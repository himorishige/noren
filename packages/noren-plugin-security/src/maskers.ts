import type { Masker } from '@himorishige/noren-core'
import type { SecurityConfig } from './types.js'
import { isCookieAllowed, parseCookieHeader, parseSetCookieHeader } from './utils.js'

/** JWT構造を保持しながらマスクする */
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

/** API Keyのプリフィックスを保持してマスクする */
function maskApiKey(apiKey: string): string {
  const prefixMatch = apiKey.match(/^([a-z]+_)(.+)$/i)
  if (prefixMatch) {
    const [, prefix, suffix] = prefixMatch
    return prefix + '*'.repeat(Math.max(4, suffix.length))
  }

  // プリフィックスがない場合は最初の4文字以外をマスク
  if (apiKey.length <= 8) {
    return '*'.repeat(apiKey.length)
  }
  return apiKey.substring(0, 4) + '*'.repeat(apiKey.length - 4)
}

/** UUID形式を部分的にマスクする */
function maskUuid(uuid: string): string {
  return uuid.replace(/[0-9a-f]/gi, (match, offset) => {
    // ハイフンは保持、最初と最後の4文字以外をマスク
    if (offset < 4 || offset >= uuid.length - 4) {
      return match
    }
    return match === '-' ? '-' : '*'
  })
}

/** 16進数トークンをマスクする */
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

/** セッションIDをマスクする */
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

/** Cookieヘッダーをマスクする（アローリスト考慮） */
function maskCookieHeader(cookieHeader: string, config?: SecurityConfig): string {
  try {
    const cookies = parseCookieHeader(cookieHeader)
    const maskedPairs: string[] = []

    for (const cookie of cookies) {
      if (isCookieAllowed(cookie.name, config)) {
        // アローリストのCookieはそのまま
        maskedPairs.push(`${cookie.name}=${cookie.value}`)
      } else {
        // アローリスト外のCookieをマスク
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
  } catch {
    return '[REDACTED:COOKIE]'
  }
}

/** Set-Cookieヘッダーをマスクする（アローリスト考慮） */
function maskSetCookieHeader(setCookieHeader: string, config?: SecurityConfig): string {
  try {
    const cookie = parseSetCookieHeader(setCookieHeader)
    if (!cookie) return '[REDACTED:SET-COOKIE]'

    if (isCookieAllowed(cookie.name, config)) {
      // アローリストのCookieはそのまま
      return setCookieHeader
    }

    // アローリスト外のCookieをマスク
    const maskedValue =
      cookie.value.length <= 6
        ? '*'.repeat(cookie.value.length)
        : cookie.value.substring(0, 2) +
          '*'.repeat(cookie.value.length - 4) +
          cookie.value.substring(cookie.value.length - 2)

    // 元の形式を保持しつつ値のみマスク
    return setCookieHeader.replace(/^(Set-Cookie\s*:\s*[^=]+=)([^;]+)(.*)$/i, `$1${maskedValue}$3`)
  } catch {
    return '[REDACTED:SET-COOKIE]'
  }
}

/** 設定付きマスカー関数を作成 */
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

/** デフォルトのセキュリティマスカー（設定なし） */
export const maskers: Record<string, Masker> = createSecurityMaskers()
