import type { Detector } from '@himorishige/noren-core'
import { SECURITY_CONTEXTS, SECURITY_PATTERNS } from './patterns.js'
// biome-ignore lint/correctness/noUnusedImports: type imported for future configuration features
import type { SecurityConfig } from './types.js'
import { logSecurityError, parseCookieHeader, parseSetCookieHeader } from './utils.js'

/** Security plugin detectors */
export const detectors: Detector[] = [
  // JWT Token Detection (highest priority)
  {
    id: 'security.jwt',
    priority: -10,
    // biome-ignore lint/correctness/noUnusedFunctionParameters: hasCtx reserved for future context-aware detection
    match: ({ src, push, hasCtx, canPush }) => {
      for (const m of src.matchAll(SECURITY_PATTERNS.jwt)) {
        if (m.index !== undefined) {
          if (!canPush?.()) break
          push({
            type: 'sec_jwt_token',
            start: m.index,
            end: m.index + m[0].length,
            value: m[0],
            risk: 'high',
            confidence: 0.95, // JWT format is highly structured and reliable
            reasons: ['jwt_structure_match', 'three_part_format'],
            features: {
              hasJwtStructure: true,
              partCount: m[0].split('.').length,
            },
          })
        }
      }
    },
  },

  // API Key Detection
  {
    id: 'security.api-key',
    priority: -5,
    // biome-ignore lint/correctness/noUnusedFunctionParameters: hasCtx reserved for future context-aware detection
    match: ({ src, push, hasCtx, canPush }) => {
      // API keys with prefixes (sk_, pk_, api_, key_)
      for (const m of src.matchAll(SECURITY_PATTERNS.apiKey)) {
        if (m.index !== undefined) {
          if (!canPush?.()) break
          push({
            type: 'sec_api_key',
            start: m.index,
            end: m.index + m[0].length,
            value: m[0],
            risk: 'high',
            confidence: 0.9, // API keys with prefixes are highly reliable
            reasons: ['api_key_prefix_match', 'structured_format'],
            features: {
              hasKnownPrefix: true,
              keyLength: m[0].length,
              prefix: m[0].split('_')[0],
            },
          })
        }
      }
    },
  },

  // UUID Token Detection
  {
    id: 'security.uuid',
    match: ({ src, push, hasCtx, canPush }) => {
      // UUID requires context hints (too generic otherwise)
      if (!hasCtx([...SECURITY_CONTEXTS.auth, ...SECURITY_CONTEXTS.session])) return

      for (const m of src.matchAll(SECURITY_PATTERNS.uuid)) {
        if (m.index !== undefined) {
          if (!canPush?.()) break
          push({
            type: 'sec_uuid_token',
            start: m.index,
            end: m.index + m[0].length,
            value: m[0],
            risk: 'medium',
            confidence: 0.7, // UUID format is structured but can be generic
            reasons: ['uuid_format_match', 'context_required'],
            features: {
              hasUuidFormat: true,
              requiresContext: true,
            },
          })
        }
      }
    },
  },

  // Hexadecimal Token Detection
  {
    id: 'security.hex-token',
    match: ({ src, push, hasCtx, canPush }) => {
      // Long hexadecimal requires context hints
      if (!hasCtx([...SECURITY_CONTEXTS.session, ...SECURITY_CONTEXTS.auth])) return

      for (const m of src.matchAll(SECURITY_PATTERNS.hexToken)) {
        if (m.index !== undefined) {
          if (!canPush?.()) break
          push({
            type: 'sec_hex_token',
            start: m.index,
            end: m.index + m[0].length,
            value: m[0],
            risk: 'medium',
            confidence: 0.65, // Hex tokens can be ambiguous
            reasons: ['hex_pattern_match', 'context_required'],
            features: {
              isHexadecimal: true,
              tokenLength: m[0].length,
              requiresContext: true,
            },
          })
        }
      }
    },
  },

  // Session ID Detection
  {
    id: 'security.session-id',
    match: ({ src, push, canPush }) => {
      // Session ID format (name=value) detected structurally
      for (const m of src.matchAll(SECURITY_PATTERNS.sessionId)) {
        if (m.index !== undefined && m[1]) {
          if (!canPush?.()) break
          push({
            type: 'sec_session_id',
            start: m.index,
            end: m.index + m[0].length,
            value: m[0],
            risk: 'high',
            confidence: 0.85, // Session ID pattern is quite reliable
            reasons: ['session_id_pattern', 'name_value_structure'],
            features: {
              hasSessionStructure: true,
              parameterName: m[0].split('=')[0],
              valueLength: m[1]?.length || 0,
            },
          })
        }
      }
    },
  },

  // HTTP Authorization Header Detection
  {
    id: 'security.auth-header',
    priority: -8,
    match: ({ src, push, hasCtx, canPush }) => {
      // Authorization header requires context check
      if (!hasCtx([...SECURITY_CONTEXTS.auth])) return

      for (const m of src.matchAll(SECURITY_PATTERNS.authHeader)) {
        if (m.index !== undefined && m[1]) {
          if (!canPush?.()) break
          push({
            type: 'sec_auth_header',
            start: m.index,
            end: m.index + m[0].length,
            value: m[0],
            risk: 'high',
            confidence: 0.9, // Authorization headers are highly reliable
            reasons: ['auth_header_structure', 'bearer_token_format'],
            features: {
              hasAuthStructure: true,
              authType: m[0].toLowerCase().includes('bearer') ? 'bearer' : 'other',
              tokenLength: m[1]?.length || 0,
            },
          })
        }
      }
    },
  },

  // API Key Header Detection
  {
    id: 'security.api-key-header',
    priority: -6,
    match: ({ src, push, hasCtx, canPush }) => {
      // API key header requires context check
      if (!hasCtx([...SECURITY_CONTEXTS.apiKey])) return

      for (const m of src.matchAll(SECURITY_PATTERNS.apiKeyHeader)) {
        if (m.index !== undefined && m[1] && m[1].length >= 8) {
          if (!canPush?.()) break
          push({
            type: 'sec_api_key',
            start: m.index,
            end: m.index + m[0].length,
            value: m[0],
            risk: 'high',
            confidence: 0.88, // API key headers are reliable with context
            reasons: ['api_key_header_match', 'context_match'],
            features: {
              hasApiKeyHeader: true,
              keyLength: m[1].length,
              requiresContext: true,
            },
          })
        }
      }
    },
  },

  // URL Token Parameter Detection
  {
    id: 'security.url-tokens',
    // biome-ignore lint/correctness/noUnusedFunctionParameters: hasCtx reserved for future context-aware detection
    match: ({ src, push, hasCtx, canPush }) => {
      // URL tokens detected regardless of context (structurally clear)
      for (const m of src.matchAll(SECURITY_PATTERNS.urlTokens)) {
        if (m.index !== undefined && m[2] && m[2].length >= 8) {
          if (!canPush?.()) break
          // Determine risk level based on parameter name
          const paramName = m[1].toLowerCase()
          const risk: 'low' | 'medium' | 'high' =
            paramName.includes('secret') ||
            paramName.includes('refresh') ||
            paramName === 'token' ||
            paramName === 'access_token'
              ? 'high'
              : 'medium'

          push({
            type: 'sec_url_token',
            start: m.index,
            end: m.index + m[0].length,
            value: m[0],
            risk,
            confidence: risk === 'high' ? 0.8 : 0.65, // Higher confidence for sensitive parameter names
            reasons: ['url_token_match', `param_name_${paramName}`, `risk_level_${risk}`],
            features: {
              parameterName: paramName,
              tokenLength: m[2].length,
              riskLevel: risk,
              isSensitiveParam: risk === 'high',
            },
          })
        }
      }
    },
  },

  // Client Credentials Detection
  {
    id: 'security.client-credentials',
    match: ({ src, push, canPush }) => {
      // Client credentials always detected
      for (const m of src.matchAll(SECURITY_PATTERNS.clientCredentials)) {
        if (m.index !== undefined && m[2] && m[2].length >= 8) {
          if (!canPush?.()) break
          const paramName = m[1].toLowerCase()
          const type = paramName === 'client_secret' ? 'sec_client_secret' : 'sec_url_token'
          const risk = paramName === 'client_secret' ? 'high' : 'medium'

          push({
            type,
            start: m.index,
            end: m.index + m[0].length,
            value: m[0],
            risk,
            confidence: paramName === 'client_secret' ? 0.9 : 0.75, // Higher confidence for client secrets
            reasons: ['client_credential_match', `param_name_${paramName}`],
            features: {
              parameterName: paramName,
              credentialType: type,
              isClientSecret: paramName === 'client_secret',
              valueLength: m[2].length,
            },
          })
        }
      }
    },
  },

  // Cookie Header Detection
  {
    id: 'security.cookie',
    match: ({ src, push, hasCtx, canPush }) => {
      // Cookie detection with context check recommended
      if (!hasCtx([...SECURITY_CONTEXTS.cookie])) return

      for (const m of src.matchAll(SECURITY_PATTERNS.cookie)) {
        if (m.index !== undefined && m[1]) {
          if (!canPush?.()) break
          try {
            const cookies = parseCookieHeader(m[0])

            // Check each cookie value individually for masking
            for (const cookie of cookies) {
              // Detect all here since allowlist check is done at runtime
              if (cookie.value.length >= 8) {
                push({
                  type: 'sec_cookie',
                  start: m.index,
                  end: m.index + m[0].length,
                  value: m[0],
                  risk: 'medium',
                  confidence: 0.7, // Cookie headers require context validation
                  reasons: ['cookie_header_match', 'context_required'],
                  features: {
                    cookieCount: cookies.length,
                    requiresContext: true,
                    hasSensitiveCookies: cookies.some((c) => c.value.length >= 8),
                  },
                })
                break // Only push once as we mask the entire Cookie header
              }
            }
          } catch (error) {
            // Skip on parse failure, but log for debugging
            const errorObj = error instanceof Error ? error : new Error(String(error))
            logSecurityError('Cookie header parsing', errorObj, m[0])
          }
        }
      }
    },
  },

  // Set-Cookie Header Detection
  {
    id: 'security.set-cookie',
    match: ({ src, push, hasCtx, canPush }) => {
      // Set-Cookie detection with context check recommended
      if (!hasCtx([...SECURITY_CONTEXTS.cookie])) return

      for (const m of src.matchAll(SECURITY_PATTERNS.setCookie)) {
        if (m.index !== undefined && m[1]) {
          if (!canPush?.()) break
          try {
            const cookie = parseSetCookieHeader(m[0])

            if (cookie && cookie.value.length >= 8) {
              // Allowlist check is done at runtime
              push({
                type: 'sec_set_cookie',
                start: m.index,
                end: m.index + m[0].length,
                value: m[0],
                risk: 'medium',
                confidence: 0.72, // Set-Cookie headers are reliable
                reasons: ['set_cookie_header_match', 'context_required'],
                features: {
                  cookieName: cookie.name,
                  cookieValueLength: cookie.value.length,
                  requiresContext: true,
                },
              })
            }
          } catch (error) {
            // Skip on parse failure, but log for debugging
            const errorObj = error instanceof Error ? error : new Error(String(error))
            logSecurityError('Set-Cookie header parsing', errorObj, m[0])
          }
        }
      }
    },
  },
]
