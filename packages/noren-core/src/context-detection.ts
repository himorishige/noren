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
 * Enhanced document structure with validation confidence
 */
export interface ValidatedDocumentStructure extends DocumentStructure {
  validation: {
    json_confidence: number // 0-1: How confident we are it's valid JSON
    xml_confidence: number // 0-1: How confident we are it's valid XML
    csv_confidence: number // 0-1: How confident we are it's valid CSV
    format_errors: string[] // List of detected format issues
    recovery_suggestions: string[] // Suggested fallback interpretations
    validation_warnings: ValidationWarning[] // Structured warnings about validation limitations
  }
}

/**
 * Structured warning about validation limitations
 */
export interface ValidationWarning {
  type: 'accuracy' | 'completeness' | 'performance' | 'compatibility'
  severity: 'low' | 'medium' | 'high'
  message: string
  details?: string
  recommendation?: string
  affected_format: 'json' | 'xml' | 'csv' | 'all'
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
  // P2-Sprint2: Locale-specific placeholders
  date_placeholder_nearby: boolean
  currency_placeholder_nearby: boolean
  address_placeholder_nearby: boolean
  phone_placeholder_nearby: boolean
  name_placeholder_nearby: boolean
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
  const sample = `${head}\n${tail}`

  // Get a few lines from middle for header detection
  const lines = text.split('\n')
  const sampleLines = [
    ...lines.slice(0, 3),
    ...lines.slice(Math.floor(lines.length / 2), Math.floor(lines.length / 2) + 3),
    ...lines.slice(-3),
  ].filter((line) => line.trim().length > 0)

  return {
    json_like: detectJSONLike(sample),
    xml_like: detectXMLLike(sample),
    csv_like: detectCSVLike(sampleLines),
    md_like: detectMarkdownLike(sample),
    code_block: detectCodeBlock(text),
    header_row: detectHeaderRow(sampleLines),
    template_section: detectTemplateSection(sample),
    log_like: detectLogLike(sampleLines),
  }
}

/**
 * Add general validation warnings about heuristic detection limitations
 */
function addValidationWarnings(
  warnings: ValidationWarning[],
  text: string,
  structure: DocumentStructure,
): void {
  const textLength = text.length

  // Warn about performance limitations for very large texts
  if (textLength > 100000) {
    warnings.push({
      type: 'performance',
      severity: 'medium',
      message: 'Large document size may affect validation accuracy and performance',
      details: `Document size: ${(textLength / 1024).toFixed(1)}KB`,
      recommendation: 'Consider processing smaller chunks for better accuracy',
      affected_format: 'all',
    })
  }

  // Warn about multiple format detection
  const formatCount = [structure.json_like, structure.xml_like, structure.csv_like].filter(
    Boolean,
  ).length
  if (formatCount > 1) {
    warnings.push({
      type: 'accuracy',
      severity: 'low',
      message: 'Multiple document formats detected - validation may be ambiguous',
      details: 'Document appears to contain mixed or nested formats',
      recommendation: 'Verify the intended format and validate accordingly',
      affected_format: 'all',
    })
  }

  // Warn about heuristic nature of detection
  if (structure.json_like || structure.xml_like || structure.csv_like) {
    warnings.push({
      type: 'completeness',
      severity: 'low',
      message: 'Document format detection uses heuristics and may not catch all edge cases',
      details: 'Basic pattern matching is used instead of full parsing',
      recommendation: 'Use dedicated parsers for mission-critical validation',
      affected_format: 'all',
    })
  }

  // Warn about encoding assumptions
  // biome-ignore lint/suspicious/noControlCharactersInRegex: Intentionally checking for control characters in text encoding validation
  if (text.includes('\ufffd') || /[\x00-\x08\x0E-\x1F\x7F]/.test(text)) {
    warnings.push({
      type: 'compatibility',
      severity: 'medium',
      message: 'Potential encoding issues detected in document',
      details: 'Non-printable characters or replacement characters found',
      recommendation: 'Verify document encoding before processing',
      affected_format: 'all',
    })
  }
}

/**
 * P2-Sprint2: Enhanced document structure detection with validation
 */
export function validateDocumentStructure(text: string): ValidatedDocumentStructure {
  const basic = detectDocumentStructure(text)
  const validation = {
    json_confidence: 0,
    xml_confidence: 0,
    csv_confidence: 0,
    format_errors: [] as string[],
    recovery_suggestions: [] as string[],
    validation_warnings: [] as ValidationWarning[],
  }

  // Add general validation warnings about heuristic limitations
  addValidationWarnings(validation.validation_warnings, text, basic)

  // Validate JSON if detected
  if (basic.json_like) {
    const jsonValidation = validateJSON(text)
    validation.json_confidence = jsonValidation.confidence
    validation.format_errors.push(...jsonValidation.errors)
    validation.recovery_suggestions.push(...jsonValidation.suggestions)

    // Add JSON-specific warnings
    if (jsonValidation.confidence < 0.8) {
      validation.validation_warnings.push({
        type: 'accuracy',
        severity: 'medium',
        message:
          'JSON structure validation is based on heuristics and may miss complex syntax errors',
        details: `Confidence level: ${(jsonValidation.confidence * 100).toFixed(1)}%`,
        recommendation:
          'For critical applications, consider using a full JSON parser for validation',
        affected_format: 'json',
      })
    }
  }

  // Validate XML if detected
  if (basic.xml_like) {
    const xmlValidation = validateXML(text)
    validation.xml_confidence = xmlValidation.confidence
    validation.format_errors.push(...xmlValidation.errors)
    validation.recovery_suggestions.push(...xmlValidation.suggestions)

    // Add XML-specific warnings
    if (xmlValidation.confidence < 0.7) {
      validation.validation_warnings.push({
        type: 'completeness',
        severity: 'medium',
        message: 'XML validation does not include DTD, schema, or namespace validation',
        details: `Basic structure confidence: ${(xmlValidation.confidence * 100).toFixed(1)}%`,
        recommendation: 'Use a dedicated XML parser for comprehensive validation',
        affected_format: 'xml',
      })
    }
  }

  // Validate CSV if detected
  if (basic.csv_like) {
    const csvValidation = validateCSV(text)
    validation.csv_confidence = csvValidation.confidence
    validation.format_errors.push(...csvValidation.errors)
    validation.recovery_suggestions.push(...csvValidation.suggestions)

    // Add CSV-specific warnings for complex cases
    if (text.includes('"') && text.includes(',')) {
      validation.validation_warnings.push({
        type: 'accuracy',
        severity: 'low',
        message: 'CSV with quoted fields may have escaping complexities not fully validated',
        recommendation: 'Consider using a dedicated CSV parser for complex quoting scenarios',
        affected_format: 'csv',
      })
    }
  }

  return {
    ...basic,
    validation,
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
    placeholder: ['placeholder', 'xxx', 'yyy', 'zzz', 'todo', 'tbd', 'fixme'],
    // P2-Sprint2: Locale-specific placeholders (English)
    date_placeholder: ['date', 'birthday', 'dob', 'YYYY-MM-DD', 'MM/DD/YYYY', 'DD/MM/YYYY'],
    currency_placeholder: ['amount', 'price', '$', 'USD', 'EUR', '€', '£', 'GBP'],
    address_placeholder: ['address', 'street', 'city', 'state', 'zip', 'postal', 'country'],
    phone_placeholder: ['phone', 'tel', 'mobile', 'cell', 'number'],
    name_placeholder: ['name', 'firstname', 'lastname', 'john', 'jane', 'smith', 'doe'],
  }

  const jaMarkers = {
    example: ['例:', '例', 'れい', '例示', '事例'],
    test: ['テスト:', 'テスト', '試験', 'ﾃｽﾄ', '検証'],
    sample: ['サンプル:', 'サンプル', '見本', 'ｻﾝﾌﾟﾙ'],
    dummy: ['ダミー:', 'ダミー', '偽', 'ﾀﾞﾐｰ', '仮'],
    placeholder: ['プレースホルダ', '置換子', '仮置き', '未定'],
    // P2-Sprint2: Locale-specific placeholders (Japanese)
    date_placeholder: ['日付', '年月日', 'YYYY/MM/DD', 'YYYY-MM-DD', '令和', '平成'],
    currency_placeholder: ['金額', '価格', '円', '¥', 'JPY'],
    address_placeholder: ['住所', '所在地', '都道府県', '市区町村', '丁目', '番地'],
    phone_placeholder: ['電話番号', 'TEL', '携帯', 'FAX'],
    name_placeholder: ['氏名', '名前', '苗字', '姓名', '田中', '佐藤', '山田'],
  }

  let nearestDistance = Infinity
  const results = {
    example_marker_nearby: false,
    test_marker_nearby: false,
    sample_marker_nearby: false,
    dummy_marker_nearby: false,
    placeholder_marker_nearby: false,
    // P2-Sprint2: Locale-specific placeholders
    date_placeholder_nearby: false,
    currency_placeholder_nearby: false,
    address_placeholder_nearby: false,
    phone_placeholder_nearby: false,
    name_placeholder_nearby: false,
  }

  let hasJaMarkers = false
  let hasEnMarkers = false

  // Check for markers
  for (const [category, markers] of Object.entries(enMarkers)) {
    for (const marker of markers) {
      // Check line context first (higher priority - same line)
      if (lineContext.includes(marker)) {
        const resultKey = category.endsWith('_placeholder')
          ? `${category}_nearby`
          : `${category}_marker_nearby`
        results[resultKey as keyof typeof results] = true
        nearestDistance = Math.min(nearestDistance, 0) // Same line = 0 distance
        hasEnMarkers = true
        continue // Skip window check if found in same line
      }

      // Check window context
      const idx = context.indexOf(marker)
      if (idx !== -1) {
        const resultKey = category.endsWith('_placeholder')
          ? `${category}_nearby`
          : `${category}_marker_nearby`
        results[resultKey as keyof typeof results] = true
        nearestDistance = Math.min(nearestDistance, Math.abs(idx - windowSize))
        hasEnMarkers = true
      }
    }
  }

  for (const [category, markers] of Object.entries(jaMarkers)) {
    for (const marker of markers) {
      // Check line context first (higher priority - same line)
      if (lineContext.includes(marker)) {
        const resultKey = category.endsWith('_placeholder')
          ? `${category}_nearby`
          : `${category}_marker_nearby`
        results[resultKey as keyof typeof results] = true
        nearestDistance = Math.min(nearestDistance, 0) // Same line = 0 distance
        hasJaMarkers = true
        continue // Skip window check if found in same line
      }

      // Check window context
      const idx = context.indexOf(marker)
      if (idx !== -1) {
        const resultKey = category.endsWith('_placeholder')
          ? `${category}_nearby`
          : `${category}_marker_nearby`
        results[resultKey as keyof typeof results] = true
        nearestDistance = Math.min(nearestDistance, Math.abs(idx - windowSize))
        hasJaMarkers = true
      }
    }
  }

  const markerLanguage =
    hasJaMarkers && hasEnMarkers ? 'mixed' : hasJaMarkers ? 'ja' : hasEnMarkers ? 'en' : 'unknown'

  return {
    ...results,
    distance_to_nearest_marker: nearestDistance === Infinity ? -1 : nearestDistance,
    marker_language: markerLanguage,
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
    repetition_detected,
  }
}

/**
 * P2-Sprint2: Enhanced context extraction with validation-aware features
 */
export function extractValidatedContextFeatures(
  text: string,
  position: number,
): ContextFeatures & {
  validatedStructure: ValidatedDocumentStructure
} {
  const basicFeatures = extractContextFeatures(text, position)
  const validatedStructure = validateDocumentStructure(text)

  return {
    ...basicFeatures,
    validatedStructure,
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
  const openTags = tags.filter((tag) => !tag.startsWith('</') && !tag.endsWith('/>')).length
  const closeTags = tags.filter((tag) => tag.startsWith('</')).length
  const selfClosing = tags.filter((tag) => tag.endsWith('/>')).length

  return openTags > 0 && (closeTags > 0 || selfClosing > 0)
}

function detectCSVLike(lines: string[]): boolean {
  if (lines.length < 2) return false

  // Check for consistent delimiters
  const delimiters = [',', '\t', ';', '|']

  for (const delimiter of delimiters) {
    const counts = lines
      .slice(0, 5)
      .map((line) => (line.match(new RegExp(`\\${delimiter}`, 'g')) || []).length)
      .filter((count) => count > 0)

    if (counts.length >= 2) {
      // Check if delimiter counts are consistent
      const avgCount = counts.reduce((a, b) => a + b) / counts.length
      const variance =
        counts.reduce((acc, count) => acc + (count - avgCount) ** 2, 0) / counts.length

      if (variance < 2 && avgCount > 1) return true
    }
  }

  return false
}

function detectMarkdownLike(text: string): boolean {
  const mdPatterns = [
    /^#{1,6}\s+/m, // Headers
    /```[\s\S]*?```/g, // Code blocks
    /`[^`]+`/g, // Inline code
    /\*\*[^*]+\*\*/g, // Bold
    /\*[^*]+\*/g, // Italic
    /^\s*[-*+]\s+/m, // Lists
    /^\s*\d+\.\s+/m, // Numbered lists
    /\[([^\]]+)\]\([^)]+\)/g, // Links
  ]

  return mdPatterns.some((pattern) => pattern.test(text))
}

function detectCodeBlock(text: string): boolean {
  // Look for code block markers
  const codeBlockPatterns = [
    /```[\s\S]*?```/g, // Markdown fenced code
    /~~~[\s\S]*?~~~/g, // Alternative fenced code
    /^\s{4,}/m, // Indented code
    /<pre[\s\S]*?<\/pre>/gi, // HTML pre tags
    /<code[\s\S]*?<\/code>/gi, // HTML code tags
  ]

  return codeBlockPatterns.some((pattern) => pattern.test(text))
}

function detectHeaderRow(lines: string[]): boolean {
  if (lines.length < 2) return false

  const firstLine = lines[0]
  const secondLine = lines[1]

  // Check if first line looks like headers
  const headerIndicators = [
    /^[A-Za-z_][A-Za-z0-9_]*(\s*[,|\t]\s*[A-Za-z_][A-Za-z0-9_]*)+$/, // CSV headers
    /name|id|email|phone|address|date|time|user|customer|product/i, // Common header words
    /^[^0-9]*$/, // Non-numeric (headers usually aren't pure numbers)
  ]

  const isHeaderLike = headerIndicators.some((pattern) => pattern.test(firstLine))

  // Check if second line looks like data
  const hasNumbers = /\d/.test(secondLine)
  const hasData = secondLine.length > firstLine.length * 0.3

  return isHeaderLike && hasNumbers && hasData
}

function detectTemplateSection(text: string): boolean {
  const templatePatterns = [
    /{{[^}]+}}/g, // Handlebars/Mustache
    /{%[^%]+%}/g, // Django/Jinja2
    /\$\{[^}]+\}/g, // Template literals
    /\[\[[^\]]+\]\]/g, // Wiki-style
    /%[A-Za-z_][A-Za-z0-9_]*%/g, // Batch/environment variables
    /\{[A-Za-z_][A-Za-z0-9_]*\}/g, // Simple placeholders
  ]

  return templatePatterns.some((pattern) => (text.match(pattern) || []).length > 0)
}

function detectLogLike(lines: string[]): boolean {
  const logPatterns = [
    /^\d{4}-\d{2}-\d{2}[\sT]\d{2}:\d{2}:\d{2}/, // ISO timestamp
    /^\d{2}\/\d{2}\/\d{4}\s+\d{2}:\d{2}:\d{2}/, // US timestamp
    /^\[.*?\]/, // Bracketed info
    /(ERROR|WARN|INFO|DEBUG|TRACE|FATAL)/i, // Log levels
    /\s(GET|POST|PUT|DELETE|PATCH)\s/, // HTTP methods
    /\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/, // IP addresses
  ]

  const logLikeLines = lines.filter((line) => logPatterns.some((pattern) => pattern.test(line)))

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
    /[a-fA-F0-9]{32,}/, // Hex strings (hashes, tokens)
    /[A-Za-z0-9+/]{20,}={0,2}/, // Base64-like
    /-----BEGIN/, // PEM headers
    /[A-Z0-9]{8,}/, // All caps alphanumeric
    /[a-z0-9]{16,}/, // Long lowercase alphanumeric
  ]

  const hasHighValuePattern = highValuePatterns.some((pattern) => pattern.test(context))

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

// P2-Sprint2: Format validation functions

interface ValidationResult {
  confidence: number // 0-1: How confident we are the format is valid
  errors: string[] // List of specific errors found
  suggestions: string[] // Recovery suggestions if errors found
}

/**
 * Validate JSON structure and content
 */
function validateJSON(text: string): ValidationResult {
  const result: ValidationResult = {
    confidence: 0,
    errors: [],
    suggestions: [],
  }

  // Try to extract JSON-like portions
  const jsonCandidates = extractJSONCandidates(text)

  if (jsonCandidates.length === 0) {
    result.errors.push('No JSON structures found despite json_like detection')
    result.suggestions.push('Treat as plain text with JSON-like patterns')
    return result
  }

  let validCount = 0
  let totalCount = 0

  for (const candidate of jsonCandidates) {
    totalCount++

    try {
      JSON.parse(candidate)
      validCount++
    } catch (error) {
      result.errors.push(`Invalid JSON: ${(error as Error).message}`)

      // Suggest recovery strategies based on common issues
      if (candidate.includes("'")) {
        result.suggestions.push('Replace single quotes with double quotes')
      }
      if (candidate.match(/\w+\s*:/)) {
        result.suggestions.push('Add quotes around unquoted keys')
      }
      if (candidate.includes(',}') || candidate.includes(',]')) {
        result.suggestions.push('Remove trailing commas')
      }
    }
  }

  result.confidence = validCount / totalCount

  // If partially valid, suggest treating as mixed content
  if (result.confidence > 0 && result.confidence < 1) {
    result.suggestions.push('Treat as mixed content with embedded JSON')
  }

  return result
}

/**
 * Validate XML structure and tag matching
 */
function validateXML(text: string): ValidationResult {
  const result: ValidationResult = {
    confidence: 0,
    errors: [],
    suggestions: [],
  }

  const tagPattern = /<([^>]+)>/g
  const tags: string[] = []
  let match = tagPattern.exec(text)

  while (match !== null) {
    tags.push(match[1])
    match = tagPattern.exec(text)
  }

  if (tags.length === 0) {
    result.errors.push('No XML tags found despite xml_like detection')
    result.suggestions.push('Treat as plain text with angle bracket content')
    return result
  }

  // Track opening and closing tags
  const tagStack: string[] = []
  let validTags = 0
  let totalTags = 0

  for (const tag of tags) {
    totalTags++

    if (tag.startsWith('/')) {
      // Closing tag
      const tagName = tag.slice(1).trim()
      const lastOpen = tagStack.pop()

      if (lastOpen === tagName) {
        validTags++
      } else {
        result.errors.push(`Mismatched closing tag: expected </${lastOpen}>, got </${tagName}>`)
      }
    } else if (tag.endsWith('/')) {
      // Self-closing tag
      validTags++
    } else {
      // Opening tag
      const tagName = tag.split(/\s/)[0]
      tagStack.push(tagName)
      validTags++
    }
  }

  // Check for unclosed tags
  if (tagStack.length > 0) {
    result.errors.push(`Unclosed tags: ${tagStack.join(', ')}`)
    result.suggestions.push('Add missing closing tags or treat as HTML fragment')
    // Penalize confidence for unclosed tags
    result.confidence = Math.max(0, validTags / Math.max(totalTags, 1) - tagStack.length * 0.2)
  } else {
    result.confidence = Math.min(validTags / Math.max(totalTags, 1), 1)
  }

  return result
}

/**
 * Validate CSV structure and consistency
 */
function validateCSV(text: string): ValidationResult {
  const result: ValidationResult = {
    confidence: 0,
    errors: [],
    suggestions: [],
  }

  const lines = text.split('\n').filter((line) => line.trim().length > 0)

  if (lines.length < 2) {
    result.errors.push('Insufficient lines for CSV validation')
    result.suggestions.push('Treat as single-line data')
    return result
  }

  // Try to determine the most likely delimiter
  const delimiters = [',', '\t', ';', '|']
  let bestDelimiter = ','
  let bestConsistency = 0

  for (const delimiter of delimiters) {
    const counts = lines.map((line) => (line.match(new RegExp(`\\${delimiter}`, 'g')) || []).length)

    if (counts.every((count) => count > 0)) {
      const avgCount = counts.reduce((a, b) => a + b) / counts.length
      const variance =
        counts.reduce((acc, count) => acc + (count - avgCount) ** 2, 0) / counts.length
      const consistency = 1 / (1 + variance)

      if (consistency > bestConsistency) {
        bestConsistency = consistency
        bestDelimiter = delimiter
      }
    }
  }

  // Check for mixed delimiters (additional penalty)
  const mixedDelimiters = delimiters.filter((d) => lines.some((line) => line.includes(d)))

  if (mixedDelimiters.length > 1) {
    result.errors.push(`Multiple delimiter types detected: ${mixedDelimiters.join(', ')}`)
    result.suggestions.push('Standardize on a single delimiter type')
    bestConsistency *= 0.5 // Penalize mixed delimiter usage
  }

  result.confidence = bestConsistency

  if (bestConsistency < 0.7) {
    result.errors.push(`Inconsistent delimiter usage (${bestDelimiter})`)
    result.suggestions.push('Treat as semi-structured text or try different delimiter')
  }

  // Check for quoted fields consistency
  const quotedFieldPattern = /"[^"]*"/g
  const hasQuotedFields = lines.some((line) => quotedFieldPattern.test(line))
  const allLinesConsistent = lines.every((line) => {
    const quotedCount = (line.match(quotedFieldPattern) || []).length
    const delimiterCount = (line.match(new RegExp(`\\${bestDelimiter}`, 'g')) || []).length
    return quotedCount <= delimiterCount + 1
  })

  if (hasQuotedFields && !allLinesConsistent) {
    result.errors.push('Inconsistent quoted field usage')
    result.suggestions.push('Check for unescaped quotes or malformed fields')
  }

  return result
}

/**
 * Extract potential JSON objects from text
 */
function extractJSONCandidates(text: string): string[] {
  const candidates: string[] = []

  // Look for object patterns { ... }
  const objectPattern = /\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}/g
  let match = objectPattern.exec(text)
  while (match !== null) {
    candidates.push(match[0])
    match = objectPattern.exec(text)
  }

  // Look for array patterns [ ... ]
  const arrayPattern = /\[[^[\]]*(?:\[[^[\]]*\][^[\]]*)*\]/g
  let arrayMatch = arrayPattern.exec(text)
  while (arrayMatch !== null) {
    candidates.push(arrayMatch[0])
    arrayMatch = arrayPattern.exec(text)
  }

  return candidates
}
