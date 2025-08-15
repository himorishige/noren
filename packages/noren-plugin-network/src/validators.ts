/**
 * Network PII validation functions for false positive reduction
 * Implements validation logic specifically for IPv4, IPv6, and MAC addresses
 */

import { parseIPv6 } from './ipv6-parser.js'

// Reserved and special network addresses to exclude (only very specific ones)
const RESERVED_IPV4_ADDRESSES = new Set([
  // Loopback
  '127.0.0.1',
  // Special addresses
  '0.0.0.0',
  '255.255.255.255',
])

const IPV4_PATTERNS_TO_EXCLUDE = [
  // Version numbers (simple patterns like 1.2.3.4 where all parts are small)
  /^[0-9]\.[0-9]\.[0-9]\.[0-9]$/,
  /^[0-9]\.[0-9]\.[0-9]{1,2}\.[0-9]$/,
  // Date patterns (YYYY.MM.DD, DD.MM.YYYY)
  /^(19|20)\d{2}\.(0[1-9]|1[0-2])\.(0[1-9]|[12]\d|3[01])$/,
  /^(0[1-9]|[12]\d|3[01])\.(0[1-9]|1[0-2])\.(19|20)\d{2}$/,
]

const RESERVED_MAC_PATTERNS = [
  // Broadcast
  /^ff:ff:ff:ff:ff:ff$/i,
  /^ff-ff-ff-ff-ff-ff$/i,
  // All zeros
  /^00:00:00:00:00:00$/i,
  /^00-00-00-00-00-00$/i,
]

export interface NetworkValidationResult {
  valid: boolean
  confidence: number
  reason: string
  metadata?: Record<string, unknown>
}

export interface NetworkValidationContext {
  surroundingText: string
  strictness: 'fast' | 'balanced' | 'strict'
  originalIndex: number
}

/**
 * Validate IPv4 address candidate
 */
export function validateIPv4(
  candidate: string,
  context: NetworkValidationContext,
): NetworkValidationResult {
  // Basic format validation (already done by regex, but double-check)
  const octets = candidate.split('.').map(Number)
  if (octets.length !== 4 || octets.some((n) => n < 0 || n > 255)) {
    return {
      valid: false,
      confidence: 0.0,
      reason: 'invalid_format',
    }
  }

  // Check against reserved addresses (in production environments)
  if (RESERVED_IPV4_ADDRESSES.has(candidate)) {
    return {
      valid: false,
      confidence: 0.0,
      reason: 'reserved_address',
    }
  }

  // Check for obvious false positives (version numbers, dates)
  for (const pattern of IPV4_PATTERNS_TO_EXCLUDE) {
    if (pattern.test(candidate)) {
      return {
        valid: false,
        confidence: 0.0,
        reason: 'likely_false_positive',
      }
    }
  }

  // Context analysis for better accuracy
  const surroundingLower = context.surroundingText.toLowerCase()

  // Positive indicators
  if (/\b(ip|address|server|host|endpoint|url|api)\b/.test(surroundingLower)) {
    return {
      valid: true,
      confidence: 0.9,
      reason: 'network_context',
      metadata: { contextMatched: true },
    }
  }

  // Negative indicators
  if (/\b(version|ver|v\d|release|build|date)\b/.test(surroundingLower)) {
    return {
      valid: false,
      confidence: 0.0,
      reason: 'version_context',
    }
  }

  // Private IP addresses (lower confidence in logs/configs)
  const [a, b] = octets
  const isPrivate =
    a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || a === 127

  // Default to valid for most cases - this is a plugin, let users decide
  return {
    valid: true,
    confidence: isPrivate ? 0.7 : 0.8,
    reason: isPrivate ? 'private_ip' : 'public_ip',
    metadata: { isPrivate, octets },
  }
}

/**
 * Validate IPv6 address candidate
 */
export function validateIPv6(
  candidate: string,
  context: NetworkValidationContext,
): NetworkValidationResult {
  const parseResult = parseIPv6(candidate)

  if (!parseResult.valid) {
    return {
      valid: false,
      confidence: 0.0,
      reason: parseResult.error || 'parse_failed',
    }
  }

  // Context analysis
  const surroundingLower = context.surroundingText.toLowerCase()

  // Strong network context
  if (/\b(ipv6|ip6|address|interface|gateway|dns)\b/.test(surroundingLower)) {
    return {
      valid: true,
      confidence: 0.95,
      reason: 'ipv6_context',
      metadata: parseResult as unknown as Record<string, unknown>,
    }
  }

  // Special addresses (typically not PII)
  if (parseResult.isLoopback || parseResult.isDocumentation) {
    return {
      valid: false,
      confidence: 0.0,
      reason: 'special_address',
      metadata: parseResult as unknown as Record<string, unknown>,
    }
  }

  // Link-local and unique local (lower confidence)
  if (parseResult.isLinkLocal || parseResult.isUniqueLocal) {
    return {
      valid: true,
      confidence: 0.6,
      reason: 'local_address',
      metadata: parseResult as unknown as Record<string, unknown>,
    }
  }

  return {
    valid: true,
    confidence: 0.8,
    reason: 'valid_ipv6',
    metadata: parseResult as unknown as Record<string, unknown>,
  }
}

/**
 * Validate MAC address candidate
 */
export function validateMAC(
  candidate: string,
  context: NetworkValidationContext,
): NetworkValidationResult {
  const normalized = candidate.replace(/[:-]/g, '').toLowerCase()

  // Check for reserved patterns
  for (const pattern of RESERVED_MAC_PATTERNS) {
    if (pattern.test(candidate)) {
      return {
        valid: false,
        confidence: 0.0,
        reason: 'reserved_mac',
      }
    }
  }

  // Context analysis
  const surroundingLower = context.surroundingText.toLowerCase()

  // Strong network context
  if (/\b(mac|ethernet|wifi|interface|adapter|nic|hardware)\b/.test(surroundingLower)) {
    return {
      valid: true,
      confidence: 0.9,
      reason: 'hardware_context',
      metadata: { normalized },
    }
  }

  // Negative indicators (serial numbers, product codes)
  if (/\b(serial|product|model|code|id|part|sku)\b/.test(surroundingLower)) {
    return {
      valid: false,
      confidence: 0.0,
      reason: 'product_context',
    }
  }

  // Check for obvious patterns (all same digits, etc.)
  if (/^(.)\1{11}$/.test(normalized)) {
    return {
      valid: false,
      confidence: 0.0,
      reason: 'pattern_repetition',
    }
  }

  return {
    valid: true,
    confidence: 0.7,
    reason: 'valid_mac',
    metadata: { normalized, separator: candidate.includes(':') ? ':' : '-' },
  }
}

/**
 * Main validation function for network PII types
 */
export function validateNetworkCandidate(
  candidate: string,
  type: string,
  context: NetworkValidationContext,
): NetworkValidationResult {
  switch (type) {
    case 'ipv4':
      return validateIPv4(candidate, context)
    case 'ipv6':
      return validateIPv6(candidate, context)
    case 'mac':
      return validateMAC(candidate, context)
    default:
      return {
        valid: false,
        confidence: 0.0,
        reason: 'unknown_type',
      }
  }
}
