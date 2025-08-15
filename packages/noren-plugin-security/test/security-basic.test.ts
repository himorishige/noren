import type { DetectUtils, Hit } from '@himorishige/noren-core'
import {
  createSecurityMaskers,
  detectors,
  maskers,
  type SecurityConfig,
} from '@himorishige/noren-plugin-security'
import { describe, expect, it } from 'vitest'

function runDetect(src: string, ctxHints: string[] = []): Hit[] {
  const hits: Hit[] = []
  const u: DetectUtils = {
    src,
    hasCtx: (ws?: string[]) => (ws ?? ctxHints).some((w) => src.includes(w)),
    push: (h: Hit) => hits.push(h),
    canPush: () => true, // Always allow push in tests
  }
  for (const d of detectors) void d.match(u)
  return hits
}

describe('noren-plugin-security detectors', () => {
  it('detects JWT tokens', () => {
    const text = 'Bearer eyJmYWtlIjoiaGVhZGVyIn0.eyJmYWtlIjoicGF5bG9hZCJ9.fake_signature_here'
    const hits = runDetect(text)
    const jwt = hits.find((h) => h.type === 'sec_jwt_token')
    expect(jwt).toBeTruthy()
    expect(jwt.risk).toBe('high')

    const masked = maskers.sec_jwt_token(jwt)
    expect(masked).toContain('.')
    expect(masked).toContain('*')
    expect(masked.startsWith('eyJ')).toBeTruthy()
  })

  it('detects API keys with prefixes', () => {
    const text = 'API key: sk_test_1234567890abcdef'
    const hits = runDetect(text)
    const apiKey = hits.find((h) => h.type === 'sec_api_key')
    expect(apiKey).toBeTruthy()
    expect(apiKey.risk).toBe('high')

    const masked = maskers.sec_api_key(apiKey)
    expect(masked.startsWith('sk_')).toBeTruthy()
    expect(masked).toContain('*')
  })

  it('detects session IDs', () => {
    const text = 'session=abc123def456789'
    const hits = runDetect(text)
    const sessionId = hits.find((h) => h.type === 'sec_session_id')
    expect(sessionId).toBeTruthy()
    expect(sessionId.risk).toBe('high')

    const masked = maskers.sec_session_id(sessionId)
    expect(masked.startsWith('session=')).toBeTruthy()
    expect(masked).toContain('*')
  })

  it('detects Authorization headers with context', () => {
    const text = 'Authorization: Bearer abc123xyz789'
    const hits = runDetect(text, ['Authorization'])
    const authHeader = hits.find((h) => h.type === 'sec_auth_header')
    expect(authHeader).toBeTruthy()
    expect(authHeader.risk).toBe('high')
  })

  it('detects URL tokens', () => {
    const text = '?access_token=secret123&client_secret=confidential456'
    const hits = runDetect(text)

    const urlToken = hits.find((h) => h.type === 'sec_url_token')
    expect(urlToken).toBeTruthy()

    const clientSecret = hits.find((h) => h.type === 'sec_client_secret')
    expect(clientSecret).toBeTruthy()
    expect(clientSecret.risk).toBe('high')
  })

  it('detects UUIDs with security context', () => {
    const text = 'Token: 550e8400-e29b-41d4-a716-446655440000'
    const hits = runDetect(text, ['Token'])
    const uuid = hits.find((h) => h.type === 'sec_uuid_token')
    expect(uuid).toBeTruthy()
    expect(uuid.risk).toBe('medium')
  })

  it('detects hex tokens with context', () => {
    const text = 'session token: 1a2b3c4d5e6f7890abcdef1234567890'
    const hits = runDetect(text, ['session'])
    const hexToken = hits.find((h) => h.type === 'sec_hex_token')
    expect(hexToken).toBeTruthy()
    expect(hexToken.risk).toBe('medium')
  })
})

describe('Cookie allowlist functionality', () => {
  it('masks cookies according to allowlist', () => {
    const config: SecurityConfig = {
      cookieAllowlist: ['theme', 'lang', 'consent_*'],
    }
    const customMaskers = createSecurityMaskers(config)

    const cookieHeader = 'Cookie: session_id=secret123; theme=dark; lang=en; consent_analytics=true'
    const hit = { value: cookieHeader } as Hit

    const masked = customMaskers.sec_cookie(hit)

    // Allowed cookies should remain unmasked
    expect(masked).toContain('theme=dark')
    expect(masked).toContain('lang=en')
    expect(masked).toContain('consent_analytics=true')

    // Non-allowed cookies should be masked
    expect(masked).not.toContain('secret123')
    expect(masked).toContain('session_id=se*****23')
  })

  it('supports wildcard patterns in allowlist', () => {
    const config: SecurityConfig = {
      cookieAllowlist: ['preference_*', 'ui_*'],
    }
    const customMaskers = createSecurityMaskers(config)

    const cookieHeader = 'Cookie: preference_theme=dark; ui_sidebar=collapsed; session=secret'
    const hit = { value: cookieHeader } as Hit

    const masked = customMaskers.sec_cookie(hit)

    // Wildcard matches should remain unmasked
    expect(masked).toContain('preference_theme=dark')
    expect(masked).toContain('ui_sidebar=collapsed')

    // Non-matches should be masked
    expect(masked).not.toContain('session=secret')
  })
})
