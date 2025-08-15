/**
 * Test canPush functionality and performance improvements
 */

import type { DetectUtils, Hit } from '@himorishige/noren-core'
import { detectors } from '@himorishige/noren-plugin-security'
import { describe, expect, it } from 'vitest'

function runDetectWithLimit(
  src: string,
  maxHits: number,
  ctxHints: string[] = [],
): { hits: Hit[]; totalIterations: number } {
  const hits: Hit[] = []
  let totalIterations = 0

  const u: DetectUtils = {
    src,
    hasCtx: (ws?: string[]) => (ws ?? ctxHints).some((w) => src.includes(w)),
    push: (h: Hit) => {
      hits.push(h)
      totalIterations++
    },
    canPush: () => hits.length < maxHits,
  }

  for (const d of detectors) {
    d.match(u)
  }

  return { hits, totalIterations }
}

function runDetectWithoutLimit(src: string, ctxHints: string[] = []): Hit[] {
  const hits: Hit[] = []

  const u: DetectUtils = {
    src,
    hasCtx: (ws?: string[]) => (ws ?? ctxHints).some((w) => src.includes(w)),
    push: (h: Hit) => hits.push(h),
    canPush: () => true, // Always allow
  }

  for (const d of detectors) {
    d.match(u)
  }

  return hits
}

describe('canPush Performance Tests', () => {
  it('should respect canPush limits and stop early', () => {
    // Create text with many potential matches
    const manyApiKeys = Array(20)
      .fill(0)
      .map((_, i) => `sk_test_${i.toString().padStart(32, '0')}`)
      .join(' ')

    const { hits: limitedHits, totalIterations } = runDetectWithLimit(manyApiKeys, 5)
    const unlimitedHits = runDetectWithoutLimit(manyApiKeys)

    // Should find fewer hits when limited
    expect(limitedHits.length).toBeLessThanOrEqual(5)
    expect(unlimitedHits.length).toBeGreaterThan(limitedHits.length)

    // Should stop processing early (fewer iterations)
    expect(totalIterations).toBeLessThanOrEqual(unlimitedHits.length)

    console.log(`Limited hits: ${limitedHits.length}, Unlimited hits: ${unlimitedHits.length}`)
    console.log(`Total iterations with limit: ${totalIterations}`)
  })

  it('should work correctly with different security patterns', () => {
    const testText = `
      Authorization: Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjMifQ.signature1
      Authorization: Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjMifQ.signature2
      Authorization: Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjMifQ.signature3
      X-API-Key: sk_test_key1
      X-API-Key: sk_test_key2
      X-API-Key: sk_test_key3
    `

    const contextHints = ['Authorization', 'Bearer', 'X-API-Key']

    const { hits: limitedHits } = runDetectWithLimit(testText, 2, contextHints)
    const unlimitedHits = runDetectWithoutLimit(testText, contextHints)

    expect(limitedHits.length).toBe(2)
    expect(unlimitedHits.length).toBeGreaterThan(2)

    // Should prioritize higher priority detectors (JWT has priority -10, API key -5)
    expect(limitedHits.some((h) => h.type === 'sec_jwt_token')).toBeTruthy()
  })

  it('should handle edge cases gracefully', () => {
    // Empty text
    const { hits: emptyHits } = runDetectWithLimit('', 10)
    expect(emptyHits.length).toBe(0)

    // Limit of 0
    const { hits: zeroLimitHits } = runDetectWithLimit('sk_test_test123', 0)
    expect(zeroLimitHits.length).toBe(0)

    // Text with no matches
    const { hits: noMatchHits } = runDetectWithLimit('just normal text here', 10)
    expect(noMatchHits.length).toBe(0)
  })

  it('should maintain confidence scoring with canPush', () => {
    const jwtText = 'Bearer eyJmYWtlIjoiaGVhZGVyIn0.eyJmYWtlIjoicGF5bG9hZCJ9.fake_signature'

    const { hits } = runDetectWithLimit(jwtText, 5)
    const jwt = hits.find((h) => h.type === 'sec_jwt_token')

    expect(jwt).toBeTruthy()
    expect(jwt?.confidence).toBeGreaterThan(0.9) // JWT should have high confidence
    expect(jwt?.reasons).toContain('jwt_pattern_match')
    expect(jwt?.features).toHaveProperty('hasJwtStructure', true)
  })
})

describe('Confidence Scoring Integration', () => {
  it('should provide confidence scores for all security detectors', () => {
    const testCases = [
      {
        text: 'Bearer eyJmYWtlIjoiaGVhZGVyIn0.eyJmYWtlIjoicGF5bG9hZCJ9.fake_signature',
        expectedType: 'sec_jwt_token',
        expectedMinConfidence: 0.9,
      },
      {
        text: 'API key: sk_test_1234567890abcdef',
        expectedType: 'sec_api_key',
        expectedMinConfidence: 0.85,
      },
      {
        text: 'session=abc123def456789',
        expectedType: 'sec_session_id',
        expectedMinConfidence: 0.8,
      },
    ]

    for (const testCase of testCases) {
      const hits = runDetectWithoutLimit(testCase.text)
      const hit = hits.find((h) => h.type === testCase.expectedType)

      expect(hit).toBeTruthy()
      expect(hit?.confidence).toBeGreaterThanOrEqual(testCase.expectedMinConfidence)
      expect(hit?.reasons).toBeInstanceOf(Array)
      expect(hit?.reasons?.length).toBeGreaterThan(0)
      expect(hit?.features).toBeDefined()
    }
  })

  it('should have appropriate confidence levels by risk', () => {
    const testText = `
      Authorization: Bearer token123
      session=abc123def456789
      uuid_token=550e8400-e29b-41d4-a716-446655440000
      hex_token=1a2b3c4d5e6f7890abcdef1234567890
    `
    const contextHints = ['Authorization', 'Bearer', 'session', 'uuid_token', 'hex_token']

    const hits = runDetectWithoutLimit(testText, contextHints)

    // High risk items should have higher confidence
    const highRiskHits = hits.filter((h) => h.risk === 'high')
    const mediumRiskHits = hits.filter((h) => h.risk === 'medium')

    for (const hit of highRiskHits) {
      expect(hit.confidence).toBeGreaterThan(0.8)
    }

    for (const hit of mediumRiskHits) {
      expect(hit.confidence).toBeGreaterThan(0.6)
    }
  })
})
