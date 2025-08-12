/**
 * Allowlist/Denylist functionality for PII detection
 * Provides environment-aware filtering of false positives
 */

import type { PiiType } from './types.js'

export type Environment = 'production' | 'test' | 'development'

/**
 * Default allowlisted patterns that should not be treated as PII
 */
export const DEFAULT_ALLOWLIST = {
  email: new Set([
    // RFC 2606 reserved domains for documentation
    'example.com',
    'example.net',
    'example.org',
    'example.edu',
    // RFC 6761 special use domains
    'localhost',
    'localhost.localdomain',
    'invalid',
    'test',
    'local',
    // Common test/no-reply patterns
    'noreply@',
    'no-reply@',
    'donotreply@',
    'do-not-reply@',
  ]),

  ipv4: new Set([
    // Loopback
    '127.0.0.1',
    '0.0.0.0',
    // Documentation (RFC 5737)
    '192.0.2.0/24', // TEST-NET-1
    '198.51.100.0/24', // TEST-NET-2
    '203.0.113.0/24', // TEST-NET-3
    // Private networks (RFC 1918) - optional
    '10.0.0.0/8',
    '172.16.0.0/12',
    '192.168.0.0/16',
  ]),

  ipv6: new Set([
    // Loopback
    '::1',
    '::',
    // Documentation (RFC 3849)
    '2001:db8::/32',
    // Unique Local Addresses (RFC 4193)
    'fc00::/7',
    'fd00::/8',
    // Link-local
    'fe80::/10',
  ]),

  phone: new Set([
    // US test numbers
    '555-0100',
    '555-0199', // Range reserved for fictional use
    // Common test patterns
    '0000000000',
    '1111111111',
    '1234567890',
    '9999999999',
  ]),

  credit_card: new Set([
    // Test card numbers (already handled by Luhn but added for clarity)
    '4242424242424242', // Stripe test
    '4111111111111111', // Visa test
    '5555555555554444', // Mastercard test
    '378282246310005', // Amex test
    '6011111111111117', // Discover test
  ]),
}

/**
 * Configuration for allowlist/denylist behavior
 */
export interface AllowDenyConfig {
  environment?: Environment
  customAllowlist?: Map<PiiType, Set<string>>
  customDenylist?: Map<PiiType, Set<string>>
  allowPrivateIPs?: boolean
  allowTestPatterns?: boolean
}

/**
 * Manages allowlist and denylist for PII detection
 */
export class AllowDenyManager {
  private environment: Environment
  private allowlist: Map<PiiType, Set<string>>
  private denylist: Map<PiiType, Set<string>>
  private allowPrivateIPs: boolean
  private allowTestPatterns: boolean

  constructor(config: AllowDenyConfig = {}) {
    this.environment = config.environment ?? 'production'
    this.allowPrivateIPs = config.allowPrivateIPs ?? this.environment !== 'production'
    this.allowTestPatterns = config.allowTestPatterns ?? this.environment !== 'production'

    // Initialize with defaults based on environment
    this.allowlist = this.initializeAllowlist(config.customAllowlist)
    this.denylist = config.customDenylist ?? new Map()
  }

  private initializeAllowlist(custom?: Map<PiiType, Set<string>>): Map<PiiType, Set<string>> {
    const result = new Map<PiiType, Set<string>>()

    // Start with defaults for non-production environments
    if (this.environment !== 'production') {
      for (const [type, patterns] of Object.entries(DEFAULT_ALLOWLIST)) {
        result.set(type as PiiType, new Set(patterns))
      }
    } else {
      // In production, only use safe defaults
      result.set('email', new Set(['noreply@', 'no-reply@', 'donotreply@', 'do-not-reply@']))
    }

    // Merge custom allowlist
    if (custom) {
      for (const [type, patterns] of custom) {
        const existing = result.get(type) ?? new Set()
        for (const pattern of patterns) {
          existing.add(pattern)
        }
        result.set(type, existing)
      }
    }

    return result
  }

  /**
   * Check if a value should be allowed (not treated as PII)
   */
  isAllowed(value: string, type: PiiType): boolean {
    const normalizedValue = value.toLowerCase().trim()

    // Check denylist first (explicit denial)
    const denyPatterns = this.denylist.get(type)
    if (denyPatterns) {
      for (const pattern of denyPatterns) {
        if (this.matchesPattern(normalizedValue, pattern, type)) {
          return false // Explicitly denied
        }
      }
    }

    // Check allowlist
    const allowPatterns = this.allowlist.get(type)
    if (allowPatterns) {
      for (const pattern of allowPatterns) {
        if (this.matchesPattern(normalizedValue, pattern, type)) {
          return true // Explicitly allowed
        }
      }
    }

    // Special handling for IPs
    if (type === 'ipv4' && this.allowPrivateIPs) {
      if (this.isPrivateIPv4(value)) {
        return true
      }
    }

    if (type === 'ipv6' && this.allowPrivateIPs) {
      if (this.isPrivateIPv6(value)) {
        return true
      }
    }

    // Special handling for test patterns
    if (this.allowTestPatterns) {
      if (this.isTestPattern(normalizedValue, type)) {
        return true
      }
    }

    return false // Not explicitly allowed
  }

  private matchesPattern(value: string, pattern: string, type: PiiType): boolean {
    // Handle different pattern types
    if (pattern.includes('/')) {
      // CIDR notation for IPs
      return this.matchesCIDR(value, pattern)
    }

    if (pattern.endsWith('@')) {
      // Email prefix pattern
      return value.startsWith(pattern)
    }

    if (type === 'email') {
      // For email, check exact match or domain match
      if (pattern === value) {
        return true // Exact match
      }
      if (pattern.includes('.') && !pattern.includes('@')) {
        // Domain pattern without @
        return value.endsWith('@' + pattern) || value.endsWith('.' + pattern)
      }
      // Full email pattern
      return value === pattern.toLowerCase()
    }

    // Exact match or contains
    return value === pattern || value.includes(pattern)
  }

  private matchesCIDR(ip: string, cidr: string): boolean {
    // Simplified CIDR matching (would need proper implementation)
    const [network] = cidr.split('/')
    return ip.startsWith(network.split('.').slice(0, -1).join('.'))
  }

  private isPrivateIPv4(ip: string): boolean {
    const parts = ip.split('.').map(Number)
    if (parts.length !== 4) return false

    // 10.0.0.0/8
    if (parts[0] === 10) return true
    // 172.16.0.0/12
    if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true
    // 192.168.0.0/16
    if (parts[0] === 192 && parts[1] === 168) return true
    // 127.0.0.0/8 (loopback)
    if (parts[0] === 127) return true

    return false
  }

  private isPrivateIPv6(ip: string): boolean {
    const normalized = ip.toLowerCase()

    // Loopback
    if (normalized === '::1' || normalized === '::') return true

    // Link-local (fe80::/10)
    if (normalized.startsWith('fe80:')) return true

    // Unique local (fc00::/7)
    if (normalized.startsWith('fc') || normalized.startsWith('fd')) return true

    // Documentation (2001:db8::/32)
    if (normalized.startsWith('2001:db8:')) return true

    return false
  }

  private isTestPattern(value: string, type: PiiType): boolean {
    // Check for obvious test patterns
    const testIndicators = ['test', 'example', 'dummy', 'sample', 'demo', 'fake']

    for (const indicator of testIndicators) {
      if (value.includes(indicator)) {
        return true
      }
    }

    // Type-specific test patterns
    if (type === 'phone') {
      // Repeated digits
      if (/^(\d)\1+$/.test(value.replace(/\D/g, ''))) {
        return true
      }
      // Sequential digits
      if (value.replace(/\D/g, '') === '1234567890') {
        return true
      }
    }

    if (type === 'email') {
      // Common test email patterns
      if (value.startsWith('test@') || value.startsWith('admin@')) {
        return true
      }
    }

    return false
  }

  /**
   * Add patterns to allowlist at runtime
   */
  addToAllowlist(type: PiiType, patterns: string[]): void {
    const existing = this.allowlist.get(type) ?? new Set()
    for (const pattern of patterns) {
      existing.add(pattern)
    }
    this.allowlist.set(type, existing)
  }

  /**
   * Add patterns to denylist at runtime
   */
  addToDenylist(type: PiiType, patterns: string[]): void {
    const existing = this.denylist.get(type) ?? new Set()
    for (const pattern of patterns) {
      existing.add(pattern)
    }
    this.denylist.set(type, existing)
  }

  /**
   * Get current configuration for debugging
   */
  getConfig(): {
    environment: Environment
    allowPrivateIPs: boolean
    allowTestPatterns: boolean
    allowlist: Record<string, string[]>
    denylist: Record<string, string[]>
  } {
    const allowlistObj: Record<string, string[]> = {}
    for (const [type, patterns] of this.allowlist) {
      allowlistObj[type] = Array.from(patterns)
    }

    const denylistObj: Record<string, string[]> = {}
    for (const [type, patterns] of this.denylist) {
      denylistObj[type] = Array.from(patterns)
    }

    return {
      environment: this.environment,
      allowPrivateIPs: this.allowPrivateIPs,
      allowTestPatterns: this.allowTestPatterns,
      allowlist: allowlistObj,
      denylist: denylistObj,
    }
  }
}
