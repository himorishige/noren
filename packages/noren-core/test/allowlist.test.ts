import { describe, expect, it } from 'vitest'
import { AllowDenyManager, Registry, redactText } from '../src/index.js'

describe('Allowlist/Denylist Functionality', () => {
  describe('AllowDenyManager', () => {
    it('should allow test domains in non-production environments', () => {
      const manager = new AllowDenyManager({ environment: 'test' })
      
      expect(manager.isAllowed('test@example.com', 'email')).toBe(true)
      expect(manager.isAllowed('user@example.org', 'email')).toBe(true)
      expect(manager.isAllowed('admin@localhost', 'email')).toBe(true)
      expect(manager.isAllowed('noreply@domain.com', 'email')).toBe(true)
    })
    
    it('should not allow test domains in production environment', () => {
      const manager = new AllowDenyManager({ environment: 'production' })
      
      expect(manager.isAllowed('test@example.com', 'email')).toBe(false)
      expect(manager.isAllowed('user@example.org', 'email')).toBe(false)
      expect(manager.isAllowed('admin@localhost', 'email')).toBe(false)
      // noreply should still be allowed
      expect(manager.isAllowed('noreply@domain.com', 'email')).toBe(true)
    })
    
    it('should handle private IPs based on configuration', () => {
      const devManager = new AllowDenyManager({ 
        environment: 'development',
        allowPrivateIPs: true 
      })
      const prodManager = new AllowDenyManager({ 
        environment: 'production',
        allowPrivateIPs: false 
      })
      
      expect(devManager.isAllowed('192.168.1.1', 'ipv4')).toBe(true)
      expect(devManager.isAllowed('10.0.0.1', 'ipv4')).toBe(true)
      expect(devManager.isAllowed('127.0.0.1', 'ipv4')).toBe(true)
      
      expect(prodManager.isAllowed('192.168.1.1', 'ipv4')).toBe(false)
      expect(prodManager.isAllowed('10.0.0.1', 'ipv4')).toBe(false)
      expect(prodManager.isAllowed('8.8.8.8', 'ipv4')).toBe(false)
    })
    
    it('should respect custom allowlist and denylist', () => {
      const customAllowlist = new Map([
        ['email', new Set(['allowed@custom.com'])]
      ])
      const customDenylist = new Map([
        ['email', new Set(['denied@custom.com', 'noreply@'])]
      ])
      
      const manager = new AllowDenyManager({
        environment: 'test',
        customAllowlist,
        customDenylist
      })
      
      // Custom allowlist
      expect(manager.isAllowed('allowed@custom.com', 'email')).toBe(true)
      
      // Custom denylist overrides default allowlist
      expect(manager.isAllowed('noreply@domain.com', 'email')).toBe(false)
      expect(manager.isAllowed('denied@custom.com', 'email')).toBe(false)
    })
    
    it('should detect test patterns when enabled', () => {
      const manager = new AllowDenyManager({ 
        environment: 'test',
        allowTestPatterns: true 
      })
      
      expect(manager.isAllowed('test@real-company.com', 'email')).toBe(true)
      expect(manager.isAllowed('dummy.user@gmail.com', 'email')).toBe(true)
      expect(manager.isAllowed('1234567890', 'phone')).toBe(true)
      expect(manager.isAllowed('1111111111', 'phone')).toBe(true)
    })
  })
  
  describe('Registry with Allowlist Integration', () => {
    it('should filter out allowed patterns in test environment', async () => {
      const reg = new Registry({ 
        defaultAction: 'mask',
        environment: 'test'
      })
      
      const text = `
        Test email: test@example.com
        Real email: user@gmail.com
        Private IP: 192.168.1.1
        Public IP: 8.8.8.8
      `
      
      const result = await redactText(reg, text)
      
      // Test patterns should not be redacted
      expect(result).toContain('test@example.com')
      expect(result).toContain('192.168.1.1')
      
      // Real PII should be redacted
      expect(result).toContain('[REDACTED:email]')
      expect(result).toContain('[REDACTED:ipv4]')
      expect(result).not.toContain('user@gmail.com')
      expect(result).not.toContain('8.8.8.8')
    })
    
    it('should redact everything in production environment', async () => {
      const reg = new Registry({ 
        defaultAction: 'mask',
        environment: 'production'
      })
      
      const text = `
        Test email: test@example.com
        NoReply: noreply@company.com
        Private IP: 192.168.1.1
      `
      
      const result = await redactText(reg, text)
      
      // Test patterns should be redacted in production
      expect(result).not.toContain('test@example.com')
      expect(result).not.toContain('192.168.1.1')
      
      // NoReply should not be redacted
      expect(result).toContain('noreply@company.com')
    })
    
    it('should handle custom configuration', async () => {
      const reg = new Registry({ 
        defaultAction: 'mask',
        environment: 'test',
        allowDenyConfig: {
          customAllowlist: new Map([
            ['email', new Set(['support@mycompany.com'])]
          ]),
          customDenylist: new Map([
            ['email', new Set(['test@'])]
          ])
        }
      })
      
      const text = `
        Support: support@mycompany.com
        Test: test@example.com
        User: user@domain.com
      `
      
      const result = await redactText(reg, text)
      
      // Custom allowed should not be redacted
      expect(result).toContain('support@mycompany.com')
      
      // Custom denied should be redacted even if normally allowed
      expect(result).not.toContain('test@example.com')
      
      // Normal email should be redacted
      expect(result).not.toContain('user@domain.com')
    })
  })
})