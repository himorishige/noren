// Built-in detection logic

import { DETECTION_PATTERNS, PATTERN_TYPES, UNIFIED_PATTERN } from './patterns.js'
import { hitPool } from './pool.js'
import type { DetectUtils, Hit, PiiType } from './types.js'
import { luhn } from './utils.js'

export function builtinDetect(u: DetectUtils) {
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
    // Built-in detectors have low default priority
    return hitPool.acquire(type, actualStart, actualEnd, actualValue, risk, 10)
  }

  for (const m of u.src.matchAll(UNIFIED_PATTERN)) {
    if (m.index === undefined) continue

    for (let i = 1; i < m.length; i++) {
      if (m[i]) {
        const patternInfo = PATTERN_TYPES[i - 1]
        if (!patternInfo) continue // Skip if pattern info is undefined
        if (patternInfo.type === 'credit_card') {
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
          let actualStart = m.index
          let actualEnd = m.index + m[i].length

          // For email and IPv6, calculate actual position within the match
          if (patternInfo.type === 'email') {
            const fullMatch = m[0]
            const emailMatch = m[i]
            const emailIndex = fullMatch.indexOf(emailMatch)
            if (emailIndex !== -1) {
              actualStart = m.index + emailIndex
              actualEnd = actualStart + emailMatch.length
            }
          } else if (patternInfo.type === 'ipv6') {
            // IPv6 pattern uses non-capturing boundary, so group is the IPv6 address itself
            const fullMatch = m[0]
            const ipv6Match = m[i]
            // Find the IPv6 address within the full match (skip boundary character)
            const ipv6Index = fullMatch.indexOf(ipv6Match)
            if (ipv6Index !== -1) {
              actualStart = m.index + ipv6Index
              actualEnd = actualStart + ipv6Match.length
            }
          }

          const hit = createHit(
            patternInfo.type as PiiType,
            m,
            patternInfo.risk,
            m[i],
            actualStart,
            actualEnd,
          )
          if (hit) u.push(hit)
        }
        break
      }
    }
  }

  for (const m of u.src.matchAll(DETECTION_PATTERNS.e164)) {
    const hit = createHit('phone_e164', m, 'medium')
    if (hit) u.push(hit)
  }
}

// biome-ignore lint/correctness/noUnusedVariables: backwards compatibility
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
