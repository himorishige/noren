import type { Masker } from '@himorishige/noren-core'
import type { SecurityConfig } from './types.js'
import {
  isCookieAllowed,
  logSecurityError,
  parseCookieHeader,
  parseSetCookieHeader,
} from './utils.js'

/** Mask JWT while preserving structure */
function maskJwtStructure(jwt: string): string {
  const parts = jwt.split('.')
  if (parts.length !== 3) {
    return '[REDACTED:JWT]'
  }

  const [header, payload, signature] = parts
  const maskPart = (part: string) => {
    if (part.length <= 6) return '*'.repeat(part.length)
    return (
      part.substring(0, 3) +
      '*'.repeat(Math.max(0, part.length - 6)) +
      part.substring(part.length - 3)
    )
  }

  return `${maskPart(header)}.${maskPart(payload)}.${maskPart(signature)}`
}

/** Mask API key while preserving prefix */
function maskApiKey(apiKey: string): string {
  const prefixMatch = apiKey.match(/^([a-z]+_)(.+)$/i)
  if (prefixMatch) {
    const [, prefix, suffix] = prefixMatch
    return prefix + '*'.repeat(Math.max(4, suffix.length))
  }

  // Mask all but first 4 characters if no prefix
  if (apiKey.length <= 8) {
    return '*'.repeat(apiKey.length)
  }
  return apiKey.substring(0, 4) + '*'.repeat(apiKey.length - 4)
}

/** Partially mask UUID format */
function maskUuid(uuid: string): string {
  if (uuid.length <= 8) {
    return '*'.repeat(uuid.length)
  }
  // Keep first and last 4 characters, mask the middle
  const start = uuid.substring(0, 4)
  const end = uuid.substring(uuid.length - 4)
  const middle = uuid.substring(4, uuid.length - 4)
  const maskedMiddle = middle.replace(/[0-9a-f]/gi, '*')
  return start + maskedMiddle + end
}

/** Mask hexadecimal tokens */
function maskHexToken(hexToken: string): string {
  if (hexToken.length <= 8) {
    return '*'.repeat(hexToken.length)
  }
  return (
    hexToken.substring(0, 4) +
    '*'.repeat(hexToken.length - 8) +
    hexToken.substring(hexToken.length - 4)
  )
}

/** Mask session IDs */
function maskSessionId(sessionId: string): string {
  const equalIndex = sessionId.indexOf('=')
  if (equalIndex === -1) {
    return '[REDACTED:SESSION]'
  }

  const name = sessionId.substring(0, equalIndex + 1)
  const value = sessionId.substring(equalIndex + 1)

  if (value.length <= 6) {
    return name + '*'.repeat(value.length)
  }
  return (
    name + value.substring(0, 3) + '*'.repeat(value.length - 6) + value.substring(value.length - 3)
  )
}

/** Mask Cookie header with allowlist consideration */
function maskCookieHeader(cookieHeader: string, config?: SecurityConfig): string {
  try {
    const cookies = parseCookieHeader(cookieHeader)
    const maskedPairs: string[] = []

    for (const cookie of cookies) {
      if (isCookieAllowed(cookie.name, config)) {
        // Keep allowlisted cookies as-is
        maskedPairs.push(`${cookie.name}=${cookie.value}`)
      } else {
        // Mask non-allowlisted cookies
        const maskedValue =
          cookie.value.length <= 6
            ? '*'.repeat(cookie.value.length)
            : cookie.value.substring(0, 2) +
              '*'.repeat(cookie.value.length - 4) +
              cookie.value.substring(cookie.value.length - 2)
        maskedPairs.push(`${cookie.name}=${maskedValue}`)
      }
    }

    return `Cookie: ${maskedPairs.join('; ')}`
  } catch (error) {
    logSecurityError('Cookie masking', error as Error, cookieHeader)
    return '[REDACTED:COOKIE]'
  }
}

/** Mask Set-Cookie header with allowlist consideration */
function maskSetCookieHeader(setCookieHeader: string, config?: SecurityConfig): string {
  try {
    const cookie = parseSetCookieHeader(setCookieHeader)
    if (!cookie) return '[REDACTED:SET-COOKIE]'

    if (isCookieAllowed(cookie.name, config)) {
      // Keep allowlisted cookies as-is
      return setCookieHeader
    }

    // Mask non-allowlisted cookies
    const maskedValue =
      cookie.value.length <= 6
        ? '*'.repeat(cookie.value.length)
        : cookie.value.substring(0, 2) +
          '*'.repeat(cookie.value.length - 4) +
          cookie.value.substring(cookie.value.length - 2)

    // Preserve original format while masking only the value
    return setCookieHeader.replace(/^(Set-Cookie\s*:\s*[^=]+=)([^;]+)(.*)$/i, `$1${maskedValue}$3`)
  } catch (error) {
    logSecurityError('Set-Cookie masking', error as Error, setCookieHeader)
    return '[REDACTED:SET-COOKIE]'
  }
}

/** Create masker functions with configuration */
export function createSecurityMaskers(config?: SecurityConfig): Record<string, Masker> {
  return {
    sec_jwt_token: (h) => maskJwtStructure(h.value),
    sec_api_key: (h) => maskApiKey(h.value),
    sec_uuid_token: (h) => maskUuid(h.value),
    sec_hex_token: (h) => maskHexToken(h.value),
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
