// Security detection patterns

/** Pre-compiled regex patterns */
export const SECURITY_PATTERNS = {
  // Authorization header (Bearer, Basic)
  authHeader: /Authorization\s*:\s*((?:Bearer|Basic)\s+[A-Za-z0-9+/=._-]{8,})/gi,

  // JWT pattern (header starting with eyJ, payload, signature)
  jwt: /\beyJ[A-Za-z0-9+/=._-]{10,}\.[A-Za-z0-9+/=._-]{10,}\.[A-Za-z0-9+/=._-]{8,}\b/g,

  // API Key patterns with common prefixes
  apiKey: /\b(?:sk_|pk_|api_|key_)[A-Za-z0-9_]{8,}\b/g,

  // API key headers
  apiKeyHeader:
    /(?:X-API-Key|X-Auth-Token|X-Access-Token|API-Key|Auth-Token)\s*:\s*([A-Za-z0-9+/=._-]{8,})/gi,

  // Token parameters in URLs
  urlTokens:
    /[?&](token|access_token|api_key|client_secret|refresh_token|auth_token)=([^&\s]{8,})/gi,

  // Client ID/Secret
  clientCredentials: /[?&](client_id|client_secret)=([^&\s]{8,})/gi,

  // UUID v4 pattern
  uuid: /\b[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/gi,

  // Long hexadecimal strings (session IDs, etc.)
  hexToken: /\b[0-9a-fA-F]{32,}\b/g,

  // Cookie values (name=value format)
  cookie: /Cookie\s*:\s*([^;\r\n]+(?:;\s*[^;\r\n]+)*)/gi,

  // Set-Cookie values
  setCookie: /Set-Cookie\s*:\s*([^;\r\n]+(?:;\s*[^;\r\n]+)*)/gi,

  // Common session ID formats
  sessionId: /\b(?:session|sess|jsessionid|phpsessid)=([A-Za-z0-9+/=._-]{8,})/gi,
} as const

/** Context hint constants */
export const SECURITY_CONTEXTS = {
  auth: ['Authorization', 'Bearer', 'Basic', 'Auth', 'Token'],
  apiKey: ['API-Key', 'X-API-Key', 'X-Auth-Token', 'API_KEY'],
  cookie: ['Cookie', 'Set-Cookie', 'Session'],
  url: ['token', 'access_token', 'api_key', 'client_secret'],
  jwt: ['JWT', 'Bearer', 'eyJ'],
  session: ['session', 'sess', 'JSESSIONID', 'PHPSESSID'],
} as const
