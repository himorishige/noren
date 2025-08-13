/**
 * Context detection for document structure analysis and PII context markers
 * Streamlined implementation with unified pattern detection and validation
 */

// ===== Core Interfaces =====

export interface DocumentStructure {
  jsonLike: boolean
  xmlLike: boolean
  csvLike: boolean
  markdownLike: boolean
  codeBlock: boolean
  headerRow: boolean
  templateSection: boolean
  logLike: boolean
}

export interface ValidatedDocumentStructure extends DocumentStructure {
  validation: {
    confidence: number // 0-1 overall confidence
    errors: string[]
    warnings: string[]
    suggestions: string[]
  }
}

export interface ContextMarkers {
  exampleNearby: boolean
  testNearby: boolean
  sampleNearby: boolean
  dummyNearby: boolean
  placeholderNearby: boolean
  distanceToNearestMarker: number
  markerLanguage: 'ja' | 'en' | 'mixed' | 'unknown'
}

export interface ContextFeatures {
  structure: DocumentStructure
  markers: ContextMarkers
  language: 'ja' | 'en' | 'mixed' | 'unknown'
  highEntropyNearby: boolean
  repetitionDetected: boolean
}

// ===== Pattern Constants =====

const STRUCTURE_PATTERNS = {
  json: {
    indicators: ['{', '}', '[', ']', ':', '"'],
    validator: (text: string) => {
      // For detection, use relaxed criteria
      const hasStructure = text.includes('{') && text.includes('}') && text.includes(':')
      const quotedKeys = (text.match(/"[^"]+"\s*:/g) || []).length > 0
      return hasStructure && quotedKeys
    },
  },
  xml: {
    indicators: ['<', '>', '</', '/>'],
    validator: (text: string) => {
      // For detection, use relaxed criteria
      const tags = text.match(/<[^>]+>/g) || []
      if (tags.length < 2) return false

      const openTags = tags.filter((tag) => !tag.startsWith('</') && !tag.endsWith('/>')).length
      const closeTags = tags.filter((tag) => tag.startsWith('</')).length
      const selfClosing = tags.filter((tag) => tag.endsWith('/>')).length

      return openTags > 0 && (closeTags > 0 || selfClosing > 0)
    },
  },
  csv: {
    indicators: [','],
    validator: (text: string) => {
      const lines = text.split('\n').filter((line) => line.trim())
      if (lines.length < 2) return false

      // CSV shouldn't have JSON/XML-like structures
      if (text.includes('{') || text.includes('<')) return false

      return [',', '\t', ';', '|'].some((delimiter) => {
        const counts = lines
          .slice(0, 5)
          .map((line) => (line.match(new RegExp(`\\${delimiter}`, 'g')) || []).length)
          .filter((count) => count > 0)

        if (counts.length < 2) return false
        const avg = counts.reduce((a, b) => a + b) / counts.length
        const variance = counts.reduce((acc, count) => acc + (count - avg) ** 2, 0) / counts.length
        return variance < 2 && avg >= 1
      })
    },
  },
} as const

const MARKER_PATTERNS = {
  en: {
    example: ['example', 'e.g.', 'for example'],
    test: ['test', 'testing', 'unit test'],
    sample: ['sample', 'samples', 'sample data'],
    dummy: ['dummy', 'mock', 'fake', 'placeholder'],
    placeholder: ['placeholder', 'xxx', 'todo', 'fixme'],
  },
  ja: {
    example: ['例', 'れい', '例示'],
    test: ['テスト', '試験', '検証'],
    sample: ['サンプル', '見本'],
    dummy: ['ダミー', '偽', '仮'],
    placeholder: ['プレースホルダ', '置換子', '仮置き'],
  },
} as const

// ===== Document Structure Detection =====

export function detectDocumentStructure(text: string): DocumentStructure {
  // Use sample for efficiency on large texts
  const sample = text.length > 2000 ? `${text.slice(0, 1000)}\n${text.slice(-1000)}` : text

  const lines = sample.split('\n').filter((line) => line.trim())

  return {
    jsonLike: hasPattern(sample, STRUCTURE_PATTERNS.json),
    xmlLike: hasPattern(sample, STRUCTURE_PATTERNS.xml),
    csvLike: hasPattern(sample, STRUCTURE_PATTERNS.csv),
    markdownLike: hasMarkdownPatterns(sample),
    codeBlock: hasCodePatterns(sample),
    headerRow: hasHeaderRow(lines),
    templateSection: hasTemplatePatterns(sample),
    logLike: hasLogPatterns(lines),
  }
}

export function validateDocumentStructure(text: string): ValidatedDocumentStructure {
  const basic = detectDocumentStructure(text)
  const validation = {
    confidence: 0,
    errors: [] as string[],
    warnings: [] as string[],
    suggestions: [] as string[],
  }

  // Calculate overall confidence based on structure detection
  let detectedFormats = 0
  let totalConfidence = 0

  if (basic.jsonLike) {
    // Actual JSON validation for confidence scoring
    let isValidJson = false
    try {
      JSON.parse(text.trim())
      isValidJson = true
    } catch {
      isValidJson = false
    }

    const jsonConfidence = isValidJson ? 0.9 : 0.4 // Lower confidence for malformed JSON
    totalConfidence += jsonConfidence
    detectedFormats++

    if (!isValidJson) {
      validation.warnings.push('JSON structure detected but may have syntax errors')
      validation.suggestions.push('Validate JSON syntax with dedicated parser')
    }
  }

  if (basic.xmlLike) {
    // Actual XML validation for confidence scoring
    const isValidXml = validateXmlStructure(text)
    const xmlConfidence = isValidXml ? 0.85 : 0.5 // Slightly higher for valid XML
    totalConfidence += xmlConfidence
    detectedFormats++

    if (!isValidXml) {
      validation.warnings.push('XML structure detected but may have unclosed tags')
      validation.suggestions.push('Check for balanced opening/closing tags')
    }
  }

  if (basic.csvLike) {
    const csvValidationResult = validateCsvStructure(text)
    const csvConfidence = csvValidationResult.isValid ? 0.8 : 0.5
    totalConfidence += csvConfidence
    detectedFormats++

    if (!csvValidationResult.isValid) {
      validation.errors.push(...csvValidationResult.errors)
      validation.warnings.push('CSV structure detected but may have inconsistent delimiters')
    }
    validation.suggestions.push('Consider standardizing delimiter usage')
  }

  validation.confidence = detectedFormats > 0 ? totalConfidence / detectedFormats : 0.5

  // General warnings for large texts
  if (text.length > 100000) {
    validation.warnings.push('Large document size may affect detection accuracy')
  }

  if (detectedFormats > 1) {
    validation.warnings.push('Multiple document formats detected - results may be ambiguous')
  }

  return {
    ...basic,
    validation,
  }
}

// ===== Context Marker Detection =====

export function detectContextMarkers(text: string, position: number): ContextMarkers {
  const windowSize = 80
  const start = Math.max(0, position - windowSize)
  const end = Math.min(text.length, position + windowSize)
  const context = text.slice(start, end).toLowerCase()

  // Get line context for higher priority matching
  const lineStart = text.lastIndexOf('\n', position) + 1
  const lineEnd = text.indexOf('\n', position)
  const lineContext = text.slice(lineStart, lineEnd === -1 ? text.length : lineEnd).toLowerCase()

  const results = {
    exampleNearby: false,
    testNearby: false,
    sampleNearby: false,
    dummyNearby: false,
    placeholderNearby: false,
  }

  let nearestDistance = Infinity
  let hasEnMarkers = false
  let hasJaMarkers = false

  // Check markers in both languages
  for (const [lang, patterns] of Object.entries(MARKER_PATTERNS)) {
    for (const [category, markers] of Object.entries(patterns)) {
      for (const marker of markers) {
        // Check line context first (higher priority)
        if (lineContext.includes(marker)) {
          const resultKey = `${category}Nearby` as keyof typeof results
          results[resultKey] = true
          nearestDistance = 0
          if (lang === 'en') {
            hasEnMarkers = true
          } else {
            hasJaMarkers = true
          }
          continue
        }

        // Check window context
        const idx = context.indexOf(marker)
        if (idx !== -1) {
          const resultKey = `${category}Nearby` as keyof typeof results
          results[resultKey] = true
          nearestDistance = Math.min(nearestDistance, Math.abs(idx - windowSize / 2))
          if (lang === 'en') {
            hasEnMarkers = true
          } else {
            hasJaMarkers = true
          }
        }
      }
    }
  }

  const markerLanguage =
    hasJaMarkers && hasEnMarkers ? 'mixed' : hasJaMarkers ? 'ja' : hasEnMarkers ? 'en' : 'unknown'

  return {
    ...results,
    distanceToNearestMarker: nearestDistance === Infinity ? -1 : nearestDistance,
    markerLanguage,
  }
}

// ===== Context Features Extraction =====

export function extractContextFeatures(text: string, position: number): ContextFeatures {
  return {
    structure: detectDocumentStructure(text),
    markers: detectContextMarkers(text, position),
    language: detectLanguage(text),
    highEntropyNearby: detectHighEntropyNearby(text, position),
    repetitionDetected: detectRepetition(text, position),
  }
}

export function extractValidatedContextFeatures(
  text: string,
  position: number,
): ContextFeatures & { validatedStructure: ValidatedDocumentStructure } {
  return {
    ...extractContextFeatures(text, position),
    validatedStructure: validateDocumentStructure(text),
  }
}

// ===== Helper Functions =====

function validateXmlStructure(text: string): boolean {
  // Remove comments first
  const cleanText = text.replace(/<!--[\s\S]*?-->/g, '')
  const tags = cleanText.match(/<[^>]+>/g) || []
  if (tags.length < 2) return false

  const openTags = tags.filter((tag) => !tag.startsWith('</') && !tag.endsWith('/>')).length
  const closeTags = tags.filter((tag) => tag.startsWith('</')).length
  const selfClosing = tags.filter((tag) => tag.endsWith('/>')).length

  // Check if all opening tags have matching closing tags
  if (openTags > 0 && closeTags === 0 && selfClosing === 0) return false
  // Strict balance check - all opening tags should have closing tags
  return openTags > 0 && (closeTags > 0 || selfClosing > 0) && openTags === closeTags
}

function validateCsvStructure(text: string): { isValid: boolean; errors: string[] } {
  const lines = text.split('\n').filter((line) => line.trim())
  if (lines.length < 2) return { isValid: false, errors: ['Insufficient data rows'] }

  const errors: string[] = []

  // Check if multiple delimiters are used (inconsistency)
  let primaryDelimiter = null
  for (const delimiter of [',', '\t', ';', '|']) {
    const counts = lines
      .slice(0, 5)
      .map((line) => (line.match(new RegExp(`\\${delimiter}`, 'g')) || []).length)
      .filter((count) => count > 0)

    if (counts.length >= 2) {
      if (primaryDelimiter) {
        // Multiple delimiters found - likely inconsistent
        errors.push(`Inconsistent delimiter usage detected`)
        break
      }

      primaryDelimiter = delimiter
      const avg = counts.reduce((a, b) => a + b) / counts.length
      const variance = counts.reduce((acc, count) => acc + (count - avg) ** 2, 0) / counts.length

      if (variance >= 1) {
        errors.push(`Inconsistent delimiter '${delimiter}' usage across rows`)
      }
    }
  }

  return { isValid: errors.length === 0, errors }
}

function hasPattern(
  text: string,
  pattern: { indicators: readonly string[]; validator: (text: string) => boolean },
): boolean {
  const indicatorCount = pattern.indicators.filter((indicator) => text.includes(indicator)).length
  const hasIndicators = indicatorCount >= Math.ceil(pattern.indicators.length * 0.6)
  return hasIndicators && pattern.validator(text)
}

function hasMarkdownPatterns(text: string): boolean {
  const patterns = [
    /^#{1,6}\s+/m, // Headers
    /```[\s\S]*?```/g, // Code blocks
    /^\s*[-*+]\s+/m, // Lists
    /\[([^\]]+)\]\([^)]+\)/g, // Links
  ]
  return patterns.some((pattern) => pattern.test(text))
}

function hasCodePatterns(text: string): boolean {
  const patterns = [
    /```[\s\S]*?```/g, // Fenced code
    /^\s{4,}/m, // Indented code
    /<pre[\s\S]*?<\/pre>/gi, // HTML pre tags
  ]
  return patterns.some((pattern) => pattern.test(text))
}

function hasHeaderRow(lines: string[]): boolean {
  if (lines.length < 2) return false

  const firstLine = lines[0]
  const secondLine = lines[1]

  const headerPatterns = [
    /name|id|email|phone|address|date|user/i,
    /^[A-Za-z_][A-Za-z0-9_,|\t\s]*$/,
  ]

  const isHeaderLike = headerPatterns.some((pattern) => pattern.test(firstLine))
  const hasData = /\d/.test(secondLine) && secondLine.length > firstLine.length * 0.3

  return isHeaderLike && hasData
}

function hasTemplatePatterns(text: string): boolean {
  const patterns = [
    /{{[^}]+}}/g, // Handlebars
    /{%[^%]+%}/g, // Jinja2
    /\$\{[^}]+\}/g, // Template literals
    /\{[A-Za-z_][A-Za-z0-9_]*\}/g, // Simple placeholders
  ]
  return patterns.some((pattern) => pattern.test(text))
}

function hasLogPatterns(lines: string[]): boolean {
  const patterns = [
    /^\d{4}-\d{2}-\d{2}[\sT]\d{2}:\d{2}:\d{2}/, // ISO timestamp
    /^\[.*?\]/, // Bracketed info
    /(ERROR|WARN|INFO|DEBUG)/i, // Log levels
    /\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/, // IP addresses
  ]

  const logLikeLines = lines.filter((line) => patterns.some((pattern) => pattern.test(line)))

  return logLikeLines.length / lines.length > 0.3
}

function detectLanguage(text: string): 'ja' | 'en' | 'mixed' | 'unknown' {
  const hasJapanese = /[\u3040-\u309f\u30a0-\u30ff\u4e00-\u9faf]/.test(text)
  const hasAscii = /[a-zA-Z]/.test(text)

  if (hasJapanese && hasAscii) return 'mixed'
  if (hasJapanese) return 'ja'
  if (hasAscii) return 'en'
  return 'unknown'
}

function detectHighEntropyNearby(text: string, position: number): boolean {
  const windowSize = 40
  const start = Math.max(0, position - windowSize)
  const end = Math.min(text.length, position + windowSize)
  const context = text.slice(start, end)

  // Calculate entropy
  const uniqueChars = new Set(context).size
  const entropy = uniqueChars / context.length

  // High-value patterns
  const highValuePatterns = [
    /[a-fA-F0-9]{24,}/, // Long hex strings
    /[A-Za-z0-9+/]{16,}={0,2}/, // Base64-like
    /[A-Z0-9]{12,}/, // All caps alphanumeric
  ]

  return entropy > 0.7 || highValuePatterns.some((pattern) => pattern.test(context))
}

function detectRepetition(text: string, position: number): boolean {
  const windowSize = 60
  const start = Math.max(0, position - windowSize)
  const end = Math.min(text.length, position + windowSize)
  const context = text.slice(start, end)

  const words = context.toLowerCase().match(/\b\w+\b/g) || []
  const wordCounts = new Map<string, number>()

  words.forEach((word) => {
    wordCounts.set(word, (wordCounts.get(word) || 0) + 1)
  })

  const maxCount = Math.max(...Array.from(wordCounts.values()))
  return maxCount / words.length > 0.4
}
