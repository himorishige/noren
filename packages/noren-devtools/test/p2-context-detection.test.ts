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
      expect(structure.json_like).toBe(true)
      expect(structure.xml_like).toBe(false)
      expect(structure.csv_like).toBe(false)
    })

    it('should detect XML-like structure', () => {
      const xmlText = `<user>
        <email>user@example.com</email>
        <id>12345</id>
      </user>`

      const structure = detectDocumentStructure(xmlText)
      expect(structure.xml_like).toBe(true)
      expect(structure.json_like).toBe(false)
      expect(structure.csv_like).toBe(false)
    })

    it('should detect CSV-like structure', () => {
      const csvText = `name,email,phone
John Doe,john@example.com,555-1234
Jane Smith,jane@example.com,555-5678`

      const structure = detectDocumentStructure(csvText)
      expect(structure.csv_like).toBe(true)
      expect(structure.header_row).toBe(true)
    })

    it('should detect Markdown-like structure', () => {
      const markdownText = `# User Data

Here is an example email: user@example.com

\`\`\`
code block here
\`\`\``

      const structure = detectDocumentStructure(markdownText)
      expect(structure.md_like).toBe(true)
      expect(structure.code_block).toBe(true)
    })

    it('should detect template sections', () => {
      const templateText = `Hello {{user.name}},
      
Your email is: {email}
Visit: \${website}`

      const structure = detectDocumentStructure(templateText)
      expect(structure.template_section).toBe(true)
    })

    it('should detect log-like structure', () => {
      const logText = `2024-01-15 10:30:45 INFO User login: user@example.com
2024-01-15 10:31:02 ERROR Failed authentication for: test@example.com
2024-01-15 10:31:15 DEBUG Processing request from 192.168.1.1`

      const structure = detectDocumentStructure(logText)
      expect(structure.log_like).toBe(true)
    })
  })

  describe('detectContextMarkers', () => {
    it('should detect English example markers', () => {
      const text = 'Example email: user@example.com for testing'
      const position = text.indexOf('user@example.com')

      const markers = detectContextMarkers(text, position)
      expect(markers.example_marker_nearby).toBe(true)
      expect(markers.test_marker_nearby).toBe(true)
      expect(markers.marker_language).toBe('en')
      expect(markers.distance_to_nearest_marker).toBeLessThan(20)
    })

    it('should detect Japanese example markers', () => {
      const text = '例: user@example.com をテストしてください'
      const position = text.indexOf('user@example.com')

      const markers = detectContextMarkers(text, position)
      expect(markers.example_marker_nearby).toBe(true)
      expect(markers.test_marker_nearby).toBe(true)
      expect(markers.marker_language).toBe('mixed') // Japanese markers + ASCII email = mixed
    })

    it('should detect mixed language markers', () => {
      const text = 'Example テスト: user@example.com for サンプル'
      const position = text.indexOf('user@example.com')

      const markers = detectContextMarkers(text, position)
      expect(markers.example_marker_nearby).toBe(true)
      expect(markers.test_marker_nearby).toBe(true)
      expect(markers.sample_marker_nearby).toBe(true)
      expect(markers.marker_language).toBe('mixed')
    })

    it('should detect dummy/placeholder markers', () => {
      const text = 'Placeholder: dummy@fake.com for mock data'
      const position = text.indexOf('dummy@fake.com')

      const markers = detectContextMarkers(text, position)
      expect(markers.dummy_marker_nearby).toBe(true)
      expect(markers.placeholder_marker_nearby).toBe(true)
    })

    it('should calculate distance to nearest marker across lines', () => {
      const text = 'Test documentation:\n\n                         user@company.com'
      const position = text.indexOf('user@company.com')

      const markers = detectContextMarkers(text, position)
      expect(markers.test_marker_nearby).toBe(true)
      expect(markers.distance_to_nearest_marker).toBeGreaterThan(15)
    })

    it('should detect same-line markers with zero distance', () => {
      const text = 'Example: user@example.com'
      const position = text.indexOf('user@example.com')

      const markers = detectContextMarkers(text, position)
      expect(markers.example_marker_nearby).toBe(true)
      expect(markers.distance_to_nearest_marker).toBe(0)
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

      expect(features.structure.json_like).toBe(true)
      expect(features.markers.example_marker_nearby).toBe(true)
      expect(features.markers.test_marker_nearby).toBe(true)
      expect(features.language).toBe('en')
    })

    it('should detect high entropy patterns nearby', () => {
      const text = 'Secret key: abc123def456ghi789 and email: user@example.com'
      const position = text.indexOf('user@example.com')

      const features = extractContextFeatures(text, position)
      expect(features.high_entropy_nearby).toBe(true)
    })

    it('should detect repetitive patterns', () => {
      const text = 'test test test test email: user@example.com test test'
      const position = text.indexOf('user@example.com')

      const features = extractContextFeatures(text, position)
      expect(features.repetition_detected).toBe(true)
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
      expect(features.structure.code_block).toBe(true)
      expect(features.structure.md_like).toBe(true)
      expect(features.markers.example_marker_nearby).toBe(true)
    })
  })

  describe('Edge cases and performance', () => {
    it('should handle empty text gracefully', () => {
      const features = extractContextFeatures('', 0)
      expect(features).toBeDefined()
      expect(features.structure.json_like).toBe(false)
      expect(features.markers.example_marker_nearby).toBe(false)
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
      expect(features.structure.json_like).toBe(false)
      expect(features.structure.xml_like).toBe(false)
      expect(features.structure.csv_like).toBe(false)
      expect(features.structure.md_like).toBe(false)
    })

    it('should be performant with large text samples', () => {
      const largeText = `${'example: '.repeat(1000)}user@example.com`
      const position = largeText.indexOf('user@example.com')

      const start = performance.now()
      const features = extractContextFeatures(largeText, position)
      const duration = performance.now() - start

      expect(features).toBeDefined()
      expect(features.markers.example_marker_nearby).toBe(true)
      expect(duration).toBeLessThan(50) // Should complete within 50ms
    })
  })
})
