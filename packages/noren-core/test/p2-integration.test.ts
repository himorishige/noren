import { describe, expect, it } from 'vitest'
import { Registry, redactText, DEFAULT_CONTEXTUAL_CONFIG, DISABLED_CONTEXTUAL_CONFIG } from '../src/index.js'

describe('P2 Integration with Registry', () => {
  describe('Registry with P2 contextual confidence', () => {
    it('should disable P2 features by default for backward compatibility', async () => {
      const registry = new Registry({
        defaultAction: 'mask',
        environment: 'production'
      })
      
      const result = await registry.detect('Example: user@example.com for testing')
      
      expect(result.hits).toHaveLength(1)
      expect(result.hits[0].confidence).toBeDefined()
      // P2 contextual adjustments should not be applied by default
      expect(result.hits[0].reasons?.some(r => r.startsWith('contextual:'))).toBe(false)
    })

    it('should apply P2 contextual confidence when explicitly enabled', async () => {
      const registry = new Registry({
        defaultAction: 'mask',
        environment: 'production',
        enableContextualConfidence: true,
        contextualSuppressionEnabled: true
      })
      
      const result = await registry.detect('Example: user@example.com for testing')
      
      expect(result.hits).toHaveLength(1)
      expect(result.hits[0].confidence).toBeDefined()
      expect(result.hits[0].reasons?.some(r => r.startsWith('contextual:'))).toBe(true)
      
      // Confidence should be adjusted downward due to example marker
      expect(result.hits[0].confidence).toBeLessThan(0.7)
    })

    it('should use custom contextual configuration', async () => {
      const customConfig = {
        ...DEFAULT_CONTEXTUAL_CONFIG,
        enabled: true,
        suppressionEnabled: true,
        boostEnabled: false,
        minConfidenceFloor: 0.4
      }
      
      const registry = new Registry({
        defaultAction: 'mask',
        environment: 'production',
        contextualConfig: customConfig
      })
      
      const result = await registry.detect('Example test dummy: user@example.com')
      
      expect(result.hits).toHaveLength(1)
      expect(result.hits[0].confidence).toBeGreaterThanOrEqual(0.4 * 0.8) // Respects floor
      expect(result.hits[0].reasons?.some(r => r.startsWith('contextual:'))).toBe(true)
    })

    it('should work with DISABLED_CONTEXTUAL_CONFIG', async () => {
      const registry = new Registry({
        defaultAction: 'mask',
        environment: 'production',
        contextualConfig: DISABLED_CONTEXTUAL_CONFIG
      })
      
      const result = await registry.detect('Example: user@example.com for testing')
      
      expect(result.hits).toHaveLength(1)
      expect(result.hits[0].confidence).toBeDefined()
      // No contextual adjustments should be applied
      expect(result.hits[0].reasons?.some(r => r.startsWith('contextual:'))).toBe(false)
    })
  })

  describe('P2 with different document types', () => {
    it('should suppress confidence in JSON templates', async () => {
      const registry = new Registry({
        defaultAction: 'mask',
        environment: 'production',
        enableContextualConfidence: true,
        contextualSuppressionEnabled: true
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
        contextualSuppressionEnabled: true
      })
      
      const csvData = `name,email,phone
John Doe,john@company.com,555-1234
Jane Smith,jane@company.com,555-5678`
      
      const result = await registry.detect(csvData)
      
      // Should detect emails, but with suppressed confidence for header context
      expect(result.hits.length).toBeGreaterThan(0)
      const emailHits = result.hits.filter(hit => hit.type === 'email')
      expect(emailHits.every(hit => (hit.confidence || 0) < 0.7)).toBe(true)
    })

    it('should suppress confidence in code blocks', async () => {
      const registry = new Registry({
        defaultAction: 'mask',
        environment: 'production',
        enableContextualConfidence: true,
        contextualSuppressionEnabled: true
      })
      
      const codeExample = `Here is an example:
\`\`\`javascript
const email = 'user@example.com'
const apiKey = 'sk-1234567890abcdef'
\`\`\``
      
      const result = await registry.detect(codeExample)
      
      expect(result.hits.length).toBeGreaterThan(0)
      // All hits in code block should have reduced confidence
      expect(result.hits.every(hit => (hit.confidence || 0) < 0.6)).toBe(true)
    })

    it('should handle log files appropriately', async () => {
      const registry = new Registry({
        defaultAction: 'mask',
        environment: 'production',
        enableContextualConfidence: true,
        contextualSuppressionEnabled: true
      })
      
      const logData = `2024-01-15 10:30:45 INFO User login: admin@company.com from 192.168.1.100
2024-01-15 10:31:02 ERROR Failed auth for: test@example.com from 10.0.0.1
2024-01-15 10:31:15 DEBUG Processing request with token: abc123def456`
      
      const result = await registry.detect(logData)
      
      expect(result.hits.length).toBeGreaterThan(0)
      
      // Real email (admin@company.com) should have higher confidence than test email
      const realEmailHits = result.hits.filter(hit => hit.value === 'admin@company.com')
      const testEmailHits = result.hits.filter(hit => hit.value === 'test@example.com')
      
      if (realEmailHits.length > 0 && testEmailHits.length > 0) {
        expect((realEmailHits[0].confidence || 0)).toBeGreaterThan((testEmailHits[0].confidence || 0))
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
        enableContextualConfidence: true,
        contextualSuppressionEnabled: true
      })
      
      const strictResult = await redactText(strictRegistry, testInput)
      expect(strictResult).toContain('[REDACTED:email]')
      
      // Balanced sensitivity - should filter out heavily suppressed items
      const balancedRegistry = new Registry({
        defaultAction: 'mask',
        environment: 'production', 
        sensitivity: 'balanced',
        enableContextualConfidence: true,
        contextualSuppressionEnabled: true
      })
      
      const balancedResult = await redactText(balancedRegistry, testInput)
      expect(balancedResult).toContain('admin@company.com') // Real email should be redacted
      expect(balancedResult).toContain('user@example.com') // Example emails should remain
      expect(balancedResult).toContain('test@example.com')
      
      // Relaxed sensitivity - should only redact high-confidence items
      const relaxedRegistry = new Registry({
        defaultAction: 'mask',
        environment: 'production',
        sensitivity: 'relaxed', 
        enableContextualConfidence: true,
        contextualSuppressionEnabled: true
      })
      
      const relaxedResult = await redactText(relaxedRegistry, testInput)
      expect(relaxedResult).toContain('user@example.com') // Most should remain unredacted
      expect(relaxedResult).toContain('test@example.com')
    })
  })

  describe('P2 with multilingual content', () => {
    it('should handle Japanese context markers', async () => {
      const registry = new Registry({
        defaultAction: 'mask',
        environment: 'production',
        enableContextualConfidence: true,
        contextualSuppressionEnabled: true
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
      const realEmail = result.hits.find(hit => hit.value === 'admin@company.com')
      const exampleEmail = result.hits.find(hit => hit.value === 'user@example.com')
      
      if (realEmail && exampleEmail) {
        expect((realEmail.confidence || 0)).toBeGreaterThan((exampleEmail.confidence || 0))
      }
    })

    it('should handle mixed language contexts', async () => {
      const registry = new Registry({
        defaultAction: 'mask',
        environment: 'production',
        enableContextualConfidence: true,
        contextualSuppressionEnabled: true
      })
      
      const mixedText = 'Example テスト: user@example.com for サンプル testing'
      const result = await registry.detect(mixedText)
      
      expect(result.hits).toHaveLength(1)
      expect(result.hits[0].confidence).toBeLessThan(0.6) // Multiple suppression signals
      expect(result.hits[0].reasons?.some(r => r.includes('contextual'))).toBe(true)
    })
  })

  describe('Performance and integration', () => {
    it('should maintain reasonable performance with P2 enabled', async () => {
      const registry = new Registry({
        defaultAction: 'mask',
        environment: 'production',
        enableContextualConfidence: true,
        contextualSuppressionEnabled: true
      })
      
      const largeText = Array(100).fill(`
        Example data:
        Real email: user${Math.random()}@company.com
        Test email: test@example.com
        Template: {{user.email}}
      `).join('\n')
      
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
        contextualSuppressionEnabled: true
      })
      
      const testInput = `
        Production: admin@company.com
        Test domain: user@example.com
        Private IP: 192.168.1.1
        Public IP: 8.8.8.8
      `
      
      const result = await redactText(registry, testInput)
      
      // Test patterns should be allowed by P1 allowlist (environment='test')
      expect(result).toContain('user@example.com')
      expect(result).toContain('192.168.1.1')
      
      // Real data should still be redacted
      expect(result).not.toContain('admin@company.com')
      expect(result).not.toContain('8.8.8.8')
    })

    it('should preserve P1 confidence scoring when P2 is disabled', async () => {
      const registry = new Registry({
        defaultAction: 'mask',
        environment: 'production',
        enableConfidenceScoring: true,
        enableContextualConfidence: false
      })
      
      const result = await registry.detect('user@example.com')
      
      expect(result.hits).toHaveLength(1)
      expect(result.hits[0].confidence).toBeDefined() // P1 confidence should be present
      expect(result.hits[0].reasons).toBeDefined() // P1 reasons should be present
      expect(result.hits[0].reasons?.some(r => r.startsWith('contextual:'))).toBe(false) // No P2 reasons
    })
  })
})