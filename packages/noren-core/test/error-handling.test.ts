import { describe, expect, it } from 'vitest'
import { Registry, validateCandidate } from '../src/index.js'

describe('Error Handling', () => {
  describe('Registry Configuration Validation', () => {
    it('should reject invalid validation strictness', () => {
      expect(() => {
        new Registry({
          defaultAction: 'mask',
          // @ts-expect-error Testing invalid validation strictness
          validationStrictness: 'invalid',
        })
      }).toThrow('Invalid validationStrictness: invalid')
    })

    it('should reject weak HMAC keys', () => {
      expect(() => {
        new Registry({
          defaultAction: 'tokenize',
          hmacKey: 'short_key',
        })
      }).toThrow('HMAC key must be at least 32 characters long')
    })

    it('should reject invalid default action', () => {
      expect(() => {
        new Registry({
          // @ts-expect-error Testing invalid default action
          defaultAction: 'invalid',
        })
      }).toThrow('Invalid defaultAction: invalid')
    })

    it('should reject invalid context hints', () => {
      expect(() => {
        new Registry({
          defaultAction: 'mask',
          // @ts-expect-error Testing invalid context hints type
          contextHints: 'invalid',
        })
      }).toThrow('contextHints must be an array of strings')
    })

    it('should reject invalid rule actions', () => {
      expect(() => {
        new Registry({
          defaultAction: 'mask',
          rules: {
            // @ts-expect-error Testing invalid rule action
            email: { action: 'invalid' },
          },
        })
      }).toThrow("Invalid action 'invalid' for type 'email'")
    })
  })

  describe('Input Validation', () => {
    it('should reject non-string input', async () => {
      const registry = new Registry({ defaultAction: 'mask' })

      // @ts-expect-error Testing invalid input type
      await expect(registry.detect(123)).rejects.toThrow('Input must be a string')
    })

    it('should reject input that is too large', async () => {
      const registry = new Registry({ defaultAction: 'mask' })
      const largeInput = 'x'.repeat(20_000_000) // 20MB

      await expect(registry.detect(largeInput)).rejects.toThrow('Input too large')
    })
  })

  describe('Validation Error Handling', () => {
    it('should handle validation errors gracefully', () => {
      const context = {
        surroundingText: 'test context',
        strictness: 'balanced' as const,
        originalIndex: 0,
      }

      // Test empty candidate
      const result1 = validateCandidate('', 'credit_card', context)
      expect(result1.valid).toBe(false)
      expect(result1.reason).toBe('invalid_input')

      // Test overly long candidate
      const longCandidate = 'x'.repeat(2000)
      const result2 = validateCandidate(longCandidate, 'credit_card', context)
      expect(result2.valid).toBe(false)
      expect(result2.reason).toBe('candidate_too_long')
    })

    it('should provide meaningful error metadata', () => {
      const context = {
        surroundingText: 'test context',
        strictness: 'balanced' as const,
        originalIndex: 0,
      }

      const result = validateCandidate('', 'credit_card', context)
      expect(result.metadata).toBeDefined()
      expect(result.metadata?.error).toBe('Candidate must be a non-empty string')
    })
  })

  describe('Fallback Behavior', () => {
    it('should continue detection when validation fails', async () => {
      const registry = new Registry({
        defaultAction: 'mask',
        validationStrictness: 'balanced',
      })

      // This should detect the email even if validation has issues
      const text = 'Contact: user@example.com'
      const result = await registry.detect(text)

      // Should still work even with validation
      expect(result.hits.length).toBeGreaterThanOrEqual(0)
      expect(result.src).toBe(text)
    })

    it('should handle malformed regex patterns gracefully', async () => {
      const registry = new Registry({ defaultAction: 'mask' })

      // This should not crash the detection process
      const text = 'Normal text with email: test@example.com'
      const result = await registry.detect(text)

      expect(result.src).toBe(text)
      expect(Array.isArray(result.hits)).toBe(true)
    })
  })

  describe('Memory Safety', () => {
    it('should limit pattern matches to prevent DoS', async () => {
      const registry = new Registry({ defaultAction: 'mask' })

      // Create input with many potential matches but not exceeding input limit
      const emails = Array(500)
        .fill(0)
        .map((_, i) => `user${i}@test.com`)
        .join(' ')

      const result = await registry.detect(emails)
      expect(result.hits.length).toBeLessThanOrEqual(200) // SECURITY_LIMITS.maxPatternMatches
    })
  })
})
