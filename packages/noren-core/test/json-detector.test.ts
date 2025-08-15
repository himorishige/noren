/**
 * Tests for JSON detector functionality
 * Comprehensive testing of structured data PII detection
 */

import { describe, expect, it } from 'vitest'
import { createJSONDetector } from '../src/json-detector.js'
import type { DetectUtils } from '../src/types.js'

// Mock DetectUtils for testing
function createMockUtils(): DetectUtils {
  return {
    src: '',
    hasCtx: () => false,
    push: () => {},
    canPush: () => true,
  }
}

describe('JSONDetector - basic functionality', () => {
  it('should detect email in JSON by key name', () => {
    const detector = createJSONDetector()
    const jsonString = JSON.stringify({
      user: {
        email: 'john@example.com',
        name: 'John Doe',
      },
    })

    const result = detector.detectInJson(jsonString, createMockUtils())

    expect(result.isValidJson).toBe(true)
    expect(result.fallbackToText).toBe(false)
    expect(result.hits.length).toBeGreaterThanOrEqual(1)

    const emailHit = result.hits.find((h) => h.type === 'email' && h.keyName === 'email')
    expect(emailHit).toBeDefined()
    expect(emailHit?.value).toBe('john@example.com')
    expect(emailHit?.jsonPath).toBe('$.user.email')
    expect(emailHit?.keyName).toBe('email')
    expect(emailHit?.confidence).toBe(0.9)
    expect(emailHit?.reasons).toContain('json_key_match')
  })

  it('should detect phone numbers by key name', () => {
    const detector = createJSONDetector()
    const jsonString = JSON.stringify({
      contact: {
        phone: '090-1234-5678',
        mobile: '+81-90-9876-5432',
      },
    })

    const result = detector.detectInJson(jsonString, createMockUtils())

    expect(result.hits).toHaveLength(2)

    const phoneHit = result.hits.find((h) => h.keyName === 'phone')
    expect(phoneHit?.type).toBe('phone_e164')
    expect(phoneHit?.value).toBe('090-1234-5678')
    expect(phoneHit?.jsonPath).toBe('$.contact.phone')

    const mobileHit = result.hits.find((h) => h.keyName === 'mobile')
    expect(mobileHit?.type).toBe('phone_e164')
    expect(mobileHit?.value).toBe('+81-90-9876-5432')
    expect(mobileHit?.jsonPath).toBe('$.contact.mobile')
  })

  it('should handle nested objects', () => {
    const detector = createJSONDetector()
    const jsonString = JSON.stringify({
      company: {
        employees: {
          manager: {
            email: 'manager@company.com',
            personal: {
              phone: '080-1111-2222',
            },
          },
        },
      },
    })

    const result = detector.detectInJson(jsonString, createMockUtils())

    expect(result.hits).toHaveLength(2)

    const emailHit = result.hits.find((h) => h.type === 'email')
    expect(emailHit?.jsonPath).toBe('$.company.employees.manager.email')

    const phoneHit = result.hits.find((h) => h.type === 'phone_e164')
    expect(phoneHit?.jsonPath).toBe('$.company.employees.manager.personal.phone')
  })

  it('should handle arrays', () => {
    const detector = createJSONDetector()
    const jsonString = JSON.stringify({
      users: [
        { email: 'user1@example.com', name: 'User One' },
        { email: 'user2@example.com', name: 'User Two' },
      ],
    })

    const result = detector.detectInJson(jsonString, createMockUtils())

    expect(result.hits.length).toBeGreaterThanOrEqual(2)

    const firstEmail = result.hits.find(
      (h) => h.value === 'user1@example.com' && h.keyName === 'email',
    )
    expect(firstEmail?.jsonPath).toBe('$.users.[0].email')

    const secondEmail = result.hits.find(
      (h) => h.value === 'user2@example.com' && h.keyName === 'email',
    )
    expect(secondEmail?.jsonPath).toBe('$.users.[1].email')
  })

  it('should detect credit card by key name', () => {
    const detector = createJSONDetector()
    const jsonString = JSON.stringify({
      payment: {
        card_number: '4111111111111111',
        expiry: '12/25',
      },
    })

    const result = detector.detectInJson(jsonString, createMockUtils())

    const cardHit = result.hits.find((h) => h.type === 'credit_card')
    expect(cardHit?.value).toBe('4111111111111111')
    expect(cardHit?.jsonPath).toBe('$.payment.card_number')
    expect(cardHit?.risk).toBe('high')
  })
})

describe('JSONDetector - Japanese support', () => {
  it('should detect PII using Japanese key names', () => {
    const detector = createJSONDetector()
    const jsonString = JSON.stringify({
      顧客情報: {
        メール: 'yamada@company.co.jp',
        電話: '03-1234-5678',
        住所: '東京都新宿区1-2-3',
      },
    })

    const result = detector.detectInJson(jsonString, createMockUtils())

    expect(result.hits).toHaveLength(3)

    const emailHit = result.hits.find((h) => h.keyName === 'メール')
    expect(emailHit?.type).toBe('email')
    expect(emailHit?.value).toBe('yamada@company.co.jp')

    const phoneHit = result.hits.find((h) => h.keyName === '電話')
    expect(phoneHit?.type).toBe('phone_e164')

    const addressHit = result.hits.find((h) => h.keyName === '住所')
    expect(addressHit?.type).toBe('address')
  })
})

describe('JSONDetector - content-based detection', () => {
  it('should detect email in values even without key hints', () => {
    const detector = createJSONDetector()
    const jsonString = JSON.stringify({
      description: 'Please contact john.doe@example.com for support',
      note: 'Email: admin@test.org',
    })

    const result = detector.detectInJson(jsonString, createMockUtils())

    expect(result.hits.length).toBeGreaterThan(0)

    const emailHits = result.hits.filter((h) => h.type === 'email')
    expect(emailHits.length).toBeGreaterThanOrEqual(1)

    const johnEmail = emailHits.find((h) => h.value === 'john.doe@example.com')
    expect(johnEmail).toBeDefined()
    expect(johnEmail?.reasons).toContain('json_content_match')
  })
})

describe('JSONDetector - NDJSON support', () => {
  it('should handle NDJSON (newline-delimited JSON)', () => {
    const detector = createJSONDetector()
    const ndjsonString = [
      JSON.stringify({ email: 'user1@example.com', id: 1 }),
      JSON.stringify({ email: 'user2@example.com', id: 2 }),
      JSON.stringify({ email: 'user3@example.com', id: 3 }),
    ].join('\n')

    const result = detector.detectInJson(ndjsonString, createMockUtils())

    expect(result.isValidJson).toBe(true)
    expect(result.hits).toHaveLength(3)

    const firstHit = result.hits.find((h) => h.value === 'user1@example.com')
    expect(firstHit?.jsonPath).toBe('$.[0].email')

    const secondHit = result.hits.find((h) => h.value === 'user2@example.com')
    expect(secondHit?.jsonPath).toBe('$.[1].email')
  })
})

describe('JSONDetector - error handling', () => {
  it('should handle invalid JSON gracefully', () => {
    const detector = createJSONDetector()
    const invalidJson = '{ invalid json string'

    const result = detector.detectInJson(invalidJson, createMockUtils())

    expect(result.isValidJson).toBe(false)
    expect(result.fallbackToText).toBe(true)
    expect(result.hits).toHaveLength(0)
  })

  it('should prevent infinite recursion with deep objects', () => {
    const detector = createJSONDetector()

    // Create a deeply nested object (beyond the 10 level limit)
    let deepObject: Record<string, unknown> = { email: 'deep@example.com' }
    for (let i = 0; i < 15; i++) {
      deepObject = { level: i, nested: deepObject }
    }

    const result = detector.detectInJson(JSON.stringify(deepObject), createMockUtils())

    expect(result.isValidJson).toBe(true)
    // Should not crash due to infinite recursion
    expect(result.hits.length).toBeGreaterThanOrEqual(0)
  })

  it('should handle empty JSON objects', () => {
    const detector = createJSONDetector()
    const emptyJson = JSON.stringify({})

    const result = detector.detectInJson(emptyJson, createMockUtils())

    expect(result.isValidJson).toBe(true)
    expect(result.hits).toHaveLength(0)
  })
})

describe('JSONDetector - risk levels', () => {
  it('should assign correct risk levels to different PII types', () => {
    const detector = createJSONDetector()
    const jsonString = JSON.stringify({
      email: 'test@example.com',
      card_number: '4111111111111111',
      ssn: '123-45-6789',
      name: 'John Doe',
    })

    const result = detector.detectInJson(jsonString, createMockUtils())

    const emailHit = result.hits.find((h) => h.type === 'email')
    expect(emailHit?.risk).toBe('medium')

    const cardHit = result.hits.find((h) => h.type === 'credit_card')
    expect(cardHit?.risk).toBe('high')

    const ssnHit = result.hits.find((h) => h.type === 'ssn')
    expect(ssnHit?.risk).toBe('high')
  })
})
