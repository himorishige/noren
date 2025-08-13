import { describe, expect, it } from 'vitest'
import {
  extractValidatedContextFeatures,
  validateDocumentStructure,
} from '../src/context-detection.js'
import {
  calculateContextualConfidence,
  DEFAULT_CONTEXTUAL_CONFIG,
} from '../src/contextual-confidence.js'
import type { Hit } from '../src/types.js'

describe('P2-Sprint2: Format Validation and Recovery', () => {
  const sampleHit: Hit = {
    type: 'email',
    start: 10,
    end: 27,
    value: 'user@company.com',
    risk: 'medium',
    confidence: 0.8,
  }

  describe('JSON validation', () => {
    it('should validate well-formed JSON', () => {
      const validJSON = `{
        "name": "John Doe",
        "email": "user@company.com",
        "active": true
      }`

      const result = validateDocumentStructure(validJSON)

      expect(result.json_like).toBe(true)
      expect(result.validation.json_confidence).toBeGreaterThan(0.8)
      expect(result.validation.format_errors).toHaveLength(0)
    })

    it('should detect malformed JSON with recovery suggestions', () => {
      const malformedJSON = `{
        name: "John Doe",  // Unquoted key
        "email": 'user@company.com',  // Single quotes
        "active": true,  // Trailing comma
      }`

      const result = validateDocumentStructure(malformedJSON)

      expect(result.json_like).toBe(true)
      expect(result.validation.json_confidence).toBeLessThan(0.5)
      expect(result.validation.format_errors.length).toBeGreaterThan(0)
      expect(result.validation.recovery_suggestions).toContain('Add quotes around unquoted keys')
      expect(result.validation.recovery_suggestions).toContain(
        'Replace single quotes with double quotes',
      )
    })

    it('should handle mixed content with embedded JSON', () => {
      const mixedContent = `
        Here's some example data:
        {"name": "John", "email": "user@company.com"}
        And here's malformed JSON:
        {name: "Invalid", 'email': 'bad@format'}
      `

      const result = validateDocumentStructure(mixedContent)

      expect(result.json_like).toBe(true)
      expect(result.validation.json_confidence).toBeGreaterThan(0.3)
      expect(result.validation.json_confidence).toBeLessThan(0.8)
      expect(result.validation.recovery_suggestions).toContain(
        'Treat as mixed content with embedded JSON',
      )
    })
  })

  describe('XML validation', () => {
    it('should validate well-formed XML', () => {
      const validXML = `
        <user>
          <name>John Doe</name>
          <email>user@company.com</email>
        </user>
      `

      const result = validateDocumentStructure(validXML)

      expect(result.xml_like).toBe(true)
      expect(result.validation.xml_confidence).toBeGreaterThan(0.8)
      expect(result.validation.format_errors).toHaveLength(0)
    })

    it('should detect unclosed XML tags', () => {
      const malformedXML = `
        <user>
          <name>John Doe</name>
          <email>user@company.com</email>
        <!-- Missing closing </user> tag -->
      `

      const result = validateDocumentStructure(malformedXML)

      expect(result.xml_like).toBe(true)
      expect(result.validation.xml_confidence).toBeLessThan(0.8)
      expect(result.validation.format_errors.some((error) => error.includes('Unclosed tags'))).toBe(
        true,
      )
      expect(result.validation.recovery_suggestions).toContain(
        'Add missing closing tags or treat as HTML fragment',
      )
    })

    it('should handle self-closing tags', () => {
      const selfClosingXML = `
        <user>
          <name>John Doe</name>
          <email>user@company.com</email>
          <active />
        </user>
      `

      const result = validateDocumentStructure(selfClosingXML)

      expect(result.xml_like).toBe(true)
      expect(result.validation.xml_confidence).toBeGreaterThan(0.8)
    })
  })

  describe('CSV validation', () => {
    it('should validate well-formed CSV', () => {
      const validCSV = `name,email,active
John Doe,user@company.com,true
Jane Smith,jane@company.com,false`

      const result = validateDocumentStructure(validCSV)

      expect(result.csv_like).toBe(true)
      expect(result.validation.csv_confidence).toBeGreaterThan(0.7)
      expect(result.validation.format_errors).toHaveLength(0)
    })

    it('should detect inconsistent CSV delimiters', () => {
      const inconsistentCSV = `name,email,active
John Doe;user@company.com,true
Jane Smith,jane@company.com;false`

      const result = validateDocumentStructure(inconsistentCSV)

      expect(result.csv_like).toBe(true)
      expect(result.validation.csv_confidence).toBeLessThan(0.7)
      expect(
        result.validation.format_errors.some((error) => error.includes('Inconsistent delimiter')),
      ).toBe(true)
    })

    it('should handle quoted fields properly', () => {
      const quotedCSV = `name,email,description
"John Doe",user@company.com,"Software Engineer, Senior Level"
"Jane Smith","jane@company.com","Product Manager"`

      const result = validateDocumentStructure(quotedCSV)

      expect(result.csv_like).toBe(true)
      expect(result.validation.csv_confidence).toBeGreaterThan(0.7)
    })
  })

  describe('Recovery rule integration', () => {
    it('should apply lighter suppression for invalid JSON', () => {
      const malformedJSON = `{
        name: "Example User",  // This triggers example marker
        "email": "user@company.com"
      }`

      const position = malformedJSON.indexOf('user@company.com')
      const hit = { ...sampleHit, start: position, end: position + 17 }

      const result = calculateContextualConfidence(
        hit,
        malformedJSON,
        0.8,
        DEFAULT_CONTEXTUAL_CONFIG,
      )

      // Should have both JSON-based and recovery-based rules
      const ruleIds = result.explanations.map((exp) => exp.ruleId)
      expect(ruleIds.some((id) => id.includes('json'))).toBe(true)

      // Recovery rule should provide lighter suppression than normal JSON rule
      expect(result.contextualConfidence).toBeGreaterThan(0.1)
      expect(result.contextualConfidence).toBeLessThan(0.8)
    })

    it('should apply recovery rules for XML with template sections', () => {
      const templateXML = `
        <config>
          <template>{{user.name}}</template>
          <email>user@company.com</email>
        </config>
      `

      const position = templateXML.indexOf('user@company.com')
      const hit = { ...sampleHit, start: position, end: position + 17 }

      const result = calculateContextualConfidence(hit, templateXML, 0.8, DEFAULT_CONTEXTUAL_CONFIG)

      // Should detect template section and apply recovery rules
      const ruleIds = result.explanations.map((exp) => exp.ruleId)
      expect(ruleIds.some((id) => id.includes('xml') || id.includes('template'))).toBe(true)
    })

    it('should handle CSV without proper headers', () => {
      const noHeaderCSV = `Example Data,user@company.com,sample
Test User,test@company.com,demo`

      const position = noHeaderCSV.indexOf('user@company.com')
      const hit = { ...sampleHit, start: position, end: position + 17 }

      const result = calculateContextualConfidence(hit, noHeaderCSV, 0.8, DEFAULT_CONTEXTUAL_CONFIG)

      // Should apply recovery rules due to no header + example marker
      const ruleIds = result.explanations.map((exp) => exp.ruleId)
      expect(ruleIds.some((id) => id.includes('csv') || id.includes('recovery'))).toBe(true)
    })
  })

  describe('Enhanced context extraction', () => {
    it('should provide validated structure in enhanced features', () => {
      const jsonContent = `{
        "user": "test@example.com",
        "config": {"enabled": true}
      }`

      const features = extractValidatedContextFeatures(jsonContent, 10)

      expect(features.structure.json_like).toBe(true)
      expect(features.validatedStructure).toBeDefined()
      expect(features.validatedStructure.validation).toBeDefined()
      expect(typeof features.validatedStructure.validation.json_confidence).toBe('number')
    })
  })

  describe('Performance with large documents', () => {
    it('should handle large documents efficiently', () => {
      // Create a large document with mixed formats
      const largeDoc = Array.from(
        { length: 100 },
        (_, i) => `{"id": ${i}, "email": "user${i}@company.com", "data": "sample"}`,
      ).join('\n')

      const start = performance.now()
      const result = validateDocumentStructure(largeDoc)
      const duration = performance.now() - start

      expect(result.json_like).toBe(true)
      expect(duration).toBeLessThan(100) // Should complete within 100ms
      expect(result.validation.json_confidence).toBeGreaterThan(0.5)
    })
  })

  describe('Edge cases', () => {
    it('should handle empty documents', () => {
      const result = validateDocumentStructure('')

      expect(result.json_like).toBe(false)
      expect(result.xml_like).toBe(false)
      expect(result.csv_like).toBe(false)
      expect(result.validation.format_errors).toHaveLength(0)
    })

    it('should handle documents with only whitespace', () => {
      const result = validateDocumentStructure('   \n\t   \n   ')

      expect(result.json_like).toBe(false)
      expect(result.xml_like).toBe(false)
      expect(result.csv_like).toBe(false)
    })

    it('should handle documents with mixed valid and invalid sections', () => {
      const mixedDoc = `
        Valid JSON: {"name": "John", "email": "john@company.com"}
        
        Invalid JSON: {name: "Bad", email: 'bad@format'}
        
        Valid XML: <user><email>xml@company.com</email></user>
        Invalid XML: <unclosed><email>broken@company.com</email>
      `

      const result = validateDocumentStructure(mixedDoc)

      // Should detect multiple formats
      expect(result.json_like).toBe(true)
      expect(result.xml_like).toBe(true)

      // Should have confidence between 0 and 1 for both
      expect(result.validation.json_confidence).toBeGreaterThan(0)
      expect(result.validation.json_confidence).toBeLessThan(1)
      expect(result.validation.xml_confidence).toBeGreaterThan(0)
      expect(result.validation.xml_confidence).toBeLessThan(1)
    })
  })
})
