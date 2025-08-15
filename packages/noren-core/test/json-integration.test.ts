/**
 * Integration tests for JSON detection in Registry
 */

import { describe, expect, it } from 'vitest'
import { Registry } from '../src/index.js'

describe('Registry JSON integration', () => {
  it('should detect PII in JSON when enableJsonDetection is true', async () => {
    const registry = new Registry({
      defaultAction: 'mask',
      enableJsonDetection: true,
    })

    const jsonInput = JSON.stringify({
      user: {
        email: 'john@example.com',
        phone: '555-123-4567',
      },
    })

    const result = await registry.detect(jsonInput)

    expect(result.hits.length).toBeGreaterThan(0)

    const emailHit = result.hits.find((h) => h.type === 'email')
    expect(emailHit).toBeDefined()
    expect(emailHit?.value).toBe('john@example.com')
    expect(emailHit?.features?.isJsonDetection).toBe(true)
    expect(emailHit?.features?.jsonPath).toBe('$.user.email')
    expect(emailHit?.features?.keyName).toBe('email')
  })

  it('should not detect JSON PII when enableJsonDetection is false', async () => {
    const registry = new Registry({
      defaultAction: 'mask',
      enableJsonDetection: false, // or omit this since default is false
    })

    const jsonInput = JSON.stringify({
      user: {
        email: 'john@example.com',
      },
    })

    const result = await registry.detect(jsonInput)

    // Should still detect email through content-based detection (built-in)
    const emailHits = result.hits.filter((h) => h.type === 'email')
    // But they should not have JSON-specific features
    for (const hit of emailHits) {
      expect(hit.features?.isJsonDetection).toBeFalsy()
      expect(hit.features?.jsonPath).toBeUndefined()
    }
  })

  it('should fall back to text detection for invalid JSON', async () => {
    const registry = new Registry({
      defaultAction: 'mask',
      enableJsonDetection: true,
    })

    const invalidJson = '{ invalid json with email: john@example.com }'

    const result = await registry.detect(invalidJson)

    // Should still detect email through built-in text detection
    const emailHit = result.hits.find((h) => h.type === 'email')
    expect(emailHit).toBeDefined()
    expect(emailHit?.value).toBe('john@example.com')
    // Should not have JSON features since it's not valid JSON
    expect(emailHit?.features?.isJsonDetection).toBeFalsy()
  })

  it('should handle NDJSON format', async () => {
    const registry = new Registry({
      defaultAction: 'mask',
      enableJsonDetection: true,
    })

    const ndjsonInput = [
      JSON.stringify({ email: 'user1@example.com' }),
      JSON.stringify({ email: 'user2@example.com' }),
    ].join('\n')

    const result = await registry.detect(ndjsonInput)

    const emailHits = result.hits.filter((h) => h.type === 'email' && h.features?.isJsonDetection)
    expect(emailHits.length).toBeGreaterThanOrEqual(2)

    const user1Hit = emailHits.find((h) => h.value === 'user1@example.com')
    expect(user1Hit?.features?.jsonPath).toBe('$.[0].email')

    const user2Hit = emailHits.find((h) => h.value === 'user2@example.com')
    expect(user2Hit?.features?.jsonPath).toBe('$.[1].email')
  })

  it('should assign higher priority to JSON-detected hits', async () => {
    const registry = new Registry({
      defaultAction: 'mask',
      enableJsonDetection: true,
    })

    const jsonInput = JSON.stringify({
      email: 'test@example.com',
    })

    const result = await registry.detect(jsonInput)

    const jsonEmailHit = result.hits.find((h) => h.type === 'email' && h.features?.isJsonDetection)

    expect(jsonEmailHit).toBeDefined()
    expect(jsonEmailHit?.priority).toBe(-5) // Higher priority than default (10)
  })
})
