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
} as const

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
]
