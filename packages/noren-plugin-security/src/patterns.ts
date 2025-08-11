// Security detection patterns

/** 事前コンパイル済み正規表現パターン */
export const SECURITY_PATTERNS = {
  // Authorization ヘッダー（Bearer, Basic）
  authHeader: /Authorization\s*:\s*((?:Bearer|Basic)\s+[A-Za-z0-9+/=._-]{8,})/gi,

  // JWT パターン (eyJ で始まるheader、任意のpayload、signature)
  jwt: /\beyJ[A-Za-z0-9+/=._-]{10,}\.[A-Za-z0-9+/=._-]{10,}\.[A-Za-z0-9+/=._-]{8,}\b/g,

  // API Key パターン（よくあるプリフィックス付き）
  apiKey: /\b(?:sk_|pk_|api_|key_)[A-Za-z0-9_]{8,}\b/g,

  // APIキー系ヘッダー
  apiKeyHeader:
    /(?:X-API-Key|X-Auth-Token|X-Access-Token|API-Key|Auth-Token)\s*:\s*([A-Za-z0-9+/=._-]{8,})/gi,

  // URL内のトークンパラメータ
  urlTokens:
    /[?&](token|access_token|api_key|client_secret|refresh_token|auth_token)=([^&\s]{8,})/gi,

  // Client ID/Secret
  clientCredentials: /[?&](client_id|client_secret)=([^&\s]{8,})/gi,

  // UUID v4 パターン
  uuid: /\b[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/gi,

  // 長い16進数文字列（セッションIDなど）
  hexToken: /\b[0-9a-fA-F]{32,}\b/g,

  // Cookie値（名前=値の形式）
  cookie: /Cookie\s*:\s*([^;\r\n]+(?:;\s*[^;\r\n]+)*)/gi,

  // Set-Cookie値
  setCookie: /Set-Cookie\s*:\s*([^;\r\n]+(?:;\s*[^;\r\n]+)*)/gi,

  // 一般的なセッションID形式
  sessionId: /\b(?:session|sess|jsessionid|phpsessid)=([A-Za-z0-9+/=._-]{8,})/gi,
} as const

/** コンテキストヒント定数 */
export const SECURITY_CONTEXTS = {
  auth: ['Authorization', 'Bearer', 'Basic', 'Auth', 'Token'],
  apiKey: ['API-Key', 'X-API-Key', 'X-Auth-Token', 'API_KEY'],
  cookie: ['Cookie', 'Set-Cookie', 'Session'],
  url: ['token', 'access_token', 'api_key', 'client_secret'],
  jwt: ['JWT', 'Bearer', 'eyJ'],
  session: ['session', 'sess', 'JSESSIONID', 'PHPSESSID'],
} as const
