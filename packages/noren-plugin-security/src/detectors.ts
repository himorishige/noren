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
    match: ({ src, push, hasCtx }) => {
      for (const m of src.matchAll(SECURITY_PATTERNS.jwt)) {
        if (m.index !== undefined) {
          push({
            type: 'sec_jwt_token',
            start: m.index,
            end: m.index + m[0].length,
            value: m[0],
            risk: 'high',
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
    match: ({ src, push, hasCtx }) => {
      // API keys with prefixes (sk_, pk_, api_, key_)
      for (const m of src.matchAll(SECURITY_PATTERNS.apiKey)) {
        if (m.index !== undefined) {
          push({
            type: 'sec_api_key',
            start: m.index,
            end: m.index + m[0].length,
            value: m[0],
            risk: 'high',
          })
        }
      }
    },
  },

  // UUID Token Detection
  {
    id: 'security.uuid',
    match: ({ src, push, hasCtx }) => {
      // UUID requires context hints (too generic otherwise)
      if (!hasCtx([...SECURITY_CONTEXTS.auth, ...SECURITY_CONTEXTS.session])) return

      for (const m of src.matchAll(SECURITY_PATTERNS.uuid)) {
        if (m.index !== undefined) {
          push({
            type: 'sec_uuid_token',
            start: m.index,
            end: m.index + m[0].length,
            value: m[0],
            risk: 'medium',
          })
        }
      }
    },
  },

  // Hexadecimal Token Detection
  {
    id: 'security.hex-token',
    match: ({ src, push, hasCtx }) => {
      // Long hexadecimal requires context hints
      if (!hasCtx([...SECURITY_CONTEXTS.session, ...SECURITY_CONTEXTS.auth])) return

      for (const m of src.matchAll(SECURITY_PATTERNS.hexToken)) {
        if (m.index !== undefined) {
          push({
            type: 'sec_hex_token',
            start: m.index,
            end: m.index + m[0].length,
            value: m[0],
            risk: 'medium',
          })
        }
      }
    },
  },

  // Session ID Detection
  {
    id: 'security.session-id',
    match: ({ src, push }) => {
      // Session ID format (name=value) detected structurally
      for (const m of src.matchAll(SECURITY_PATTERNS.sessionId)) {
        if (m.index !== undefined && m[1]) {
          push({
            type: 'sec_session_id',
            start: m.index,
            end: m.index + m[0].length,
            value: m[0],
            risk: 'high',
          })
        }
      }
    },
  },

  // HTTP Authorization Header Detection
  {
    id: 'security.auth-header',
    priority: -8,
    match: ({ src, push, hasCtx }) => {
      // Authorization header requires context check
      if (!hasCtx([...SECURITY_CONTEXTS.auth])) return

      for (const m of src.matchAll(SECURITY_PATTERNS.authHeader)) {
        if (m.index !== undefined && m[1]) {
          push({
            type: 'sec_auth_header',
            start: m.index,
            end: m.index + m[0].length,
            value: m[0],
            risk: 'high',
          })
        }
      }
    },
  },

  // API Key Header Detection
  {
    id: 'security.api-key-header',
    priority: -6,
    match: ({ src, push, hasCtx }) => {
      // API key header requires context check
      if (!hasCtx([...SECURITY_CONTEXTS.apiKey])) return

      for (const m of src.matchAll(SECURITY_PATTERNS.apiKeyHeader)) {
        if (m.index !== undefined && m[1] && m[1].length >= 8) {
          push({
            type: 'sec_api_key',
            start: m.index,
            end: m.index + m[0].length,
            value: m[0],
            risk: 'high',
          })
        }
      }
    },
  },

  // URL Token Parameter Detection
  {
    id: 'security.url-tokens',
    // biome-ignore lint/correctness/noUnusedFunctionParameters: hasCtx reserved for future context-aware detection
    match: ({ src, push, hasCtx }) => {
      // URL tokens detected regardless of context (structurally clear)
      for (const m of src.matchAll(SECURITY_PATTERNS.urlTokens)) {
        if (m.index !== undefined && m[2] && m[2].length >= 8) {
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
          })
        }
      }
    },
  },

  // Client Credentials Detection
  {
    id: 'security.client-credentials',
    match: ({ src, push }) => {
      // Client credentials always detected
      for (const m of src.matchAll(SECURITY_PATTERNS.clientCredentials)) {
        if (m.index !== undefined && m[2] && m[2].length >= 8) {
          const paramName = m[1].toLowerCase()
          const type = paramName === 'client_secret' ? 'sec_client_secret' : 'sec_url_token'
          const risk = paramName === 'client_secret' ? 'high' : 'medium'

          push({
            type,
            start: m.index,
            end: m.index + m[0].length,
            value: m[0],
            risk,
          })
        }
      }
    },
  },

  // Cookie Header Detection
  {
    id: 'security.cookie',
    match: ({ src, push, hasCtx }) => {
      // Cookie detection with context check recommended
      if (!hasCtx([...SECURITY_CONTEXTS.cookie])) return

      for (const m of src.matchAll(SECURITY_PATTERNS.cookie)) {
        if (m.index !== undefined && m[1]) {
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
                })
                break // Only push once as we mask the entire Cookie header
              }
            }
          } catch (error) {
            // Skip on parse failure, but log for debugging
            logSecurityError('Cookie header parsing', error as Error, m[0])
          }
        }
      }
    },
  },

  // Set-Cookie Header Detection
  {
    id: 'security.set-cookie',
    match: ({ src, push, hasCtx }) => {
      // Set-Cookie detection with context check recommended
      if (!hasCtx([...SECURITY_CONTEXTS.cookie])) return

      for (const m of src.matchAll(SECURITY_PATTERNS.setCookie)) {
        if (m.index !== undefined && m[1]) {
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
              })
            }
          } catch (error) {
            // Skip on parse failure, but log for debugging
            logSecurityError('Set-Cookie header parsing', error as Error, m[0])
          }
        }
      }
    },
  },
]
