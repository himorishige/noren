// Security plugin types

export interface SecurityConfig {
  /** List of allowed cookie names (these will not be masked) */
  cookieAllowlist?: string[]
  /** List of allowed header names (these will not be masked) */
  headerAllowlist?: string[]
  /** Strict mode - performs more conservative detection */
  strictMode?: boolean
  /** Minimum length for JWT detection (default: 50) */
  jwtMinLength?: number
  /** Minimum length for API key detection (default: 16) */
  apiKeyMinLength?: number
}

/** Security-related PII types */
export type SecurityPiiType =
  | 'sec_auth_header' // Authorization Bearer/Basic
  | 'sec_api_key' // X-API-Key, X-Auth-Token, etc.
  | 'sec_cookie' // Cookie values (allowlist-based)
  | 'sec_set_cookie' // Set-Cookie values
  | 'sec_url_token' // token, access_token, api_key, etc.
  | 'sec_client_secret' // client_secret, client_id, etc.
  | 'sec_jwt_token' // JWT format (xxx.yyy.zzz)
  | 'sec_uuid_token' // UUID format tokens
  | 'sec_hex_token' // Long hexadecimal strings
  | 'sec_session_id' // Session ID format

/** Cookie parsing result */
export interface CookieInfo {
  name: string
  value: string
  isAllowed: boolean
}

/** HTTP header parsing result */
export interface HeaderInfo {
  name: string
  value: string
  isAllowed: boolean
}
