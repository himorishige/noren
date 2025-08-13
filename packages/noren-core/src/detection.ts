// Optimized built-in detection logic for v0.5.0 - single-pass unified detection

import { parseIPv6 } from './ipv6-parser.js'
import { DETECTION_PATTERNS, PATTERN_TYPES, UNIFIED_PATTERN } from './patterns.js'
import { hitPool } from './pool.js'
import type { DetectUtils } from './types.js'
import { luhn, SECURITY_LIMITS } from './utils.js'

export function builtinDetect(u: DetectUtils) {
  const { src } = u

  // Simple length check for security
  if (src.length > SECURITY_LIMITS.maxInputLength) {
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
        let startIndex = match.index

        // Adjust for IPv6 lookahead match
        if (patternType.type === 'ipv6') {
          const fullMatch = match[0]
          const ipv6Start = fullMatch.lastIndexOf(value)
          startIndex = match.index + ipv6Start
          // Additional validation for IPv6
          const result = parseIPv6(value)
          if (!result.valid) {
            isValid = false
          }
        }

        // Additional validation for credit cards
        if (patternType.type === 'credit_card') {
          const digits = value.replace(/[ -]/g, '')
          if (digits.length < 13 || digits.length > 19 || !luhn(digits)) {
            isValid = false
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
          u.push(hit)
        }
        break // Only process the first matching group
      }
    }
  }

  // Phone E164 detection (not in unified pattern due to complexity)
  for (const match of src.matchAll(DETECTION_PATTERNS.e164)) {
    if (!u.canPush || !u.canPush()) break

    // Simple validation - check length
    const digits = match[0].replace(/\D/g, '')
    if (digits.length >= 10 && digits.length <= 15) {
      if (match.index == null) continue

      const hit = hitPool.acquire(
        'phone_e164',
        match.index,
        match.index + match[0].length,
        match[0],
        'medium',
      )
      u.push(hit)
    }
  }
}
