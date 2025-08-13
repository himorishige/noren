import type { Masker } from '@himorishige/noren-core'
import type { SecurityConfig } from './types.js'
import {
  isCookieAllowed,
  logSecurityError,
  parseCookieHeader,
  parseSetCookieHeader,
} from './utils.js'

/**
 * Generic token masking with configurable preserve length
 */
function maskToken(token: string, preserveStart = 4, preserveEnd = 4, minLength = 8): string {
  if (token.length <= minLength) {
    return '*'.repeat(token.length)
  }

  const actualStart = Math.min(preserveStart, Math.floor(token.length / 3))
  const actualEnd = Math.min(preserveEnd, Math.floor(token.length / 3))
  const maskLength = Math.max(1, token.length - actualStart - actualEnd)

  return (
    token.substring(0, actualStart) +
    '*'.repeat(maskLength) +
    token.substring(token.length - actualEnd)
  )
}

/** Mask JWT while preserving structure */
function maskJwtStructure(jwt: string): string {
  const parts = jwt.split('.')
  if (parts.length !== 3) return '[REDACTED:JWT]'

  return parts.map((part) => maskToken(part, 3, 3, 6)).join('.')
}

/** Mask API key while preserving prefix */
function maskApiKey(apiKey: string): string {
  const prefixMatch = apiKey.match(/^([a-z]+_)(.+)$/i)
  if (prefixMatch) {
    const [, prefix, suffix] = prefixMatch
    return prefix + '*'.repeat(Math.max(4, suffix.length))
  }
  return maskToken(apiKey)
}

/** Mask tokens with standard pattern */
function maskStandardToken(token: string): string {
  return maskToken(token)
}

/** Mask session IDs */
function maskSessionId(sessionId: string): string {
  const equalIndex = sessionId.indexOf('=')
  if (equalIndex === -1) return '[REDACTED:SESSION]'

  const name = sessionId.substring(0, equalIndex + 1)
  const value = sessionId.substring(equalIndex + 1)

  return name + maskToken(value, 3, 3, 6)
}

/**
 * Generic cookie header masker with error handling
 */
function maskCookieWithErrorHandling(
  headerValue: string,
  config: SecurityConfig | undefined,
  parseFunc: typeof parseCookieHeader | typeof parseSetCookieHeader,
  isSetCookie = false,
): string {
  try {
    if (isSetCookie) {
      const cookie = parseFunc(headerValue) as ReturnType<typeof parseSetCookieHeader>
      if (!cookie) return '[REDACTED:SET-COOKIE]'

      if (isCookieAllowed(cookie.name, config)) return headerValue

      const maskedValue = maskToken(cookie.value, 2, 2, 6)
      return headerValue.replace(/^(Set-Cookie\s*:\s*[^=]+=)([^;]+)(.*)$/i, `$1${maskedValue}$3`)
    } else {
      const cookies = parseFunc(headerValue) as ReturnType<typeof parseCookieHeader>
      const maskedPairs = cookies.map((cookie) =>
        isCookieAllowed(cookie.name, config)
          ? `${cookie.name}=${cookie.value}`
          : `${cookie.name}=${maskToken(cookie.value, 2, 2, 6)}`,
      )
      return `Cookie: ${maskedPairs.join('; ')}`
    }
  } catch (error) {
    const errorObj = error instanceof Error ? error : new Error(String(error))
    logSecurityError(`${isSetCookie ? 'Set-Cookie' : 'Cookie'} masking`, errorObj, headerValue)
    return `[REDACTED:${isSetCookie ? 'SET-COOKIE' : 'COOKIE'}]`
  }
}

/** Mask Cookie header with allowlist consideration */
function maskCookieHeader(cookieHeader: string, config?: SecurityConfig): string {
  return maskCookieWithErrorHandling(cookieHeader, config, parseCookieHeader, false)
}

/** Mask Set-Cookie header with allowlist consideration */
function maskSetCookieHeader(setCookieHeader: string, config?: SecurityConfig): string {
  return maskCookieWithErrorHandling(setCookieHeader, config, parseSetCookieHeader, true)
}

/** Create masker functions with configuration */
export function createSecurityMaskers(config?: SecurityConfig): Record<string, Masker> {
  return {
    sec_jwt_token: (h) => maskJwtStructure(h.value),
    sec_api_key: (h) => maskApiKey(h.value),
    sec_uuid_token: (h) => maskStandardToken(h.value),
    sec_hex_token: (h) => maskStandardToken(h.value),
    sec_session_id: (h) => maskSessionId(h.value),
    sec_auth_header: () => '[REDACTED:AUTH]',
    sec_cookie: (h) => maskCookieHeader(h.value, config),
    sec_set_cookie: (h) => maskSetCookieHeader(h.value, config),
    sec_url_token: () => '[REDACTED:URL-TOKEN]',
    sec_client_secret: () => '[REDACTED:CLIENT-SECRET]',
  }
}

/** Default security maskers without configuration */
export const maskers: Record<string, Masker> = createSecurityMaskers()
