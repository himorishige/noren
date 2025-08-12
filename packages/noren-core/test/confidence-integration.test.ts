import { describe, expect, it } from 'vitest'
import { Registry, redactText } from '../src/index.js'

describe('Confidence Scoring Integration', () => {
  describe('Registry with confidence scoring', () => {
    it('should apply confidence scoring by default', async () => {
      const registry = new Registry({
        defaultAction: 'mask',
        environment: 'production'
      })
      
      const result = await registry.detect('Contact user@example.com for support')
      
      expect(result.hits).toHaveLength(1)
      expect(result.hits[0].confidence).toBeDefined()
      expect(result.hits[0].reasons).toBeDefined()
      expect(result.hits[0].features).toBeDefined()
    })
    
    it('should disable confidence scoring when requested', async () => {
      const registry = new Registry({
        defaultAction: 'mask',
        environment: 'production',
        enableConfidenceScoring: false
      })
      
      const result = await registry.detect('Contact user@example.com for support')
      
      expect(result.hits).toHaveLength(1)
      expect(result.hits[0].confidence).toBeUndefined()
      expect(result.hits[0].reasons).toBeUndefined()
    })
    
    it('should filter hits by sensitivity level', async () => {
      const registry = new Registry({
        defaultAction: 'mask',
        environment: 'production',
        sensitivity: 'balanced'
      })
      
      const testInput = `
        Real email: user@gmail.com
        Test email: test@example.com
        Public IP: 8.8.8.8
        Private IP: 192.168.1.1
      `
      
      const result = await registry.detect(testInput)
      
      // Should filter out low-confidence matches like test@example.com and 192.168.1.1
      const emailHits = result.hits.filter(h => h.type === 'email')
      const ipHits = result.hits.filter(h => h.type === 'ipv4')
      
      // With balanced sensitivity (0.7), only high-confidence matches should remain
      expect(emailHits.length).toBeGreaterThan(0)
      expect(emailHits.some(h => h.value === 'test@example.com')).toBe(false)
      expect(ipHits.some(h => h.value === '192.168.1.1')).toBe(false)
    })
    
    it('should use custom confidence threshold', async () => {
      const registry = new Registry({
        defaultAction: 'mask',
        environment: 'production',
        sensitivity: 'balanced',
        confidenceThreshold: 0.4 // Lower than balanced default (0.7)
      })
      
      const result = await registry.detect('test@example.com')
      
      // With lower threshold, should detect even test emails
      expect(result.hits).toHaveLength(1)
      expect(result.hits[0].value).toBe('test@example.com')
      expect(result.hits[0].confidence).toBeLessThan(0.7)
    })
  })
  
  describe('Sensitivity levels in redaction', () => {
    it('should redact differently based on sensitivity', async () => {
      const testInput = `
        Real: user@gmail.com
        Test: test@example.com
        IP: 192.168.1.1
      `
      
      // Strict - should redact almost everything
      const strictRegistry = new Registry({
        defaultAction: 'mask',
        environment: 'production',
        sensitivity: 'strict'
      })
      const strictResult = await redactText(strictRegistry, testInput)
      expect(strictResult).toContain('[REDACTED:email]')
      expect(strictResult).toContain('[REDACTED:ipv4]')
      
      // Relaxed - should redact only high-confidence matches
      const relaxedRegistry = new Registry({
        defaultAction: 'mask',
        environment: 'production',
        sensitivity: 'relaxed'
      })
      const relaxedResult = await redactText(relaxedRegistry, testInput)
      expect(relaxedResult).toContain('[REDACTED:email]')
      expect(relaxedResult).toContain('test@example.com') // Should not be redacted
      expect(relaxedResult).toContain('192.168.1.1') // Should not be redacted
    })
    
    it('should combine with allowlist filtering', async () => {
      const registry = new Registry({
        defaultAction: 'mask',
        environment: 'test', // Enables test patterns allowlist
        sensitivity: 'strict'
      })
      
      const testInput = `
        Test domain: test@example.com
        Real domain: user@gmail.com
        Private IP: 192.168.1.1
        Public IP: 8.8.8.8
      `
      
      const result = await redactText(registry, testInput)
      
      // Test patterns should be allowed by environment settings, not by confidence
      expect(result).toContain('test@example.com')
      expect(result).toContain('192.168.1.1')
      
      // Real PII should still be redacted
      expect(result).not.toContain('user@gmail.com')
      expect(result).not.toContain('8.8.8.8')
    })
  })
  
  describe('Confidence features and reasoning', () => {
    it('should provide detailed confidence reasoning', async () => {
      const registry = new Registry({
        defaultAction: 'mask',
        environment: 'production'
      })
      
      const codeInput = '```\nuser@example.com\n```'
      const result = await registry.detect(codeInput)
      
      expect(result.hits).toHaveLength(1)
      expect(result.hits[0].reasons).toContain('in-code-block')
      expect(result.hits[0].confidence).toBeLessThan(0.7)
    })
    
    it('should extract useful features', async () => {
      const registry = new Registry({
        defaultAction: 'mask',
        environment: 'production'
      })
      
      const result = await registry.detect('Contact user@example.com for test purposes')
      
      expect(result.hits).toHaveLength(1)
      expect(result.hits[0].features).toBeDefined()
      expect(result.hits[0].features?.hasTestKeywords).toBe(true)
      expect(result.hits[0].features?.surroundingWords).toContain('test')
    })
  })
  
  describe('Performance with confidence scoring', () => {
    it('should maintain reasonable performance with confidence scoring', async () => {
      const registry = new Registry({
        defaultAction: 'mask',
        environment: 'production',
        sensitivity: 'balanced'
      })
      
      const largeText = Array(100).fill('Contact user@domain.com for support').join(' ')
      
      const startTime = performance.now()
      await registry.detect(largeText)
      const duration = performance.now() - startTime
      
      // Should still be fast (< 100ms for 100 repetitions)
      expect(duration).toBeLessThan(100)
    })
    
    it('should be faster with confidence scoring disabled', async () => {
      const enabledRegistry = new Registry({
        defaultAction: 'mask',
        environment: 'production',
        enableConfidenceScoring: true
      })
      
      const disabledRegistry = new Registry({
        defaultAction: 'mask',
        environment: 'production',
        enableConfidenceScoring: false
      })
      
      const text = 'Contact user@domain.com and admin@test.com'
      
      const startEnabled = performance.now()
      await enabledRegistry.detect(text)
      const durationEnabled = performance.now() - startEnabled
      
      const startDisabled = performance.now()
      await disabledRegistry.detect(text)
      const durationDisabled = performance.now() - startDisabled
      
      // Disabled should be faster (though difference may be small)
      expect(durationDisabled).toBeLessThan(durationEnabled + 5) // Allow 5ms tolerance
    })
  })
})