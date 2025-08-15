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
  isAllowed(value: string, type: PiiType, context?: string): boolean {
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

    // Check context-based filtering (comments, documentation, etc.)
    if (context && this.isInCommentOrDocumentation(context, value)) {
      return true // Allow PII-like patterns in comments/docs
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
      if (!pattern.includes('@')) {
        // Domain pattern without @ (including single-part domains like 'localhost')
        return value.endsWith(`@${pattern}`) || value.endsWith(`.${pattern}`)
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

  /**
   * Check if PII-like value appears in a comment or documentation context
   */
  private isInCommentOrDocumentation(context: string, value: string): boolean {
    const valueIndex = context.indexOf(value)
    if (valueIndex === -1) return false

    const beforeValue = context.substring(0, valueIndex)
    const afterValue = context.substring(valueIndex + value.length)

    // Check for comment indicators in the immediate vicinity
    const lineStart = Math.max(0, beforeValue.lastIndexOf('\n'))
    const lineEnd = afterValue.indexOf('\n')
    const currentLine = context.substring(
      lineStart,
      lineEnd === -1 ? context.length : valueIndex + value.length + lineEnd,
    )

    // Comment patterns - must be on the same line or within the current block
    const commentPatterns = [
      /^\s*\/\//, // Line starts with //
      /\/\/[^"]*$/, // // comment to end of line
      /^\s*\/\*[\s\S]*?\*\//, // /* */ block on same line
      /^\s*#/, // Line starts with #
      /^\s*<!--[\s\S]*?-->/, // HTML comment
      /^\s*\*\//, // End of multi-line comment
      /^\s*\*/, // JSDoc continuation
    ]

    for (const pattern of commentPatterns) {
      if (pattern.test(currentLine.trim())) {
        return true
      }
    }

    // Check for documentation keywords ONLY within the same line
    const strongIndicators = [
      /\bexample\s*[:]\s*/i,
      /\bdemo\s*[:]\s*/i,
      /\bsample\s*[:]\s*/i,
      /\btest\s*[:]\s*/i,
      /\bplaceholder\s*[:]\s*/i,
      /\be\.g\.\s*/i,
      /\bfor\s+example\b/i,
    ]

    for (const pattern of strongIndicators) {
      if (pattern.test(currentLine)) {
        // Check only current line, not before value
        return true
      }
    }

    // Check if the value is within inline code on the same line
    const beforeValueInLine = currentLine.substring(0, valueIndex - lineStart)
    const afterValueInLine = currentLine.substring(valueIndex - lineStart + value.length)

    // Check for backticks (inline code)
    if (beforeValueInLine.includes('`') && afterValueInLine.includes('`')) {
      const backticksBeforeValue = (beforeValueInLine.match(/`/g) || []).length
      const backticksAfterValue = (afterValueInLine.match(/`/g) || []).length

      // If odd number of backticks before and after, it's likely inside code
      if (backticksBeforeValue % 2 === 1 && backticksAfterValue % 2 === 1) {
        return true
      }
    }

    // Check for environment variable pattern on same line
    // But only filter if it contains obvious test indicators
    if (/^\s*[A-Z_]+=/.test(currentLine)) {
      const envTestIndicators = ['test', 'demo', 'sample', 'example', 'fake']
      const lineText = currentLine.toLowerCase()

      // Only filter env vars that clearly contain test indicators
      for (const indicator of envTestIndicators) {
        if (lineText.includes(indicator)) {
          return true
        }
      }
    }

    return false
  }

  private isTestPattern(value: string, type: PiiType): boolean {
    // Only filter very obvious test patterns
    if (type === 'email') {
      // Check for test/example domains
      if (
        value.includes('@example.com') ||
        value.includes('@example.org') ||
        value.includes('@example.net')
      ) {
        return true
      }
      // Check for obvious test prefixes with example domains
      if ((value.startsWith('test@') || value.startsWith('dummy@')) && value.includes('example.')) {
        return true
      }
      if (value.includes('noreply') || value.includes('no-reply')) {
        return true
      }
    }

    if (type === 'credit_card') {
      // Known test card patterns only (most common ones)
      const testCards = [
        '4242424242424242', // Stripe test
        '4111111111111111', // Visa test
        '378282246310005', // Amex test
        '6011111111111117', // Discover test
        // Note: Removed 5555555555554444 as it's often used in real examples
      ]

      const digitsOnly = value.replace(/\D/g, '')
      if (testCards.includes(digitsOnly)) {
        return true
      }

      // Only very specific repeated patterns
      if (digitsOnly === '4242424242424242') {
        return true
      }
    }

    if (type === 'phone') {
      // Repeated digits only
      if (/^(\d)\1+$/.test(value.replace(/\D/g, ''))) {
        return true
      }
      // Sequential digits
      if (value.replace(/\D/g, '') === '1234567890') {
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
