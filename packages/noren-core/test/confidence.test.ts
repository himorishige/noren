import { describe, expect, it } from 'vitest'
import {
  CONFIDENCE_THRESHOLDS,
  calculateConfidence,
  filterByConfidence,
  meetsConfidenceThreshold,
} from '../src/confidence.js'
import type { Hit } from '../src/types.js'

describe('Confidence Scoring System', () => {
  describe('calculateConfidence', () => {
    it('should calculate confidence for email patterns', () => {
      const hit: Hit = {
        type: 'email',
        start: 10,
        end: 25,
        value: 'user@domain.com',
        risk: 'medium',
      }

      const result = calculateConfidence(hit, 'Contact user@domain.com for support')

      expect(result.confidence).toBeGreaterThan(0.5)
      expect(result.confidence).toBeLessThan(1.0)
      expect(result.reasons).toContain('base-pattern-email')
      expect(result.features).toBeDefined()
    })

    it('should reduce confidence for test patterns', () => {
      const testHit: Hit = {
        type: 'email',
        start: 0,
        end: 16,
        value: 'test@example.com',
        risk: 'medium',
      }

      const realHit: Hit = {
        type: 'email',
        start: 0,
        end: 15,
        value: 'user@gmail.com',
        risk: 'medium',
      }

      const testResult = calculateConfidence(testHit, 'test@example.com')
      const realResult = calculateConfidence(realHit, 'user@gmail.com')

      expect(testResult.confidence).toBeLessThan(realResult.confidence)
      expect(testResult.reasons).toContain('test-domain')
    })

    it('should reduce confidence for patterns in code blocks', () => {
      const codeText = '```\nuser@example.com\n```'
      const normalText = 'Email: user@example.com'

      const hit: Hit = {
        type: 'email',
        start: 4,
        end: 20,
        value: 'user@example.com',
        risk: 'medium',
      }

      const codeResult = calculateConfidence(hit, codeText)
      const normalResult = calculateConfidence(hit, normalText)

      expect(codeResult.confidence).toBeLessThan(normalResult.confidence)
      expect(codeResult.reasons).toContain('in-code-block')
    })

    it('should handle email patterns with repeated characters', () => {
      const validHit: Hit = {
        type: 'email',
        start: 0,
        end: 18,
        value: 'user@company.com',
        risk: 'medium',
      }

      const testHit: Hit = {
        type: 'email',
        start: 0,
        end: 18,
        value: 'test@example.com',
        risk: 'medium',
      }

      const validResult = calculateConfidence(validHit, 'Contact: user@company.com')
      const testResult = calculateConfidence(testHit, 'Example: test@example.com')

      expect(validResult.confidence).toBeGreaterThan(testResult.confidence)
      expect(testResult.reasons).toContain('example-keywords-present')
    })
  })

  describe('meetsConfidenceThreshold', () => {
    it('should check confidence against sensitivity levels', () => {
      expect(meetsConfidenceThreshold(0.6, 'strict')).toBe(true)
      expect(meetsConfidenceThreshold(0.6, 'balanced')).toBe(false)
      expect(meetsConfidenceThreshold(0.6, 'relaxed')).toBe(false)

      expect(meetsConfidenceThreshold(0.8, 'strict')).toBe(true)
      expect(meetsConfidenceThreshold(0.8, 'balanced')).toBe(true)
      expect(meetsConfidenceThreshold(0.8, 'relaxed')).toBe(false)

      expect(meetsConfidenceThreshold(0.9, 'strict')).toBe(true)
      expect(meetsConfidenceThreshold(0.9, 'balanced')).toBe(true)
      expect(meetsConfidenceThreshold(0.9, 'relaxed')).toBe(true)
    })

    it('should use custom threshold when provided', () => {
      expect(meetsConfidenceThreshold(0.6, 'balanced', 0.5)).toBe(true)
      expect(meetsConfidenceThreshold(0.6, 'balanced', 0.8)).toBe(false)
    })
  })

  describe('filterByConfidence', () => {
    const hits: Hit[] = [
      {
        type: 'email',
        start: 0,
        end: 15,
        value: 'user@gmail.com',
        risk: 'medium',
        confidence: 0.9,
      },
      {
        type: 'email',
        start: 20,
        end: 36,
        value: 'test@example.com',
        risk: 'medium',
        confidence: 0.3,
      },
      {
        type: 'ipv4',
        start: 40,
        end: 47,
        value: '8.8.8.8',
        risk: 'low',
        confidence: 0.8,
      },
      {
        type: 'ipv4',
        start: 50,
        end: 61,
        value: '192.168.1.1',
        risk: 'low',
        confidence: 0.2,
      },
    ]

    it('should filter hits by strict sensitivity', () => {
      const filtered = filterByConfidence(hits, 'strict')
      expect(filtered).toHaveLength(2) // High confidence ones (0.9, 0.8)
      expect(filtered.map((h) => h.value)).not.toContain('192.168.1.1')
      expect(filtered.map((h) => h.value)).not.toContain('test@example.com')
    })

    it('should filter hits by balanced sensitivity', () => {
      const filtered = filterByConfidence(hits, 'balanced')
      expect(filtered).toHaveLength(2) // Only high confidence ones
      expect(filtered.map((h) => h.value)).toEqual(['user@gmail.com', '8.8.8.8'])
    })

    it('should filter hits by relaxed sensitivity', () => {
      const filtered = filterByConfidence(hits, 'relaxed')
      expect(filtered).toHaveLength(1) // Only the highest confidence
      expect(filtered[0].value).toBe('user@gmail.com')
    })

    it('should keep hits without confidence scores for backward compatibility', () => {
      const hitsWithoutConfidence: Hit[] = [
        {
          type: 'email',
          start: 0,
          end: 15,
          value: 'user@domain.com',
          risk: 'medium',
          // No confidence field
        },
      ]

      const filtered = filterByConfidence(hitsWithoutConfidence, 'relaxed')
      expect(filtered).toHaveLength(1)
    })
  })

  describe('CONFIDENCE_THRESHOLDS', () => {
    it('should have correct threshold values', () => {
      expect(CONFIDENCE_THRESHOLDS.strict).toBe(0.5)
      expect(CONFIDENCE_THRESHOLDS.balanced).toBe(0.7)
      expect(CONFIDENCE_THRESHOLDS.relaxed).toBe(0.85)
    })

    it('should have ascending threshold values', () => {
      expect(CONFIDENCE_THRESHOLDS.strict).toBeLessThan(CONFIDENCE_THRESHOLDS.balanced)
      expect(CONFIDENCE_THRESHOLDS.balanced).toBeLessThan(CONFIDENCE_THRESHOLDS.relaxed)
    })
  })
})
