import { describe, expect, it } from 'vitest'
import { Registry } from '../../src/index.js'
import type { Hit } from '../../src/types.js'
import { calculateInputComplexity, isInputSafeForRegex } from '../../src/utils.js'

/**
 * Security test cases for ReDoS protection
 */
describe('ReDoS Protection Security Tests', () => {
  const reg = new Registry({ defaultAction: 'mask' })

  describe('Input complexity calculation', () => {
    it('should calculate low complexity for normal text', () => {
      const normalText = 'Email: user@example.com, Phone: 555-123-4567'
      const complexity = calculateInputComplexity(normalText)
      expect(complexity).toBeLessThan(2000) // Should be lower than attack patterns
    })

    it('should detect high complexity from repeated characters', () => {
      const repeatedText = `${'a'.repeat(1000)}@example.com`
      const complexity = calculateInputComplexity(repeatedText)
      expect(complexity).toBeGreaterThan(1000) // Should be high complexity
    })

    it('should detect suspicious ReDoS patterns', () => {
      const suspiciousPattern = '(a|a)*x'
      const complexity = calculateInputComplexity(suspiciousPattern)
      expect(complexity).toBeGreaterThan(500) // Should have high penalty
    })

    it('should detect nested quantifier patterns', () => {
      const nestedPattern = '(.+)+x'
      const complexity = calculateInputComplexity(nestedPattern)
      expect(complexity).toBeGreaterThan(500) // Should have high penalty
    })
  })

  describe('Input safety checks', () => {
    it('should reject extremely long inputs', () => {
      const longInput = 'x'.repeat(60000) // Over 50KB limit
      expect(isInputSafeForRegex(longInput)).toBe(false)
    })

    it('should accept reasonably sized inputs', () => {
      const normalInput = 'Email: test@example.com '.repeat(100) // Under limit
      expect(isInputSafeForRegex(normalInput)).toBe(true)
    })

    it('should reject inputs with high complexity score', () => {
      const complexInput = 'aaaaaaa'.repeat(1000) + '|||||||'.repeat(100)
      expect(isInputSafeForRegex(complexInput)).toBe(false)
    })
  })

  describe('Safe processing under attack scenarios', () => {
    it('should handle ReDoS attack gracefully', async () => {
      // Classic ReDoS pattern attempt
      const attackInput = `${'a'.repeat(10000)}X` // Won't match email pattern

      const startTime = Date.now()
      const { hits } = await reg.detect(attackInput)
      const duration = Date.now() - startTime

      expect(hits).toHaveLength(0) // Should find no PII (input rejected)
      expect(duration).toBeLessThan(100) // Should be fast (input rejected quickly)
    })

    it('should limit number of regex matches', async () => {
      // Generate many potential PII matches
      const manyEmails = Array.from({ length: 300 }, (_, i) => `user${i}@example.com`).join(' ')

      const { hits } = await reg.detect(manyEmails)
      expect(hits.length).toBeLessThanOrEqual(200) // Should be limited by maxPatternMatches
    })

    it('should handle malicious nested structures', async () => {
      const nestedInput = '(((((' + 'test@example.com' + ')))))'

      const startTime = Date.now()
      await reg.detect(nestedInput)
      const duration = Date.now() - startTime

      expect(duration).toBeLessThan(50) // Should be fast even with nesting
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
      expect(duration).toBeLessThan(20) // Should be reasonably fast
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
      expect(duration).toBeLessThan(50) // Should be efficient
    })
  })
})
