/**
 * Aho-Corasick algorithm implementation for multi-pattern matching
 * Optimized for prompt injection detection patterns
 */

import type { InjectionPattern, PatternMatch } from './types.js'

/**
 * Trie node for Aho-Corasick automaton
 */
interface TrieNode {
  char: string | null
  children: Map<string, TrieNode>
  isEndOfWord: boolean
  patterns: InjectionPattern[]
  failure: TrieNode | null
  output: InjectionPattern[]
}

/**
 * Aho-Corasick automaton for fast multi-pattern matching
 */
export class AhoCorasick {
  private root: TrieNode
  private compiled = false

  constructor() {
    this.root = this.createNode(null)
  }

  /**
   * Create a new trie node
   */
  private createNode(char: string | null): TrieNode {
    return {
      char,
      children: new Map(),
      isEndOfWord: false,
      patterns: [],
      failure: null,
      output: []
    }
  }

  /**
   * Add patterns to the automaton
   */
  addPatterns(patterns: InjectionPattern[]): void {
    if (this.compiled) {
      throw new Error('Cannot add patterns after compilation')
    }

    for (const pattern of patterns) {
      this.addPattern(pattern)
    }
  }

  /**
   * Add a single pattern to the trie
   */
  private addPattern(pattern: InjectionPattern): void {
    // Convert regex to string patterns for AC algorithm
    const patternStrings = this.extractStringPatterns(pattern)
    
    for (const str of patternStrings) {
      let node = this.root
      
      for (const char of str.toLowerCase()) {
        if (!node.children.has(char)) {
          node.children.set(char, this.createNode(char))
        }
        node = node.children.get(char)!
      }
      
      node.isEndOfWord = true
      node.patterns.push(pattern)
    }
  }

  /**
   * Extract string patterns from regex for AC algorithm
   * This is a simplified approach - for full regex support, we'd need more complex parsing
   */
  private extractStringPatterns(pattern: InjectionPattern): string[] {
    const source = pattern.pattern.source.toLowerCase()
    
    // Simple extraction of literal strings from regex
    // Remove regex metacharacters and extract core terms
    const cleaned = source
      .replace(/[\\^$.*+?()[\]{}|]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
    
    if (!cleaned) return []
    
    // Split into words and filter out short ones
    const words = cleaned.split(' ').filter(word => word.length >= 3)
    
    // For critical patterns, use the whole cleaned string
    if (pattern.severity === 'critical' && cleaned.length >= 5) {
      return [cleaned, ...words]
    }
    
    return words
  }

  /**
   * Build failure links for the automaton
   */
  compile(): void {
    if (this.compiled) return
    
    this.buildFailureLinks()
    this.buildOutputLinks()
    this.compiled = true
  }

  /**
   * Build failure links using BFS
   */
  private buildFailureLinks(): void {
    const queue: TrieNode[] = []
    
    // Set failure links for depth 1 nodes
    for (const child of this.root.children.values()) {
      child.failure = this.root
      queue.push(child)
    }
    
    // BFS to build failure links
    while (queue.length > 0) {
      const current = queue.shift()!
      
      for (const [char, child] of current.children) {
        queue.push(child)
        
        // Find the longest proper suffix
        let failure = current.failure
        while (failure !== null && !failure.children.has(char)) {
          failure = failure.failure
        }
        
        if (failure !== null) {
          child.failure = failure.children.get(char)!
        } else {
          child.failure = this.root
        }
      }
    }
  }

  /**
   * Build output links for pattern matching
   */
  private buildOutputLinks(): void {
    const queue: TrieNode[] = [this.root]
    
    while (queue.length > 0) {
      const current = queue.shift()!
      
      // Copy patterns from failure link
      if (current.failure && current.failure.patterns.length > 0) {
        current.output = [...current.patterns, ...current.failure.output]
      } else {
        current.output = [...current.patterns]
      }
      
      // Add children to queue
      for (const child of current.children.values()) {
        queue.push(child)
      }
    }
  }

  /**
   * Search for all patterns in the text
   */
  search(text: string): PatternMatch[] {
    if (!this.compiled) {
      this.compile()
    }

    const matches: PatternMatch[] = []
    const lowerText = text.toLowerCase()
    let currentNode = this.root

    for (let i = 0; i < lowerText.length; i++) {
      const char = lowerText[i]
      
      // Follow failure links until we find a valid transition
      while (currentNode !== this.root && !currentNode.children.has(char)) {
        currentNode = currentNode.failure!
      }
      
      // Make transition if possible
      if (currentNode.children.has(char)) {
        currentNode = currentNode.children.get(char)!
      }
      
      // Check for matches at current position
      if (currentNode.output.length > 0) {
        for (const pattern of currentNode.output) {
          // Verify the match using the original regex
          const match = this.verifyMatch(text, pattern, i)
          if (match) {
            matches.push(match)
          }
        }
      }
    }

    return this.deduplicateMatches(matches)
  }

  /**
   * Verify match using original regex pattern
   */
  private verifyMatch(
    text: string,
    pattern: InjectionPattern,
    endIndex: number
  ): PatternMatch | null {
    // Create a window around the detected position
    const windowSize = 50
    const start = Math.max(0, endIndex - windowSize)
    const end = Math.min(text.length, endIndex + windowSize)
    const window = text.slice(start, end)
    
    // Reset regex state
    pattern.pattern.lastIndex = 0
    
    const match = pattern.pattern.exec(window)
    if (match) {
      const actualIndex = start + match.index
      return {
        pattern: pattern.id,
        index: actualIndex,
        match: match[0],
        severity: pattern.severity,
        category: pattern.category,
        confidence: pattern.weight,
      }
    }
    
    return null
  }

  /**
   * Remove duplicate matches (same pattern at same position)
   */
  private deduplicateMatches(matches: PatternMatch[]): PatternMatch[] {
    const seen = new Set<string>()
    const unique: PatternMatch[] = []
    
    for (const match of matches) {
      const key = `${match.pattern}:${match.index}:${match.match}`
      if (!seen.has(key)) {
        seen.add(key)
        unique.push(match)
      }
    }
    
    return unique
  }

  /**
   * Get statistics about the automaton
   */
  getStats(): {
    nodeCount: number
    patternCount: number
    compiled: boolean
  } {
    let nodeCount = 0
    let patternCount = 0
    
    const countNodes = (node: TrieNode) => {
      nodeCount++
      patternCount += node.patterns.length
      for (const child of node.children.values()) {
        countNodes(child)
      }
    }
    
    countNodes(this.root)
    
    return {
      nodeCount,
      patternCount,
      compiled: this.compiled
    }
  }
}

/**
 * Pre-compiled automaton cache
 */
const automatonCache = new Map<string, AhoCorasick>()

/**
 * Create or get cached Aho-Corasick automaton
 */
export function createOptimizedDetector(patterns: InjectionPattern[]): AhoCorasick {
  // Create cache key from pattern IDs
  const cacheKey = patterns.map(p => p.id).sort().join(',')
  
  if (automatonCache.has(cacheKey)) {
    return automatonCache.get(cacheKey)!
  }
  
  const automaton = new AhoCorasick()
  automaton.addPatterns(patterns)
  automaton.compile()
  
  automatonCache.set(cacheKey, automaton)
  return automaton
}

/**
 * Fast multi-pattern detection using Aho-Corasick
 */
export function detectMultiplePatterns(
  text: string,
  patterns: InjectionPattern[],
  options?: {
    maxMatches?: number
    severityFilter?: InjectionPattern['severity'][]
  }
): PatternMatch[] {
  if (patterns.length === 0) return []
  
  // Filter patterns by severity if specified
  const filteredPatterns = options?.severityFilter
    ? patterns.filter(p => options.severityFilter!.includes(p.severity))
    : patterns
  
  if (filteredPatterns.length === 0) return []
  
  const automaton = createOptimizedDetector(filteredPatterns)
  const matches = automaton.search(text)
  
  // Limit matches if specified
  if (options?.maxMatches && matches.length > options.maxMatches) {
    // Sort by severity and confidence, take top matches
    matches.sort((a, b) => {
      const severityOrder = { critical: 4, high: 3, medium: 2, low: 1 }
      const aSeverity = severityOrder[a.severity]
      const bSeverity = severityOrder[b.severity]
      
      if (aSeverity !== bSeverity) {
        return bSeverity - aSeverity
      }
      
      return b.confidence - a.confidence
    })
    
    return matches.slice(0, options.maxMatches)
  }
  
  return matches
}

/**
 * Clear automaton cache (useful for testing)
 */
export function clearAutomatonCache(): void {
  automatonCache.clear()
}