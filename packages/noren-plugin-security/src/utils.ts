import type { CookieInfo, HeaderInfo, SecurityConfig } from './types.js'

// Optional debug logging function
let debugLogger: ((message: string, error?: Error) => void) | undefined

export function setSecurityDebugLogger(logger: (message: string, error?: Error) => void) {
  debugLogger = logger
}

export function logSecurityError(context: string, error: Error, input?: string) {
  if (debugLogger) {
    const sanitizedInput = input
      ? `Input: "${input.slice(0, 50)}${input.length > 50 ? '...' : ''}"`
      : ''
    debugLogger(`Security parsing error in ${context}. ${sanitizedInput}`, error)
  }
}

/**
 * Generic header/cookie parser
 */
function parseNameValuePairs(
  input: string,
  separator = ';',
): Array<{ name: string; value: string }> {
  const pairs: Array<{ name: string; value: string }> = []
  const items = input.split(separator)

  for (const item of items) {
    const trimmed = item.trim()
    const equalIndex = trimmed.indexOf('=')

    if (equalIndex > 0) {
      const name = trimmed.substring(0, equalIndex).trim()
      const value = trimmed.substring(equalIndex + 1).trim()
      pairs.push({ name, value })
    }
  }

  return pairs
}

/** Parse Cookie header string */
export function parseCookieHeader(cookieHeader: string): CookieInfo[] {
  const cookieValue = cookieHeader.replace(/^Cookie\s*:\s*/i, '')
  return parseNameValuePairs(cookieValue).map(({ name, value }) => ({
    name,
    value,
    isAllowed: false, // Updated later by allowlist check
  }))
}

/** Parse Set-Cookie header string */
export function parseSetCookieHeader(setCookieHeader: string): CookieInfo | null {
  const cookieValue = setCookieHeader.replace(/^Set-Cookie\s*:\s*/i, '')
  const pairs = parseNameValuePairs(cookieValue)

  if (pairs.length === 0) return null

  const { name, value } = pairs[0]
  return {
    name,
    value,
    isAllowed: false, // Updated later by allowlist check
  }
}

/** Parse HTTP header string */
export function parseHttpHeader(headerLine: string): HeaderInfo | null {
  const colonIndex = headerLine.indexOf(':')
  if (colonIndex <= 0) return null

  const name = headerLine.substring(0, colonIndex).trim()
  const value = headerLine.substring(colonIndex + 1).trim()

  return {
    name,
    value,
    isAllowed: false, // Updated later by allowlist check
  }
}

/**
 * Generic allowlist checker for names with wildcard support
 */
function isInAllowlist(itemName: string, allowlist?: string[]): boolean {
  if (!allowlist || allowlist.length === 0) return false

  const lowerItem = itemName.toLowerCase()
  return allowlist.some((allowed) => {
    const lowerAllowed = allowed.toLowerCase()

    // Exact match
    if (lowerAllowed === lowerItem) return true

    // Wildcard pattern (ending with *)
    if (allowed.endsWith('*')) {
      const prefix = lowerAllowed.slice(0, -1)
      return lowerItem.startsWith(prefix)
    }

    return false
  })
}

/** Check if cookie is in allowlist */
export function isCookieAllowed(cookieName: string, config?: SecurityConfig): boolean {
  return isInAllowlist(cookieName, config?.cookieAllowlist)
}

/** Check if header is in allowlist */
export function isHeaderAllowed(headerName: string, config?: SecurityConfig): boolean {
  return isInAllowlist(headerName, config?.headerAllowlist)
}

/** Apply default values to security configuration */
export function applyDefaultConfig(config: SecurityConfig = {}): Required<SecurityConfig> {
  return {
    cookieAllowlist: config.cookieAllowlist ?? [],
    headerAllowlist: config.headerAllowlist ?? [],
    strictMode: config.strictMode ?? false,
    jwtMinLength: config.jwtMinLength ?? 50,
    apiKeyMinLength: config.apiKeyMinLength ?? 16,
  }
}

/**
 * Validate allowlist patterns for security
 */
function validateAllowlistPatterns(patterns: string[], type: string): void {
  for (const pattern of patterns) {
    if (typeof pattern !== 'string') {
      throw new Error(`Invalid ${type} allowlist pattern: must be string, got ${typeof pattern}`)
    }

    // Check for dangerous characters
    if (pattern.includes('\0') || pattern.includes('\n') || pattern.includes('\r')) {
      throw new Error(
        `Invalid ${type} allowlist pattern: contains dangerous characters: ${pattern}`,
      )
    }

    // Validate wildcard usage (only * at end is allowed)
    const asteriskCount = (pattern.match(/\*/g) || []).length
    if (asteriskCount > 1 || (asteriskCount === 1 && !pattern.endsWith('*'))) {
      throw new Error(
        `Invalid ${type} allowlist pattern: wildcard (*) only allowed at end: ${pattern}`,
      )
    }
  }
}

/** Validate security configuration to prevent injection attacks */
export function validateSecurityConfig(config: SecurityConfig): void {
  if (config.cookieAllowlist) {
    validateAllowlistPatterns(config.cookieAllowlist, 'cookie')
  }
  if (config.headerAllowlist) {
    validateAllowlistPatterns(config.headerAllowlist, 'header')
  }
}
