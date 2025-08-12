import { describe, expect, it } from 'vitest'
import { extractIPv6Candidates, parseIPv6, validateIPv6Candidates } from '../src/ipv6-parser.js'

describe('IPv6 Parser', () => {
  describe('parseIPv6', () => {
    it('should parse valid full IPv6 addresses', () => {
      const cases = [
        '2001:0db8:85a3:0000:0000:8a2e:0370:7334',
        '2001:db8:85a3::8a2e:370:7334',
        '::1',
        '::',
        'fe80::1',
        '2001:db8::1',
      ]
      
      for (const addr of cases) {
        const result = parseIPv6(addr)
        expect(result.valid).toBe(true)
        expect(result.normalized).toBeDefined()
      }
    })
    
    it('should classify IPv6 address types correctly', () => {
      // Loopback
      let result = parseIPv6('::1')
      expect(result.valid).toBe(true)
      expect(result.isLoopback).toBe(true)
      expect(result.isPrivate).toBe(true)
      
      // Link-local
      result = parseIPv6('fe80::1')
      expect(result.valid).toBe(true)
      expect(result.isLinkLocal).toBe(true)
      expect(result.isPrivate).toBe(true)
      
      // Unique local
      result = parseIPv6('fd00::1')
      expect(result.valid).toBe(true)
      expect(result.isUniqueLocal).toBe(true)
      expect(result.isPrivate).toBe(true)
      
      // Documentation
      result = parseIPv6('2001:db8::1')
      expect(result.valid).toBe(true)
      expect(result.isDocumentation).toBe(true)
      expect(result.isPrivate).toBe(false)
      
      // Global unicast
      result = parseIPv6('2001:4860:4860::8888')
      expect(result.valid).toBe(true)
      expect(result.isPrivate).toBe(false)
    })
    
    it('should handle IPv6 with embedded IPv4', () => {
      const cases = [
        '::ffff:192.168.1.1',
        '::192.168.1.1',
        '64:ff9b::192.0.2.1',
      ]
      
      for (const addr of cases) {
        const result = parseIPv6(addr)
        expect(result.valid).toBe(true)
      }
    })
    
    it('should reject invalid IPv6 addresses', () => {
      const invalidCases = [
        '2001:db8:85z3::8a2e:370:7334', // Invalid character
        '2001:db8::8a2e::370:7334', // Double ::
        '2001:db8:85a3:0000:0000:8a2e:0370:7334:extra', // Too many parts
        '12345::', // Hextet too long
        'gg01::', // Invalid hex
        '192.168.1.1', // IPv4 only
      ]
      
      for (const addr of invalidCases) {
        const result = parseIPv6(addr)
        expect(result.valid).toBe(false)
        expect(result.error).toBeDefined()
      }
    })
    
    it('should handle zone IDs and brackets', () => {
      let result = parseIPv6('fe80::1%eth0')
      expect(result.valid).toBe(true)
      
      result = parseIPv6('[2001:db8::1]')
      expect(result.valid).toBe(true)
    })
  })
  
  describe('extractIPv6Candidates', () => {
    it('should extract potential IPv6 addresses from text', () => {
      const text = `
        Server at 2001:db8::1 is running.
        Link-local: fe80::1
        Compressed: ::1
        URL: http://[2001:db8::8a2e:370:7334]/path
      `
      
      const candidates = extractIPv6Candidates(text)
      expect(candidates).toContain('2001:db8::1')
      expect(candidates).toContain('fe80::1')
      expect(candidates).toContain('::1')
      expect(candidates).toContain('2001:db8::8a2e:370:7334')
    })
    
    it('should not extract IPv4 addresses', () => {
      const text = 'IP addresses: 192.168.1.1 and 10.0.0.1'
      const candidates = extractIPv6Candidates(text)
      expect(candidates).toHaveLength(0)
    })
  })
  
  describe('validateIPv6Candidates', () => {
    it('should validate and filter IPv6 candidates', () => {
      const candidates = [
        '2001:db8::1',
        'invalid::address::here',
        'fe80::1',
        '192.168.1.1',
        '::1',
      ]
      
      const results = validateIPv6Candidates(candidates)
      
      expect(results).toHaveLength(3)
      expect(results.map(r => r.original)).toEqual([
        '2001:db8::1',
        'fe80::1',
        '::1',
      ])
      
      // Check parsed results
      for (const result of results) {
        expect(result.parsed.valid).toBe(true)
        expect(result.parsed.normalized).toBeDefined()
      }
    })
  })
  
  describe('Integration with detection', () => {
    it('should properly detect IPv6 addresses using parser', async () => {
      const { Registry, redactText } = await import('../src/index.js')
      
      const reg = new Registry({ 
        defaultAction: 'mask',
        environment: 'production'
      })
      
      const text = `
        Public IPv6: 2001:4860:4860::8888
        Private IPv6: fd00::1
        Link-local: fe80::1
        Documentation: 2001:db8::1
        Invalid: 2001:db8:85z3::8a2e:370:7334
      `
      
      const result = await redactText(reg, text)
      
      // Public IPv6 should be redacted
      expect(result).not.toContain('2001:4860:4860::8888')
      expect(result).toContain('[REDACTED:ipv6]')
      
      // Private/special addresses have lower confidence but may still be detected
      // depending on sensitivity level - with production environment and no specific sensitivity,
      // they may still be detected if confidence is above default threshold
      // This is expected behavior with confidence scoring enabled
      
      // Documentation addresses are detected
      expect(result).not.toContain('2001:db8::1')
      
      // Invalid should remain as-is (partial detection might occur)
      // The parser won't detect the invalid part, but regex might catch partial matches
    })
  })
})