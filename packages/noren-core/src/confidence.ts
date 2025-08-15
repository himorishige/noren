/**
 * Confidence scoring system for PII detection
 * Provides rule-based confidence calculation for detected patterns
 */

import type { DetectionSensitivity, Hit, PiiType } from './types.js'

/**
 * Confidence thresholds for different sensitivity levels
 */
export const CONFIDENCE_THRESHOLDS = {
  strict: 0.5, // Allow false positives, avoid false negatives
  balanced: 0.7, // Balance precision and recall
  relaxed: 0.85, // Avoid false positives, allow false negatives
} as const

/**
 * Features extracted from text for confidence calculation
 */
export interface ConfidenceFeatures extends Record<string, unknown> {
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
  typeSpecific: Record<string, unknown>
}

/**
 * Calculate confidence score for a detected PII pattern
 */
export function calculateConfidence(
  hit: Hit,
  text: string,
  features?: Partial<ConfidenceFeatures>,
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
    features: extractedFeatures,
  }
}

/**
 * Extract features from text around the detected pattern
 */
function extractFeatures(
  hit: Hit,
  text: string,
  providedFeatures?: Partial<ConfidenceFeatures>,
): ConfidenceFeatures {
  const surroundingStart = Math.max(0, hit.start - 50)
  const surroundingEnd = Math.min(text.length, hit.end + 50)
  const surroundingText = text.slice(surroundingStart, surroundingEnd).toLowerCase()
  const surroundingWords = surroundingText.match(/\b\w+\b/g) || []

  // Test keywords that suggest non-real data
  const testKeywords = ['test', 'example', 'dummy', 'sample', 'demo', 'fake', 'mock']
  const exampleKeywords = ['example.com', 'example.org', 'localhost', 'invalid', 'placeholder']

  const features: ConfidenceFeatures = {
    hasTestKeywords: testKeywords.some((keyword) => surroundingText.includes(keyword)),
    hasExampleKeywords: exampleKeywords.some((keyword) => surroundingText.includes(keyword)),
    isInCodeBlock: isInCodeBlock(text, hit.start),
    isInComment: isInComment(text, hit.start),
    surroundingWords,
    patternComplexity: calculatePatternComplexity(hit.value),
    patternLength: hit.value.length,
    hasValidFormat: true, // Will be overridden by type-specific validation
    typeSpecific: {},
    ...providedFeatures,
  }

  return features
}

/**
 * Get base confidence score for pattern type
 */
function getBasePatternScore(type: PiiType, _value: string): number {
  switch (type) {
    case 'email':
      return 0.6 // Email patterns are generally reliable
    case 'credit_card':
      return 0.7 // Credit cards have Luhn validation
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
  _features: ConfidenceFeatures,
): {
  adjustment: number
  reasons: string[]
} {
  const adjustment = 0
  const reasons: string[] = []

  switch (type) {
    case 'email':
      return getEmailConfidenceAdjustment(value, _features)
    default:
      return { adjustment, reasons }
  }
}

/**
 * Email-specific confidence adjustments
 */
function getEmailConfidenceAdjustment(
  value: string,
  _features: ConfidenceFeatures,
): {
  adjustment: number
  reasons: string[]
} {
  let adjustment = 0
  const reasons: string[] = []

  const email = value.toLowerCase()

  // Check for disposable/test email domains
  const testDomains = ['example.com', 'example.org', 'test.com', 'localhost']
  if (testDomains.some((domain) => email.endsWith(domain))) {
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
 * Check if hit meets confidence threshold for given sensitivity
 */
export function meetsConfidenceThreshold(
  confidence: number,
  sensitivity: DetectionSensitivity,
  customThreshold?: number,
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
  customThreshold?: number,
): Hit[] {
  return hits.filter((hit) => {
    if (hit.confidence === undefined) {
      // For backward compatibility, assume high confidence for hits without scores
      return true
    }
    return meetsConfidenceThreshold(hit.confidence, sensitivity, customThreshold)
  })
}
