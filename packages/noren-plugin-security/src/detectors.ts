import type { Detector } from '@himorishige/noren-core'
import { SECURITY_CONTEXTS, SECURITY_PATTERNS } from './patterns.js'
// biome-ignore lint/correctness/noUnusedImports: type imported for future configuration features
import type { SecurityConfig } from './types.js'
import { logSecurityError, parseCookieHeader, parseSetCookieHeader } from './utils.js'

// Pre-calculated confidence thresholds for performance
const CONFIDENCE_THRESHOLDS = {
  jwt: { base: 0.7, valid: 0.99, invalid: 0.4 },
  apiKey: { base: 0.5, max: 0.95, min: 0.1 },
  uuid: 0.7,
  hex: 0.65,
  session: 0.85,
  auth: 0.9,
  url: { high: 0.8, medium: 0.65 },
  client: { secret: 0.9, other: 0.75 },
  cookie: { base: 0.7, setCookie: 0.72 },

  // === NEW THRESHOLDS FOR ENHANCED DETECTION ===
  github: 0.95, // GitHub tokens have very stable format
  aws: 0.92, // AWS access keys are highly structured
  google: 0.93, // Google API keys have consistent format
  stripe: 0.91, // Stripe keys are well-defined
  slack: 0.89, // Slack tokens have good structure
  sendgrid: 0.9, // SendGrid has unique dot-separated format
  openai: 0.88, // OpenAI keys are structured
  azure: 0.86, // Azure subscription keys
  webhook: 0.82, // Webhook URLs need domain validation
  oauth: 0.75, // OAuth tokens vary more in format
} as const

/**
 * Context-based scoring system for enhanced detection accuracy
 */
function _calculateContextScore(
  text: string,
  match: RegExpMatchArray,
  baseConfidence: number,
): { confidence: number; reasons: string[] } {
  const reasons: string[] = []
  let score = 80 // Base score for pattern match

  // Get surrounding context (±50 chars)
  const start = Math.max(0, (match.index || 0) - 50)
  const end = Math.min(text.length, (match.index || 0) + match[0].length + 50)
  const context = text.slice(start, end).toLowerCase()

  // Positive indicators
  if (/(?:secret|key|token|password|bearer|api|auth|credential)/.test(context)) {
    score += 20
    reasons.push('security_context')
  }

  if (/(?:\.env|config|settings|\.npmrc|\.git-credentials)/.test(context)) {
    score += 25
    reasons.push('config_file_context')
  }

  if (/(?:authorization:|bearer |api[_-]?key:|x-api-key:)/.test(context)) {
    score += 30
    reasons.push('header_context')
  }

  // Negative indicators
  if (/(?:test|sample|dummy|placeholder|example|your_|xxxxx)/.test(context)) {
    score -= 40
    reasons.push('test_sample_context')
  }

  if (/(?:tests?\/|examples?\/|docs?\/|readme|documentation)/.test(context)) {
    score -= 35
    reasons.push('documentation_context')
  }

  // Calculate final confidence
  const finalConfidence = Math.max(0.1, Math.min(0.99, baseConfidence * (score / 100)))

  return {
    confidence: finalConfidence,
    reasons: [...reasons, `score_${score}`],
  }
}

/**
 * Unified token validation for API keys and similar patterns
 */
function validateToken(token: string, minLength = 16): { confidence: number; reasons: string[] } {
  const reasons: string[] = []
  let confidence = 0.7 // Higher base confidence for API keys with prefixes

  // Length check
  if (token.length >= 20) {
    confidence += 0.15
    reasons.push('sufficient_length')
  } else if (token.length < minLength) {
    confidence -= 0.1
    reasons.push('short_length')
  }

  // Character diversity (simplified check)
  const charTypes = [
    /[a-z]/.test(token),
    /[A-Z]/.test(token),
    /\d/.test(token),
    /[_\-+/=]/.test(token),
  ].filter(Boolean).length

  if (charTypes >= 3) {
    confidence += 0.1
    reasons.push('diverse_characters')
  }

  // Check for obvious patterns
  if (/(.{3,})\1/.test(token)) {
    confidence -= 0.2
    reasons.push('repeating_pattern')
  }

  return {
    confidence: Math.max(
      CONFIDENCE_THRESHOLDS.apiKey.min,
      Math.min(CONFIDENCE_THRESHOLDS.apiKey.max, confidence),
    ),
    reasons,
  }
}

/**
 * Fast JWT structure validation with proper confidence scoring
 */
function validateJwtStructure(token: string): {
  valid: boolean
  confidence: number
  reasons: string[]
} {
  const parts = token.split('.')
  if (parts.length !== 3) {
    return { valid: false, confidence: 0.2, reasons: ['invalid_part_count'] }
  }

  const [header, payload, signature] = parts
  const reasons = ['three_part_format']
  let confidence = 0.7 // Base confidence

  // Length validation
  if (header.length < 10 || payload.length < 10 || signature.length < 8) {
    return {
      valid: false,
      confidence: CONFIDENCE_THRESHOLDS.jwt.invalid,
      reasons: ['invalid_part_lengths'],
    }
  }

  // Base64URL character validation
  const base64UrlPattern = /^[A-Za-z0-9_-]+$/
  if (
    !base64UrlPattern.test(header) ||
    !base64UrlPattern.test(payload) ||
    !base64UrlPattern.test(signature)
  ) {
    return {
      valid: false,
      confidence: CONFIDENCE_THRESHOLDS.jwt.invalid,
      reasons: ['invalid_base64url'],
    }
  }

  reasons.push('valid_base64url')
  confidence += 0.1

  // JWT pattern starts with eyJ (Base64 for {"typ":"JWT",...})
  if (header.startsWith('eyJ')) {
    confidence += 0.15
    reasons.push('jwt_header_pattern')
  }

  // Additional length bonus for realistic tokens
  if (token.length >= 100 && token.length <= 2000) {
    confidence += 0.05
    reasons.push('realistic_length')
  }

  return {
    valid: true,
    confidence: Math.min(CONFIDENCE_THRESHOLDS.jwt.valid, confidence),
    reasons,
  }
}

/**
 * Generic detector helper for pattern matching with context
 */
function createContextualDetector(
  id: string,
  pattern: RegExp,
  type: string,
  risk: 'low' | 'medium' | 'high',
  confidence: number,
  contexts?: string[],
  validator?: (match: string) => { confidence: number; reasons: string[] } | null,
  priority?: number,
): Detector {
  return {
    id,
    ...(priority !== undefined && { priority }),
    match: ({ src, push, hasCtx, canPush }) => {
      if (contexts && !hasCtx(contexts)) return

      for (const m of src.matchAll(pattern)) {
        if (m.index === undefined || !m[0]) continue
        if (!canPush?.()) break

        let finalConfidence = confidence
        let reasons = [
          type === 'sec_jwt_token'
            ? 'jwt_pattern_match'
            : `${type.replace('sec_', '')}_pattern_match`,
        ]
        let features = {}

        if (contexts) {
          reasons.push('context_required')
          features = { requiresContext: true }
        }

        if (validator) {
          const validation = validator(m[0])
          if (!validation) continue
          finalConfidence = validation.confidence
          reasons = [...reasons, ...validation.reasons]

          // Add specific features for JWT
          if (type === 'sec_jwt_token' && 'valid' in validation) {
            features = {
              hasJwtStructure: validation.valid,
              partCount: m[0].split('.').length,
              validationPassed: validation.valid,
            }
          }
        }

        push({
          type,
          start: m.index,
          end: m.index + m[0].length,
          value: m[0],
          risk,
          confidence: finalConfidence,
          reasons,
          features,
        })
      }
    },
  }
}

/**
 * Specialized detector for URL parameters with risk assessment
 */
function createUrlTokenDetector(): Detector {
  return {
    id: 'security.url-tokens',
    match: ({ src, push, canPush }) => {
      for (const m of src.matchAll(SECURITY_PATTERNS.urlTokens)) {
        if (m.index === undefined || !m[1] || !m[2] || m[2].length < 8) continue
        if (!canPush?.()) break

        const paramName = m[1].toLowerCase()
        const isSensitive = ['secret', 'refresh', 'token', 'access_token'].some(
          (sensitive) => paramName.includes(sensitive) || paramName === sensitive,
        )
        const risk: 'medium' | 'high' = isSensitive ? 'high' : 'medium'
        const confidence = isSensitive
          ? CONFIDENCE_THRESHOLDS.url.high
          : CONFIDENCE_THRESHOLDS.url.medium

        push({
          type: 'sec_url_token',
          start: m.index,
          end: m.index + m[0].length,
          value: m[0],
          risk,
          confidence,
          reasons: ['url_token_match', `param_${paramName}`, `risk_${risk}`],
          features: {
            parameterName: paramName,
            tokenLength: m[2].length,
            isSensitive,
          },
        })
      }
    },
  }
}

/**
 * Webhook URL detector with domain validation
 */
function createWebhookDetector(): Detector {
  return {
    id: 'security.webhook-urls',
    match: ({ src, push, canPush }) => {
      // Check each webhook pattern
      const webhookPatterns = [
        { pattern: SECURITY_PATTERNS.webhookUrls.slack, service: 'slack' },
        { pattern: SECURITY_PATTERNS.webhookUrls.discord, service: 'discord' },
        { pattern: SECURITY_PATTERNS.webhookUrls.github, service: 'github' },
      ]

      for (const { pattern, service } of webhookPatterns) {
        for (const m of src.matchAll(pattern)) {
          if (m.index === undefined || !m[0]) continue
          if (!canPush?.()) break

          push({
            type: 'sec_webhook_url',
            start: m.index,
            end: m.index + m[0].length,
            value: m[0],
            risk: 'high',
            confidence: CONFIDENCE_THRESHOLDS.webhook,
            reasons: ['webhook_url_match', `service_${service}`, 'domain_validated'],
            features: {
              service,
              urlLength: m[0].length,
              isWebhook: true,
            },
          })
        }
      }
    },
  }
}

/**
 * Signed URL detector with parameter validation
 */
function createSignedUrlDetector(): Detector {
  return {
    id: 'security.signed-urls',
    match: ({ src, push, canPush }) => {
      const signedUrlPatterns = [
        { pattern: SECURITY_PATTERNS.signedUrls.awsS3, service: 'aws_s3', minParams: 2 },
        {
          pattern: SECURITY_PATTERNS.signedUrls.googleCloud,
          service: 'google_cloud',
          minParams: 2,
        },
        { pattern: SECURITY_PATTERNS.signedUrls.azureSas, service: 'azure_sas', minParams: 3 },
      ]

      for (const { pattern, service, minParams } of signedUrlPatterns) {
        const matches = [...src.matchAll(pattern)]

        // Group matches by proximity to detect complete signed URLs
        const urlGroups = new Map<number, typeof matches>()

        for (const match of matches) {
          if (!match.index) continue

          // Find nearby matches (within 500 characters)
          const groupKey = Math.floor(match.index / 500)
          if (!urlGroups.has(groupKey)) {
            urlGroups.set(groupKey, [])
          }
          urlGroups.get(groupKey)?.push(match)
        }

        // Check each group for sufficient parameters
        for (const group of urlGroups.values()) {
          if (group.length >= minParams && canPush?.()) {
            const firstMatch = group[0]
            const lastMatch = group[group.length - 1]

            if (firstMatch.index !== undefined && lastMatch.index !== undefined) {
              push({
                type: 'sec_signed_url',
                start: firstMatch.index,
                end: lastMatch.index + lastMatch[0].length,
                value: src.slice(firstMatch.index, lastMatch.index + lastMatch[0].length),
                risk: 'high',
                confidence: CONFIDENCE_THRESHOLDS.webhook,
                reasons: ['signed_url_match', `service_${service}`, `param_count_${group.length}`],
                features: {
                  service,
                  parameterCount: group.length,
                  isSignedUrl: true,
                },
              })
            }
          }
        }
      }
    },
  }
}

/**
 * Cookie header detector with parsing
 */
function createCookieDetector(setCookie = false): Detector {
  const pattern = setCookie ? SECURITY_PATTERNS.setCookie : SECURITY_PATTERNS.cookie
  const type = setCookie ? 'sec_set_cookie' : 'sec_cookie'
  const parseFunc = setCookie ? parseSetCookieHeader : parseCookieHeader
  const confidence = setCookie
    ? CONFIDENCE_THRESHOLDS.cookie.setCookie
    : CONFIDENCE_THRESHOLDS.cookie.base

  return {
    id: `security.${setCookie ? 'set-' : ''}cookie`,
    match: ({ src, push, hasCtx, canPush }) => {
      if (!hasCtx([...SECURITY_CONTEXTS.cookie])) return

      for (const m of src.matchAll(pattern)) {
        if (m.index === undefined || !m[1]) continue
        if (!canPush?.()) break

        try {
          if (setCookie) {
            const cookie = parseFunc(m[0]) as ReturnType<typeof parseSetCookieHeader>
            if (!cookie || cookie.value.length < 8) continue

            push({
              type,
              start: m.index,
              end: m.index + m[0].length,
              value: m[0],
              risk: 'medium',
              confidence,
              reasons: ['set_cookie_match', 'context_required'],
              features: {
                cookieName: cookie.name,
                cookieValueLength: cookie.value.length,
                requiresContext: true,
              },
            })
          } else {
            const cookies = parseFunc(m[0]) as ReturnType<typeof parseCookieHeader>
            if (cookies.some((c) => c.value.length >= 8)) {
              push({
                type,
                start: m.index,
                end: m.index + m[0].length,
                value: m[0],
                risk: 'medium',
                confidence,
                reasons: ['cookie_match', 'context_required'],
                features: {
                  cookieCount: cookies.length,
                  requiresContext: true,
                  hasSensitiveCookies: cookies.some((c) => c.value.length >= 8),
                },
              })
            }
          }
        } catch (error) {
          const errorObj = error instanceof Error ? error : new Error(String(error))
          logSecurityError(`${setCookie ? 'Set-Cookie' : 'Cookie'} parsing`, errorObj, m[0])
        }
      }
    },
  }
}

/** Security plugin detectors */
export const detectors: Detector[] = [
  // JWT Token Detection (highest priority)
  createContextualDetector(
    'security.jwt',
    SECURITY_PATTERNS.jwt,
    'sec_jwt_token',
    'high',
    CONFIDENCE_THRESHOLDS.jwt.base,
    undefined,
    validateJwtStructure,
    -10,
  ),

  // API Key Detection
  createContextualDetector(
    'security.api-key',
    SECURITY_PATTERNS.apiKey,
    'sec_api_key',
    'high',
    CONFIDENCE_THRESHOLDS.apiKey.base,
    undefined,
    (key) => validateToken(key),
    -5,
  ),

  // Authorization Header
  createContextualDetector(
    'security.auth-header',
    SECURITY_PATTERNS.authHeader,
    'sec_auth_header',
    'high',
    CONFIDENCE_THRESHOLDS.auth,
    [...SECURITY_CONTEXTS.auth],
    undefined,
    -8,
  ),

  // API Key Header
  createContextualDetector(
    'security.api-key-header',
    SECURITY_PATTERNS.apiKeyHeader,
    'sec_api_key',
    'high',
    0.88,
    [...SECURITY_CONTEXTS.apiKey],
    undefined,
    -6,
  ),

  // UUID Token
  createContextualDetector(
    'security.uuid',
    SECURITY_PATTERNS.uuid,
    'sec_uuid_token',
    'medium',
    CONFIDENCE_THRESHOLDS.uuid,
    [...SECURITY_CONTEXTS.auth, ...SECURITY_CONTEXTS.session],
  ),

  // Hex Token
  createContextualDetector(
    'security.hex-token',
    SECURITY_PATTERNS.hexToken,
    'sec_hex_token',
    'medium',
    CONFIDENCE_THRESHOLDS.hex,
    [...SECURITY_CONTEXTS.session, ...SECURITY_CONTEXTS.auth],
  ),

  // Session ID
  createContextualDetector(
    'security.session-id',
    SECURITY_PATTERNS.sessionId,
    'sec_session_id',
    'high',
    CONFIDENCE_THRESHOLDS.session,
  ),

  // Client Credentials
  createContextualDetector(
    'security.client-credentials',
    SECURITY_PATTERNS.clientCredentials,
    'sec_client_secret',
    'high',
    CONFIDENCE_THRESHOLDS.client.secret,
  ),

  // URL Tokens
  createUrlTokenDetector(),

  // Cookie Headers
  createCookieDetector(false),
  createCookieDetector(true),

  // === NEW ENHANCED DETECTORS ===

  // GitHub Personal Access Tokens (highest priority due to high frequency)
  createContextualDetector(
    'security.github-token',
    SECURITY_PATTERNS.githubToken,
    'sec_github_token',
    'high',
    CONFIDENCE_THRESHOLDS.github,
    [...SECURITY_CONTEXTS.github],
    undefined,
    -15,
  ),

  // AWS Access Key ID
  createContextualDetector(
    'security.aws-access-key',
    SECURITY_PATTERNS.awsAccessKey,
    'sec_aws_access_key',
    'high',
    CONFIDENCE_THRESHOLDS.aws,
    [...SECURITY_CONTEXTS.aws],
    undefined,
    -12,
  ),

  // Google/Firebase API Keys
  createContextualDetector(
    'security.google-api-key',
    SECURITY_PATTERNS.googleApiKey,
    'sec_google_api_key',
    'high',
    CONFIDENCE_THRESHOLDS.google,
    [...SECURITY_CONTEXTS.google],
    undefined,
    -11,
  ),

  // Stripe API Keys
  createContextualDetector(
    'security.stripe-api-key',
    SECURITY_PATTERNS.stripeApiKey,
    'sec_stripe_api_key',
    'high',
    CONFIDENCE_THRESHOLDS.stripe,
    [...SECURITY_CONTEXTS.stripe],
    undefined,
    -10,
  ),

  // Slack Tokens
  createContextualDetector(
    'security.slack-token',
    SECURITY_PATTERNS.slackToken,
    'sec_slack_token',
    'high',
    CONFIDENCE_THRESHOLDS.slack,
    [...SECURITY_CONTEXTS.slack],
    undefined,
    -9,
  ),

  // SendGrid API Keys
  createContextualDetector(
    'security.sendgrid-api-key',
    SECURITY_PATTERNS.sendGridApiKey,
    'sec_sendgrid_api_key',
    'high',
    CONFIDENCE_THRESHOLDS.sendgrid,
    [...SECURITY_CONTEXTS.sendgrid],
    undefined,
    -8,
  ),

  // OpenAI API Keys
  createContextualDetector(
    'security.openai-api-key',
    SECURITY_PATTERNS.openAiApiKey,
    'sec_openai_api_key',
    'high',
    CONFIDENCE_THRESHOLDS.openai,
    [...SECURITY_CONTEXTS.openai],
    undefined,
    -7,
  ),

  // Google OAuth Tokens
  createContextualDetector(
    'security.google-oauth-token',
    SECURITY_PATTERNS.googleOAuthToken,
    'sec_google_oauth_token',
    'medium',
    CONFIDENCE_THRESHOLDS.oauth,
    [...SECURITY_CONTEXTS.oauth],
    undefined,
    -6,
  ),

  // Azure Subscription Keys
  createContextualDetector(
    'security.azure-subscription-key',
    SECURITY_PATTERNS.azureSubscriptionKey,
    'sec_azure_subscription_key',
    'high',
    CONFIDENCE_THRESHOLDS.azure,
    [...SECURITY_CONTEXTS.azure],
    undefined,
    -5,
  ),

  // Webhook URLs
  createWebhookDetector(),

  // Signed URLs
  createSignedUrlDetector(),
]
