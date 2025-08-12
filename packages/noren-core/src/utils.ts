// Utility functions (separate module for tree-shaking)
import { NORMALIZE_PATTERNS } from './patterns.js'

export const normalize = (s: string) => {
  // Fast path: if string is already ASCII-only and doesn't need normalization, return as-is
  if (s.length > 0 && /^[\x20-\x7E]*$/.test(s) && !/[ \t]{2,}/.test(s)) {
    return s
  }

  // Don't normalize empty strings or strings with only whitespace
  // to preserve original content when no PII is present
  const normalized = s
    .normalize('NFKC')
    .replace(NORMALIZE_PATTERNS.dashVariants, '-')
    .replace(NORMALIZE_PATTERNS.ideographicSpace, ' ')
    .replace(NORMALIZE_PATTERNS.multipleSpaces, ' ')

  // Only trim if the result would not be empty
  // This preserves single spaces and other whitespace-only inputs
  const trimmed = normalized.trim()
  return trimmed.length > 0 ? trimmed : normalized
}

// Luhn algorithm for credit card validation
export function luhn(d: string) {
  let sum = 0
  let dbl = false
  for (let i = d.length - 1; i >= 0; i--) {
    let x = d.charCodeAt(i) - 48
    if (x < 0 || x > 9) return false
    if (dbl) {
      x *= 2
      if (x > 9) x -= 9
    }
    sum += x
    dbl = !dbl
  }
  return sum % 10 === 0
}

// Optimized hex conversion lookup table
const HEX_CHARS = '0123456789abcdef'
const HEX_TABLE = new Array(256)
for (let i = 0; i < 256; i++) {
  HEX_TABLE[i] = HEX_CHARS[(i >>> 4) & 0xf] + HEX_CHARS[i & 0xf]
}

const enc = new TextEncoder()

export async function importHmacKey(secret: string | CryptoKey) {
  if (typeof secret !== 'string') {
    if (secret instanceof CryptoKey) return secret
    throw new Error('HMAC key must be at least 32 characters long')
  }

  // Check for null, undefined, or empty values
  if (!secret || secret.length === 0) {
    throw new Error('HMAC key must be at least 32 characters long')
  }

  // Ensure minimum key length for security (check byte length, not character length)
  const keyBytes = enc.encode(secret)
  if (keyBytes.length < 32) {
    throw new Error('HMAC key must be at least 32 characters long')
  }

  return crypto.subtle.importKey('raw', keyBytes, { name: 'HMAC', hash: 'SHA-256' }, false, [
    'sign',
  ])
}

export async function hmacToken(value: string, key: CryptoKey) {
  const mac = await crypto.subtle.sign('HMAC', key, enc.encode(value))
  const b = new Uint8Array(mac)

  // Use lookup table for faster hex conversion (first 16 bytes = 128 bits)
  let hex = ''
  for (let i = 0; i < 16; i++) {
    hex += HEX_TABLE[b[i]]
  }
  return hex
}

/**
 * Detect if a Uint8Array chunk contains binary data
 * Uses heuristics to determine if data is likely binary vs text
 */
export function isBinaryChunk(chunk: Uint8Array): boolean {
  if (chunk.length === 0) return false

  let nullBytes = 0
  let controlBytes = 0
  const sampleSize = Math.min(chunk.length, 1024) // Check first 1KB

  for (let i = 0; i < sampleSize; i++) {
    const byte = chunk[i]

    // Null bytes are strong indicator of binary data
    if (byte === 0) {
      nullBytes++
      if (nullBytes > 0) return true // Even one null byte suggests binary
    }

    // Control characters (except common text ones)
    if (byte < 32 && byte !== 9 && byte !== 10 && byte !== 13) {
      controlBytes++
    }

    // High ratio of control characters suggests binary
    if (controlBytes > sampleSize * 0.3) return true
  }

  return false
}

/**
 * Decode patterns for encoded data detection
 */
export const ENCODING_PATTERNS = {
  // Base64 pattern - matches valid base64 strings (minimum 8 chars, multiple of 4)
  base64: /\b[A-Za-z0-9+/]{8,}={0,2}(?=\s|$|[^A-Za-z0-9+/=])/g,
  // URL encoded pattern - matches %XX sequences
  urlEncoded: /%[0-9A-Fa-f]{2}/g,
  // HTML entity pattern - matches &entity; and &#number;
  htmlEntity: /&(?:[A-Za-z][A-Za-z0-9]{1,30}|#[0-9]{1,7}|#[xX][0-9A-Fa-f]{1,6});/g,
  // Common hash patterns to exclude from PII detection (MD5, SHA1, SHA256, etc.)
  hashPatterns: /\b(?:[0-9a-fA-F]{32}|[0-9a-fA-F]{40}|[0-9a-fA-F]{64}|[0-9a-fA-F]{128})\b/g,
} as const

/**
 * Patterns for technical identifiers that should not be treated as PII
 */
export const TECHNICAL_ID_PATTERNS = {
  // UUID patterns (v4, v1, etc.)
  uuid: /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/gi,
  // MongoDB ObjectId
  mongoId: /\b[0-9a-fA-F]{24}\b/g,
  // Docker container IDs / short hashes
  dockerId: /\b[0-9a-f]{12,64}\b/g,
  // Git commit hashes (short and long)
  gitHash: /\b[0-9a-f]{7,40}\b/g,
  // Unix timestamps (10 or 13 digits)
  timestamp: /\b(?:1[0-9]{9,12})\b/g,
  // Version numbers
  version: /\b\d+\.\d+(?:\.\d+)*(?:-[a-zA-Z0-9.-]+)?(?:\+[a-zA-Z0-9.-]+)?\b/g,
  // Common technical prefixes
  technicalPrefixes:
    /\b(?:req|res|tmp|temp|sess|session|token|key|id|uid|pid|tid|ref|var|obj|elem|item|idx|ptr|addr|mem|buf|ctx|cfg|env|arg|param|attr|prop|val|str|num|bool|arr|list|map|dict|hash|cache|db|sql|api|url|uri|http|https|ftp|ssh|tcp|udp|ip|dns|tls|ssl|jwt|oauth|cors|csrf|xss|sql|nosql|rest|soap|json|xml|html|css|js|ts|py|java|cpp|cs|php|rb|go|rs|kt|scala|sh|ps1|bat|yml|yaml|toml|ini|cfg|conf|log|txt|csv|tsv|md|doc|pdf|img|jpg|png|gif|svg|mp3|mp4|avi|mov|zip|tar|gz|rar|7z|exe|dll|so|dylib|bin|hex|oct|dec|ascii|utf8|utf16|base64|base32|crc|md5|sha1|sha256|sha512|aes|rsa|ecdsa|hmac|pbkdf2|bcrypt|scrypt|argon2)_[a-zA-Z0-9_-]+/gi,
  // Common file extensions and paths
  filePaths:
    /\b(?:[a-zA-Z]:\\|\/)[a-zA-Z0-9_.-]+(?:[\\/][a-zA-Z0-9_.-]+)*\.(?:txt|log|json|xml|html|css|js|ts|py|java|cpp|cs|php|rb|go|rs|kt|scala|sh|ps1|bat|yml|yaml|toml|ini|cfg|conf|md|doc|pdf|img|jpg|png|gif|svg|mp3|mp4|avi|mov|zip|tar|gz|rar|7z|exe|dll|so|dylib)\b/gi,
  // IPv6 in URL format (to avoid false positives)
  ipv6InUrl: /\[(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}\]/g,
} as const

/**
 * Safe Base64 decode with error handling
 */
export function safeBase64Decode(input: string): string | null {
  try {
    // Validate base64 format
    if (!/^[A-Za-z0-9+/]*={0,2}$/.test(input)) return null
    // Must be multiple of 4 for valid base64
    if (input.length % 4 !== 0) return null
    // Minimum meaningful length
    if (input.length < 8) return null

    const decoded = atob(input)
    // Check if decoded result is valid UTF-8 text
    try {
      return new TextDecoder('utf-8', { fatal: true }).decode(new TextEncoder().encode(decoded))
    } catch {
      // Not valid UTF-8, likely binary data
      return null
    }
  } catch {
    return null
  }
}

/**
 * Safe URL decode with error handling
 */
export function safeUrlDecode(input: string): string | null {
  try {
    return decodeURIComponent(input)
  } catch {
    return null
  }
}

/**
 * Safe HTML entity decode with error handling
 */
export function safeHtmlEntityDecode(input: string): string | null {
  try {
    const entityMap: Record<string, string> = {
      '&amp;': '&',
      '&lt;': '<',
      '&gt;': '>',
      '&quot;': '"',
      '&#39;': "'",
      '&apos;': "'",
      '&#64;': '@',
      '&#45;': '-',
      '&#46;': '.',
    }

    return input.replace(
      /&(?:[A-Za-z][A-Za-z0-9]{1,30}|#[0-9]{1,7}|#[xX][0-9A-Fa-f]{1,6});/g,
      (match) => {
        if (entityMap[match]) return entityMap[match]

        // Handle numeric entities
        if (match.startsWith('&#')) {
          const isHex = match.startsWith('&#x') || match.startsWith('&#X')
          const numStr = match.slice(isHex ? 3 : 2, -1)
          const num = parseInt(numStr, isHex ? 16 : 10)
          if (num >= 0 && num <= 0x10ffff) {
            return String.fromCodePoint(num)
          }
        }

        return match // Return original if can't decode
      },
    )
  } catch {
    return null
  }
}

// Strict IPv4 pattern for exact validation
const IPV4_STRICT =
  /^(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(?:\.(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/

/**
 * Check if a string looks like a hash value or technical identifier (common patterns)
 */
export function isHashLike(input: string, piiType?: string): boolean {
  // Don't apply hash detection to IP addresses or phone numbers
  if (piiType === 'ipv4' || piiType === 'ipv6' || piiType === 'phone' || piiType === 'phone_e164') {
    return false
  }

  // If input looks like IPv4, don't treat as hash
  if (IPV4_STRICT.test(input.trim())) {
    return false
  }

  // Reset regex state before testing to ensure consistent behavior
  ENCODING_PATTERNS.hashPatterns.lastIndex = 0
  return ENCODING_PATTERNS.hashPatterns.test(input)
}

/**
 * Check if a string looks like a technical identifier that should be excluded from PII detection
 */
export function isTechnicalId(input: string, piiType?: string): boolean {
  // Don't apply technical ID detection to IP addresses or phone numbers
  if (piiType === 'ipv4' || piiType === 'ipv6' || piiType === 'phone' || piiType === 'phone_e164') {
    return false
  }

  // If input looks like IPv4, don't treat as technical ID
  if (IPV4_STRICT.test(input.trim())) {
    return false
  }

  // Reset regex lastIndex to ensure consistent behavior
  Object.values(TECHNICAL_ID_PATTERNS).forEach((pattern) => {
    pattern.lastIndex = 0
  })

  // Strict SemVer pattern (exactly 2 dots for version numbers)
  const SEMVER_STRICT = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/
  if (SEMVER_STRICT.test(input)) {
    return true
  }

  return (
    TECHNICAL_ID_PATTERNS.uuid.test(input) ||
    TECHNICAL_ID_PATTERNS.mongoId.test(input) ||
    TECHNICAL_ID_PATTERNS.dockerId.test(input) ||
    TECHNICAL_ID_PATTERNS.gitHash.test(input) ||
    TECHNICAL_ID_PATTERNS.timestamp.test(input) ||
    TECHNICAL_ID_PATTERNS.technicalPrefixes.test(input) ||
    TECHNICAL_ID_PATTERNS.filePaths.test(input) ||
    TECHNICAL_ID_PATTERNS.ipv6InUrl.test(input)
  )
}

/**
 * Debug tracing for false positive detection
 */
export type FalsePositiveReason =
  | 'ipv4-localhost'
  | 'ipv6-localhost'
  | 'ipv4-guard'
  | 'ipv6-guard'
  | 'hash-like'
  | 'technical-id'
  | 'email-test-pattern'
  | 'phone-invalid-length'

export function isFalsePositiveWithTrace(
  input: string,
  piiType?: string,
): {
  result: boolean
  reasons: FalsePositiveReason[]
} {
  const reasons: FalsePositiveReason[] = []
  const trimmed = input.trim()

  // Type-priority short-circuit (prevent generic rules from overriding)
  // All IP addresses (including localhost) are considered PII by default
  if (piiType === 'ipv4') {
    reasons.push('ipv4-guard')
    return { result: false, reasons }
  }

  if (piiType === 'ipv6') {
    reasons.push('ipv6-guard')
    return { result: false, reasons }
  }

  // Type-unspecified safeguard: If it looks like IPv4, protect it from generic rules
  if (IPV4_STRICT.test(trimmed)) {
    reasons.push('ipv4-guard')
    return { result: false, reasons }
  }

  // Generic false positive filters (only applied to non-IP data)
  if (isHashLike(trimmed, piiType)) {
    reasons.push('hash-like')
    return { result: true, reasons }
  }

  if (isTechnicalId(trimmed, piiType)) {
    reasons.push('technical-id')
    return { result: true, reasons }
  }

  // Type-specific checks
  if (piiType === 'email') {
    // Only exclude obvious system/placeholder emails
    if (trimmed.includes('noreply') || trimmed.includes('no-reply')) {
      reasons.push('email-test-pattern')
      return { result: true, reasons }
    }

    // Note: Removed test@example.com exclusion as it should be treated as PII for security
    // Only keep very obvious non-personal system patterns
  }

  if (piiType === 'phone' || piiType === 'phone_e164') {
    // Only exclude extremely long or obviously invalid phone patterns
    if (trimmed.length > 30 || trimmed.replace(/[^\d]/g, '').length > 20) {
      reasons.push('phone-invalid-length')
      return { result: true, reasons }
    }
  }

  return { result: false, reasons }
}

/**
 * Comprehensive check for false positive patterns (wrapper for compatibility)
 */
export function isFalsePositive(input: string, piiType?: string): boolean {
  return isFalsePositiveWithTrace(input, piiType).result
}

/**
 * Security limits for ReDoS prevention
 */
export const SECURITY_LIMITS = {
  maxInputLength: 50000, // Reduced for better security (50KB text limit)
  maxRegexComplexity: 3000, // Reduced complexity threshold for stricter security
  chunkSize: 2000, // Increased chunk size for better performance
  maxPatternMatches: 200, // Limit number of regex matches to prevent DoS
} as const

/**
 * Calculate input complexity to prevent ReDoS attacks
 */
export function calculateInputComplexity(input: string): number {
  let complexity = Math.floor(input.length / 10) // Base complexity from length

  // Repeated characters (especially problematic for regex) - more aggressive detection
  const repeatedCharMatches = input.match(/(.)\1{3,}/g) || [] // Lower threshold
  complexity += repeatedCharMatches.reduce((sum, match) => sum + match.length * 8, 0) // Higher penalty

  // Nested structures (can cause exponential backtracking)
  const nestedStructures = (input.match(/[([{].*[([{].*[)\]}].*[)\]}]/g) || []).length
  complexity += nestedStructures * 30 // Higher penalty

  // Alternation patterns in potential regex input
  const alternationCount = (input.match(/\|/g) || []).length
  if (alternationCount > 3) {
    // Lower threshold
    complexity += alternationCount * 15 // Higher penalty
  }

  // Quantifier patterns
  const quantifierCount = (input.match(/[*+?{]/g) || []).length
  if (quantifierCount > 3) {
    // Lower threshold
    complexity += quantifierCount * 20 // Higher penalty
  }

  // Suspicious regex patterns that could cause backtracking
  const suspiciousPatterns = [
    /(\w+\s*){10,}/, // Many word+space repetitions
    /([^\s]+\s+){10,}/, // Many non-space+space repetitions
    /(a|a)*/, // Classic ReDoS pattern
    /(.+)+/, // Nested quantifiers
  ]

  for (const pattern of suspiciousPatterns) {
    if (pattern.test(input)) {
      complexity += 500 // High penalty for suspicious patterns
    }
  }

  return complexity
}

/**
 * Check if input is safe for regex processing
 */
export function isInputSafeForRegex(input: string): boolean {
  if (input.length > SECURITY_LIMITS.maxInputLength) {
    return false
  }

  const complexity = calculateInputComplexity(input)
  return complexity <= SECURITY_LIMITS.maxRegexComplexity
}

/**
 * Safe regex execution wrapper
 */
export function safeRegexMatch(
  pattern: RegExp,
  input: string,
  maxMatches: number = SECURITY_LIMITS.maxPatternMatches,
): RegExpMatchArray[] {
  // Check input safety first
  if (!isInputSafeForRegex(input)) {
    return []
  }

  try {
    const matches: RegExpMatchArray[] = []
    let matchCount = 0

    // For global patterns, use matchAll but limit results
    if (pattern.global) {
      for (const match of input.matchAll(pattern)) {
        if (matchCount >= maxMatches) break
        matches.push(match)
        matchCount++
      }
    } else {
      // For non-global patterns, just get the first match
      const match = input.match(pattern)
      if (match) matches.push(match)
    }

    return matches
  } catch (_error) {
    // If regex fails, return empty array
    return []
  }
}

/**
 * Process large inputs in safe chunks
 */
export function processInChunks<T>(
  input: string,
  processor: (chunk: string, offset: number) => T[],
  chunkSize: number = SECURITY_LIMITS.chunkSize,
): T[] {
  if (input.length <= chunkSize) {
    return processor(input, 0)
  }

  const results: T[] = []
  let offset = 0

  while (offset < input.length) {
    const chunk = input.slice(offset, offset + chunkSize)
    const chunkResults = processor(chunk, offset)
    results.push(...chunkResults)
    offset += chunkSize

    // Prevent infinite loops
    if (results.length > 10000) break
  }

  return results
}

/**
 * Extract string values from JSON objects recursively
 */
export function extractJsonStrings(text: string): Array<{
  value: string
  path: string
  originalStart: number
  originalEnd: number
}> {
  const results: Array<{
    value: string
    path: string
    originalStart: number
    originalEnd: number
  }> = []

  try {
    // Try to parse as JSON
    const jsonObj = JSON.parse(text)

    // Recursively extract string values
    const extractFromObject = (obj: unknown, path: string = ''): void => {
      if (typeof obj === 'string' && obj.length > 2) {
        // Find the position of this string in the original text
        // This is approximate - for exact positioning, we'd need a more sophisticated parser
        const stringPattern = new RegExp(`"${obj.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"`, 'g')
        for (const match of text.matchAll(stringPattern)) {
          if (match.index !== undefined) {
            results.push({
              value: obj,
              path,
              originalStart: match.index + 1, // Skip opening quote
              originalEnd: match.index + match[0].length - 1, // Skip closing quote
            })
          }
        }
      } else if (Array.isArray(obj)) {
        obj.forEach((item, index) => {
          extractFromObject(item, `${path}[${index}]`)
        })
      } else if (obj && typeof obj === 'object') {
        Object.entries(obj).forEach(([key, value]) => {
          const newPath = path ? `${path}.${key}` : key
          extractFromObject(value, newPath)
        })
      }
    }

    extractFromObject(jsonObj)
  } catch {
    // Not valid JSON, return empty array
  }

  return results
}

/**
 * Extract string values from XML-like structures
 */
export function extractXmlStrings(text: string): Array<{
  value: string
  tagName: string
  originalStart: number
  originalEnd: number
}> {
  const results: Array<{
    value: string
    tagName: string
    originalStart: number
    originalEnd: number
  }> = []

  // Simple XML tag content extraction
  const xmlPattern = /<([a-zA-Z][a-zA-Z0-9_-]*)[^>]*>([^<]+)<\/\1>/g

  for (const match of text.matchAll(xmlPattern)) {
    if (match.index !== undefined && match[2] && match[2].trim().length > 2) {
      const contentStart = match.index + match[0].indexOf(match[2])
      results.push({
        value: match[2].trim(),
        tagName: match[1],
        originalStart: contentStart,
        originalEnd: contentStart + match[2].length,
      })
    }
  }

  return results
}

/**
 * Extract string values from CSV-like structures
 */
export function extractCsvStrings(text: string): Array<{
  value: string
  row: number
  col: number
  originalStart: number
  originalEnd: number
}> {
  const results: Array<{
    value: string
    row: number
    col: number
    originalStart: number
    originalEnd: number
  }> = []

  // Simple CSV parsing (handles basic cases)
  const lines = text.split('\n')
  let currentPos = 0

  lines.forEach((line, rowIndex) => {
    const fields = line.split(',')
    let fieldStart = currentPos

    fields.forEach((field, colIndex) => {
      const trimmedField = field.trim().replace(/^["']|["']$/g, '') // Remove quotes
      if (trimmedField.length > 2) {
        const fieldIndex = line.indexOf(field, fieldStart - currentPos)
        if (fieldIndex !== -1) {
          results.push({
            value: trimmedField,
            row: rowIndex,
            col: colIndex,
            originalStart: currentPos + fieldIndex,
            originalEnd: currentPos + fieldIndex + field.length,
          })
        }
      }
      fieldStart = currentPos + line.indexOf(field, fieldStart - currentPos) + field.length + 1
    })

    currentPos += line.length + 1 // +1 for newline
  })

  return results
}

/**
 * Enhanced text preprocessing for encoded data detection
 */
export function preprocessForPiiDetection(text: string): Array<{
  decoded: string
  originalStart: number
  originalEnd: number
  encoding: 'base64' | 'url' | 'html' | 'json' | 'xml' | 'csv' | 'none'
}> {
  const results: Array<{
    decoded: string
    originalStart: number
    originalEnd: number
    encoding: 'base64' | 'url' | 'html' | 'json' | 'xml' | 'csv' | 'none'
  }> = []

  // Add original text
  results.push({
    decoded: text,
    originalStart: 0,
    originalEnd: text.length,
    encoding: 'none',
  })

  // Process Base64 encoded strings
  for (const match of text.matchAll(ENCODING_PATTERNS.base64)) {
    if (match.index === undefined) continue
    const decoded = safeBase64Decode(match[0])
    if (decoded && decoded.length > 4) {
      results.push({
        decoded,
        originalStart: match.index,
        originalEnd: match.index + match[0].length,
        encoding: 'base64',
      })
    }
  }

  // Process URL encoded strings
  if (ENCODING_PATTERNS.urlEncoded.test(text)) {
    const decoded = safeUrlDecode(text)
    if (decoded && decoded !== text) {
      results.push({
        decoded,
        originalStart: 0,
        originalEnd: text.length,
        encoding: 'url',
      })
    }
  }

  // Process HTML entity encoded strings
  if (ENCODING_PATTERNS.htmlEntity.test(text)) {
    const decoded = safeHtmlEntityDecode(text)
    if (decoded && decoded !== text) {
      results.push({
        decoded,
        originalStart: 0,
        originalEnd: text.length,
        encoding: 'html',
      })
    }
  }

  // Process JSON structure
  if ((text.includes('{') && text.includes('}')) || (text.includes('[') && text.includes(']'))) {
    const jsonStrings = extractJsonStrings(text)
    for (const jsonStr of jsonStrings) {
      results.push({
        decoded: jsonStr.value,
        originalStart: jsonStr.originalStart,
        originalEnd: jsonStr.originalEnd,
        encoding: 'json',
      })
    }
  }

  // Process XML structure
  if (text.includes('<') && text.includes('>')) {
    const xmlStrings = extractXmlStrings(text)
    for (const xmlStr of xmlStrings) {
      results.push({
        decoded: xmlStr.value,
        originalStart: xmlStr.originalStart,
        originalEnd: xmlStr.originalEnd,
        encoding: 'xml',
      })
    }
  }

  // Process CSV structure (if it looks like CSV)
  if (text.includes(',') && text.includes('\n')) {
    const csvStrings = extractCsvStrings(text)
    for (const csvStr of csvStrings) {
      results.push({
        decoded: csvStr.value,
        originalStart: csvStr.originalStart,
        originalEnd: csvStr.originalEnd,
        encoding: 'csv',
      })
    }
  }

  return results
}
