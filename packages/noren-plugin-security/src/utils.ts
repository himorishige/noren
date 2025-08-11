import type { CookieInfo, HeaderInfo, SecurityConfig } from './types.js'

/** Cookieヘッダー文字列を解析する */
export function parseCookieHeader(cookieHeader: string): CookieInfo[] {
  const cookies: CookieInfo[] = []

  // "Cookie: name1=value1; name2=value2; name3=value3" の形式を解析
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
        isAllowed: false, // 後でアローリストチェックで更新
      })
    }
  }

  return cookies
}

/** Set-Cookieヘッダー文字列を解析する */
export function parseSetCookieHeader(setCookieHeader: string): CookieInfo | null {
  // "Set-Cookie: name=value; Path=/; HttpOnly" の形式を解析
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
    isAllowed: false, // 後でアローリストチェックで更新
  }
}

/** HTTPヘッダー文字列を解析する */
export function parseHttpHeader(headerLine: string): HeaderInfo | null {
  const colonIndex = headerLine.indexOf(':')
  if (colonIndex <= 0) return null

  const name = headerLine.substring(0, colonIndex).trim()
  const value = headerLine.substring(colonIndex + 1).trim()

  return {
    name,
    value,
    isAllowed: false, // 後でアローリストチェックで更新
  }
}

/** Cookieがアローリストに含まれているかチェック */
export function isCookieAllowed(cookieName: string, config?: SecurityConfig): boolean {
  if (!config?.cookieAllowlist) return false

  return config.cookieAllowlist.some((allowed) => {
    // 大文字小文字を無視して比較
    if (allowed.toLowerCase() === cookieName.toLowerCase()) return true

    // ワイルドカードパターン（* で終わる）をサポート
    if (allowed.endsWith('*')) {
      const prefix = allowed.slice(0, -1).toLowerCase()
      return cookieName.toLowerCase().startsWith(prefix)
    }

    return false
  })
}

/** ヘッダーがアローリストに含まれているかチェック */
export function isHeaderAllowed(headerName: string, config?: SecurityConfig): boolean {
  if (!config?.headerAllowlist) return false

  return config.headerAllowlist.some((allowed) => {
    // 大文字小文字を無視して比較（HTTPヘッダーは大文字小文字を区別しない）
    return allowed.toLowerCase() === headerName.toLowerCase()
  })
}

/** セキュリティ設定のデフォルト値を適用 */
export function applyDefaultConfig(config: SecurityConfig = {}): Required<SecurityConfig> {
  return {
    cookieAllowlist: config.cookieAllowlist ?? [],
    headerAllowlist: config.headerAllowlist ?? [],
    strictMode: config.strictMode ?? false,
    jwtMinLength: config.jwtMinLength ?? 50,
    apiKeyMinLength: config.apiKeyMinLength ?? 16,
  }
}
