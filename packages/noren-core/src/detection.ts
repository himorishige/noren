// Simplified built-in detection logic for v0.4.0

import { parseIPv6 } from './ipv6-parser.js'
import { DETECTION_PATTERNS } from './patterns.js'
import { hitPool } from './pool.js'
import type { DetectUtils } from './types.js'
import { luhn, SECURITY_LIMITS } from './utils.js'

export function builtinDetect(u: DetectUtils) {
  const { src } = u

  // Simple length check for security
  if (src.length > SECURITY_LIMITS.maxInputLength) {
    return
  }

  // Email detection
  for (const match of src.matchAll(DETECTION_PATTERNS.email)) {
    if (!u.canPush || !u.canPush()) break

    if (match.index == null) continue

    const hit = hitPool.acquire(
      'email',
      match.index,
      match.index + match[0].length,
      match[0],
      'medium',
    )
    u.push(hit)
  }

  // Credit card detection with Luhn validation
  for (const match of src.matchAll(DETECTION_PATTERNS.creditCardChunk)) {
    if (!u.canPush || !u.canPush()) break

    const digits = match[0].replace(/[ -]/g, '')
    if (digits.length >= 13 && digits.length <= 19 && luhn(digits)) {
      if (match.index == null) continue

      const hit = hitPool.acquire(
        'credit_card',
        match.index,
        match.index + match[0].length,
        match[0],
        'high',
      )
      u.push(hit)
    }
  }

  // IPv4 detection
  for (const match of src.matchAll(DETECTION_PATTERNS.ipv4)) {
    if (!u.canPush || !u.canPush()) break

    if (match.index == null) continue

    const hit = hitPool.acquire('ipv4', match.index, match.index + match[0].length, match[0], 'low')
    u.push(hit)
  }

  // IPv6 detection (simplified - just use regex)
  for (const match of src.matchAll(DETECTION_PATTERNS.ipv6)) {
    if (!u.canPush || !u.canPush()) break

    const result = parseIPv6(match[0])
    if (result.valid) {
      if (match.index == null) continue

      const hit = hitPool.acquire(
        'ipv6',
        match.index,
        match.index + match[0].length,
        match[0],
        'low',
      )
      u.push(hit)
    }
  }

  // MAC address detection
  for (const match of src.matchAll(DETECTION_PATTERNS.mac)) {
    if (!u.canPush || !u.canPush()) break

    if (match.index == null) continue

    const hit = hitPool.acquire('mac', match.index, match.index + match[0].length, match[0], 'low')
    u.push(hit)
  }

  // Phone E164 detection
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
