/**
 * Confidence scoring system for PII detection
 * Provides rule-based confidence calculation for detected patterns
 */

import type { Hit, PiiType, DetectionSensitivity } from './types.js'
import { parseIPv6 } from './ipv6-parser.js'

/**
 * Confidence thresholds for different sensitivity levels
 */
export const CONFIDENCE_THRESHOLDS = {
  strict: 0.5,    // Allow false positives, avoid false negatives
  balanced: 0.7,  // Balance precision and recall
  relaxed: 0.85   // Avoid false positives, allow false negatives
} as const

/**
 * Features extracted from text for confidence calculation
 */
export interface ConfidenceFeatures {
  // Context features
  hasTestKeywords: boolean
  hasExampleKeywords: boolean
  isInCodeBlock: boolean
  isInComment: boolean
  surroundingWords: string[]
  
  // Pattern features
  patternComplexity: number
  patternLength: number
  hasValidFormat: boolean
  
  // Type-specific features
  typeSpecific: Record<string, any>
}

/**
 * Calculate confidence score for a detected PII pattern
 */
export function calculateConfidence(
  hit: Hit, 
  text: string, 
  features?: Partial<ConfidenceFeatures>
): {
  confidence: number
  reasons: string[]
  features: ConfidenceFeatures
} {
  const extractedFeatures = extractFeatures(hit, text, features)
  const reasons: string[] = []
  let baseScore = 0.5 // Start with neutral confidence
  
  // Base pattern matching score
  baseScore += getBasePatternScore(hit.type, hit.value)
  reasons.push(`base-pattern-${hit.type}`)
  
  // Context-based adjustments
  const contextAdjustment = getContextAdjustment(extractedFeatures)
  baseScore += contextAdjustment.adjustment
  reasons.push(...contextAdjustment.reasons)
  
  // Type-specific validation
  const typeAdjustment = getTypeSpecificAdjustment(hit.type, hit.value, extractedFeatures)
  baseScore += typeAdjustment.adjustment
  reasons.push(...typeAdjustment.reasons)
  
  // Normalize to 0.0-1.0 range, but ensure it's not exactly 1.0 for better testing
  const confidence = Math.max(0.0, Math.min(0.99, baseScore))
  
  return {
    confidence,
    reasons,
    features: extractedFeatures
  }
}

/**
 * Extract features from text around the detected pattern
 */
function extractFeatures(
  hit: Hit, 
  text: string, 
  providedFeatures?: Partial<ConfidenceFeatures>
): ConfidenceFeatures {
  const surroundingStart = Math.max(0, hit.start - 50)
  const surroundingEnd = Math.min(text.length, hit.end + 50)
  const surroundingText = text.slice(surroundingStart, surroundingEnd).toLowerCase()
  const surroundingWords = surroundingText.match(/\b\w+\b/g) || []
  
  // Test keywords that suggest non-real data
  const testKeywords = ['test', 'example', 'dummy', 'sample', 'demo', 'fake', 'mock']
  const exampleKeywords = ['example.com', 'example.org', 'localhost', 'invalid', 'placeholder']
  
  const features: ConfidenceFeatures = {
    hasTestKeywords: testKeywords.some(keyword => surroundingText.includes(keyword)),
    hasExampleKeywords: exampleKeywords.some(keyword => surroundingText.includes(keyword)),
    isInCodeBlock: isInCodeBlock(text, hit.start),
    isInComment: isInComment(text, hit.start),
    surroundingWords,
    patternComplexity: calculatePatternComplexity(hit.value),
    patternLength: hit.value.length,
    hasValidFormat: true, // Will be overridden by type-specific validation
    typeSpecific: {},
    ...providedFeatures
  }
  
  return features
}

/**
 * Get base confidence score for pattern type
 */
function getBasePatternScore(type: PiiType, value: string): number {
  switch (type) {
    case 'email':
      return 0.6 // Email patterns are generally reliable
    case 'credit_card':
      return 0.7 // Credit cards have Luhn validation
    case 'ipv4':
      return 0.5 // IP addresses are common but can be false positives
    case 'ipv6':
      return 0.6 // IPv6 is less common, more likely to be real
    case 'phone_e164':
      return 0.5 // Phone patterns can be ambiguous
    case 'mac':
      return 0.6 // MAC addresses have specific format
    default:
      return 0.4 // Unknown types get lower base score
  }
}

/**
 * Adjust confidence based on context
 */
function getContextAdjustment(features: ConfidenceFeatures): {
  adjustment: number
  reasons: string[]
} {
  let adjustment = 0
  const reasons: string[] = []
  
  if (features.hasTestKeywords) {
    adjustment -= 0.1 // Reduced from 0.2
    reasons.push('test-keywords-present')
  }
  
  if (features.hasExampleKeywords) {
    adjustment -= 0.15 // Reduced from 0.3
    reasons.push('example-keywords-present')
  }
  
  if (features.isInCodeBlock) {
    adjustment -= 0.2 // Reduced from 0.3
    reasons.push('in-code-block')
  }
  
  if (features.isInComment) {
    adjustment -= 0.2
    reasons.push('in-comment')
  }
  
  // Longer patterns are generally more reliable
  if (features.patternLength > 20) {
    adjustment += 0.1
    reasons.push('long-pattern')
  } else if (features.patternLength < 5) {
    adjustment -= 0.1
    reasons.push('short-pattern')
  }
  
  return { adjustment, reasons }
}

/**
 * Type-specific confidence adjustments
 */
function getTypeSpecificAdjustment(
  type: PiiType, 
  value: string, 
  features: ConfidenceFeatures
): {
  adjustment: number
  reasons: string[]
} {
  let adjustment = 0
  const reasons: string[] = []
  
  switch (type) {
    case 'email':
      return getEmailConfidenceAdjustment(value, features)
    case 'ipv4':
      return getIPv4ConfidenceAdjustment(value, features)
    case 'ipv6':
      return getIPv6ConfidenceAdjustment(value, features)
    case 'phone_e164':
      return getPhoneConfidenceAdjustment(value, features)
    default:
      return { adjustment, reasons }
  }
}

/**
 * Email-specific confidence adjustments
 */
function getEmailConfidenceAdjustment(
  value: string, 
  features: ConfidenceFeatures
): {
  adjustment: number
  reasons: string[]
} {
  let adjustment = 0
  const reasons: string[] = []
  
  const email = value.toLowerCase()
  
  // Check for disposable/test email domains
  const testDomains = ['example.com', 'example.org', 'test.com', 'localhost']
  if (testDomains.some(domain => email.endsWith(domain))) {
    adjustment -= 0.4 // Reduced from 0.8 to prevent zero confidence
    reasons.push('test-domain')
  }
  
  // Check for no-reply patterns
  if (email.startsWith('noreply@') || email.startsWith('no-reply@')) {
    adjustment -= 0.4
    reasons.push('noreply-pattern')
  }
  
  // Check for valid TLD (simplified check)
  const tld = email.split('.').pop()
  if (tld && tld.length >= 2 && tld.length <= 6 && /^[a-z]+$/.test(tld)) {
    adjustment += 0.2
    reasons.push('valid-tld')
  }
  
  // Check for suspicious patterns
  if (/admin@|test@|user@/.test(email)) {
    adjustment -= 0.2
    reasons.push('generic-prefix')
  }
  
  return { adjustment, reasons }
}

/**
 * IPv4-specific confidence adjustments
 */
function getIPv4ConfidenceAdjustment(
  value: string, 
  features: ConfidenceFeatures
): {
  adjustment: number
  reasons: string[]
} {
  let adjustment = 0
  const reasons: string[] = []
  
  const parts = value.split('.').map(Number)
  
  // Private IP addresses are less likely to be PII
  if (isPrivateIPv4(parts)) {
    adjustment -= 0.2  // Reduced penalty to allow detection at strict threshold
    reasons.push('private-ip')
  } else {
    adjustment += 0.3
    reasons.push('public-ip')
  }
  
  // Loopback and special addresses
  if (parts[0] === 127) {
    adjustment -= 0.8
    reasons.push('loopback-ip')
  }
  
  // Documentation ranges (RFC 5737)
  if ((parts[0] === 192 && parts[1] === 0 && parts[2] === 2) ||
      (parts[0] === 198 && parts[1] === 51 && parts[2] === 100) ||
      (parts[0] === 203 && parts[1] === 0 && parts[2] === 113)) {
    adjustment -= 0.8
    reasons.push('documentation-ip')
  }
  
  return { adjustment, reasons }
}

/**
 * Phone number-specific confidence adjustments
 */
function getPhoneConfidenceAdjustment(
  value: string, 
  features: ConfidenceFeatures
): {
  adjustment: number
  reasons: string[]
} {
  let adjustment = 0
  const reasons: string[] = []
  
  const digits = value.replace(/\D/g, '')
  
  // Repeated digits (like 1111111111) are likely test numbers
  if (/^(\d)\1+$/.test(digits)) {
    adjustment -= 0.8
    reasons.push('repeated-digits')
  }
  
  // Sequential digits (like 1234567890)
  if (digits === '1234567890') {
    adjustment -= 0.8
    reasons.push('sequential-digits')
  }
  
  // US test number ranges (555-0100 to 555-0199)
  if (digits.match(/^1?555010[0-9]$/)) {
    adjustment -= 0.8
    reasons.push('us-test-number')
  }
  
  return { adjustment, reasons }
}

/**
 * IPv6-specific confidence adjustments
 */
function getIPv6ConfidenceAdjustment(
  value: string,
  features: ConfidenceFeatures
): {
  adjustment: number
  reasons: string[]
} {
  let adjustment = 0
  const reasons: string[] = []
  
  const parsed = parseIPv6(value)
  
  if (parsed.valid) {
    // Private/local addresses are less likely to be PII
    if (parsed.isPrivate || parsed.isLoopback || parsed.isLinkLocal || parsed.isUniqueLocal) {
      adjustment -= 0.3  // Less aggressive than IPv4 to allow some detection at strict level
      if (parsed.isLoopback) {
        reasons.push('ipv6-loopback')
      } else if (parsed.isLinkLocal) {
        reasons.push('ipv6-link-local') 
      } else if (parsed.isUniqueLocal) {
        reasons.push('ipv6-unique-local')
      } else {
        reasons.push('ipv6-private')
      }
    } else {
      adjustment += 0.2
      reasons.push('ipv6-public')
    }
    
    // Documentation range
    if (parsed.isDocumentation) {
      adjustment -= 0.5
      reasons.push('ipv6-documentation')
    }
  }
  
  return { adjustment, reasons }
}

/**
 * Check if text position is within a code block
 */
function isInCodeBlock(text: string, position: number): boolean {
  const beforeText = text.slice(0, position)
  
  // Check for markdown code blocks
  const beforeTicks = (beforeText.match(/```/g) || []).length
  
  // If odd number of ``` before position, we're inside a code block
  return beforeTicks % 2 === 1
}

/**
 * Check if text position is within a comment
 */
function isInComment(text: string, position: number): boolean {
  const line = getLineContaining(text, position)
  return line.trim().startsWith('//') || line.trim().startsWith('#')
}

/**
 * Get the line containing the specified position
 */
function getLineContaining(text: string, position: number): string {
  const beforeText = text.slice(0, position)
  const afterText = text.slice(position)
  
  const lineStart = beforeText.lastIndexOf('\n') + 1
  const lineEnd = afterText.indexOf('\n')
  
  if (lineEnd === -1) {
    return text.slice(lineStart)
  } else {
    return text.slice(lineStart, position + lineEnd)
  }
}

/**
 * Calculate pattern complexity score
 */
function calculatePatternComplexity(value: string): number {
  let complexity = 0
  
  // Character variety
  if (/[a-z]/.test(value)) complexity++
  if (/[A-Z]/.test(value)) complexity++
  if (/\d/.test(value)) complexity++
  if (/[^a-zA-Z0-9]/.test(value)) complexity++
  
  // Length contribution
  complexity += Math.min(value.length / 20, 2)
  
  return complexity
}

/**
 * Check if IPv4 address is private
 */
function isPrivateIPv4(parts: number[]): boolean {
  if (parts.length !== 4) return false
  
  // 10.0.0.0/8
  if (parts[0] === 10) return true
  
  // 172.16.0.0/12
  if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true
  
  // 192.168.0.0/16
  if (parts[0] === 192 && parts[1] === 168) return true
  
  return false
}

/**
 * Check if hit meets confidence threshold for given sensitivity
 */
export function meetsConfidenceThreshold(
  confidence: number, 
  sensitivity: DetectionSensitivity,
  customThreshold?: number
): boolean {
  const threshold = customThreshold ?? CONFIDENCE_THRESHOLDS[sensitivity]
  return confidence >= threshold
}

/**
 * Apply confidence-based filtering to hits
 */
export function filterByConfidence(
  hits: Hit[],
  sensitivity: DetectionSensitivity,
  customThreshold?: number
): Hit[] {
  return hits.filter(hit => {
    if (hit.confidence === undefined) {
      // For backward compatibility, assume high confidence for hits without scores
      return true
    }
    return meetsConfidenceThreshold(hit.confidence, sensitivity, customThreshold)
  })
}