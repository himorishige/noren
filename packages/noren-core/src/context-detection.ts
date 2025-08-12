/**
 * Lightweight context detection for P2 implementation
 * Provides document structure sniffing and context markers analysis
 */

/**
 * Document structure flags detected by lightweight sniffing
 */
export interface DocumentStructure {
  json_like: boolean
  xml_like: boolean
  csv_like: boolean
  md_like: boolean
  code_block: boolean
  header_row: boolean
  template_section: boolean
  log_like: boolean
}

/**
 * Context markers detected around PII patterns
 */
export interface ContextMarkers {
  example_marker_nearby: boolean
  test_marker_nearby: boolean
  sample_marker_nearby: boolean
  dummy_marker_nearby: boolean
  placeholder_marker_nearby: boolean
  distance_to_nearest_marker: number
  marker_language: 'ja' | 'en' | 'mixed' | 'unknown'
}

/**
 * Combined context features for P2
 */
export interface ContextFeatures {
  structure: DocumentStructure
  markers: ContextMarkers
  language: 'ja' | 'en' | 'mixed' | 'unknown'
  high_entropy_nearby: boolean
  repetition_detected: boolean
}

/**
 * Detect document structure using lightweight heuristics
 */
export function detectDocumentStructure(text: string): DocumentStructure {
  // Sample first and last few hundred characters for efficiency
  const sampleSize = 500
  const head = text.slice(0, sampleSize)
  const tail = text.slice(-sampleSize)
  const sample = head + '\n' + tail
  
  // Get a few lines from middle for header detection
  const lines = text.split('\n')
  const sampleLines = [
    ...lines.slice(0, 3),
    ...lines.slice(Math.floor(lines.length / 2), Math.floor(lines.length / 2) + 3),
    ...lines.slice(-3)
  ].filter(line => line.trim().length > 0)
  
  return {
    json_like: detectJSONLike(sample),
    xml_like: detectXMLLike(sample), 
    csv_like: detectCSVLike(sampleLines),
    md_like: detectMarkdownLike(sample),
    code_block: detectCodeBlock(text),
    header_row: detectHeaderRow(sampleLines),
    template_section: detectTemplateSection(sample),
    log_like: detectLogLike(sampleLines)
  }
}

/**
 * Detect context markers around a specific position
 */
export function detectContextMarkers(text: string, position: number): ContextMarkers {
  const windowSize = 64 // Characters before/after to examine
  const start = Math.max(0, position - windowSize)
  const end = Math.min(text.length, position + windowSize)
  const context = text.slice(start, end).toLowerCase()
  
  // Line-level context (same line as the match)
  const lineStart = text.lastIndexOf('\n', position) + 1
  const lineEnd = text.indexOf('\n', position)
  const lineContext = text.slice(lineStart, lineEnd === -1 ? text.length : lineEnd).toLowerCase()
  
  // Define markers by language
  const enMarkers = {
    example: ['example:', 'example', 'e.g.', 'for example', 'examples'],
    test: ['test:', 'test', 'testing', 'test case', 'unit test'],
    sample: ['sample:', 'sample', 'samples', 'sample data'],
    dummy: ['dummy:', 'dummy', 'mock', 'fake', 'placeholder'],
    placeholder: ['placeholder', 'xxx', 'yyy', 'zzz', 'todo', 'tbd', 'fixme']
  }
  
  const jaMarkers = {
    example: ['例:', '例', 'れい', '例示', '事例'],
    test: ['テスト:', 'テスト', '試験', 'ﾃｽﾄ', '検証'],
    sample: ['サンプル:', 'サンプル', '見本', 'ｻﾝﾌﾟﾙ'],
    dummy: ['ダミー:', 'ダミー', '偽', 'ﾀﾞﾐｰ', '仮'],
    placeholder: ['プレースホルダ', '置換子', '仮置き', '未定']
  }
  
  let nearestDistance = Infinity
  const results = {
    example_marker_nearby: false,
    test_marker_nearby: false, 
    sample_marker_nearby: false,
    dummy_marker_nearby: false,
    placeholder_marker_nearby: false
  }
  
  let hasJaMarkers = false
  let hasEnMarkers = false
  
  // Check for markers
  for (const [category, markers] of Object.entries(enMarkers)) {
    for (const marker of markers) {
      // Check line context first (higher priority - same line)
      if (lineContext.includes(marker)) {
        results[`${category}_marker_nearby` as keyof typeof results] = true
        nearestDistance = Math.min(nearestDistance, 0) // Same line = 0 distance
        hasEnMarkers = true
        continue // Skip window check if found in same line
      }
      
      // Check window context
      const idx = context.indexOf(marker)
      if (idx !== -1) {
        results[`${category}_marker_nearby` as keyof typeof results] = true
        nearestDistance = Math.min(nearestDistance, Math.abs(idx - windowSize))
        hasEnMarkers = true
      }
    }
  }
  
  for (const [category, markers] of Object.entries(jaMarkers)) {
    for (const marker of markers) {
      // Check line context first (higher priority - same line)
      if (lineContext.includes(marker)) {
        results[`${category}_marker_nearby` as keyof typeof results] = true
        nearestDistance = Math.min(nearestDistance, 0) // Same line = 0 distance
        hasJaMarkers = true
        continue // Skip window check if found in same line
      }
      
      // Check window context
      const idx = context.indexOf(marker)
      if (idx !== -1) {
        results[`${category}_marker_nearby` as keyof typeof results] = true
        nearestDistance = Math.min(nearestDistance, Math.abs(idx - windowSize))
        hasJaMarkers = true
      }
    }
  }
  
  const markerLanguage = hasJaMarkers && hasEnMarkers ? 'mixed' :
                        hasJaMarkers ? 'ja' :
                        hasEnMarkers ? 'en' : 'unknown'
  
  return {
    ...results,
    distance_to_nearest_marker: nearestDistance === Infinity ? -1 : nearestDistance,
    marker_language: markerLanguage
  }
}

/**
 * Combine all context features for a specific position
 */
export function extractContextFeatures(text: string, position: number): ContextFeatures {
  const structure = detectDocumentStructure(text)
  const markers = detectContextMarkers(text, position)
  
  // Simple language detection based on character patterns
  const language = detectLanguage(text)
  
  // Check for high entropy patterns nearby
  const high_entropy_nearby = detectHighEntropyNearby(text, position)
  
  // Check for repetitive patterns
  const repetition_detected = detectRepetition(text, position)
  
  return {
    structure,
    markers,
    language,
    high_entropy_nearby,
    repetition_detected
  }
}

// Helper functions for structure detection

function detectJSONLike(text: string): boolean {
  const cleaned = text.replace(/\s+/g, ' ').trim()
  
  // Basic JSON structure indicators
  const hasBraces = cleaned.includes('{') && cleaned.includes('}')
  const hasBrackets = cleaned.includes('[') && cleaned.includes(']')
  const hasColons = (cleaned.match(/:/g) || []).length > 0
  const hasQuotes = (cleaned.match(/"/g) || []).length > 1
  
  // Simple key:value ratio check
  const colonCount = (cleaned.match(/:/g) || []).length
  const braceCount = (cleaned.match(/[{}]/g) || []).length
  
  return (hasBraces || hasBrackets) && hasColons && hasQuotes && colonCount > 0 && braceCount > 0
}

function detectXMLLike(text: string): boolean {
  const tagPattern = /<[^>]+>/g
  const tags = text.match(tagPattern) || []
  
  if (tags.length < 2) return false
  
  // Check for balanced tags
  const openTags = tags.filter(tag => !tag.startsWith('</') && !tag.endsWith('/>')).length
  const closeTags = tags.filter(tag => tag.startsWith('</')).length
  const selfClosing = tags.filter(tag => tag.endsWith('/>')).length
  
  return openTags > 0 && (closeTags > 0 || selfClosing > 0)
}

function detectCSVLike(lines: string[]): boolean {
  if (lines.length < 2) return false
  
  // Check for consistent delimiters
  const delimiters = [',', '\t', ';', '|']
  
  for (const delimiter of delimiters) {
    const counts = lines.slice(0, 5).map(line => 
      (line.match(new RegExp(`\\${delimiter}`, 'g')) || []).length
    ).filter(count => count > 0)
    
    if (counts.length >= 2) {
      // Check if delimiter counts are consistent
      const avgCount = counts.reduce((a, b) => a + b) / counts.length
      const variance = counts.reduce((acc, count) => acc + Math.pow(count - avgCount, 2), 0) / counts.length
      
      if (variance < 2 && avgCount > 1) return true
    }
  }
  
  return false
}

function detectMarkdownLike(text: string): boolean {
  const mdPatterns = [
    /^#{1,6}\s+/m,  // Headers
    /```[\s\S]*?```/g,  // Code blocks
    /`[^`]+`/g,  // Inline code
    /\*\*[^*]+\*\*/g,  // Bold
    /\*[^*]+\*/g,  // Italic
    /^\s*[-*+]\s+/m,  // Lists
    /^\s*\d+\.\s+/m,  // Numbered lists
    /\[([^\]]+)\]\([^)]+\)/g  // Links
  ]
  
  return mdPatterns.some(pattern => pattern.test(text))
}

function detectCodeBlock(text: string): boolean {
  // Look for code block markers
  const codeBlockPatterns = [
    /```[\s\S]*?```/g,  // Markdown fenced code
    /~~~[\s\S]*?~~~/g,  // Alternative fenced code
    /^\s{4,}/m,  // Indented code
    /<pre[\s\S]*?<\/pre>/gi,  // HTML pre tags
    /<code[\s\S]*?<\/code>/gi  // HTML code tags
  ]
  
  return codeBlockPatterns.some(pattern => pattern.test(text))
}

function detectHeaderRow(lines: string[]): boolean {
  if (lines.length < 2) return false
  
  const firstLine = lines[0]
  const secondLine = lines[1]
  
  // Check if first line looks like headers
  const headerIndicators = [
    /^[A-Za-z_][A-Za-z0-9_]*(\s*[,|\t]\s*[A-Za-z_][A-Za-z0-9_]*)+$/,  // CSV headers
    /name|id|email|phone|address|date|time|user|customer|product/i,  // Common header words
    /^[^0-9]*$/  // Non-numeric (headers usually aren't pure numbers)
  ]
  
  const isHeaderLike = headerIndicators.some(pattern => pattern.test(firstLine))
  
  // Check if second line looks like data
  const hasNumbers = /\d/.test(secondLine)
  const hasData = secondLine.length > firstLine.length * 0.3
  
  return isHeaderLike && hasNumbers && hasData
}

function detectTemplateSection(text: string): boolean {
  const templatePatterns = [
    /{{[^}]+}}/g,  // Handlebars/Mustache
    /{%[^%]+%}/g,  // Django/Jinja2
    /\$\{[^}]+\}/g,  // Template literals
    /\[\[[^\]]+\]\]/g,  // Wiki-style
    /%[A-Za-z_][A-Za-z0-9_]*%/g,  // Batch/environment variables
    /\{[A-Za-z_][A-Za-z0-9_]*\}/g,  // Simple placeholders
  ]
  
  return templatePatterns.some(pattern => (text.match(pattern) || []).length > 0)
}

function detectLogLike(lines: string[]): boolean {
  const logPatterns = [
    /^\d{4}-\d{2}-\d{2}[\s\T]\d{2}:\d{2}:\d{2}/,  // ISO timestamp
    /^\d{2}\/\d{2}\/\d{4}\s+\d{2}:\d{2}:\d{2}/,  // US timestamp
    /^\[.*?\]/,  // Bracketed info
    /(ERROR|WARN|INFO|DEBUG|TRACE|FATAL)/i,  // Log levels
    /\s(GET|POST|PUT|DELETE|PATCH)\s/,  // HTTP methods
    /\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/  // IP addresses
  ]
  
  const logLikeLines = lines.filter(line => 
    logPatterns.some(pattern => pattern.test(line))
  )
  
  return logLikeLines.length / lines.length > 0.3
}

function detectLanguage(text: string): 'ja' | 'en' | 'mixed' | 'unknown' {
  // Simple heuristic based on character sets
  const hasHiragana = /[\u3040-\u309f]/.test(text)
  const hasKatakana = /[\u30a0-\u30ff]/.test(text)
  const hasKanji = /[\u4e00-\u9faf]/.test(text)
  const hasJapanese = hasHiragana || hasKatakana || hasKanji
  
  const hasAscii = /[a-zA-Z]/.test(text)
  
  if (hasJapanese && hasAscii) return 'mixed'
  if (hasJapanese) return 'ja'
  if (hasAscii) return 'en'
  return 'unknown'
}

function detectHighEntropyNearby(text: string, position: number): boolean {
  const windowSize = 32
  const start = Math.max(0, position - windowSize)
  const end = Math.min(text.length, position + windowSize)
  const context = text.slice(start, end)
  
  // Calculate character diversity
  const uniqueChars = new Set(context).size
  const entropy = uniqueChars / context.length
  
  // Look for patterns that indicate high-value data
  const highValuePatterns = [
    /[a-fA-F0-9]{32,}/,  // Hex strings (hashes, tokens)
    /[A-Za-z0-9+/]{20,}={0,2}/,  // Base64-like
    /-----BEGIN/,  // PEM headers
    /[A-Z0-9]{8,}/,  // All caps alphanumeric
    /[a-z0-9]{16,}/,  // Long lowercase alphanumeric
  ]
  
  const hasHighValuePattern = highValuePatterns.some(pattern => pattern.test(context))
  
  return entropy > 0.7 || hasHighValuePattern
}

function detectRepetition(text: string, position: number): boolean {
  const windowSize = 50
  const start = Math.max(0, position - windowSize)
  const end = Math.min(text.length, position + windowSize)
  const context = text.slice(start, end)
  
  // Look for repeated patterns
  const words = context.toLowerCase().match(/\b\w+\b/g) || []
  const wordCounts = new Map<string, number>()
  
  for (const word of words) {
    wordCounts.set(word, (wordCounts.get(word) || 0) + 1)
  }
  
  // Check for high repetition
  const maxCount = Math.max(...wordCounts.values())
  const totalWords = words.length
  
  return maxCount / totalWords > 0.5
}