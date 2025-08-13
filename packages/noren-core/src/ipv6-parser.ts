/**
 * Lightweight IPv6 address validator (optimized for v0.5.0)
 * Simplified for better performance - only validates, no classification
 */

/**
 * Result of IPv6 parsing - lightweight with classification
 */
export interface IPv6ParseResult {
  valid: boolean
  normalized?: string
  isPrivate?: boolean
  isLoopback?: boolean
  isDocumentation?: boolean
  isLinkLocal?: boolean
  isUniqueLocal?: boolean
  error?: string
}

/**
 * Lightweight IPv6 address validator with basic normalization
 */
export function parseIPv6(address: string): IPv6ParseResult {
  // Basic character validation (allow alphanumeric for zone ID)
  if (!/^[0-9a-fA-F:.%[\]a-zA-Z0-9]+$/.test(address)) {
    return { valid: false, error: 'Invalid characters' }
  }

  // Clean up zone ID and brackets
  const clean = address.split('%')[0].replace(/[[\]]/g, '')

  // Handle special cases first
  if (clean === '::') {
    return {
      valid: true,
      normalized: '0000:0000:0000:0000:0000:0000:0000:0000',
      isLoopback: true,
      isPrivate: true,
    }
  }
  if (clean === '::1') {
    return {
      valid: true,
      normalized: '0000:0000:0000:0000:0000:0000:0000:0001',
      isLoopback: true,
      isPrivate: true,
    }
  }

  // Quick structural validation
  const _parts = clean.split(':')
  const doubleColons = clean.match(/::/g)
  if (doubleColons && doubleColons.length > 1) {
    return { valid: false, error: 'Multiple :: not allowed' }
  }

  // Check for embedded IPv4
  let hasIPv4 = false
  let cleanIPv6 = clean
  if (/\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(clean)) {
    hasIPv4 = true
    const lastColon = clean.lastIndexOf(':')
    if (lastColon === -1) return { valid: false, error: 'Invalid IPv4 mapping' }
    cleanIPv6 = clean.substring(0, lastColon)
    // Handle special case for :: at the beginning
    if (cleanIPv6 === '') {
      cleanIPv6 = '::'
    }
    // Handle case where cleanIPv6 ends with colon due to ::
    if (cleanIPv6.endsWith(':') && !cleanIPv6.endsWith('::')) {
      cleanIPv6 += ':'
    }
  }

  // Handle compressed notation
  let expandedParts: string[] = []
  const ipv6Parts = cleanIPv6.split(':')

  if (cleanIPv6.includes('::')) {
    const beforeCompress = ipv6Parts.slice(0, ipv6Parts.indexOf(''))
    const afterCompress = ipv6Parts.slice(ipv6Parts.lastIndexOf('') + 1).filter((p) => p !== '')
    const expectedParts = hasIPv4 ? 6 : 8
    const missing = expectedParts - beforeCompress.length - afterCompress.length
    if (missing < 0) {
      return { valid: false, error: 'Too many parts' }
    }
    expandedParts = [...beforeCompress, ...Array(missing).fill('0'), ...afterCompress]
  } else {
    expandedParts = ipv6Parts
  }

  // Validate part count and format
  const expectedParts = hasIPv4 ? 6 : 8
  if (expandedParts.length !== expectedParts) {
    return { valid: false, error: 'Invalid part count' }
  }

  for (const part of expandedParts) {
    if (part.length > 4 || !/^[0-9a-fA-F]*$/.test(part)) {
      return { valid: false, error: 'Invalid hextet' }
    }
  }

  // Basic normalization (pad to handle IPv4 case)
  const normalized = hasIPv4
    ? expandedParts.map((p) => p.padStart(4, '0').toLowerCase()).join(':') +
      ':' +
      clean.match(/\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/)?.[0]
    : expandedParts.map((p) => p.padStart(4, '0').toLowerCase()).join(':')

  // Simple classification
  const first = parseInt(expandedParts[0] || '0', 16)
  let classification: Partial<IPv6ParseResult> = {}

  if (first >= 0xfe80 && first <= 0xfebf) {
    classification = { isLinkLocal: true, isPrivate: true }
  } else if (first >= 0xfc00 && first <= 0xfdff) {
    classification = { isUniqueLocal: true, isPrivate: true }
  } else if (expandedParts[0] === '2001' && expandedParts[1].toLowerCase() === 'db8') {
    classification = { isDocumentation: true, isPrivate: false }
  } else {
    classification = { isPrivate: false }
  }

  return {
    valid: true,
    normalized,
    ...classification,
  }
}

/**
 * Extract potential IPv6 addresses - optimized version
 */
export function extractIPv6Candidates(text: string): string[] {
  const patterns = [
    // Standard IPv6 - full format
    /(?:^|[^0-9a-fA-F:])([0-9a-fA-F]{1,4}:[0-9a-fA-F:]+)(?![0-9a-fA-F:])/g,
    // Compressed notation patterns
    /::[0-9a-fA-F:]*[0-9a-fA-F]/g,
    /[0-9a-fA-F][0-9a-fA-F:]*::/g,
    /::/g,
    // Bracketed IPv6
    /\[([0-9a-fA-F:]+)\]/g,
  ]

  const candidates = new Set<string>()

  for (const pattern of patterns) {
    let match: RegExpExecArray | null = pattern.exec(text)
    while (match !== null) {
      let candidate = match[1] || match[0]
      // Clean up boundary characters
      candidate = candidate.replace(/^[^0-9a-fA-F:]/, '').replace(/[[\]]/g, '')
      if (candidate.length > 1 && candidate.includes(':')) {
        candidates.add(candidate)
      }
      match = pattern.exec(text)
    }
  }

  return Array.from(candidates)
}

/**
 * Validate IPv6 candidates - simplified
 */
export function validateIPv6Candidates(candidates: string[]): Array<{
  original: string
  parsed: IPv6ParseResult
}> {
  return candidates
    .map((candidate) => ({ original: candidate, parsed: parseIPv6(candidate) }))
    .filter((result) => result.parsed.valid)
}
