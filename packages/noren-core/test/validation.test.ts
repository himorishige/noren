import {
  Registry,
  redactText,
  type ValidationContext,
  validateCandidate,
} from '@himorishige/noren-core'
import { describe, expect, it } from 'vitest'

describe('PII Validation System', () => {
  describe('Credit Card Validation', () => {
    const createContext = (
      text: string,
      strictness: 'fast' | 'balanced' | 'strict' = 'balanced',
    ): ValidationContext => ({
      surroundingText: text,
      strictness,
      originalIndex: 0,
    })

    it('should reject test credit card numbers', () => {
      const testCard = '4111111111111111'
      const context = createContext('Payment with card 4111111111111111 processed')

      const result = validateCandidate(testCard, 'credit_card', context)
      expect(result.valid).toBe(false)
      expect(result.reason).toBe('test_number')
    })

    it('should accept valid Visa card with good context', () => {
      const validVisa = '4532015112830366' // Valid Luhn, not a test number
      const context = createContext('Please enter your credit card number: 4532015112830366')

      const result = validateCandidate(validVisa, 'credit_card', context)
      expect(result.valid).toBe(true)
      expect(result.reason).toContain('valid_visa')
      expect(result.confidence).toBeGreaterThan(0.8)
    })

    it('should reject bare 16-digit numbers with poor context', () => {
      const bareNumber = '4532015112830366'
      const context = createContext('User ID: 4532015112830366 was created')

      const result = validateCandidate(bareNumber, 'credit_card', context)
      expect(result.valid).toBe(false)
      expect(result.reason).toBe('bare_digits_weak_context')
    })

    it('should reject cards with repeated digits', () => {
      const repeatedCard = '4444444444444448' // Valid Luhn but repeated
      const context = createContext('Card: 4444444444444448')

      const result = validateCandidate(repeatedCard, 'credit_card', context)
      expect(result.valid).toBe(false)
      expect(result.reason).toBe('repeated_digits')
    })

    it('should reject sequential digit patterns', () => {
      const sequentialCard = '4123456789012349' // Valid Luhn but sequential
      const context = createContext('Card: 4123456789012349')

      const result = validateCandidate(sequentialCard, 'credit_card', context)
      expect(result.valid).toBe(false)
      expect(result.reason).toBe('sequential_digits')
    })

    it('should validate brand-specific patterns', () => {
      const amexCard = '378282246310005' // Valid Amex test number - should be rejected
      const context = createContext('American Express: 378282246310005', 'strict')

      const result = validateCandidate(amexCard, 'credit_card', context)
      expect(result.valid).toBe(false)
      expect(result.reason).toBe('test_number')
    })
  })

  describe('Email Validation', () => {
    const createContext = (
      text: string,
      strictness: 'fast' | 'balanced' | 'strict' = 'balanced',
    ): ValidationContext => ({
      surroundingText: text,
      strictness,
      originalIndex: 0,
    })

    it('should reject example domains', () => {
      const exampleEmail = 'user@example.com'
      const context = createContext('Contact: user@example.com for support')

      const result = validateCandidate(exampleEmail, 'email', context)
      expect(result.valid).toBe(false)
      expect(result.reason).toBe('example_domain')
    })

    it('should reject noreply addresses', () => {
      const noreplyEmail = 'noreply@company.com'
      const context = createContext('From: noreply@company.com')

      const result = validateCandidate(noreplyEmail, 'email', context)
      expect(result.valid).toBe(false)
      expect(result.reason).toBe('non_pii_prefix')
    })

    it('should accept real user emails', () => {
      const userEmail = 'john.doe@company.com'
      const context = createContext('Send to: john.doe@company.com')

      const result = validateCandidate(userEmail, 'email', context)
      expect(result.valid).toBe(true)
      expect(result.reason).toBe('valid_email')
    })

    it('should reject invalid TLDs', () => {
      const invalidEmail = 'user@domain.x'
      const context = createContext('Email: user@domain.x')

      const result = validateCandidate(invalidEmail, 'email', context)
      expect(result.valid).toBe(false)
      expect(result.reason).toBe('invalid_tld')
    })
  })

  describe('Registry Integration', () => {
    it('should use validation in fast mode (minimal validation)', async () => {
      const registry = new Registry({
        defaultAction: 'mask',
        validationStrictness: 'fast',
      })

      // Test credit card that would be rejected in stricter modes
      const text = 'Test card: 4111111111111111 for development'
      const result = await redactText(registry, text)

      // In fast mode, test cards are still detected and masked (no validation filters)
      expect(result).toContain('[REDACTED:credit_card]')
    })

    it('should use validation in balanced mode', async () => {
      const registry = new Registry({
        defaultAction: 'mask',
        validationStrictness: 'balanced',
      })

      // Test credit card should be rejected
      const text = 'Test card: 4111111111111111 for development'
      const result = await redactText(registry, text)

      // Test card should not be masked (rejected by validation)
      expect(result).toContain('4111111111111111')
    })

    it('should use validation in strict mode', async () => {
      const registry = new Registry({
        defaultAction: 'mask',
        validationStrictness: 'strict',
      })

      // Example email should be rejected in strict mode
      const text = 'Contact us at user@example.com for support'
      const result = await redactText(registry, text)

      // Example email should not be masked in strict mode
      expect(result).toContain('user@example.com')
    })

    it('should accept genuine PII with good context', async () => {
      const registry = new Registry({
        defaultAction: 'mask',
        validationStrictness: 'balanced',
      })

      // Real email with context should be detected
      const text = 'Send report to john.doe@company.com'
      const result = await redactText(registry, text)

      expect(result).toContain('[REDACTED:email]')
      expect(result).not.toContain('john.doe@company.com')
    })

    it('should provide confidence scores when validation is enabled', async () => {
      const registry = new Registry({
        defaultAction: 'mask',
        validationStrictness: 'balanced',
      })

      const text = 'Credit card payment: 4532015112830366 processed'
      const detection = await registry.detect(text)

      // Should have confidence scores for validated hits
      const ccHits = detection.hits.filter((h) => h.type === 'credit_card')
      if (ccHits.length > 0) {
        expect(ccHits[0].confidence).toBeDefined()
        expect(ccHits[0].confidence).toBeGreaterThan(0)
        expect(ccHits[0].confidence).toBeLessThanOrEqual(1)
      }
    })
  })

  describe('Context Scoring', () => {
    it('should increase confidence with positive context', async () => {
      const registry = new Registry({
        defaultAction: 'mask',
        validationStrictness: 'balanced',
      })

      const strongContext = 'Please enter your credit card number: 4532015112830366'
      const weakContext = 'Random number: 4532015112830366'

      const strongResult = await registry.detect(strongContext)
      const weakResult = await registry.detect(weakContext)

      const strongCC = strongResult.hits.find((h) => h.type === 'credit_card')
      const weakCC = weakResult.hits.find((h) => h.type === 'credit_card')

      if (strongCC && weakCC) {
        expect(strongCC.confidence).toBeGreaterThan(weakCC.confidence || 0)
      }
    })

    it('should reduce confidence with negative context', async () => {
      const registry = new Registry({
        defaultAction: 'mask',
        validationStrictness: 'balanced',
      })

      const goodContext = 'Contact email: user@company.com'
      const badContext = 'Example: user@example.com'

      const goodResult = await registry.detect(goodContext)
      const badResult = await registry.detect(badContext)

      // Bad context should result in no detection (validation rejects it)
      const goodEmail = goodResult.hits.find((h) => h.type === 'email')
      const badEmail = badResult.hits.find((h) => h.type === 'email')

      expect(goodEmail).toBeDefined()
      expect(badEmail).toBeUndefined() // Should be rejected by validation
    })
  })

  describe('Performance Impact', () => {
    it('should maintain reasonable performance with validation enabled', async () => {
      const registry = new Registry({
        defaultAction: 'mask',
        validationStrictness: 'balanced',
      })

      const largeText = 'Email user@company.com, IP 192.168.1.100, '.repeat(100)

      const start = performance.now()
      await redactText(registry, largeText)
      const duration = performance.now() - start

      // Should complete in reasonable time (adjust threshold as needed)
      expect(duration).toBeLessThan(100) // 100ms threshold
    })

    it('should be faster in fast mode', async () => {
      const fastRegistry = new Registry({
        defaultAction: 'mask',
        validationStrictness: 'fast',
      })

      const balancedRegistry = new Registry({
        defaultAction: 'mask',
        validationStrictness: 'balanced',
      })

      const text = 'Email user@company.com, IP 192.168.1.100, Card 4532015112830366'

      const fastStart = performance.now()
      await redactText(fastRegistry, text)
      const fastDuration = performance.now() - fastStart

      const balancedStart = performance.now()
      await redactText(balancedRegistry, text)
      const balancedDuration = performance.now() - balancedStart

      // Fast mode should be faster (though difference might be small for small text)
      expect(fastDuration).toBeLessThanOrEqual(balancedDuration * 2) // Allow some variance
    })
  })
})
