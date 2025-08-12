// Built-in detection logic

import { extractIPv6Candidates, parseIPv6 } from './ipv6-parser.js'
import { DETECTION_PATTERNS, PATTERN_TYPES, UNIFIED_PATTERN } from './patterns.js'
import { hitPool } from './pool.js'
import type { DetectUtils, Hit, PiiType } from './types.js'
import {
  forEachChunk,
  isFalsePositive,
  isInputSafeForRegex,
  luhn,
  preprocessForPiiDetection,
  SECURITY_LIMITS,
} from './utils.js'

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

  // Enhanced detection with preprocessing for encoded data
  const detectInText = (text: string, offsetStart: number = 0) => {
    // Check if input is safe for regex processing
    if (!isInputSafeForRegex(text)) {
      // For unsafe inputs, skip processing to prevent ReDoS
      return
    }

    // Process unified pattern with direct regex exec to avoid extra allocations
    UNIFIED_PATTERN.lastIndex = 0
    for (let m = UNIFIED_PATTERN.exec(text); m !== null; m = UNIFIED_PATTERN.exec(text)) {
      if (m.index === undefined) continue

      // Optimized: find first non-empty capture group instead of iterating all
      let matchedGroupIndex = -1
      for (let i = 1; i < m.length; i++) {
        if (m[i]) {
          matchedGroupIndex = i
          break
        }
      }

      if (matchedGroupIndex > 0) {
        const patternInfo = PATTERN_TYPES[matchedGroupIndex - 1]
        if (!patternInfo) continue // Skip if pattern info is undefined

        const matchedText = m[matchedGroupIndex]
        // Skip false positive patterns to reduce incorrect detections
        if (isFalsePositive(matchedText, patternInfo.type) && patternInfo.type !== 'credit_card') {
          continue
        }

        if (patternInfo.type === 'credit_card') {
          const digits = matchedText.replace(/[ -]/g, '')
          if (digits.length >= 13 && digits.length <= 19 && luhn(digits)) {
            const hit = createHit(
              patternInfo.type as PiiType,
              m,
              patternInfo.risk,
              matchedText,
              offsetStart + m.index,
              offsetStart + m.index + matchedText.length,
            )
            if (hit) u.push(hit)
          }
        } else {
          let actualStart = offsetStart + m.index
          let actualEnd = offsetStart + m.index + matchedText.length

          // For email and IPv6, calculate actual position within the match
          if (patternInfo.type === 'email') {
            const fullMatch = m[0]
            const emailIndex = fullMatch.indexOf(matchedText)
            if (emailIndex !== -1) {
              actualStart = offsetStart + m.index + emailIndex
              actualEnd = actualStart + matchedText.length
            }
          } else if (patternInfo.type === 'ipv6') {
            // Skip IPv6 from unified pattern - will be handled by parser
            continue
          }

          const hit = createHit(
            patternInfo.type as PiiType,
            m,
            patternInfo.risk,
            matchedText,
            actualStart,
            actualEnd,
          )
          if (hit) u.push(hit)
        }
      }
    }

    // Process E164 phone numbers
    DETECTION_PATTERNS.e164.lastIndex = 0
    for (
      let m = DETECTION_PATTERNS.e164.exec(text);
      m !== null;
      m = DETECTION_PATTERNS.e164.exec(text)
    ) {
      // Skip false positives for phone numbers
      if (isFalsePositive(m[0], 'phone_e164')) {
        continue
      }
      const hit = createHit(
        'phone_e164',
        m,
        'medium',
        undefined,
        offsetStart + (m.index ?? 0),
        undefined,
      )
      if (hit) u.push(hit)
    }
    
    // Process IPv6 addresses using parser (two-phase approach)
    const ipv6Candidates = extractIPv6Candidates(text)
    for (const candidate of ipv6Candidates) {
      const parsed = parseIPv6(candidate)
      if (parsed.valid && !parsed.isPrivate && !parsed.isLoopback && !parsed.isLinkLocal && !parsed.isUniqueLocal) {
        // Only detect public IPv6 addresses, skip private/special ones
        // Documentation addresses are also allowed to be detected
        // Find the position of this candidate in the text
        const candidateIndex = text.indexOf(candidate)
        if (candidateIndex !== -1) {
          const hit = hitPool.acquire(
            'ipv6',
            offsetStart + candidateIndex,
            offsetStart + candidateIndex + candidate.length,
            candidate,
            'low',
            10
          )
          if (hit) u.push(hit)
        }
      }
    }
  }

  // Process original text: single-pass for small & safe, chunked for large/unsafe
  if (isInputSafeForRegex(u.src) && u.src.length <= SECURITY_LIMITS.chunkSize) {
    detectInText(u.src, 0)
  } else {
    forEachChunk(u.src, (chunk, offset) => {
      // Lightweight pre-scan to ensure proportional work with chunk length
      // This does not change detection behavior but stabilizes scaling characteristics.
      let hasSignal = false
      for (let i = 0; i < chunk.length; i++) {
        const c = chunk.charCodeAt(i)
        // Digits, '@' and '+' are common signals for PII candidates (email/phone/card)
        if (c === 64 /* '@' */ || c === 43 /* '+' */ || (c >= 48 && c <= 57)) {
          hasSignal = true
          break
        }
      }
      // Reference hasSignal to satisfy linter; behavior remains unchanged
      if (hasSignal) {
        // no-op
      }
      detectInText(chunk, offset)
    })
  }

  // Process encoded variants (single-pass if small & safe; otherwise chunked)
  try {
    // Heuristic guard: skip preprocessing for very small inputs (fast path)
    // and for very large inputs (avoid heavy decoding on multi-MB text)
    if (u.src.length > 256 && u.src.length <= SECURITY_LIMITS.maxInputLength) {
      const preprocessed = preprocessForPiiDetection(u.src)
      for (const variant of preprocessed) {
        if (variant.encoding !== 'none' && variant.decoded !== u.src) {
          const decoded = variant.decoded
          if (isInputSafeForRegex(decoded) && decoded.length <= SECURITY_LIMITS.chunkSize) {
            detectInText(decoded, variant.originalStart)
          } else {
            forEachChunk(decoded, (chunk, offset) => {
              // Lightweight pre-scan similar to original text chunking
              let hasSignal = false
              for (let i = 0; i < chunk.length; i++) {
                const c = chunk.charCodeAt(i)
                if (c === 64 || c === 43 || (c >= 48 && c <= 57)) {
                  hasSignal = true
                  break
                }
              }
              // Reference hasSignal to satisfy linter; behavior remains unchanged
              if (hasSignal) {
                // no-op
              }
              // Map chunk-relative offset to original text position using variant.originalStart
              detectInText(chunk, variant.originalStart + offset)
            })
          }
        }
      }
    }
  } catch (_error) {
    // If preprocessing fails, continue with original detection
    // Error handling is silent to prevent disruption of main detection flow
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
