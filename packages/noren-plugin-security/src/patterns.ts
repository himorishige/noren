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

  // === NEW PATTERNS FOR ENHANCED SECURITY DETECTION ===

  // GitHub Personal Access Tokens (4 char prefix + 38 char suffix = 42 total)
  githubToken: /(?<![¥$€£¢])\b(gh[opusa]_[A-Za-z0-9]{38})\b(?![¥$€£¢])/g,

  // AWS Access Key ID
  awsAccessKey: /(?<![¥$€£¢])\b((?:AKIA|ASIA|AGPA|AIDA|ANPA|AROA|AIPA)[A-Z0-9]{16})\b(?![¥$€£¢])/g,

  // Google/Firebase API Keys
  googleApiKey: /(?<![¥$€£¢])\b(AIza[0-9A-Za-z_-]{35})\b(?![¥$€£¢])/g,

  // Stripe API Keys
  stripeApiKey: /(?<![¥$€£¢])\b((?:sk|pk)_(?:live|test)_[A-Za-z0-9]{24,})\b(?![¥$€£¢])/g,

  // Slack Tokens (both old and new formats)
  slackToken:
    /(?<![¥$€£¢])\b(xox[abps]-\d{10,}-\d{10,}-[A-Za-z0-9]{24,48}|xapp-[A-Za-z0-9-]{20,})\b(?![¥$€£¢])/g,

  // SendGrid API Keys
  sendGridApiKey: /(?<![¥$€£¢])\b(SG\.[A-Za-z0-9_-]{16,}\.[A-Za-z0-9_-]{16,})\b(?![¥$€£¢])/g,

  // OpenAI API Keys (both old and new formats)
  openAiApiKey: /(?<![¥$€£¢])\b(sk-(?:proj-)?[A-Za-z0-9_-]{20,})\b(?![¥$€£¢])/g,

  // Google OAuth Tokens
  googleOAuthToken: /(?<![¥$€£¢])\b(ya29\.[0-9A-Za-z_-]+|1\/\/[0-9A-Za-z_-]+)\b(?![¥$€£¢])/g,

  // Azure Subscription Keys (simplified to match key value directly)
  azureSubscriptionKey: /(?<![¥$€£¢A-Za-z0-9])\b([A-Za-z0-9]{32,44})\b(?![¥$€£¢A-Za-z0-9])/g,

  // Webhook URLs
  webhookUrls: {
    slack: /https:\/\/hooks\.slack\.com\/services\/T[A-Z0-9]{8}\/B[A-Z0-9]{8}\/[A-Za-z0-9]{24,}/g,
    discord: /https:\/\/(?:discord|discordapp)\.com\/api\/webhooks\/\d{16,32}\/[A-Za-z0-9_-]{30,}/g,
    github: /https:\/\/api\.github\.com\/repos\/[^/]+\/[^/]+\/hooks\/\d+/g,
  },

  // Signed URLs (AWS S3, GCS, Azure SAS)
  signedUrls: {
    awsS3: /[?&]X-Amz-(Credential|Signature|Expires|Algorithm)=[^&\s]+/g,
    googleCloud: /[?&]X-Goog-(Algorithm|Credential|Signature|Expires)=[^&\s]+/g,
    azureSas: /[?&](sv|se|sr|sp|sig)=[^&\s]+/g,
  },
} as const

/** Optimized context hint constants with Set for O(1) lookup */
export const SECURITY_CONTEXTS = {
  auth: new Set(['Authorization', 'Bearer', 'Basic', 'Auth', 'Token']),
  apiKey: new Set(['API-Key', 'X-API-Key', 'X-Auth-Token', 'API_KEY']),
  cookie: new Set(['Cookie', 'Set-Cookie', 'Session']),
  url: new Set(['token', 'access_token', 'api_key', 'client_secret']),
  jwt: new Set(['JWT', 'Bearer', 'eyJ']),
  session: new Set(['session', 'sess', 'JSESSIONID', 'PHPSESSID']),

  // === NEW CONTEXT SETS ===
  github: new Set(['github', 'gh_', 'pat', 'personal', 'access', 'token']),
  aws: new Set(['aws', 'amazon', 'akia', 'asia', 'access', 'key', 'id']),
  google: new Set(['google', 'gcp', 'firebase', 'api', 'key', 'aiza']),
  stripe: new Set(['stripe', 'sk_', 'pk_', 'live', 'test', 'payment']),
  slack: new Set(['slack', 'xox', 'bot', 'user', 'app', 'workspace']),
  sendgrid: new Set(['sendgrid', 'sg', 'email', 'mail', 'api']),
  openai: new Set(['openai', 'gpt', 'api', 'sk-', 'chat', 'completion']),
  azure: new Set(['azure', 'ocp-apim', 'subscription', 'cognitive', 'translator']),
  webhook: new Set(['webhook', 'hook', 'callback', 'notify', 'endpoint']),
  oauth: new Set(['oauth', 'ya29', 'refresh', 'access', 'bearer']),
} as const
