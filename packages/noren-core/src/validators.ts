/**
 * PII validation functions for false positive reduction
 * Implements lightweight, fast validation logic for each PII type
 */

import {
  CREDIT_CARD_BRANDS,
  EXAMPLE_DOMAINS,
  NON_PII_EMAIL_PREFIXES,
  NORMALIZED_TEST_CREDIT_CARDS,
  STRICTNESS_LEVELS,
  type StrictnessLevel,
} from './constants.js'
import { calculateContextScore as calcContextScore } from './context-scoring.js'
import type { PiiType } from './types.js'
import { luhn } from './utils.js'

export interface ValidationResult {
  valid: boolean
  confidence: number // 0.0-1.0
  reason: string
  metadata?: Record<string, unknown>
}

export interface ValidationContext {
  surroundingText: string // Text around the candidate (±24 chars)
  strictness: StrictnessLevel
  originalIndex: number
}

/**
 * Validate credit card candidate
 */
export function validateCreditCard(
  candidate: string,
  context: ValidationContext,
): ValidationResult {
  const digits = candidate.replace(/[\s-]/g, '')
  const settings = STRICTNESS_LEVELS[context.strictness]

  // Basic format check
  if (digits.length < 13 || digits.length > 19) {
    return {
      valid: false,
      confidence: 0.0,
      reason: 'invalid_length',
    }
  }

  // Luhn algorithm check (already implemented in core)
  if (!luhn(digits)) {
    return {
      valid: false,
      confidence: 0.0,
      reason: 'luhn_failed',
    }
  }

  // Test number exclusion
  if (settings.excludeTestData && NORMALIZED_TEST_CREDIT_CARDS.has(digits)) {
    return {
      valid: false,
      confidence: 0.0,
      reason: 'test_number',
    }
  }

  // Brand validation
  let brand: string | null = null
  let validLength = false

  if (settings.brandValidation) {
    for (const [brandName, brandInfo] of Object.entries(CREDIT_CARD_BRANDS)) {
      if (brandInfo.pattern.test(digits)) {
        brand = brandName
        validLength = brandInfo.lengths.includes(digits.length)
        break
      }
    }

    if (!brand) {
      return {
        valid: false,
        confidence: 0.0,
        reason: 'unknown_brand',
      }
    }

    if (!validLength) {
      return {
        valid: false,
        confidence: 0.0,
        reason: 'invalid_brand_length',
        metadata: { brand, length: digits.length },
      }
    }
  }

  // Check for repeated digits (likely test data) - check before context
  const repeatedPattern = /(\d)\1{3,}/.test(digits)
  if (repeatedPattern) {
    return {
      valid: false,
      confidence: 0.1,
      reason: 'repeated_digits',
    }
  }

  // Check for sequential digits - check before context
  const sequential =
    /(?:0123|1234|2345|3456|4567|5678|6789|9876|8765|7654|6543|5432|4321|3210)/.test(digits)
  if (sequential) {
    return {
      valid: false,
      confidence: 0.2,
      reason: 'sequential_digits',
    }
  }

  // Check for bare 16-digit numbers (no separators) - only in strict mode
  const hasNoSeparators = !/[\s-]/.test(candidate)
  if (hasNoSeparators && digits.length === 16 && settings.excludeTestData) {
    // Bare 16-digit numbers need strong context evidence in balanced/strict mode
    const contextScore = calculateContextScore(context.surroundingText, 'credit_card')
    const threshold = context.strictness === 'strict' ? 2.0 : 1.2 // Lower threshold for balanced mode
    if (contextScore < threshold) {
      return {
        valid: false,
        confidence: 0.3,
        reason: 'bare_digits_weak_context',
        metadata: { contextScore, threshold },
      }
    }
  }

  return {
    valid: true,
    confidence: brand ? 0.9 : 0.7,
    reason: brand ? `valid_${brand}` : 'valid_unknown_brand',
    metadata: { brand, digits: digits.length },
  }
}

/**
 * Validate email address candidate
 */
export function validateEmail(candidate: string, context: ValidationContext): ValidationResult {
  const settings = STRICTNESS_LEVELS[context.strictness]

  const atIndex = candidate.indexOf('@')
  if (atIndex === -1) {
    return {
      valid: false,
      confidence: 0.0,
      reason: 'no_at_symbol',
    }
  }

  const localPart = candidate.slice(0, atIndex)
  const domain = candidate.slice(atIndex + 1)

  // Check example domains
  if (settings.excludeTestData && EXAMPLE_DOMAINS.has(domain.toLowerCase())) {
    return {
      valid: false,
      confidence: 0.0,
      reason: 'example_domain',
    }
  }

  // Check non-PII prefixes
  const normalizedLocal = localPart.toLowerCase().replace(/[.-]/g, '')
  if (NON_PII_EMAIL_PREFIXES.has(normalizedLocal)) {
    return {
      valid: false,
      confidence: 0.1,
      reason: 'non_pii_prefix',
      metadata: { prefix: normalizedLocal },
    }
  }

  // TLD validation
  const lastDot = domain.lastIndexOf('.')
  if (lastDot === -1) {
    return {
      valid: false,
      confidence: 0.0,
      reason: 'no_tld',
    }
  }

  const tld = domain.slice(lastDot + 1)
  if (tld.length < 2 || tld.length > 24 || !/^[a-z]+$/i.test(tld)) {
    return {
      valid: false,
      confidence: 0.0,
      reason: 'invalid_tld',
    }
  }

  // Context scoring
  const contextScore = calculateContextScore(context.surroundingText, 'email')

  return {
    valid: true,
    confidence: Math.min(0.9, 0.6 + contextScore * 0.15),
    reason: 'valid_email',
    metadata: { contextScore, domain, isExample: EXAMPLE_DOMAINS.has(domain.toLowerCase()) },
  }
}

/**
 * Calculate context score based on surrounding text
 */
function calculateContextScore(surroundingText: string, piiType: PiiType): number {
  const analysis = calcContextScore(surroundingText, piiType)
  return analysis.score
}

/**
 * Main validation dispatcher with error handling
 */
export function validateCandidate(
  candidate: string,
  piiType: PiiType,
  context: ValidationContext,
): ValidationResult {
  // Input validation
  if (!candidate || typeof candidate !== 'string') {
    return {
      valid: false,
      confidence: 0.0,
      reason: 'invalid_input',
      metadata: { error: 'Candidate must be a non-empty string' },
    }
  }

  if (candidate.length > 1000) {
    return {
      valid: false,
      confidence: 0.0,
      reason: 'candidate_too_long',
      metadata: { length: candidate.length, maxLength: 1000 },
    }
  }

  try {
    switch (piiType) {
      case 'credit_card':
        return validateCreditCard(candidate, context)
      case 'email':
        return validateEmail(candidate, context)
      default:
        // For other types, just pass through
        return { valid: true, confidence: 0.7, reason: 'no_validation' }
    }
  } catch (error) {
    // Fallback on validation errors
    return {
      valid: false,
      confidence: 0.0,
      reason: 'validation_error',
      metadata: {
        error: error instanceof Error ? error.message : 'Unknown validation error',
        piiType,
        candidateLength: candidate.length,
      },
    }
  }
}

/**
 * Debug helper to analyze validation results in a readable format
 */
export function debugValidation(
  candidate: string,
  piiType: PiiType,
  context: ValidationContext,
): void {
  const result = validateCandidate(candidate, piiType, context)

  console.log(`🔍 Validation Debug for ${piiType}: "${candidate}"`)
  console.log(`📍 Context: "${context.surroundingText}"`)
  console.log(`⚙️  Strictness: ${context.strictness}`)
  console.log(`✅ Valid: ${result.valid}`)
  console.log(`🎯 Confidence: ${result.confidence}`)
  console.log(`💭 Reason: ${result.reason}`)

  if (result.metadata) {
    console.log(`📋 Metadata:`)
    Object.entries(result.metadata).forEach(([key, value]) => {
      console.log(`   ${key}: ${JSON.stringify(value)}`)
    })
  }

  if (!result.valid) {
    console.log(`❌ This candidate was filtered out by validation`)
  } else {
    console.log(`✅ This candidate passed validation`)
  }

  console.log('') // Empty line for readability
}
