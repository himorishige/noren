/**
 * Build-time pattern compiler for optimal runtime performance
 * Converts regex patterns into optimized data structures
 */

import type { InjectionPattern } from './types.js'

/**
 * Compiled pattern representation using TypedArrays
 */
export interface CompiledPatternSet {
  // Metadata
  version: number
  patternCount: number
  stringTableSize: number
  
  // String table (UTF-8 encoded)
  stringTable: Uint8Array
  stringOffsets: Uint32Array
  
  // Pattern metadata
  patternIds: Uint32Array      // Pattern ID hashes
  severityLevels: Uint8Array   // 0=low, 1=medium, 2=high, 3=critical  
  weights: Uint8Array          // Weight values (0-100)
  categories: Uint32Array      // Category name hashes
  flags: Uint8Array           // Boolean flags (sanitize, etc.)
  
  // Trie data for fast matching
  trieNodes: Uint32Array      // Node data: [char_code, first_child, next_sibling, is_end, pattern_idx]
  trieRoot: number            // Root node index
  
  // Lookup tables for O(1) access
  charToNodes: Map<number, number[]>  // Character to node indices
  patternLookup: Map<string, number>  // Pattern ID to index
}

/**
 * String hash function (simple FNV-1a)
 */
function hashString(str: string): number {
  let hash = 2166136261
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0 // Ensure unsigned 32-bit
}

/**
 * Encode string to UTF-8 bytes
 */
function encodeString(str: string): Uint8Array {
  return new TextEncoder().encode(str)
}

/**
 * Build string table for space-efficient storage
 */
function buildStringTable(strings: string[]): {
  table: Uint8Array
  offsets: Uint32Array
} {
  const encoder = new TextEncoder()
  const chunks: Uint8Array[] = []
  const offsets: number[] = []
  let totalSize = 0
  
  for (const str of strings) {
    offsets.push(totalSize)
    const encoded = encoder.encode(str + '\0') // Null-terminated
    chunks.push(encoded)
    totalSize += encoded.length
  }
  
  // Combine all chunks
  const table = new Uint8Array(totalSize)
  let position = 0
  for (const chunk of chunks) {
    table.set(chunk, position)
    position += chunk.length
  }
  
  return {
    table,
    offsets: new Uint32Array(offsets)
  }
}

/**
 * Extract literal strings from regex patterns for trie construction
 */
function extractLiterals(pattern: InjectionPattern): string[] {
  const source = pattern.pattern.source.toLowerCase()
  
  // Simple literal extraction (can be enhanced for full regex parsing)
  const literals: string[] = []
  
  // Remove common regex metacharacters and extract words
  const cleaned = source
    .replace(/[\\^$.*+?()[\]{}|]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  
  if (cleaned.length >= 3) {
    // Split into meaningful tokens
    const tokens = cleaned.split(' ').filter(token => token.length >= 3)
    literals.push(...tokens)
    
    // Also include the whole cleaned string if it's meaningful
    if (cleaned.length >= 5 && cleaned.length <= 50) {
      literals.push(cleaned)
    }
  }
  
  // Extract quoted literals (more accurate)
  const quotedMatches = source.match(/'([^']+)'|"([^"]+)"/g)
  if (quotedMatches) {
    for (const match of quotedMatches) {
      const literal = match.slice(1, -1) // Remove quotes
      if (literal.length >= 2) {
        literals.push(literal.toLowerCase())
      }
    }
  }
  
  return [...new Set(literals)] // Remove duplicates
}

/**
 * Build optimized trie structure
 */
function buildTrie(patterns: InjectionPattern[]): {
  nodes: Uint32Array
  root: number
  charToNodes: Map<number, number[]>
  patternLookup: Map<string, number>
} {
  interface TrieNode {
    char: number
    children: Map<number, TrieNode>
    isEnd: boolean
    patternIndex: number
    index: number
  }
  
  const root: TrieNode = {
    char: 0,
    children: new Map(),
    isEnd: false,
    patternIndex: -1,
    index: 0
  }
  
  const allNodes: TrieNode[] = [root]
  let nodeIndex = 1
  
  // Build trie from pattern literals
  for (let patternIdx = 0; patternIdx < patterns.length; patternIdx++) {
    const pattern = patterns[patternIdx]
    const literals = extractLiterals(pattern)
    
    for (const literal of literals) {
      let current = root
      
      for (const char of literal) {
        const charCode = char.charCodeAt(0)
        
        if (!current.children.has(charCode)) {
          const newNode: TrieNode = {
            char: charCode,
            children: new Map(),
            isEnd: false,
            patternIndex: -1,
            index: nodeIndex++
          }
          current.children.set(charCode, newNode)
          allNodes.push(newNode)
        }
        
        current = current.children.get(charCode)!
      }
      
      current.isEnd = true
      current.patternIndex = patternIdx
    }
  }
  
  // Convert to TypedArray format
  // Each node: [char_code, first_child_idx, next_sibling_idx, is_end, pattern_idx]
  const nodeData = new Uint32Array(allNodes.length * 5)
  const charToNodes = new Map<number, number[]>()
  const patternLookup = new Map<string, number>()
  
  for (let i = 0; i < allNodes.length; i++) {
    const node = allNodes[i]
    const offset = i * 5
    
    nodeData[offset] = node.char
    nodeData[offset + 1] = 0 // first_child (to be filled)
    nodeData[offset + 2] = 0 // next_sibling (to be filled)
    nodeData[offset + 3] = node.isEnd ? 1 : 0
    nodeData[offset + 4] = node.patternIndex
    
    // Build character lookup
    if (node.char > 0) {
      if (!charToNodes.has(node.char)) {
        charToNodes.set(node.char, [])
      }
      charToNodes.get(node.char)!.push(i)
    }
    
    // Build pattern lookup
    if (node.isEnd && node.patternIndex >= 0) {
      patternLookup.set(patterns[node.patternIndex].id, i)
    }
  }
  
  // Fill in child/sibling relationships
  for (let i = 0; i < allNodes.length; i++) {
    const node = allNodes[i]
    const offset = i * 5
    
    if (node.children.size > 0) {
      const childIndices = Array.from(node.children.values()).map(child => child.index)
      nodeData[offset + 1] = Math.min(...childIndices) // first child
      
      // Link siblings
      const sortedChildren = childIndices.sort((a, b) => a - b)
      for (let j = 0; j < sortedChildren.length - 1; j++) {
        const currentIdx = sortedChildren[j]
        const nextIdx = sortedChildren[j + 1]
        nodeData[currentIdx * 5 + 2] = nextIdx // next sibling
      }
    }
  }
  
  return {
    nodes: nodeData,
    root: 0,
    charToNodes,
    patternLookup
  }
}

/**
 * Compile patterns into optimized format
 */
export function compilePatterns(patterns: InjectionPattern[]): CompiledPatternSet {
  // Extract all strings for table
  const allStrings: string[] = []
  const patternIds: string[] = []
  const categories: string[] = []
  
  for (const pattern of patterns) {
    patternIds.push(pattern.id)
    allStrings.push(pattern.id)
    
    if (!categories.includes(pattern.category)) {
      categories.push(pattern.category)
      allStrings.push(pattern.category)
    }
  }
  
  // Build string table
  const { table: stringTable, offsets: stringOffsets } = buildStringTable(allStrings)
  
  // Build metadata arrays
  const patternCount = patterns.length
  const patternIdHashes = new Uint32Array(patternCount)
  const severityLevels = new Uint8Array(patternCount)
  const weights = new Uint8Array(patternCount)
  const categoryHashes = new Uint32Array(patternCount)
  const flags = new Uint8Array(patternCount)
  
  const severityMap = { low: 0, medium: 1, high: 2, critical: 3 }
  
  for (let i = 0; i < patterns.length; i++) {
    const pattern = patterns[i]
    
    patternIdHashes[i] = hashString(pattern.id)
    severityLevels[i] = severityMap[pattern.severity]
    weights[i] = Math.min(100, Math.max(0, pattern.weight))
    categoryHashes[i] = hashString(pattern.category)
    flags[i] = pattern.sanitize ? 1 : 0
  }
  
  // Build trie
  const { nodes: trieNodes, root: trieRoot, charToNodes, patternLookup } = buildTrie(patterns)
  
  return {
    version: 1,
    patternCount,
    stringTableSize: stringTable.length,
    
    stringTable,
    stringOffsets,
    
    patternIds: patternIdHashes,
    severityLevels,
    weights,
    categories: categoryHashes,
    flags,
    
    trieNodes,
    trieRoot,
    
    charToNodes,
    patternLookup
  }
}

/**
 * Fast pattern matcher using compiled data
 */
export class CompiledPatternMatcher {
  private compiled: CompiledPatternSet
  private decoder = new TextDecoder()
  
  constructor(compiled: CompiledPatternSet) {
    this.compiled = compiled
  }
  
  /**
   * Get string from table by offset
   */
  private getString(offset: number): string {
    let length = 0
    for (let i = offset; i < this.compiled.stringTable.length; i++) {
      if (this.compiled.stringTable[i] === 0) break
      length++
    }
    
    const slice = this.compiled.stringTable.slice(offset, offset + length)
    return this.decoder.decode(slice)
  }
  
  /**
   * Search for patterns in text using compiled trie
   */
  search(text: string): Array<{
    patternIndex: number
    position: number
    length: number
    severity: string
    weight: number
  }> {
    const results: Array<{
      patternIndex: number
      position: number
      length: number
      severity: string
      weight: number
    }> = []
    
    const severityNames = ['low', 'medium', 'high', 'critical']
    const lowerText = text.toLowerCase()
    
    // Simple trie traversal (can be optimized further)
    for (let i = 0; i < lowerText.length; i++) {
      let nodeIdx = this.compiled.trieRoot
      let matchLength = 0
      
      for (let j = i; j < lowerText.length; j++) {
        const charCode = lowerText.charCodeAt(j)
        let found = false
        
        // Find child with matching character
        const firstChild = this.compiled.trieNodes[nodeIdx * 5 + 1]
        if (firstChild > 0) {
          let childIdx = firstChild
          
          while (childIdx > 0) {
            const childChar = this.compiled.trieNodes[childIdx * 5]
            if (childChar === charCode) {
              nodeIdx = childIdx
              matchLength = j - i + 1
              found = true
              break
            }
            childIdx = this.compiled.trieNodes[childIdx * 5 + 2] // next sibling
          }
        }
        
        if (!found) break
        
        // Check if this is an end node
        const isEnd = this.compiled.trieNodes[nodeIdx * 5 + 3]
        if (isEnd) {
          const patternIdx = this.compiled.trieNodes[nodeIdx * 5 + 4]
          if (patternIdx >= 0) {
            results.push({
              patternIndex: patternIdx,
              position: i,
              length: matchLength,
              severity: severityNames[this.compiled.severityLevels[patternIdx]],
              weight: this.compiled.weights[patternIdx]
            })
          }
        }
      }
    }
    
    return results
  }
  
  /**
   * Get pattern info by index
   */
  getPatternInfo(index: number): {
    id: string
    severity: string
    weight: number
    category: string
    sanitize: boolean
  } | null {
    if (index < 0 || index >= this.compiled.patternCount) {
      return null
    }
    
    const severityNames = ['low', 'medium', 'high', 'critical']
    
    return {
      id: this.getString(this.compiled.stringOffsets[index]),
      severity: severityNames[this.compiled.severityLevels[index]],
      weight: this.compiled.weights[index],
      category: this.getString(this.compiled.stringOffsets[index + this.compiled.patternCount]),
      sanitize: this.compiled.flags[index] === 1
    }
  }
  
  /**
   * Get statistics about compiled patterns
   */
  getStats(): {
    patternCount: number
    trieNodeCount: number
    stringTableSize: number
    totalSize: number
  } {
    const trieNodeCount = this.compiled.trieNodes.length / 5
    const totalSize = 
      this.compiled.stringTable.byteLength +
      this.compiled.stringOffsets.byteLength +
      this.compiled.patternIds.byteLength +
      this.compiled.severityLevels.byteLength +
      this.compiled.weights.byteLength +
      this.compiled.categories.byteLength +
      this.compiled.flags.byteLength +
      this.compiled.trieNodes.byteLength
    
    return {
      patternCount: this.compiled.patternCount,
      trieNodeCount,
      stringTableSize: this.compiled.stringTableSize,
      totalSize
    }
  }
}

/**
 * Serialize compiled patterns to binary format
 */
export function serializeCompiledPatterns(compiled: CompiledPatternSet): Uint8Array {
  // Calculate total size
  const headerSize = 32 // version, counts, offsets
  const totalSize = 
    headerSize +
    compiled.stringTable.byteLength +
    compiled.stringOffsets.byteLength +
    compiled.patternIds.byteLength +
    compiled.severityLevels.byteLength +
    compiled.weights.byteLength +
    compiled.categories.byteLength +
    compiled.flags.byteLength +
    compiled.trieNodes.byteLength
  
  const buffer = new ArrayBuffer(totalSize)
  const view = new DataView(buffer)
  let offset = 0
  
  // Header
  view.setUint32(offset, compiled.version, true); offset += 4
  view.setUint32(offset, compiled.patternCount, true); offset += 4
  view.setUint32(offset, compiled.stringTableSize, true); offset += 4
  view.setUint32(offset, compiled.trieNodes.length / 5, true); offset += 4 // trie node count
  
  // Skip to data section (reserve space for offsets)
  offset = headerSize
  
  // Copy data arrays
  const arrays = [
    compiled.stringTable,
    new Uint8Array(compiled.stringOffsets.buffer),
    new Uint8Array(compiled.patternIds.buffer),
    compiled.severityLevels,
    compiled.weights,
    new Uint8Array(compiled.categories.buffer),
    compiled.flags,
    new Uint8Array(compiled.trieNodes.buffer)
  ]
  
  for (const array of arrays) {
    new Uint8Array(buffer, offset, array.length).set(array)
    offset += array.length
  }
  
  return new Uint8Array(buffer)
}

/**
 * Deserialize compiled patterns from binary format
 */
export function deserializeCompiledPatterns(data: Uint8Array): CompiledPatternSet {
  const view = new DataView(data.buffer, data.byteOffset)
  let offset = 0
  
  // Read header
  const version = view.getUint32(offset, true); offset += 4
  const patternCount = view.getUint32(offset, true); offset += 4
  const stringTableSize = view.getUint32(offset, true); offset += 4
  const trieNodeCount = view.getUint32(offset, true); offset += 4
  
  offset = 32 // Skip to data section
  
  // Extract arrays
  const stringTable = data.slice(offset, offset + stringTableSize)
  offset += stringTableSize
  
  const stringOffsets = new Uint32Array(data.buffer, data.byteOffset + offset, patternCount)
  offset += patternCount * 4
  
  const patternIds = new Uint32Array(data.buffer, data.byteOffset + offset, patternCount)
  offset += patternCount * 4
  
  const severityLevels = data.slice(offset, offset + patternCount)
  offset += patternCount
  
  const weights = data.slice(offset, offset + patternCount)
  offset += patternCount
  
  const categories = new Uint32Array(data.buffer, data.byteOffset + offset, patternCount)
  offset += patternCount * 4
  
  const flags = data.slice(offset, offset + patternCount)
  offset += patternCount
  
  const trieNodes = new Uint32Array(data.buffer, data.byteOffset + offset, trieNodeCount * 5)
  
  return {
    version,
    patternCount,
    stringTableSize,
    stringTable,
    stringOffsets,
    patternIds,
    severityLevels,
    weights,
    categories,
    flags,
    trieNodes,
    trieRoot: 0,
    charToNodes: new Map(), // Rebuild if needed
    patternLookup: new Map() // Rebuild if needed
  }
}