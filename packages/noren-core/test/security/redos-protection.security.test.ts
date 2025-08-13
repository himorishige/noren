import { describe, expect, it } from 'vitest'
import { Registry, redactText } from '../../src/index.js'
import type { Hit } from '../../src/types.js'

/**
 * Basic Security Tests for v0.4.0
 * Advanced ReDoS protection features have been moved to @himorishige/noren-devtools
 */
describe('Security Tests', () => {
  const reg = new Registry({ defaultAction: 'mask' })

  describe('Input length limits', () => {
    it('should handle very long inputs without crashing', async () => {
      const longInput = 'test@example.com '.repeat(1000) // ~17KB

      // Should not crash - basic length protection exists
      const result = await redactText(reg, longInput)
      expect(result).toBeTruthy()
      expect(result.length).toBeGreaterThan(0)
    })

    it('should still detect PII in reasonably large inputs', async () => {
      const input = 'Normal text with user@example.com email '.repeat(100)

      const result = await redactText(reg, input)
      expect(result).toContain('[REDACTED:email]')
      expect(result).not.toContain('user@example.com')
    })
  })

  describe('Safe processing scenarios', () => {
    it('should handle inputs with many potential matches', async () => {
      // Generate many potential PII matches
      const manyEmails = Array.from({ length: 50 }, (_, i) => `user${i}@example.com`).join(' ')

      const { hits } = await reg.detect(manyEmails)
      expect(hits.length).toBeGreaterThan(0) // Should find legitimate PII
      expect(hits.length).toBeLessThanOrEqual(200) // Should be limited by maxPatternMatches
    })

    it('should handle nested structures', async () => {
      const nestedInput = '(((((' + 'test@example.com' + ')))))'

      const startTime = Date.now()
      const { hits } = await reg.detect(nestedInput)
      const duration = Date.now() - startTime

      expect(hits.length).toBeGreaterThan(0) // Should find the email
      expect(duration).toBeLessThan(50) // Should be fast
    })
  })

  describe('Performance under security constraints', () => {
    it('should maintain performance for legitimate large inputs', async () => {
      // Large but legitimate input
      const legitimateInput = Array.from(
        { length: 50 },
        (_, i) =>
          `User ${i}: email${i}@company.com, phone: +1-555-${String(i).padStart(3, '0')}-${String(i * 2).padStart(4, '0')}`,
      ).join('\\n')

      const startTime = Date.now()
      const { hits } = await reg.detect(legitimateInput)
      const duration = Date.now() - startTime

      expect(hits.length).toBeGreaterThan(0) // Should find legitimate PII
      expect(duration).toBeLessThan(100) // Should be reasonably fast
    })

    it('should process chunk-based inputs efficiently', async () => {
      // Simulate streaming input processing
      const chunks = Array.from(
        { length: 10 },
        (_, i) => `Chunk ${i}: email${i}@test.com phone:+1-555-000-${String(i).padStart(4, '0')}`,
      )

      const startTime = Date.now()
      const allHits: Hit[] = []

      for (const chunk of chunks) {
        const { hits } = await reg.detect(chunk)
        allHits.push(...hits)
      }

      const duration = Date.now() - startTime

      expect(allHits.length).toBeGreaterThan(0) // Should find PII in chunks
      expect(duration).toBeLessThan(100) // Should be efficient
    })
  })
})
