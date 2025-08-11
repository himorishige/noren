import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import type { DetectUtils, Detector, Hit } from '@himorishige/noren-core'
import {
  type SecurityConfig,
  createSecurityMaskers,
  detectors,
  maskers,
} from '@himorishige/noren-plugin-security'

function runDetect(src: string, ctxHints: string[] = []): Hit[] {
  const hits: Hit[] = []
  const u: DetectUtils = {
    src,
    hasCtx: (ws?: string[]) => (ws ?? ctxHints).some((w) => src.includes(w)),
    push: (h: Hit) => hits.push(h),
  }
  for (const d of detectors as unknown as Detector[]) void d.match(u)
  return hits
}

describe('noren-plugin-security detectors', () => {
  it('detects JWT tokens', () => {
    const text = 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjMifQ.signature-here'
    const hits = runDetect(text)
    const jwt = hits.find((h) => h.type === 'sec_jwt_token')
    assert.ok(jwt)
    assert.equal(jwt.risk, 'high')

    const masked = maskers.sec_jwt_token(jwt)
    assert.ok(masked.includes('.'))
    assert.ok(masked.includes('*'))
    assert.ok(masked.startsWith('eyJ'))
  })

  it('detects API keys with prefixes', () => {
    const text = 'API key: sk_live_1234567890abcdef'
    const hits = runDetect(text)
    const apiKey = hits.find((h) => h.type === 'sec_api_key')
    assert.ok(apiKey)
    assert.equal(apiKey.risk, 'high')

    const masked = maskers.sec_api_key(apiKey)
    assert.ok(masked.startsWith('sk_'))
    assert.ok(masked.includes('*'))
  })

  it('detects session IDs', () => {
    const text = 'session=abc123def456789'
    const hits = runDetect(text)
    const sessionId = hits.find((h) => h.type === 'sec_session_id')
    assert.ok(sessionId)
    assert.equal(sessionId.risk, 'high')

    const masked = maskers.sec_session_id(sessionId)
    assert.ok(masked.startsWith('session='))
    assert.ok(masked.includes('*'))
  })

  it('detects Authorization headers with context', () => {
    const text = 'Authorization: Bearer abc123xyz789'
    const hits = runDetect(text, ['Authorization'])
    const authHeader = hits.find((h) => h.type === 'sec_auth_header')
    assert.ok(authHeader)
    assert.equal(authHeader.risk, 'high')
  })

  it('detects URL tokens', () => {
    const text = '?access_token=secret123&client_secret=confidential456'
    const hits = runDetect(text)

    const urlToken = hits.find((h) => h.type === 'sec_url_token')
    assert.ok(urlToken)

    const clientSecret = hits.find((h) => h.type === 'sec_client_secret')
    assert.ok(clientSecret)
    assert.equal(clientSecret.risk, 'high')
  })

  it('detects UUIDs with security context', () => {
    const text = 'Token: 550e8400-e29b-41d4-a716-446655440000'
    const hits = runDetect(text, ['Token'])
    const uuid = hits.find((h) => h.type === 'sec_uuid_token')
    assert.ok(uuid)
    assert.equal(uuid.risk, 'medium')
  })

  it('detects hex tokens with context', () => {
    const text = 'session token: 1a2b3c4d5e6f7890abcdef1234567890'
    const hits = runDetect(text, ['session'])
    const hexToken = hits.find((h) => h.type === 'sec_hex_token')
    assert.ok(hexToken)
    assert.equal(hexToken.risk, 'medium')
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
    assert.ok(masked.includes('theme=dark'))
    assert.ok(masked.includes('lang=en'))
    assert.ok(masked.includes('consent_analytics=true'))

    // Non-allowed cookies should be masked
    assert.ok(!masked.includes('secret123'))
    assert.ok(masked.includes('session_id=se*****23'))
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
    assert.ok(masked.includes('preference_theme=dark'))
    assert.ok(masked.includes('ui_sidebar=collapsed'))

    // Non-matches should be masked
    assert.ok(!masked.includes('session=secret'))
  })
})
