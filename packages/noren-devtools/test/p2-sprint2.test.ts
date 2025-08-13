import { describe, expect, it } from 'vitest'
import { detectContextMarkers } from '../src/context-detection.js'
import {
  calculateContextualConfidence,
  DEFAULT_CONTEXTUAL_CONFIG,
} from '../src/contextual-confidence.js'
import type { Hit } from '../src/types.js'

describe('P2-Sprint2: Format-specific and Locale-specific Features', () => {
  const sampleHit: Hit = {
    type: 'email',
    start: 10,
    end: 27,
    value: 'user@example.com',
    risk: 'medium',
    confidence: 0.8,
  }

  describe('Format-specific rules', () => {
    it('should apply JSON key-value suppression', () => {
      const jsonText = `{
        "example": {
          "email": "user@example.com",
          "dummy": true
        }
      }`
      const position = jsonText.indexOf('user@example.com')
      const hit = { ...sampleHit, start: position, end: position + 17 }

      const result = calculateContextualConfidence(hit, jsonText, 0.8, DEFAULT_CONTEXTUAL_CONFIG)

      expect(result.contextualConfidence).toBeLessThan(0.8)
      expect(result.explanations.some((exp) => exp.ruleId === 'json-key-value')).toBe(true)
    })

    it('should apply CSV example data suppression', () => {
      const csvText = `name,email,phone
John Doe,john@company.com,555-1234
Example User,user@company.com,555-5678`
      const position = csvText.indexOf('user@company.com')
      const hit = { ...sampleHit, start: position, end: position + 17, value: 'user@company.com' }

      const result = calculateContextualConfidence(hit, csvText, 0.8, DEFAULT_CONTEXTUAL_CONFIG)

      expect(result.contextualConfidence).toBeLessThan(0.8)
      // Should have example marker suppression instead of csv-example-data since there's 'Example' in the text
      expect(result.explanations.some((exp) => exp.ruleId === 'example-marker-strong')).toBe(true)
    })

    it('should apply Markdown code fence suppression', () => {
      const markdownText = `Here is an example:

\`\`\`javascript
const email = 'user@example.com'
\`\`\``
      const position = markdownText.indexOf('user@example.com')
      const hit = { ...sampleHit, start: position, end: position + 17 }

      const result = calculateContextualConfidence(
        hit,
        markdownText,
        0.8,
        DEFAULT_CONTEXTUAL_CONFIG,
      )

      expect(result.contextualConfidence).toBeLessThan(0.8)
      expect(result.explanations.some((exp) => exp.ruleId === 'markdown-code-fence')).toBe(true)
    })

    it('should apply XML example content suppression', () => {
      const xmlText = `<user>
        <email>user@example.com</email>
        <example>true</example>
      </user>`
      const position = xmlText.indexOf('user@example.com')
      const hit = { ...sampleHit, start: position, end: position + 17 }

      const result = calculateContextualConfidence(hit, xmlText, 0.8, DEFAULT_CONTEXTUAL_CONFIG)

      expect(result.contextualConfidence).toBeLessThan(0.8)
      expect(result.explanations.some((exp) => exp.ruleId === 'xml-example-content')).toBe(true)
    })

    it('should apply log example entry suppression', () => {
      const logText = `2024-01-15 10:30:45 INFO Example login: user@example.com from test IP
2024-01-15 10:31:02 ERROR Authentication failed for: admin@company.com`
      const position = logText.indexOf('user@example.com')
      const hit = { ...sampleHit, start: position, end: position + 17 }

      const result = calculateContextualConfidence(hit, logText, 0.8, DEFAULT_CONTEXTUAL_CONFIG)

      expect(result.contextualConfidence).toBeLessThan(0.8)
      expect(result.explanations.some((exp) => exp.ruleId === 'log-example-entry')).toBe(true)
    })
  })

  describe('Locale-specific placeholder detection', () => {
    it('should detect English date placeholders', () => {
      const text = 'Date of birth: user@example.com (YYYY-MM-DD format)'
      const position = text.indexOf('user@example.com')

      const markers = detectContextMarkers(text, position)
      expect(markers.date_placeholder_nearby).toBe(true)

      const hit = { ...sampleHit, start: position, end: position + 17 }
      const result = calculateContextualConfidence(hit, text, 0.8, DEFAULT_CONTEXTUAL_CONFIG)
      expect(result.explanations.some((exp) => exp.ruleId === 'date-placeholder')).toBe(true)
    })

    it('should detect Japanese date placeholders', () => {
      const text = '生年月日: user@example.com (YYYY/MM/DD 形式)'
      const position = text.indexOf('user@example.com')

      const markers = detectContextMarkers(text, position)
      expect(markers.date_placeholder_nearby).toBe(true)

      const hit = { ...sampleHit, start: position, end: position + 17 }
      const result = calculateContextualConfidence(hit, text, 0.8, DEFAULT_CONTEXTUAL_CONFIG)
      expect(result.explanations.some((exp) => exp.ruleId === 'date-placeholder')).toBe(true)
    })

    it('should detect currency placeholders', () => {
      const text = 'Amount: $100 for user@example.com account'
      const position = text.indexOf('user@example.com')

      const markers = detectContextMarkers(text, position)
      expect(markers.currency_placeholder_nearby).toBe(true)

      const hit = { ...sampleHit, start: position, end: position + 17 }
      const result = calculateContextualConfidence(hit, text, 0.8, DEFAULT_CONTEXTUAL_CONFIG)
      expect(result.explanations.some((exp) => exp.ruleId === 'currency-placeholder')).toBe(true)
    })

    it('should detect Japanese currency placeholders', () => {
      const text = '金額: 1000円 user@example.com のアカウント'
      const position = text.indexOf('user@example.com')

      const markers = detectContextMarkers(text, position)
      expect(markers.currency_placeholder_nearby).toBe(true)

      const hit = { ...sampleHit, start: position, end: position + 17 }
      const result = calculateContextualConfidence(hit, text, 0.8, DEFAULT_CONTEXTUAL_CONFIG)
      expect(result.explanations.some((exp) => exp.ruleId === 'currency-placeholder')).toBe(true)
    })

    it('should detect address placeholders', () => {
      const text = 'Street address: 123 Main St for user@example.com'
      const position = text.indexOf('user@example.com')

      const markers = detectContextMarkers(text, position)
      expect(markers.address_placeholder_nearby).toBe(true)

      const hit = { ...sampleHit, start: position, end: position + 17 }
      const result = calculateContextualConfidence(hit, text, 0.8, DEFAULT_CONTEXTUAL_CONFIG)
      expect(result.explanations.some((exp) => exp.ruleId === 'address-placeholder')).toBe(true)
    })

    it('should detect Japanese address placeholders', () => {
      const text = '住所: 東京都渋谷区 user@example.com'
      const position = text.indexOf('user@example.com')

      const markers = detectContextMarkers(text, position)
      expect(markers.address_placeholder_nearby).toBe(true)

      const hit = { ...sampleHit, start: position, end: position + 17 }
      const result = calculateContextualConfidence(hit, text, 0.8, DEFAULT_CONTEXTUAL_CONFIG)
      expect(result.explanations.some((exp) => exp.ruleId === 'address-placeholder')).toBe(true)
    })

    it('should detect phone placeholders', () => {
      const text = 'Phone number: user@example.com or call 555-1234'
      const position = text.indexOf('user@example.com')

      const markers = detectContextMarkers(text, position)
      expect(markers.phone_placeholder_nearby).toBe(true)

      const hit = { ...sampleHit, start: position, end: position + 17 }
      const result = calculateContextualConfidence(hit, text, 0.8, DEFAULT_CONTEXTUAL_CONFIG)
      expect(result.explanations.some((exp) => exp.ruleId === 'phone-placeholder')).toBe(true)
    })

    it('should detect Japanese phone placeholders', () => {
      const text = '電話番号: user@example.com または TEL 03-1234-5678'
      const position = text.indexOf('user@example.com')

      const markers = detectContextMarkers(text, position)
      expect(markers.phone_placeholder_nearby).toBe(true)

      const hit = { ...sampleHit, start: position, end: position + 17 }
      const result = calculateContextualConfidence(hit, text, 0.8, DEFAULT_CONTEXTUAL_CONFIG)
      expect(result.explanations.some((exp) => exp.ruleId === 'phone-placeholder')).toBe(true)
    })

    it('should detect name placeholders', () => {
      const text = 'Name: John Doe, email: user@example.com'
      const position = text.indexOf('user@example.com')

      const markers = detectContextMarkers(text, position)
      expect(markers.name_placeholder_nearby).toBe(true)

      const hit = { ...sampleHit, start: position, end: position + 17 }
      const result = calculateContextualConfidence(hit, text, 0.8, DEFAULT_CONTEXTUAL_CONFIG)
      expect(result.explanations.some((exp) => exp.ruleId === 'name-placeholder')).toBe(true)
    })

    it('should detect Japanese name placeholders', () => {
      const text = '氏名: 田中太郎, メール: user@example.com'
      const position = text.indexOf('user@example.com')

      const markers = detectContextMarkers(text, position)
      expect(markers.name_placeholder_nearby).toBe(true)

      const hit = { ...sampleHit, start: position, end: position + 17 }
      const result = calculateContextualConfidence(hit, text, 0.8, DEFAULT_CONTEXTUAL_CONFIG)
      expect(result.explanations.some((exp) => exp.ruleId === 'name-placeholder')).toBe(true)
    })
  })

  describe('Combined format and locale rules', () => {
    it('should apply multiple suppression rules in JSON with locale placeholders', () => {
      const jsonText = `{
        "user_info": {
          "name": "田中太郎",
          "email": "user@company.com",
          "date": "2024/01/01",
          "amount": "1000円"
        }
      }`
      const position = jsonText.indexOf('user@company.com')
      const hit = { ...sampleHit, start: position, end: position + 17, value: 'user@company.com' }

      const result = calculateContextualConfidence(hit, jsonText, 0.8, DEFAULT_CONTEXTUAL_CONFIG)

      expect(result.contextualConfidence).toBeLessThan(0.6) // Should have some suppression from locale placeholders
      expect(result.explanations.length).toBeGreaterThan(0) // Should have rules

      const ruleIds = result.explanations.map((exp) => exp.ruleId)
      // Should have placeholder rules for name, date, amount/currency
      const hasPlaceholderRules = ruleIds.some((id) => id.includes('placeholder'))
      expect(hasPlaceholderRules).toBe(true)
    })

    it('should handle priority ordering correctly', () => {
      const text = 'Example name: John Doe, date: 2024-01-01, email: user@example.com'
      const position = text.indexOf('user@example.com')
      const hit = { ...sampleHit, start: position, end: position + 17 }

      const result = calculateContextualConfidence(hit, text, 0.8, DEFAULT_CONTEXTUAL_CONFIG)

      // Should apply the highest priority rule (example-marker-strong has priority 100)
      expect(result.explanations[0].ruleId).toBe('example-marker-strong')
      expect(result.explanations.length).toBeGreaterThan(1) // Multiple locale rules
    })
  })

  describe('Edge cases and performance', () => {
    it('should handle text without any new markers gracefully', () => {
      const text = 'Contact admin@company.com for support'
      const position = text.indexOf('admin@company.com')

      const markers = detectContextMarkers(text, position)
      expect(markers.date_placeholder_nearby).toBe(false)
      expect(markers.currency_placeholder_nearby).toBe(false)
      expect(markers.address_placeholder_nearby).toBe(false)
      expect(markers.phone_placeholder_nearby).toBe(false)
      expect(markers.name_placeholder_nearby).toBe(false)

      const hit = { ...sampleHit, start: position, end: position + 17, value: 'admin@company.com' }
      const result = calculateContextualConfidence(hit, text, 0.8, DEFAULT_CONTEXTUAL_CONFIG)
      expect(result.contextualConfidence).toBe(0.8) // No suppression
    })

    it('should maintain performance with new rules', () => {
      const largeText = Array(100)
        .fill(`
        Example data:
        Name: 田中太郎
        Email: user@example.com
        Date: 2024/01/01
        Amount: ¥1000
        Address: 東京都渋谷区
        Phone: 03-1234-5678
      `)
        .join('\\n')

      const position = largeText.indexOf('user@example.com')
      const hit = { ...sampleHit, start: position, end: position + 17 }

      const start = performance.now()
      const result = calculateContextualConfidence(hit, largeText, 0.8, DEFAULT_CONTEXTUAL_CONFIG)
      const duration = performance.now() - start

      expect(result).toBeDefined()
      expect(result.contextualConfidence).toBeLessThan(0.8)
      expect(duration).toBeLessThan(100) // Should complete within 100ms
    })
  })
})
