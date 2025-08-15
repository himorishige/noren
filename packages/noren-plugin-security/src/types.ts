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
  // === NEW ENHANCED SECURITY TYPES ===
  | 'sec_github_token' // GitHub Personal Access Tokens (ghp_, gho_, etc.)
  | 'sec_aws_access_key' // AWS Access Key ID (AKIA, ASIA, etc.)
  | 'sec_google_api_key' // Google/Firebase API Keys (AIza...)
  | 'sec_stripe_api_key' // Stripe API Keys (sk_live_, pk_test_, etc.)
  | 'sec_slack_token' // Slack Tokens (xoxb-, xoxp-, etc.)
  | 'sec_sendgrid_api_key' // SendGrid API Keys (SG....)
  | 'sec_openai_api_key' // OpenAI API Keys (sk-proj-, sk-)
  | 'sec_google_oauth_token' // Google OAuth Tokens (ya29., 1//...)
  | 'sec_azure_subscription_key' // Azure Subscription Keys
  | 'sec_webhook_url' // Webhook URLs (Slack, Discord, GitHub)
  | 'sec_signed_url' // Signed URLs (AWS S3, GCS, Azure SAS)

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

/** Security-specific features for Hit objects */
export interface SecurityFeatures {
  // JWT-specific features
  hasJwtStructure?: boolean
  partCount?: number
  validationPassed?: boolean

  // API Key-specific features
  hasKnownPrefix?: boolean
  keyLength?: number
  prefix?: string
  entropy?: number

  // General security features
  requiresContext?: boolean

  // Token-specific features
  tokenLength?: number
  riskLevel?: string
  isSensitiveParam?: boolean

  // Header/Cookie-specific features
  hasAuthStructure?: boolean
  authType?: string
  cookieCount?: number
  hasSensitiveCookies?: boolean

  // Session-specific features
  hasSessionStructure?: boolean
  parameterName?: string
  valueLength?: number

  // Credential-specific features
  credentialType?: string
  isClientSecret?: boolean

  // UUID/Hex token features
  hasUuidFormat?: boolean
  isHexadecimal?: boolean
  phoneType?: string

  // === NEW ENHANCED FEATURES ===
  // Service-specific features
  service?: string
  provider?: string
  environment?: 'live' | 'test' | 'development'

  // GitHub-specific features
  tokenType?: 'personal' | 'organization' | 'app' | 'user'

  // AWS-specific features
  keyType?: 'access_key' | 'secret_key' | 'session_token'

  // URL-specific features
  isWebhook?: boolean
  isSignedUrl?: boolean
  urlLength?: number

  // Enhanced validation features
  hasKnownFormat?: boolean
  passedValidation?: boolean
  contextScore?: number

  // Multi-parameter features (for signed URLs)
  parameterCount?: number
  hasRequiredParams?: boolean
}
