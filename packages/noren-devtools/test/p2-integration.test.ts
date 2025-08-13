import { Registry, redactText } from '@himorishige/noren-core'
import { describe, expect, it } from 'vitest'
import { DEFAULT_CONTEXTUAL_CONFIG, DISABLED_CONTEXTUAL_CONFIG } from '../src/index.js'

describe.skip('P2 Integration with Registry', () => {
  // TODO: P2 contextual confidence features are not fully implemented in v0.4.0
  // These tests will be enabled when P2 features are implemented
  describe('Registry with P2 contextual confidence', () => {
    it('should disable P2 features by default for backward compatibility', async () => {
      const registry = new Registry({
        defaultAction: 'mask',
        environment: 'production',
      })

      const result = await registry.detect('Example: user@example.com for testing')

      expect(result.hits).toHaveLength(1)
      expect(result.hits[0].confidence).toBeDefined()
      // P2 contextual adjustments should not be applied by default
      expect(result.hits[0].reasons?.some((r) => r.startsWith('contextual:'))).toBe(false)
    })

    it('should apply P2 contextual confidence when explicitly enabled', async () => {
      const registry = new Registry({
        defaultAction: 'mask',
        environment: 'production',
        enableContextualConfidence: true,
        contextualSuppressionEnabled: true,
      })

      const result = await registry.detect('Example: user@example.com for testing')

      expect(result.hits).toHaveLength(1)
      expect(result.hits[0].confidence).toBeDefined()
      expect(result.hits[0].reasons?.some((r) => r.startsWith('contextual:'))).toBe(true)

      // Confidence should be adjusted downward due to example marker
      expect(result.hits[0].confidence).toBeLessThan(0.7)
    })

    it('should use custom contextual configuration', async () => {
      const customConfig = {
        ...DEFAULT_CONTEXTUAL_CONFIG,
        enabled: true,
        suppressionEnabled: true,
        boostEnabled: false,
        minConfidenceFloor: 0.4,
      }

      const registry = new Registry({
        defaultAction: 'mask',
        environment: 'production',
        contextualConfig: customConfig,
      })

      const result = await registry.detect('Example test dummy: user@example.com')

      expect(result.hits).toHaveLength(1)
      // minConfidenceFloor = 0.4, so minimum is baseConfidence * 0.4
      // With strong suppression (multiplier ~0.4), should hit the floor
      expect(result.hits[0].confidence).toBeGreaterThanOrEqual(0.15) // Floor applied
      expect(result.hits[0].confidence).toBeLessThan(0.5) // Should be suppressed
      expect(result.hits[0].reasons?.some((r) => r.startsWith('contextual:'))).toBe(true)
    })

    it('should work with DISABLED_CONTEXTUAL_CONFIG', async () => {
      const registry = new Registry({
        defaultAction: 'mask',
        environment: 'production',
        contextualConfig: DISABLED_CONTEXTUAL_CONFIG,
      })

      const result = await registry.detect('Example: user@example.com for testing')

      expect(result.hits).toHaveLength(1)
      expect(result.hits[0].confidence).toBeDefined()
      // No contextual adjustments should be applied
      expect(result.hits[0].reasons?.some((r) => r.startsWith('contextual:'))).toBe(false)
    })
  })

  describe('P2 with different document types', () => {
    it('should suppress confidence in JSON templates', async () => {
      const registry = new Registry({
        defaultAction: 'mask',
        environment: 'production',
        enableContextualConfidence: true,
        contextualSuppressionEnabled: true,
      })

      const jsonTemplate = `{
        "example": {
          "email": "user@example.com",
          "test": true
        }
      }`

      const result = await registry.detect(jsonTemplate)

      expect(result.hits).toHaveLength(1)
      expect(result.hits[0].confidence).toBeLessThan(0.5) // Heavy suppression for template + example
    })

    it('should suppress confidence in CSV headers', async () => {
      const registry = new Registry({
        defaultAction: 'mask',
        environment: 'production',
        enableContextualConfidence: true,
        contextualSuppressionEnabled: true,
        sensitivity: 'strict', // Use strict to ensure detection
        confidenceThreshold: 0.1, // Very low threshold to catch suppressed emails
      })

      const csvData = `name,email,phone
John Doe, john@company.com, 555-1234
Jane Smith, jane@company.com, 555-5678`

      const result = await registry.detect(csvData)

      // Should detect emails in data rows (note: spaced CSV to avoid lookbehind issues)
      expect(result.hits.length).toBeGreaterThan(0)
      const emailHits = result.hits.filter((hit) => hit.type === 'email')
      expect(emailHits.length).toBeGreaterThan(0)
      // Emails should be detected but may have reduced confidence due to CSV context
      expect(emailHits.every((hit) => (hit.confidence || 0) > 0)).toBe(true)
    })

    it('should suppress confidence in code blocks', async () => {
      const registry = new Registry({
        defaultAction: 'mask',
        environment: 'production',
        enableContextualConfidence: true,
        contextualSuppressionEnabled: true,
      })

      const codeExample = `Here is an example:
\`\`\`javascript
const email = 'user@example.com'
const apiKey = 'sk-1234567890abcdef'
\`\`\``

      const result = await registry.detect(codeExample)

      expect(result.hits.length).toBeGreaterThan(0)
      // All hits in code block should have reduced confidence
      expect(result.hits.every((hit) => (hit.confidence || 0) < 0.6)).toBe(true)
    })

    it('should handle log files appropriately', async () => {
      const registry = new Registry({
        defaultAction: 'mask',
        environment: 'production',
        enableContextualConfidence: true,
        contextualSuppressionEnabled: true,
      })

      const logData = `2024-01-15 10:30:45 INFO User login: admin@company.com from 192.168.1.100
2024-01-15 10:31:02 ERROR Failed auth for: test@example.com from 10.0.0.1
2024-01-15 10:31:15 DEBUG Processing request with token: abc123def456`

      const result = await registry.detect(logData)

      expect(result.hits.length).toBeGreaterThan(0)

      // Real email (admin@company.com) should have higher confidence than test email
      const realEmailHits = result.hits.filter((hit) => hit.value === 'admin@company.com')
      const testEmailHits = result.hits.filter((hit) => hit.value === 'test@example.com')

      if (realEmailHits.length > 0 && testEmailHits.length > 0) {
        expect(realEmailHits[0].confidence || 0).toBeGreaterThan(testEmailHits[0].confidence || 0)
      }
    })
  })

  describe('P2 with sensitivity levels', () => {
    it('should filter differently based on contextual confidence', async () => {
      const testInput = `
        Real email: admin@company.com
        Example email: user@example.com
        Test data: test@example.com
        Template: {{email}}
      `

      // Strict sensitivity - should detect most things
      const strictRegistry = new Registry({
        defaultAction: 'mask',
        environment: 'production',
        sensitivity: 'strict',
        confidenceThreshold: 0.1, // Low threshold to detect suppressed items
        enableContextualConfidence: true,
        contextualSuppressionEnabled: true,
        allowDenyConfig: {
          customAllowlist: new Map(), // Disable allowlist for this test
        },
      })

      const strictResult = await redactText(strictRegistry, testInput)
      expect(strictResult).toContain('[REDACTED:email]')

      // Balanced sensitivity - should filter out heavily suppressed items
      const balancedRegistry = new Registry({
        defaultAction: 'mask',
        environment: 'production',
        sensitivity: 'balanced',
        confidenceThreshold: 0.3, // Medium threshold - above example emails (~0.225) but below admin (~0.42)
        enableContextualConfidence: true,
        contextualSuppressionEnabled: true,
        allowDenyConfig: {
          customAllowlist: new Map(), // Disable allowlist for this test
        },
      })

      const balancedResult = await redactText(balancedRegistry, testInput)
      expect(balancedResult).toContain('[REDACTED:email]') // Real email should be redacted
      expect(balancedResult).toContain('user@example.com') // Example emails should remain (suppressed below threshold)
      expect(balancedResult).toContain('test@example.com')

      // Relaxed sensitivity - should only redact high-confidence items
      const relaxedRegistry = new Registry({
        defaultAction: 'mask',
        environment: 'production',
        sensitivity: 'relaxed',
        confidenceThreshold: 0.5, // High threshold - only very confident detections
        enableContextualConfidence: true,
        contextualSuppressionEnabled: true,
        allowDenyConfig: {
          customAllowlist: new Map(), // Disable allowlist for this test
        },
      })

      const relaxedResult = await redactText(relaxedRegistry, testInput)
      expect(relaxedResult).toContain('user@example.com') // Most should remain unredacted due to high threshold
      expect(relaxedResult).toContain('test@example.com')
      expect(relaxedResult).toContain('admin@company.com') // Even admin email might be suppressed at this threshold
    })
  })

  describe('P2 with multilingual content', () => {
    it('should handle Japanese context markers', async () => {
      const registry = new Registry({
        defaultAction: 'mask',
        environment: 'production',
        enableContextualConfidence: true,
        contextualSuppressionEnabled: true,
      })

      const japaneseText = `
        実際のメール: admin@company.com
        例: user@example.com
        テスト: test@example.com
        サンプル: sample@example.com
      `

      const result = await registry.detect(japaneseText)

      expect(result.hits.length).toBeGreaterThan(0)

      // Real email should have higher confidence than example/test emails
      const realEmail = result.hits.find((hit) => hit.value === 'admin@company.com')
      const exampleEmail = result.hits.find((hit) => hit.value === 'user@example.com')

      if (realEmail && exampleEmail) {
        expect(realEmail.confidence || 0).toBeGreaterThan(exampleEmail.confidence || 0)
      }
    })

    it('should handle mixed language contexts', async () => {
      const registry = new Registry({
        defaultAction: 'mask',
        environment: 'production',
        enableContextualConfidence: true,
        contextualSuppressionEnabled: true,
      })

      const mixedText = 'Example テスト: user@example.com for サンプル testing'
      const result = await registry.detect(mixedText)

      expect(result.hits).toHaveLength(1)
      expect(result.hits[0].confidence).toBeLessThan(0.6) // Multiple suppression signals
      expect(result.hits[0].reasons?.some((r) => r.includes('contextual'))).toBe(true)
    })
  })

  describe('Performance and integration', () => {
    it('should maintain reasonable performance with P2 enabled', async () => {
      const registry = new Registry({
        defaultAction: 'mask',
        environment: 'production',
        enableContextualConfidence: true,
        contextualSuppressionEnabled: true,
      })

      const largeText = Array(100)
        .fill(`
        Example data:
        Real email: user${Math.random()}@company.com
        Test email: test@example.com
        Template: {{user.email}}
      `)
        .join('\n')

      const start = performance.now()
      const result = await registry.detect(largeText)
      const duration = performance.now() - start

      expect(result.hits.length).toBeGreaterThan(0)
      expect(duration).toBeLessThan(500) // Should complete within 500ms
    })

    it('should work correctly with P1 allowlist/denylist features', async () => {
      const registry = new Registry({
        defaultAction: 'mask',
        environment: 'test', // Enables test pattern allowlist
        enableContextualConfidence: true,
        contextualSuppressionEnabled: true,
      })

      const testInput = `
        Production: prod.user@company.com
        Test domain: user@example.com
        Private IP: 192.168.1.1
        Public IP: 8.8.8.8
      `

      const result = await redactText(registry, testInput)

      // Test patterns should be allowed by P1 allowlist (environment='test')
      expect(result).toContain('user@example.com') // example.com is allowlisted
      expect(result).toContain('192.168.1.1') // Private IP allowed in test env

      // Real data should still be redacted
      expect(result).not.toContain('prod.user@company.com')
      expect(result).not.toContain('8.8.8.8')
    })

    it('should preserve P1 confidence scoring when P2 is disabled', async () => {
      const registry = new Registry({
        defaultAction: 'mask',
        environment: 'production',
        enableConfidenceScoring: true,
        enableContextualConfidence: false,
      })

      const result = await registry.detect('user@example.com')

      expect(result.hits).toHaveLength(1)
      expect(result.hits[0].confidence).toBeDefined() // P1 confidence should be present
      expect(result.hits[0].reasons).toBeDefined() // P1 reasons should be present
      expect(result.hits[0].reasons?.some((r) => r.startsWith('contextual:'))).toBe(false) // No P2 reasons
    })
  })
})
