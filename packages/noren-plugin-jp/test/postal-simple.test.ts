import { Registry } from '@himorishige/noren-core'
import { describe, expect, it } from 'vitest'
import { detectors, maskers } from '../src/index.js'

/**
 * Simple postal code detection tests
 * Focus on core functionality: phone number conflict resolution and postal symbol detection
 */

describe('Simple Postal Code Detection', () => {
  const registry = new Registry({
    defaultAction: 'mask',
    validationStrictness: 'balanced',
  })

  // Load JP plugin
  registry.use(detectors, maskers, ['電話', '携帯', '郵便', '住所'])

  describe('Core Functionality', () => {
    it('should detect postal codes with postal symbol (high confidence)', async () => {
      const testCases = ['〒100-0001 東京都千代田区', '住所: 〒123-4567', '〒 456-7890 大阪府']

      for (const text of testCases) {
        const result = await registry.detect(text)
        const postalHit = result.hits.find((h) => h.type === 'postal_jp')

        expect(postalHit, `Should detect postal code in: ${text}`).toBeDefined()
        expect(postalHit?.confidence).toBeGreaterThan(0.8)
        expect(postalHit?.features.hasPostalSymbol).toBe(true)
      }
    })

    it('should detect postal codes with context (medium confidence)', async () => {
      const testCases = ['住所: 123-4567', '郵便番号 456-7890', 'ZIP: 789-0123']

      for (const text of testCases) {
        const result = await registry.detect(text)
        const postalHit = result.hits.find((h) => h.type === 'postal_jp')

        expect(postalHit, `Should detect postal code in: ${text}`).toBeDefined()
        expect(postalHit?.confidence).toBeGreaterThanOrEqual(0.6)
        expect(postalHit?.features.hasContext).toBe(true)
      }
    })

    it('should detect standalone postal codes (low confidence)', async () => {
      const testCases = ['Some text 123-4567 more text', '郵便: 456-7890 です']

      for (const text of testCases) {
        const result = await registry.detect(text)
        const postalHit = result.hits.find((h) => h.type === 'postal_jp')

        expect(postalHit, `Should detect postal code in: ${text}`).toBeDefined()
        expect(postalHit?.confidence).toBeGreaterThanOrEqual(0.4)
      }
    })
  })

  describe('Phone Number Conflict Prevention', () => {
    it('should NOT detect phone numbers as postal codes', async () => {
      const testCases = [
        'TEL: 03-1234-5678',
        '電話番号: 06-9876-5432',
        'Phone: 011-333-4444',
        'Mobile: 080-1111-2222',
        'FAX: 092-555-6666',
      ]

      for (const text of testCases) {
        const result = await registry.detect(text)
        const postalHit = result.hits.find((h) => h.type === 'postal_jp')

        expect(postalHit, `Should NOT detect postal code in: ${text}`).toBeUndefined()

        // Should detect as phone instead
        const phoneHit = result.hits.find((h) => h.type === 'phone_jp')
        expect(phoneHit, `Should detect as phone: ${text}`).toBeDefined()
      }
    })

    it('should handle international phone numbers correctly', async () => {
      const testCases = ['+81-3-1234-5678', '+81 90 1234 5678']

      for (const text of testCases) {
        const result = await registry.detect(text)
        const postalHit = result.hits.find((h) => h.type === 'postal_jp')

        expect(postalHit, `Should NOT detect postal code in: ${text}`).toBeUndefined()
      }
    })
  })

  describe('Mixed Scenarios', () => {
    it('should correctly identify both postal codes and phone numbers in same text', async () => {
      const text = '会社情報: 〒100-0001 東京都千代田区 TEL: 03-1234-5678'
      const result = await registry.detect(text)

      const postalHit = result.hits.find((h) => h.type === 'postal_jp')
      const phoneHit = result.hits.find((h) => h.type === 'phone_jp')

      expect(postalHit).toBeDefined()
      expect(phoneHit).toBeDefined()
      expect(postalHit?.value).toBe('100-0001')
      expect(phoneHit?.value).toContain('1234-5678')
    })

    it('should prioritize phone detection when pattern is ambiguous', async () => {
      const text = 'お問い合わせ: 03-1234-5678'
      const result = await registry.detect(text)

      // Should detect as phone, not postal
      const phoneHit = result.hits.find((h) => h.type === 'phone_jp')
      const postalHit = result.hits.find((h) => h.type === 'postal_jp')

      expect(phoneHit).toBeDefined()
      expect(postalHit).toBeUndefined()
    })
  })

  describe('Edge Cases', () => {
    it('should handle various hyphen formats', async () => {
      const testCases = [
        '〒123-4567', // Regular hyphen
        '〒1234567', // No hyphen
        '〒123−4567', // Full-width hyphen
      ]

      for (const text of testCases) {
        const result = await registry.detect(text)
        const postalHit = result.hits.find((h) => h.type === 'postal_jp')

        expect(postalHit, `Should detect postal code in: ${text}`).toBeDefined()
        expect(postalHit?.features.normalized).toBe('123-4567')
      }
    })

    it('should handle postal codes at text boundaries', async () => {
      const testCases = [
        '123-4567', // Start of text
        'Text 456-7890', // End of text
        '〒789-0123東京', // No space after
      ]

      for (const text of testCases) {
        const result = await registry.detect(text)
        const postalHit = result.hits.find((h) => h.type === 'postal_jp')

        // These should be detected (some with low confidence)
        expect(postalHit, `Should detect postal code in: ${text}`).toBeDefined()
      }
    })
  })

  describe('Performance Characteristics', () => {
    it('should process text efficiently', async () => {
      const text = 'Sample text with postal code 123-4567 and phone 090-1111-2222'.repeat(100)

      const startTime = performance.now()
      const result = await registry.detect(text)
      const endTime = performance.now()

      const processingTime = endTime - startTime

      // Should be fast (under 50ms for this size)
      expect(processingTime).toBeLessThan(50)

      // Should detect patterns correctly
      expect(result.hits.length).toBeGreaterThan(0)
    })
  })
})
