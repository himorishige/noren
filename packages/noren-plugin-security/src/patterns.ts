// Security detection patterns with improved boundaries

/** Pre-compiled regex patterns with enhanced boundary detection */
export const SECURITY_PATTERNS = {
  // Authorization header (Bearer, Basic) - enhanced boundary
  authHeader: /Authorization\s*:\s*((?:Bearer|Basic)\s+(?![¥$€£¢])[A-Za-z0-9+/=._-]{8,})/gi,

  // JWT pattern - enhanced with currency symbol boundaries
  jwt: /(?<![¥$€£¢])\beyJ[A-Za-z0-9+/=._-]{10,}\.[A-Za-z0-9+/=._-]{10,}\.[A-Za-z0-9+/=._-]{8,}\b(?![¥$€£¢])/g,

  // API Key patterns - enhanced boundaries
  apiKey: /(?<![¥$€£¢])\b(?:sk_|pk_|api_|key_)[A-Za-z0-9_]{8,}\b(?![¥$€£¢])/g,

  // API key headers - enhanced validation
  apiKeyHeader:
    /(?:X-API-Key|X-Auth-Token|X-Access-Token|API-Key|Auth-Token)\s*:\s*(?![¥$€£¢])([A-Za-z0-9+/=._-]{8,})(?![¥$€£¢])/gi,

  // URL token parameters - improved boundary detection
  urlTokens:
    /[?&](token|access_token|api_key|client_secret|refresh_token|auth_token)=(?![¥$€£¢])([^&\s¥$€£¢]{8,})(?![¥$€£¢])/gi,

  // Client credentials - enhanced boundaries
  clientCredentials: /[?&](client_id|client_secret)=(?![¥$€£¢])([^&\s¥$€£¢]{8,})(?![¥$€£¢])/gi,

  // UUID v4 pattern - enhanced boundaries
  uuid: /(?<![¥$€£¢0-9a-fA-F])\b[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b(?![¥$€£¢0-9a-fA-F])/gi,

  // Hexadecimal tokens - improved boundaries
  hexToken: /(?<![¥$€£¢0-9a-fA-F])\b[0-9a-fA-F]{32,}\b(?![¥$€£¢0-9a-fA-F])/g,

  // Cookie and Set-Cookie headers (unchanged - already contextual)
  cookie: /Cookie\s*:\s*([^;\r\n]+(?:;\s*[^;\r\n]+)*)/gi,
  setCookie: /Set-Cookie\s*:\s*([^;\r\n]+(?:;\s*[^;\r\n]+)*)/gi,

  // Session ID formats - enhanced boundaries
  sessionId:
    /(?<![¥$€£¢])\b(?:session|sess|jsessionid|phpsessid)=([A-Za-z0-9+/=._-]{8,})(?![¥$€£¢])/gi,
} as const

/** Optimized context hint constants with Set for O(1) lookup */
export const SECURITY_CONTEXTS = {
  auth: new Set(['Authorization', 'Bearer', 'Basic', 'Auth', 'Token']),
  apiKey: new Set(['API-Key', 'X-API-Key', 'X-Auth-Token', 'API_KEY']),
  cookie: new Set(['Cookie', 'Set-Cookie', 'Session']),
  url: new Set(['token', 'access_token', 'api_key', 'client_secret']),
  jwt: new Set(['JWT', 'Bearer', 'eyJ']),
  session: new Set(['session', 'sess', 'JSESSIONID', 'PHPSESSID']),
} as const
