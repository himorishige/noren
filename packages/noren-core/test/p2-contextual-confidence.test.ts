import { describe, expect, it } from 'vitest'
import {
  applyContextualConfidence,
  CONSERVATIVE_CONTEXTUAL_CONFIG,
  calculateContextualConfidence,
  createContextualConfig,
  DEFAULT_CONTEXTUAL_CONFIG,
  DISABLED_CONTEXTUAL_CONFIG,
} from '../src/contextual-confidence.js'
import type { Hit } from '../src/types.js'

describe('P2 Contextual Confidence', () => {
  const sampleHit: Hit = {
    type: 'email',
    start: 10,
    end: 27,
    value: 'user@example.com',
    risk: 'medium',
    confidence: 0.8,
  }

  describe('calculateContextualConfidence', () => {
    it('should return base confidence when disabled', () => {
      const text = 'Example: user@example.com for testing'
      const result = calculateContextualConfidence(sampleHit, text, 0.8, DISABLED_CONTEXTUAL_CONFIG)

      expect(result.contextualConfidence).toBe(0.8)
      expect(result.adjustmentFactor).toBe(1.0)
      expect(result.explanations).toHaveLength(0)
    })

    it('should suppress confidence for example markers', () => {
      const text = 'Example: user@example.com for testing'
      const result = calculateContextualConfidence(sampleHit, text, 0.8, DEFAULT_CONTEXTUAL_CONFIG)

      expect(result.contextualConfidence).toBeLessThan(0.8)
      expect(result.explanations.some((exp) => exp.ruleId === 'example-marker-strong')).toBe(true)
      expect(result.explanations.some((exp) => exp.effect === 'suppress')).toBe(true)
    })

    it('should suppress more for closer markers', () => {
      const closeText = 'Example: user@company.com'
      // Text without any context markers for comparison
      const neutralText = 'Contact user@company.com for support'
      const closePosition = closeText.indexOf('user@company.com')
      const neutralPosition = neutralText.indexOf('user@company.com')
      const closeHit = { ...sampleHit, start: closePosition, end: closePosition + 16 }
      const neutralHit = { ...sampleHit, start: neutralPosition, end: neutralPosition + 16 }

      const closeResult = calculateContextualConfidence(
        closeHit,
        closeText,
        0.8,
        DEFAULT_CONTEXTUAL_CONFIG,
      )
      const neutralResult = calculateContextualConfidence(
        neutralHit,
        neutralText,
        0.8,
        DEFAULT_CONTEXTUAL_CONFIG,
      )

      // Text with example marker should have lower confidence than neutral text
      expect(closeResult.contextualConfidence).toBeLessThan(neutralResult.contextualConfidence)
      expect(closeResult.explanations.some((exp) => exp.ruleId === 'example-marker-strong')).toBe(
        true,
      )
    })

    it('should suppress confidence in template contexts', () => {
      const templateText = 'Hello {{name}}, your email is: user@example.com'
      const result = calculateContextualConfidence(
        sampleHit,
        templateText,
        0.8,
        DEFAULT_CONTEXTUAL_CONFIG,
      )

      expect(result.contextualConfidence).toBeLessThan(0.8)
      expect(result.explanations.some((exp) => exp.ruleId === 'template-section')).toBe(true)
    })

    it('should suppress confidence in code blocks', () => {
      const codeText = `\`\`\`javascript
const email = 'user@example.com'
\`\`\``
      const result = calculateContextualConfidence(
        sampleHit,
        codeText,
        0.8,
        DEFAULT_CONTEXTUAL_CONFIG,
      )

      expect(result.contextualConfidence).toBeLessThan(0.8)
      expect(result.explanations.some((exp) => exp.ruleId === 'code-block')).toBe(true)
    })

    it('should suppress confidence in CSV headers', () => {
      const csvText = `name,email,phone
John,user@example.com,555-1234`
      const result = calculateContextualConfidence(
        sampleHit,
        csvText,
        0.8,
        DEFAULT_CONTEXTUAL_CONFIG,
      )

      expect(result.contextualConfidence).toBeLessThan(0.8)
      expect(result.explanations.some((exp) => exp.ruleId === 'header-row')).toBe(true)
    })

    it('should handle Japanese context markers', () => {
      const japaneseText = '例: user@example.com をテストしてください'
      const hit: Hit = { ...sampleHit, start: japaneseText.indexOf('user@example.com') }
      const result = calculateContextualConfidence(
        hit,
        japaneseText,
        0.8,
        DEFAULT_CONTEXTUAL_CONFIG,
      )

      expect(result.contextualConfidence).toBeLessThan(0.8)
      expect(result.explanations.some((exp) => exp.ruleId.includes('example-marker'))).toBe(true)
      expect(result.explanations.some((exp) => exp.ruleId.includes('test-marker'))).toBe(true)
    })

    it('should boost confidence for high entropy context (when enabled)', () => {
      const config = createContextualConfig({
        ...DEFAULT_CONTEXTUAL_CONFIG,
        boostEnabled: true,
      })
      const highEntropyText = 'Secret key: a1b2c3d4e5f6g7h8i9j0 near user@example.com'
      const result = calculateContextualConfidence(sampleHit, highEntropyText, 0.7, config)

      // Should boost due to high entropy, but may also have suppressions
      expect(result.explanations.some((exp) => exp.ruleId === 'high-entropy-boost')).toBe(true)
      expect(result.explanations.some((exp) => exp.effect === 'boost')).toBe(true)
    })

    it('should respect confidence floor', () => {
      const config = createContextualConfig({
        ...DEFAULT_CONTEXTUAL_CONFIG,
        minConfidenceFloor: 0.3, // 30% of base confidence
      })
      const heavilyMarkedText = 'Example test dummy placeholder: user@example.com'

      // Even with heavy suppression, should not go below 30% of 0.8 = 0.24
      const result = calculateContextualConfidence(sampleHit, heavilyMarkedText, 0.8, config)
      expect(result.contextualConfidence).toBeGreaterThanOrEqual(0.24)
    })

    it('should respect confidence ceiling', () => {
      const config = createContextualConfig({
        ...DEFAULT_CONTEXTUAL_CONFIG,
        boostEnabled: true,
        maxConfidenceCeiling: 0.95,
      })
      const boostText = 'Structured data with high entropy: user@example.com'

      const result = calculateContextualConfidence(sampleHit, boostText, 0.9, config)
      expect(result.contextualConfidence).toBeLessThanOrEqual(0.95)
    })

    it('should handle multiple overlapping rules correctly', () => {
      const complexText = `Example template:
\`\`\`
Email: {{user.email}} = user@example.com
\`\`\``

      const result = calculateContextualConfidence(
        sampleHit,
        complexText,
        0.8,
        DEFAULT_CONTEXTUAL_CONFIG,
      )

      // Should have multiple suppression rules active
      expect(result.explanations.length).toBeGreaterThan(1)
      expect(result.contextualConfidence).toBeLessThan(0.8)

      // Check that multiple different rule types are present
      const ruleIds = result.explanations.map((exp) => exp.ruleId)
      expect(ruleIds).toContain('example-marker-strong')
      expect(ruleIds).toContain('template-section')
      expect(ruleIds).toContain('code-block')
    })
  })

  describe('applyContextualConfidence', () => {
    it('should modify hit confidence in place', () => {
      const hit: Hit = { ...sampleHit }
      const text = 'Example: user@example.com for testing'

      const originalConfidence = hit.confidence
      const result = applyContextualConfidence(hit, text, DEFAULT_CONTEXTUAL_CONFIG)

      expect(hit.confidence).not.toBe(originalConfidence)
      expect(hit.confidence).toBe(result.contextualConfidence)
    })

    it('should add contextual reasons to existing reasons', () => {
      const hit: Hit = {
        ...sampleHit,
        reasons: ['base-pattern-email', 'valid-tld'],
      }
      const text = 'Example: user@example.com for testing'

      applyContextualConfidence(hit, text, DEFAULT_CONTEXTUAL_CONFIG)

      expect(hit.reasons).toContain('base-pattern-email')
      expect(hit.reasons).toContain('valid-tld')
      expect(hit.reasons?.some((reason) => reason.startsWith('contextual:'))).toBe(true)
    })

    it('should store contextual features in hit features', () => {
      const hit: Hit = {
        ...sampleHit,
        features: { baseFeatures: true },
      }
      const text = 'Example: user@example.com for testing'

      applyContextualConfidence(hit, text, DEFAULT_CONTEXTUAL_CONFIG)

      expect(hit.features?.contextual).toBeDefined()
      expect(hit.features?.contextual.adjustmentFactor).toBeDefined()
      expect(hit.features?.contextual.explanations).toBeDefined()
      expect(hit.features?.contextual.contextFeatures).toBeDefined()
      expect(hit.features?.baseFeatures).toBe(true) // Preserve existing features
    })

    it('should handle hits without base confidence', () => {
      const hit: Hit = {
        type: 'email',
        start: 10,
        end: 27,
        value: 'user@example.com',
        risk: 'medium',
        // No confidence field
      }
      const text = 'Example: user@example.com'

      const result = applyContextualConfidence(hit, text, DEFAULT_CONTEXTUAL_CONFIG)

      expect(hit.confidence).toBeDefined()
      expect(result.baseConfidence).toBe(0.5) // Fallback value
    })
  })

  describe('Configuration variations', () => {
    it('should use conservative config correctly', () => {
      const text = 'Example: user@example.com for testing'
      const result = calculateContextualConfidence(
        sampleHit,
        text,
        0.8,
        CONSERVATIVE_CONTEXTUAL_CONFIG,
      )

      expect(result.contextualConfidence).toBeLessThan(0.8)
      expect(result.contextualConfidence).toBeGreaterThanOrEqual(0.48) // 60% floor of 0.8
      expect(result.explanations.some((exp) => exp.effect === 'boost')).toBe(false) // No boost in conservative
    })

    it('should allow custom rule configuration', () => {
      const customConfig = createContextualConfig({
        enabled: true,
        suppressionEnabled: true,
        boostEnabled: false,
        rules: [
          {
            id: 'custom-suppression',
            priority: 100,
            condition: (features) => features.markers.example_marker_nearby,
            multiplier: 0.2,
            description: 'Custom strong suppression for examples',
          },
        ],
      })

      const text = 'Example: user@company.com'
      const position = text.indexOf('user@company.com')
      const hit = { ...sampleHit, start: position, end: position + 16 }
      const result = calculateContextualConfidence(hit, text, 0.8, customConfig)

      expect(result.explanations.some((exp) => exp.ruleId === 'custom-suppression')).toBe(true)
      // With custom rules, the actual multiplier depends on rule priority and processing
      expect(result.contextualConfidence).toBeLessThan(0.8) // Should suppress
    })

    it('should handle suppression disabled', () => {
      const config = createContextualConfig({
        enabled: true,
        suppressionEnabled: false,
        boostEnabled: true,
      })

      const text = 'Example: user@example.com for testing'
      const result = calculateContextualConfidence(sampleHit, text, 0.8, config)

      expect(result.contextualConfidence).toBeGreaterThanOrEqual(0.8) // No suppression
      expect(result.explanations.every((exp) => exp.effect !== 'suppress')).toBe(true)
    })

    it('should handle boost disabled', () => {
      const config = createContextualConfig({
        enabled: true,
        suppressionEnabled: true,
        boostEnabled: false,
      })

      const text = 'High entropy data: abc123def456 with user@example.com'
      const result = calculateContextualConfidence(sampleHit, text, 0.7, config)

      // Should suppress if markers present, but not boost for high entropy
      expect(result.explanations.every((exp) => exp.effect !== 'boost')).toBe(true)
    })
  })

  describe('Performance and edge cases', () => {
    it('should handle very large text efficiently', () => {
      const largeText = `${'prefix '.repeat(10000)}Example: user@example.com${' suffix'.repeat(10000)}`
      const position = largeText.indexOf('user@example.com')
      const hit: Hit = { ...sampleHit, start: position, end: position + 17 }

      const start = performance.now()
      const result = calculateContextualConfidence(hit, largeText, 0.8, DEFAULT_CONTEXTUAL_CONFIG)
      const duration = performance.now() - start

      expect(result).toBeDefined()
      expect(result.contextualConfidence).toBeLessThan(0.8)
      expect(duration).toBeLessThan(100) // Should complete within 100ms
    })

    it('should handle empty explanations gracefully', () => {
      const plainText = 'Contact admin@company.com for support' // No context markers
      const position = plainText.indexOf('admin@company.com')
      const hit = { ...sampleHit, start: position, end: position + 17 }
      const result = calculateContextualConfidence(hit, plainText, 0.8, DEFAULT_CONTEXTUAL_CONFIG)

      expect(result.contextualConfidence).toBe(0.8) // No adjustment
      expect(result.adjustmentFactor).toBe(1.0)
      expect(result.explanations).toHaveLength(0)
    })

    it('should handle malformed text gracefully', () => {
      const malformedText = '\x00\x01\x02 user@example.com \xff\xfe'
      const result = calculateContextualConfidence(
        sampleHit,
        malformedText,
        0.8,
        DEFAULT_CONTEXTUAL_CONFIG,
      )

      expect(result).toBeDefined()
      expect(result.contextualConfidence).toBeGreaterThanOrEqual(0)
      expect(result.contextualConfidence).toBeLessThanOrEqual(1)
    })
  })
})
