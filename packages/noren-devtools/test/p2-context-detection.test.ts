import { describe, expect, it } from 'vitest'
import {
  detectContextMarkers,
  detectDocumentStructure,
  extractContextFeatures,
} from '../src/context-detection.js'

describe('P2 Context Detection', () => {
  describe('detectDocumentStructure', () => {
    it('should detect JSON-like structure', () => {
      const jsonText = `{
        "user": {
          "email": "user@example.com",
          "id": 12345
        }
      }`

      const structure = detectDocumentStructure(jsonText)
      expect(structure.jsonLike).toBe(true)
      expect(structure.xmlLike).toBe(false)
      expect(structure.csvLike).toBe(false)
    })

    it('should detect XML-like structure', () => {
      const xmlText = `<user>
        <email>user@example.com</email>
        <id>12345</id>
      </user>`

      const structure = detectDocumentStructure(xmlText)
      expect(structure.xmlLike).toBe(true)
      expect(structure.jsonLike).toBe(false)
      expect(structure.csvLike).toBe(false)
    })

    it('should detect CSV-like structure', () => {
      const csvText = `name,email,phone
John Doe,john@example.com,555-1234
Jane Smith,jane@example.com,555-5678`

      const structure = detectDocumentStructure(csvText)
      expect(structure.csvLike).toBe(true)
      expect(structure.headerRow).toBe(true)
    })

    it('should detect Markdown-like structure', () => {
      const markdownText = `# User Data

Here is an example email: user@example.com

\`\`\`
code block here
\`\`\``

      const structure = detectDocumentStructure(markdownText)
      expect(structure.markdownLike).toBe(true)
      expect(structure.codeBlock).toBe(true)
    })

    it('should detect template sections', () => {
      const templateText = `Hello {{user.name}},
      
Your email is: {email}
Visit: \${website}`

      const structure = detectDocumentStructure(templateText)
      expect(structure.templateSection).toBe(true)
    })

    it('should detect log-like structure', () => {
      const logText = `2024-01-15 10:30:45 INFO User login: user@example.com
2024-01-15 10:31:02 ERROR Failed authentication for: test@example.com
2024-01-15 10:31:15 DEBUG Processing request from 192.168.1.1`

      const structure = detectDocumentStructure(logText)
      expect(structure.logLike).toBe(true)
    })
  })

  describe('detectContextMarkers', () => {
    it('should detect English example markers', () => {
      const text = 'Example email: user@example.com for testing'
      const position = text.indexOf('user@example.com')

      const markers = detectContextMarkers(text, position)
      expect(markers.exampleNearby).toBe(true)
      expect(markers.testNearby).toBe(true)
      expect(markers.markerLanguage).toBe('en')
      expect(markers.distanceToNearestMarker).toBeLessThan(20)
    })

    it('should detect Japanese example markers', () => {
      const text = '例: user@example.com をテストしてください'
      const position = text.indexOf('user@example.com')

      const markers = detectContextMarkers(text, position)
      expect(markers.exampleNearby).toBe(true)
      expect(markers.testNearby).toBe(true)
      expect(markers.markerLanguage).toBe('mixed') // Japanese markers + ASCII email = mixed
    })

    it('should detect mixed language markers', () => {
      const text = 'Example テスト: user@example.com for サンプル'
      const position = text.indexOf('user@example.com')

      const markers = detectContextMarkers(text, position)
      expect(markers.exampleNearby).toBe(true)
      expect(markers.testNearby).toBe(true)
      expect(markers.sampleNearby).toBe(true)
      expect(markers.markerLanguage).toBe('mixed')
    })

    it('should detect dummy/placeholder markers', () => {
      const text = 'Placeholder: dummy@fake.com for mock data'
      const position = text.indexOf('dummy@fake.com')

      const markers = detectContextMarkers(text, position)
      expect(markers.dummyNearby).toBe(true)
      expect(markers.placeholderNearby).toBe(true)
    })

    it('should calculate distance to nearest marker across lines', () => {
      const text = 'Test documentation:\n\n                         user@company.com'
      const position = text.indexOf('user@company.com')

      const markers = detectContextMarkers(text, position)
      expect(markers.testNearby).toBe(true)
      expect(markers.distanceToNearestMarker).toBeGreaterThan(15)
    })

    it('should detect same-line markers with zero distance', () => {
      const text = 'Example: user@example.com'
      const position = text.indexOf('user@example.com')

      const markers = detectContextMarkers(text, position)
      expect(markers.exampleNearby).toBe(true)
      expect(markers.distanceToNearestMarker).toBe(0)
    })
  })

  describe('extractContextFeatures', () => {
    it('should combine structure and marker detection', () => {
      const text = `{
        "example": {
          "email": "user@example.com",
          "test": true
        }
      }`
      const position = text.indexOf('user@example.com')

      const features = extractContextFeatures(text, position)

      expect(features.structure.jsonLike).toBe(true)
      expect(features.markers.exampleNearby).toBe(true)
      expect(features.markers.testNearby).toBe(true)
      expect(features.language).toBe('en')
    })

    it('should detect high entropy patterns nearby', () => {
      const text = 'Secret key: abc123def456ghi789 and email: user@example.com'
      const position = text.indexOf('user@example.com')

      const features = extractContextFeatures(text, position)
      expect(features.highEntropyNearby).toBe(true)
    })

    it('should detect repetitive patterns', () => {
      const text = 'test test test test email: user@example.com test test'
      const position = text.indexOf('user@example.com')

      const features = extractContextFeatures(text, position)
      expect(features.repetitionDetected).toBe(true)
    })

    it('should detect Japanese language context', () => {
      const text = 'メールアドレス: user@example.com をテストしています'
      const position = text.indexOf('user@example.com')

      const features = extractContextFeatures(text, position)
      expect(features.language).toBe('mixed') // Japanese text + ASCII email = mixed
    })

    it('should handle code block context', () => {
      const text = `Here is an example:
\`\`\`javascript
const email = 'user@example.com'
\`\`\``
      const position = text.indexOf('user@example.com')

      const features = extractContextFeatures(text, position)
      expect(features.structure.codeBlock).toBe(true)
      expect(features.structure.markdownLike).toBe(true)
      expect(features.markers.exampleNearby).toBe(true)
    })
  })

  describe('Edge cases and performance', () => {
    it('should handle empty text gracefully', () => {
      const features = extractContextFeatures('', 0)
      expect(features).toBeDefined()
      expect(features.structure.jsonLike).toBe(false)
      expect(features.markers.exampleNearby).toBe(false)
    })

    it('should handle very short text', () => {
      const text = 'a@b.c'
      const features = extractContextFeatures(text, 0)
      expect(features).toBeDefined()
      expect(features.language).toBe('en')
    })

    it('should handle text with no clear structure', () => {
      const text = 'random text with user@example.com somewhere'
      const position = text.indexOf('user@example.com')

      const features = extractContextFeatures(text, position)
      expect(features.structure.jsonLike).toBe(false)
      expect(features.structure.xmlLike).toBe(false)
      expect(features.structure.csvLike).toBe(false)
      expect(features.structure.markdownLike).toBe(false)
    })

    it('should be performant with large text samples', () => {
      const largeText = `${'example: '.repeat(1000)}user@example.com`
      const position = largeText.indexOf('user@example.com')

      const start = performance.now()
      const features = extractContextFeatures(largeText, position)
      const duration = performance.now() - start

      expect(features).toBeDefined()
      expect(features.markers.exampleNearby).toBe(true)
      expect(duration).toBeLessThan(50) // Should complete within 50ms
    })
  })
})
