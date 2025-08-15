// Optimized built-in detection logic for v0.6.0 - single-pass unified detection with validation

import { extractSurroundingText } from './context-scoring.js'
import { PATTERN_TYPES, UNIFIED_PATTERN } from './patterns.js'
import { hitPool } from './pool.js'
import { prefilterText, quickDigitValidation } from './prefilter.js'
import type { DetectUtils } from './types.js'
import { luhn, SECURITY_LIMITS } from './utils.js'
import { type ValidationContext, validateCandidate } from './validators.js'

export function builtinDetect(
  u: DetectUtils,
  strictness: 'fast' | 'balanced' | 'strict' = 'balanced',
) {
  const { src } = u

  // Simple length check for security
  if (src.length > SECURITY_LIMITS.maxInputLength) {
    return
  }

  // Fast prefiltering to skip expensive regex when no candidates
  const prefilterResult = prefilterText(src)
  if (prefilterResult.skipExpensiveDetection) {
    return
  }

  // Single-pass unified detection for common patterns
  for (const match of src.matchAll(UNIFIED_PATTERN)) {
    if (!u.canPush || !u.canPush()) break
    if (match.index == null) continue

    // Find which group matched
    for (let i = 1; i < match.length; i++) {
      if (match[i]) {
        const patternType = PATTERN_TYPES[i - 1]
        let isValid = true
        const value = match[i]
        const startIndex = match.index

        // Basic validation for credit cards (keep existing logic for compatibility)
        if (patternType.type === 'credit_card') {
          if (!quickDigitValidation(value, 'credit_card')) {
            isValid = false
          } else {
            const digits = value.replace(/[ -]/g, '')
            if (!luhn(digits)) {
              isValid = false
            }
          }
        }

        // Enhanced validation using new validator system
        if (isValid && strictness !== 'fast') {
          // Use window around the match for context, but include the full text for pattern matching
          const windowSize = 48 // Larger window for context
          const beforeStart = Math.max(0, startIndex - windowSize)
          const afterEnd = Math.min(src.length, startIndex + value.length + windowSize)
          const surroundingText = src.slice(beforeStart, afterEnd)

          const validationContext: ValidationContext = {
            surroundingText,
            strictness,
            originalIndex: startIndex - beforeStart, // Adjust index for windowed text
          }

          try {
            const validationResult = validateCandidate(value, patternType.type, validationContext)

            if (!validationResult.valid) {
              isValid = false
            }
          } catch (error) {
            // On validation error, fall back to allowing the match
            // This prevents validation errors from breaking detection entirely
            console.warn(
              `Validation error for ${patternType.type}: ${error instanceof Error ? error.message : 'Unknown error'}`,
            )
            // Continue with isValid = true (fallback behavior)
          }
        }

        if (isValid) {
          const hit = hitPool.acquire(
            patternType.type,
            startIndex,
            startIndex + value.length,
            value,
            patternType.risk,
          )

          // Add validation metadata if available
          if (strictness !== 'fast') {
            const surroundingText = extractSurroundingText(
              src,
              startIndex,
              startIndex + value.length,
            )
            const validationContext: ValidationContext = {
              surroundingText,
              strictness,
              originalIndex: startIndex,
            }
            const validationResult = validateCandidate(value, patternType.type, validationContext)
            hit.confidence = validationResult.confidence
          }

          u.push(hit)
        }
        break // Only process the first matching group
      }
    }
  }
}
