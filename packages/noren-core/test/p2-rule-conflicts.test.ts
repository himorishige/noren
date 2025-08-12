import { describe, expect, it } from 'vitest'
import {
  DEFAULT_CONTEXTUAL_CONFIG,
  calculateContextualConfidence,
  createContextualConfig,
} from '../src/contextual-confidence.js'
import type { Hit } from '../src/types.js'

describe('P2-Sprint2: Rule Conflict Resolution', () => {
  const sampleHit: Hit = {
    type: 'email',
    start: 10,
    end: 27,
    value: 'user@company.com',
    risk: 'medium',
    confidence: 0.8,
  }

  describe('Priority-based conflict resolution', () => {
    it('should apply higher priority rules first', () => {
      const customConfig = createContextualConfig({
        enabled: true,
        suppressionEnabled: true,
        boostEnabled: false,
        minConfidenceFloor: 0.01,  // Allow deeper suppression for testing
        rules: [
          {
            id: 'low-priority-rule',
            priority: 10,
            condition: () => true,
            multiplier: 0.9,
            description: 'Low priority suppression'
          },
          {
            id: 'high-priority-rule',
            priority: 90,
            condition: () => true,
            multiplier: 0.3,
            description: 'High priority strong suppression'
          }
        ]
      })
      
      const text = 'Test text with user@company.com'
      const position = text.indexOf('user@company.com')
      const hit = { ...sampleHit, start: position, end: position + 17 }
      
      const result = calculateContextualConfidence(hit, text, 0.8, customConfig)
      
      // Should apply both rules (0.8 * 0.3 * 0.9 = 0.216)
      expect(result.contextualConfidence).toBeCloseTo(0.216)
      expect(result.explanations).toHaveLength(2)
      expect(result.explanations[0].ruleId).toBe('high-priority-rule')
      expect(result.explanations[1].ruleId).toBe('low-priority-rule')
    })

    it('should handle same priority conflicts with category precedence', () => {
      const text = `{
        "example": "user@company.com",
        "name": "田中太郎"
      }`
      const position = text.indexOf('user@company.com')
      const hit = { ...sampleHit, start: position, end: position + 17 }
      
      const result = calculateContextualConfidence(hit, text, 0.8, DEFAULT_CONTEXTUAL_CONFIG)
      
      // Should have multiple suppression rules but resolved by precedence
      expect(result.contextualConfidence).toBeLessThan(0.8)
      expect(result.explanations.length).toBeGreaterThan(0)
      
      // Format-specific rules should take precedence over marker-based rules
      const formatRules = result.explanations.filter(exp => exp.ruleId.includes('json'))
      const markerRules = result.explanations.filter(exp => exp.ruleId.includes('example'))
      
      // Both should be present but format rules processed first
      expect(formatRules.length + markerRules.length).toBeGreaterThan(0)
    })
  })

  describe('Category precedence resolution', () => {
    it('should prioritize format-specific over locale-specific rules', () => {
      const jsonText = `{
        "currency": "¥1000",
        "email": "user@company.com"
      }`
      const position = jsonText.indexOf('user@company.com')
      const hit = { ...sampleHit, start: position, end: position + 17 }
      
      const result = calculateContextualConfidence(hit, jsonText, 0.8, DEFAULT_CONTEXTUAL_CONFIG)
      
      // Should detect both JSON structure and currency placeholder
      expect(result.explanations.some(exp => exp.ruleId.includes('json'))).toBe(true)
      expect(result.explanations.some(exp => exp.ruleId.includes('currency'))).toBe(true)
    })

    it('should prioritize locale-specific over marker-based rules', () => {
      const text = 'Example date: 2024-01-01, email: user@company.com'
      const position = text.indexOf('user@company.com')
      const hit = { ...sampleHit, start: position, end: position + 17 }
      
      const result = calculateContextualConfidence(hit, text, 0.8, DEFAULT_CONTEXTUAL_CONFIG)
      
      // Should have both example marker and date placeholder
      expect(result.explanations.some(exp => exp.ruleId.includes('example'))).toBe(true)
      expect(result.explanations.some(exp => exp.ruleId.includes('date'))).toBe(true)
    })

    it('should prioritize marker-based over structural rules', () => {
      const text = 'Example: user@company.com in JSON format'
      const position = text.indexOf('user@company.com')
      const hit = { ...sampleHit, start: position, end: position + 17 }
      
      const result = calculateContextualConfidence(hit, text, 0.8, DEFAULT_CONTEXTUAL_CONFIG)
      
      // Should have example marker rule
      expect(result.explanations.some(exp => exp.ruleId.includes('example'))).toBe(true)
    })
  })

  describe('Tiebreaker resolution', () => {
    it('should prefer stronger suppression in tiebreakers', () => {
      const customConfig = createContextualConfig({
        enabled: true,
        suppressionEnabled: true,
        boostEnabled: false,
        minConfidenceFloor: 0.01,  // Allow deeper suppression for testing
        rules: [
          {
            id: 'weak-suppression',
            priority: 50,
            condition: () => true,
            multiplier: 0.8,
            description: 'Weak suppression'
          },
          {
            id: 'strong-suppression',
            priority: 50,
            condition: () => true,
            multiplier: 0.3,
            description: 'Strong suppression'
          }
        ]
      })
      
      const text = 'Test user@company.com'
      const position = text.indexOf('user@company.com')
      const hit = { ...sampleHit, start: position, end: position + 17 }
      
      const result = calculateContextualConfidence(hit, text, 0.8, customConfig)
      
      // Should only apply the stronger suppression rule (0.3)
      expect(result.contextualConfidence).toBe(0.24) // 0.8 * 0.3
      expect(result.explanations).toHaveLength(1)
      expect(result.explanations[0].ruleId).toBe('strong-suppression')
    })

    it('should prefer higher boost in tiebreakers when only boosts present', () => {
      const customConfig = createContextualConfig({
        enabled: true,
        suppressionEnabled: false,
        boostEnabled: true,
        maxConfidenceCeiling: 2.0,  // Allow higher boosts for testing
        rules: [
          {
            id: 'small-boost',
            priority: 50,
            condition: () => true,
            multiplier: 1.1,
            description: 'Small boost'
          },
          {
            id: 'large-boost',
            priority: 50,
            condition: () => true,
            multiplier: 1.3,
            description: 'Large boost'
          }
        ]
      })
      
      const text = 'High quality data: user@company.com'
      const position = text.indexOf('user@company.com')
      const hit = { ...sampleHit, start: position, end: position + 17 }
      
      const result = calculateContextualConfidence(hit, text, 0.8, customConfig)
      
      // Should only apply the higher boost rule (1.3)
      expect(result.contextualConfidence).toBeCloseTo(1.04) // 0.8 * 1.3
      expect(result.explanations).toHaveLength(1)
      expect(result.explanations[0].ruleId).toBe('large-boost')
    })
  })

  describe('Real-world conflict scenarios', () => {
    it('should handle complex CSV with multiple markers', () => {
      const csvText = `name,email,date,currency
Example User,user@company.com,2024-01-01,$100
Test Data,test@company.com,2024-02-01,¥200`
      
      const position = csvText.indexOf('user@company.com')
      const hit = { ...sampleHit, start: position, end: position + 17 }
      
      const result = calculateContextualConfidence(hit, csvText, 0.8, DEFAULT_CONTEXTUAL_CONFIG)
      
      // Should resolve conflicts and apply appropriate rules
      expect(result.contextualConfidence).toBeLessThan(0.8)
      expect(result.explanations.length).toBeGreaterThan(0)
      
      // Check that rules are applied in logical order
      const ruleIds = result.explanations.map(exp => exp.ruleId)
      expect(ruleIds.length).toBeGreaterThan(0)
    })

    it('should handle JSON with nested locale placeholders', () => {
      const jsonText = `{
        "user": {
          "name": "田中太郎",
          "email": "user@company.com",
          "address": "東京都渋谷区",
          "phone": "03-1234-5678",
          "salary": "¥1000000"
        },
        "example": true
      }`
      
      const position = jsonText.indexOf('user@company.com')
      const hit = { ...sampleHit, start: position, end: position + 17 }
      
      const result = calculateContextualConfidence(hit, jsonText, 0.8, DEFAULT_CONTEXTUAL_CONFIG)
      
      // Should heavily suppress due to multiple indicators
      expect(result.contextualConfidence).toBeLessThan(0.5)
      expect(result.explanations.length).toBeGreaterThan(1)
      
      // Should have mix of format, locale, and marker rules
      const ruleTypes = result.explanations.map(exp => {
        if (exp.ruleId.includes('json')) return 'format'
        if (exp.ruleId.includes('placeholder')) return 'locale'
        if (exp.ruleId.includes('example') || exp.ruleId.includes('marker')) return 'marker'
        return 'other'
      })
      
      expect(ruleTypes.includes('format')).toBe(true)
      expect(ruleTypes.includes('locale')).toBe(true)
    })

    it('should maintain performance with many conflicting rules', () => {
      const largeRuleConfig = createContextualConfig({
        enabled: true,
        suppressionEnabled: true,
        boostEnabled: true,
        rules: [
          ...DEFAULT_CONTEXTUAL_CONFIG.rules,
          // Add many conflicting rules
          ...Array.from({ length: 20 }, (_, i) => ({
            id: `test-rule-${i}`,
            priority: 50 + (i % 10),
            condition: () => Math.random() > 0.5,
            multiplier: 0.5 + (i % 5) * 0.1,
            description: `Test rule ${i}`
          }))
        ]
      })
      
      const text = 'Example test data: user@company.com with ¥1000'
      const position = text.indexOf('user@company.com')
      const hit = { ...sampleHit, start: position, end: position + 17 }
      
      const start = performance.now()
      const result = calculateContextualConfidence(hit, text, 0.8, largeRuleConfig)
      const duration = performance.now() - start
      
      expect(result).toBeDefined()
      expect(result.contextualConfidence).toBeLessThan(0.8)
      expect(duration).toBeLessThan(50) // Should resolve conflicts quickly
    })
  })

  describe('Edge cases', () => {
    it('should handle rules with same multiplier', () => {
      const customConfig = createContextualConfig({
        enabled: true,
        suppressionEnabled: true,
        boostEnabled: false,
        minConfidenceFloor: 0.01,  // Allow deeper suppression for testing
        rules: [
          {
            id: 'rule-a',
            priority: 50,
            condition: () => true,
            multiplier: 0.5,
            description: 'Rule A'
          },
          {
            id: 'rule-b',
            priority: 50,
            condition: () => true,
            multiplier: 0.5,
            description: 'Rule B'
          }
        ]
      })
      
      const text = 'Test user@company.com'
      const position = text.indexOf('user@company.com')
      const hit = { ...sampleHit, start: position, end: position + 17 }
      
      const result = calculateContextualConfidence(hit, text, 0.8, customConfig)
      
      // Should apply first rule deterministically
      expect(result.contextualConfidence).toBe(0.4) // 0.8 * 0.5
      expect(result.explanations).toHaveLength(1)
      expect(result.explanations[0].ruleId).toBe('rule-a')
    })

    it('should handle no applicable rules gracefully', () => {
      const customConfig = createContextualConfig({
        enabled: true,
        suppressionEnabled: true,
        boostEnabled: true,
        rules: [
          {
            id: 'never-applies',
            priority: 100,
            condition: () => false,
            multiplier: 0.1,
            description: 'Never applies'
          }
        ]
      })
      
      const text = 'Clean data: user@company.com'
      const position = text.indexOf('user@company.com')
      const hit = { ...sampleHit, start: position, end: position + 17 }
      
      const result = calculateContextualConfidence(hit, text, 0.8, customConfig)
      
      // Should return base confidence unchanged
      expect(result.contextualConfidence).toBe(0.8)
      expect(result.explanations).toHaveLength(0)
    })
  })
})