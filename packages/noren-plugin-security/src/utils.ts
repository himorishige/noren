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

/** Parse Cookie header string */
export function parseCookieHeader(cookieHeader: string): CookieInfo[] {
  const cookies: CookieInfo[] = []

  // Parse format: "Cookie: name1=value1; name2=value2; name3=value3"
  const cookieValue = cookieHeader.replace(/^Cookie\s*:\s*/i, '')
  const pairs = cookieValue.split(';')

  for (const pair of pairs) {
    const trimmed = pair.trim()
    const equalIndex = trimmed.indexOf('=')

    if (equalIndex > 0) {
      const name = trimmed.substring(0, equalIndex).trim()
      const value = trimmed.substring(equalIndex + 1).trim()

      cookies.push({
        name,
        value,
        isAllowed: false, // Updated later by allowlist check
      })
    }
  }

  return cookies
}

/** Parse Set-Cookie header string */
export function parseSetCookieHeader(setCookieHeader: string): CookieInfo | null {
  // Parse format: "Set-Cookie: name=value; Path=/; HttpOnly"
  const cookieValue = setCookieHeader.replace(/^Set-Cookie\s*:\s*/i, '')
  const parts = cookieValue.split(';')

  if (parts.length === 0) return null

  const mainPart = parts[0].trim()
  const equalIndex = mainPart.indexOf('=')

  if (equalIndex <= 0) return null

  const name = mainPart.substring(0, equalIndex).trim()
  const value = mainPart.substring(equalIndex + 1).trim()

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

/** Check if cookie is in allowlist */
export function isCookieAllowed(cookieName: string, config?: SecurityConfig): boolean {
  if (!config?.cookieAllowlist) return false

  return config.cookieAllowlist.some((allowed) => {
    // Case-insensitive comparison
    if (allowed.toLowerCase() === cookieName.toLowerCase()) return true

    // Support wildcard patterns (ending with *)
    if (allowed.endsWith('*')) {
      const prefix = allowed.slice(0, -1).toLowerCase()
      return cookieName.toLowerCase().startsWith(prefix)
    }

    return false
  })
}

/** Check if header is in allowlist */
export function isHeaderAllowed(headerName: string, config?: SecurityConfig): boolean {
  if (!config?.headerAllowlist) return false

  return config.headerAllowlist.some((allowed) => {
    // Case-insensitive comparison (HTTP headers are case-insensitive)
    return allowed.toLowerCase() === headerName.toLowerCase()
  })
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

/** Validate security configuration to prevent injection attacks */
export function validateSecurityConfig(config: SecurityConfig): void {
  // Validate cookie allowlist patterns
  if (config.cookieAllowlist) {
    for (const pattern of config.cookieAllowlist) {
      if (typeof pattern !== 'string') {
        throw new Error(`Invalid cookie allowlist pattern: must be string, got ${typeof pattern}`)
      }
      // Check for potentially dangerous characters (prevent injection)
      if (pattern.includes('\0') || pattern.includes('\n') || pattern.includes('\r')) {
        throw new Error(
          `Invalid cookie allowlist pattern: contains dangerous characters: ${pattern}`,
        )
      }
      // Validate wildcard usage (only * at end is allowed)
      const asteriskCount = (pattern.match(/\*/g) || []).length
      if (asteriskCount > 1 || (asteriskCount === 1 && !pattern.endsWith('*'))) {
        throw new Error(
          `Invalid cookie allowlist pattern: wildcard (*) only allowed at end: ${pattern}`,
        )
      }
    }
  }

  // Validate header allowlist patterns
  if (config.headerAllowlist) {
    for (const pattern of config.headerAllowlist) {
      if (typeof pattern !== 'string') {
        throw new Error(`Invalid header allowlist pattern: must be string, got ${typeof pattern}`)
      }
      // Check for potentially dangerous characters
      if (pattern.includes('\0') || pattern.includes('\n') || pattern.includes('\r')) {
        throw new Error(
          `Invalid header allowlist pattern: contains dangerous characters: ${pattern}`,
        )
      }
      // Validate wildcard usage
      const asteriskCount = (pattern.match(/\*/g) || []).length
      if (asteriskCount > 1 || (asteriskCount === 1 && !pattern.endsWith('*'))) {
        throw new Error(
          `Invalid header allowlist pattern: wildcard (*) only allowed at end: ${pattern}`,
        )
      }
    }
  }
}
