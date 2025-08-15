import {
  calculateContextScore,
  extractSurroundingText,
  meetsContextThreshold,
} from '@himorishige/noren-core'
import { describe, expect, it } from 'vitest'

describe('Context Scoring System', () => {
  describe('calculateContextScore', () => {
    it('should give base score for neutral context', () => {
      const analysis = calculateContextScore('Some random text here', 'email')
      expect(analysis.score).toBe(1.0) // Base score
      expect(analysis.positiveMatches).toHaveLength(0)
      expect(analysis.negativeMatches).toHaveLength(0)
    })

    it('should increase score for positive email context', () => {
      const analysis = calculateContextScore('Please send email to contact address', 'email')
      expect(analysis.score).toBeGreaterThan(1.0)
      expect(analysis.positiveMatches).toContain('email')
      expect(analysis.positiveMatches).toContain('contact')
      expect(analysis.reasoning).toContain('positive_keyword:email')
    })

    it('should decrease score for negative context', () => {
      const analysis = calculateContextScore('This is a test example for documentation', 'email')
      expect(analysis.score).toBeLessThan(1.0)
      expect(analysis.negativeMatches).toContain('test')
      expect(analysis.negativeMatches).toContain('example')
      expect(analysis.reasoning).toContain('negative_keyword:test')
    })

    it('should handle mixed positive and negative context', () => {
      const analysis = calculateContextScore('Send email to test@example.com for testing', 'email')
      expect(analysis.positiveMatches).toContain('email')
      expect(analysis.negativeMatches).toContain('test')
      expect(analysis.negativeMatches).toContain('example')
      // Net effect depends on weights (positive +0.2, negative -0.3 each)
    })
  })

  describe('Type-specific context adjustments', () => {
    describe('Credit card context', () => {
      it('should boost score for payment context', () => {
        const analysis = calculateContextScore(
          'Process payment transaction with billing info',
          'credit_card',
        )
        expect(analysis.score).toBeGreaterThan(1.0)
        expect(analysis.reasoning).toContain('payment_context')
      })

      it('should boost score for card details context', () => {
        const analysis = calculateContextScore(
          'Enter card number, exp date and CVV security code',
          'credit_card',
        )
        expect(analysis.score).toBeGreaterThan(1.0)
        expect(analysis.reasoning).toContain('card_details_context')
      })

      it('should reduce score for test context', () => {
        const analysis = calculateContextScore('Use this example card for testing', 'credit_card')
        expect(analysis.score).toBeLessThan(1.0)
        expect(analysis.reasoning).toContain('test_context')
      })

      it('should reduce score for identifier context', () => {
        const analysis = calculateContextScore('Customer ID: 1234567890123456', 'credit_card')
        expect(analysis.score).toBeLessThan(1.0)
        expect(analysis.reasoning).toContain('identifier_context')
      })

      it('should reduce score for database context', () => {
        const analysis = calculateContextScore('INSERT INTO cards (number) VALUES', 'credit_card')
        expect(analysis.score).toBeLessThan(1.0)
        expect(analysis.reasoning).toContain('database_context')
      })
    })

    describe('IP address context', () => {
      it('should boost score for network context', () => {
        const analysis = calculateContextScore('Connect to server endpoint gateway', 'ipv4')
        expect(analysis.score).toBeGreaterThan(1.0)
        expect(analysis.reasoning).toContain('network_context')
      })

      it('should boost score for direction context', () => {
        const analysis = calculateContextScore('Packets from source to destination', 'ipv4')
        expect(analysis.score).toBeGreaterThan(1.0)
        expect(analysis.reasoning).toContain('direction_context')
      })

      it('should boost score for network tools context', () => {
        const analysis = calculateContextScore('Run ping to test connectivity', 'ipv4')
        expect(analysis.score).toBeGreaterThan(1.0)
        expect(analysis.reasoning).toContain('network_tool_context')
      })

      it('should reduce score for version context', () => {
        const analysis = calculateContextScore('Software version 1.2.3.4 released', 'ipv4')
        expect(analysis.score).toBeLessThan(1.0)
        expect(analysis.reasoning).toContain('version_context')
      })

      it('should reduce score for date context', () => {
        const analysis = calculateContextScore('Released on date 2023.12.25', 'ipv4')
        expect(analysis.score).toBeLessThan(1.0)
        expect(analysis.reasoning).toContain('date_context')
      })

      it('should boost score for config context', () => {
        const analysis = calculateContextScore('Configuration file settings', 'ipv4')
        expect(analysis.score).toBeGreaterThan(1.0)
        expect(analysis.reasoning).toContain('config_context')
      })
    })

    describe('Email context', () => {
      it('should boost score for communication context', () => {
        const analysis = calculateContextScore('Send message to contact', 'email')
        expect(analysis.score).toBeGreaterThan(1.0)
        expect(analysis.reasoning).toContain('communication_context')
      })

      it('should boost score for email headers context', () => {
        const analysis = calculateContextScore('From: user To: recipient Subject:', 'email')
        expect(analysis.score).toBeGreaterThan(1.0)
        expect(analysis.reasoning).toContain('email_headers_context')
      })

      it('should reduce score for automated email context', () => {
        const analysis = calculateContextScore('noreply automated system message', 'email')
        expect(analysis.score).toBeLessThan(1.0)
        expect(analysis.reasoning).toContain('automated_email_context')
      })

      it('should reduce score for DNS context', () => {
        const analysis = calculateContextScore('DNS MX record zone configuration', 'email')
        expect(analysis.score).toBeLessThan(1.0)
        expect(analysis.reasoning).toContain('dns_context')
      })
    })

    describe('Phone number context', () => {
      it('should boost score for phone action context', () => {
        const analysis = calculateContextScore('Call mobile cell phone extension', 'phone_e164')
        expect(analysis.score).toBeGreaterThan(1.0)
        expect(analysis.reasoning).toContain('phone_action_context')
      })

      it('should boost score for contact context', () => {
        const analysis = calculateContextScore('Emergency contact support number', 'phone_e164')
        expect(analysis.score).toBeGreaterThan(1.0)
        expect(analysis.reasoning).toContain('contact_context')
      })

      it('should reduce score for test number context', () => {
        const analysis = calculateContextScore('Use this test example dummy number', 'phone_e164')
        expect(analysis.score).toBeLessThan(1.0)
        expect(analysis.reasoning).toContain('test_number_context')
      })
    })

    describe('MAC address context', () => {
      it('should boost score for network hardware context', () => {
        const analysis = calculateContextScore('Ethernet NIC interface adapter', 'mac')
        expect(analysis.score).toBeGreaterThan(1.0)
        expect(analysis.reasoning).toContain('network_hardware_context')
      })

      it('should boost score for network config context', () => {
        const analysis = calculateContextScore('ifconfig ARP bridge configuration', 'mac')
        expect(analysis.score).toBeGreaterThan(1.0)
        expect(analysis.reasoning).toContain('network_config_context')
      })

      it('should reduce score for identifier hash context', () => {
        const analysis = calculateContextScore('UUID GUID hash checksum signature', 'mac')
        expect(analysis.score).toBeLessThan(1.0)
        expect(analysis.reasoning).toContain('identifier_hash_context')
      })

      it('should boost score for wireless context', () => {
        const analysis = calculateContextScore('Bluetooth wireless WiFi connection', 'mac')
        expect(analysis.score).toBeGreaterThan(1.0)
        expect(analysis.reasoning).toContain('wireless_context')
      })
    })
  })

  describe('extractSurroundingText', () => {
    it('should extract text around match with default window', () => {
      const fullText =
        'This is a long piece of text with an EMAIL@EXAMPLE.COM in the middle and more text'
      const matchStart = fullText.indexOf('EMAIL@EXAMPLE.COM')
      const matchEnd = matchStart + 'EMAIL@EXAMPLE.COM'.length

      const surrounding = extractSurroundingText(fullText, matchStart, matchEnd)
      expect(surrounding).toContain('text with an')
      expect(surrounding).toContain('in the middle')
      expect(surrounding).not.toContain('EMAIL@EXAMPLE.COM') // Should exclude the match itself
    })

    it('should handle matches at start of text', () => {
      const fullText = 'EMAIL@EXAMPLE.COM at the beginning of text'
      const matchStart = 0
      const matchEnd = 'EMAIL@EXAMPLE.COM'.length

      const surrounding = extractSurroundingText(fullText, matchStart, matchEnd)
      expect(surrounding).toBe(' at the beginning of tex')
    })

    it('should handle matches at end of text', () => {
      const fullText = 'Text ending with EMAIL@EXAMPLE.COM'
      const matchStart = fullText.indexOf('EMAIL@EXAMPLE.COM')
      const matchEnd = fullText.length

      const surrounding = extractSurroundingText(fullText, matchStart, matchEnd)
      expect(surrounding).toBe('Text ending with ')
    })

    it('should respect custom window size', () => {
      const fullText = 'This is a very long piece of text with an EMAIL@EXAMPLE.COM in the middle'
      const matchStart = fullText.indexOf('EMAIL@EXAMPLE.COM')
      const matchEnd = matchStart + 'EMAIL@EXAMPLE.COM'.length

      const smallWindow = extractSurroundingText(fullText, matchStart, matchEnd, 5)
      const largeWindow = extractSurroundingText(fullText, matchStart, matchEnd, 50)

      expect(largeWindow.length).toBeGreaterThan(smallWindow.length)
    })
  })

  describe('meetsContextThreshold', () => {
    it('should apply correct thresholds for different strictness levels', () => {
      const lowScoreAnalysis = {
        score: 0.3,
        positiveMatches: [],
        negativeMatches: [],
        confidence: 0.5,
        reasoning: [],
      }
      const mediumScoreAnalysis = {
        score: 1.0,
        positiveMatches: [],
        negativeMatches: [],
        confidence: 0.7,
        reasoning: [],
      }
      const highScoreAnalysis = {
        score: 1.5,
        positiveMatches: [],
        negativeMatches: [],
        confidence: 0.9,
        reasoning: [],
      }

      // Credit card thresholds: fast=0.5, balanced=1.1, strict=1.5
      expect(meetsContextThreshold(lowScoreAnalysis, 'credit_card', 'fast')).toBe(false)
      expect(meetsContextThreshold(mediumScoreAnalysis, 'credit_card', 'fast')).toBe(true)

      expect(meetsContextThreshold(mediumScoreAnalysis, 'credit_card', 'balanced')).toBe(false) // 1.0 < 1.1
      expect(meetsContextThreshold(lowScoreAnalysis, 'credit_card', 'balanced')).toBe(false)

      expect(meetsContextThreshold(highScoreAnalysis, 'credit_card', 'strict')).toBe(true)
      expect(meetsContextThreshold(mediumScoreAnalysis, 'credit_card', 'strict')).toBe(false)
    })

    it('should use default threshold for unknown PII types', () => {
      const analysis = {
        score: 0.6,
        positiveMatches: [],
        negativeMatches: [],
        confidence: 0.7,
        reasoning: [],
      }

      // Should use default thresholds: fast=0.3, balanced=0.5, strict=1.0
      // @ts-expect-error Testing unknown type behavior
      expect(meetsContextThreshold(analysis, 'unknown_type', 'fast')).toBe(true)
      // @ts-expect-error Testing unknown type behavior
      expect(meetsContextThreshold(analysis, 'unknown_type', 'balanced')).toBe(true)
      // @ts-expect-error Testing unknown type behavior
      expect(meetsContextThreshold(analysis, 'unknown_type', 'strict')).toBe(false)
    })

    it('should handle different PII types correctly', () => {
      const analysis = {
        score: 0.7,
        positiveMatches: [],
        negativeMatches: [],
        confidence: 0.7,
        reasoning: [],
      }

      // Email threshold is lower than credit card
      expect(meetsContextThreshold(analysis, 'email', 'balanced')).toBe(false) // 0.7 < 0.8
      expect(meetsContextThreshold(analysis, 'credit_card', 'balanced')).toBe(false) // 0.7 < 1.1
    })
  })

  describe('Confidence calculation', () => {
    it('should calculate confidence based on evidence strength', () => {
      const noEvidenceAnalysis = calculateContextScore('neutral text here', 'email')
      const someEvidenceAnalysis = calculateContextScore('send email to contact', 'email')
      const strongEvidenceAnalysis = calculateContextScore(
        'send email to contact for testing example',
        'email',
      )

      expect(noEvidenceAnalysis.confidence).toBeLessThan(someEvidenceAnalysis.confidence)
      expect(someEvidenceAnalysis.confidence).toBeLessThan(strongEvidenceAnalysis.confidence)
    })

    it('should cap confidence at maximum value', () => {
      const manyKeywordsText =
        'email send contact mail address to from cc bcc message reply forward'
      const analysis = calculateContextScore(manyKeywordsText, 'email')

      expect(analysis.confidence).toBeLessThanOrEqual(0.95) // Max confidence
    })

    it('should provide minimum confidence for no evidence', () => {
      const analysis = calculateContextScore('completely unrelated text', 'email')

      expect(analysis.confidence).toBeGreaterThanOrEqual(0.5) // Base confidence
    })
  })

  describe('Edge cases', () => {
    it('should handle empty surrounding text', () => {
      const analysis = calculateContextScore('', 'email')
      expect(analysis.score).toBe(1.0) // Base score
      expect(analysis.positiveMatches).toHaveLength(0)
      expect(analysis.negativeMatches).toHaveLength(0)
    })

    it('should handle very long surrounding text', () => {
      const longText = 'email '.repeat(1000) + 'test '.repeat(1000)
      const analysis = calculateContextScore(longText, 'email')

      // Should still work but with many matches
      expect(analysis.positiveMatches.length).toBeGreaterThan(0)
      expect(analysis.negativeMatches.length).toBeGreaterThan(0)
    })

    it('should handle special characters in context', () => {
      const specialText = 'email@domain.com! $pecial ch@racters #test %example'
      const analysis = calculateContextScore(specialText, 'email')

      expect(analysis.negativeMatches).toContain('test')
      expect(analysis.negativeMatches).toContain('example')
    })

    it('should be case insensitive', () => {
      const upperCaseAnalysis = calculateContextScore('EMAIL CONTACT ADDRESS', 'email')
      const lowerCaseAnalysis = calculateContextScore('email contact address', 'email')
      const mixedCaseAnalysis = calculateContextScore('Email Contact Address', 'email')

      expect(upperCaseAnalysis.score).toBe(lowerCaseAnalysis.score)
      expect(upperCaseAnalysis.score).toBe(mixedCaseAnalysis.score)
    })
  })
})
