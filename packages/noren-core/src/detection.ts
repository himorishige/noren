// Detection logic (separate for tree-shaking)

import { DETECTION_PATTERNS, PATTERN_TYPES, UNIFIED_PATTERN } from './patterns.js'
import { hitPool } from './pool.js'
import type { DetectUtils, Hit, PiiType } from './types.js'
import { luhn } from './utils.js'

export function builtinDetect(u: DetectUtils) {
  // Helper function for pooled hit creation
  const createHit = (
    type: PiiType,
    match: RegExpMatchArray,
    risk: Hit['risk'],
    value?: string,
    start?: number,
    end?: number,
  ): Hit | null => {
    if (match.index === undefined && start === undefined) return null
    const actualStart = start ?? match.index ?? 0
    const actualEnd = end ?? (match.index ?? 0) + match[0].length
    const actualValue = value ?? match[0]
    return hitPool.acquire(type, actualStart, actualEnd, actualValue, risk)
  }

  // Unified pattern detection (single pass for most common patterns)
  for (const m of u.src.matchAll(UNIFIED_PATTERN)) {
    if (m.index === undefined) continue

    // Determine which capture group matched
    for (let i = 1; i < m.length; i++) {
      if (m[i]) {
        const patternInfo = PATTERN_TYPES[i - 1]
        if (patternInfo.type === 'credit_card') {
          // Credit card requires Luhn validation
          const digits = m[i].replace(/[ -]/g, '')
          if (digits.length >= 13 && digits.length <= 19 && luhn(digits)) {
            const hit = createHit(
              patternInfo.type as PiiType,
              m,
              patternInfo.risk,
              m[i],
              m.index,
              m.index + m[i].length,
            )
            if (hit) u.push(hit)
          }
        } else {
          const hit = createHit(
            patternInfo.type as PiiType,
            m,
            patternInfo.risk,
            m[i],
            m.index,
            m.index + m[i].length,
          )
          if (hit) u.push(hit)
        }
        break // Only match first capture group
      }
    }
  }

  // IPv6 (complex pattern, kept separate)
  for (const m of u.src.matchAll(DETECTION_PATTERNS.ipv6)) {
    const hit = createHit('ipv6', m, 'low')
    if (hit) u.push(hit)
  }

  // E.164 phone numbers (context-sensitive, kept separate)
  for (const m of u.src.matchAll(DETECTION_PATTERNS.e164)) {
    const hit = createHit('phone_e164', m, 'medium')
    if (hit) u.push(hit)
  }
}

// Maintaining original hit function for backwards compatibility
// This function is used in external packages or user-defined plugins
// biome-ignore lint/correctness/noUnusedVariables: kept for backwards compatibility with external packages
function hit(type: PiiType, m: RegExpMatchArray, risk: Hit['risk']): Hit | null {
  if (m.index === undefined) return null
  return {
    type,
    start: m.index,
    end: m.index + m[0].length,
    value: m[0],
    risk,
  }
}
