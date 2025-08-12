/**
 * IPv6 address parser and validator
 * Handles compressed notation, embedded IPv4, and zone IDs
 */

/**
 * Result of IPv6 parsing
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
 * Parse and validate IPv6 address
 */
export function parseIPv6(address: string): IPv6ParseResult {
  try {
    // Remove zone ID if present (e.g., %eth0)
    const cleanAddress = address.split('%')[0]
    
    // Quick validation of allowed characters
    if (!/^[0-9a-fA-F:.\[\]]+$/.test(cleanAddress)) {
      return { valid: false, error: 'Invalid characters in IPv6 address' }
    }
    
    // Remove brackets if present (from URLs)
    const addr = cleanAddress.replace(/^\[/, '').replace(/\]$/, '')
    
    // Check for embedded IPv4 (e.g., ::ffff:192.168.1.1)
    const ipv4Match = addr.match(/:((?:\d{1,3}\.){3}\d{1,3})$/)
    let ipv6Part = addr
    let hasIPv4 = false
    
    if (ipv4Match) {
      hasIPv4 = true
      ipv6Part = addr.substring(0, addr.lastIndexOf(':'))
      
      // Validate IPv4 part
      const ipv4Parts = ipv4Match[1].split('.').map(Number)
      if (ipv4Parts.length !== 4 || ipv4Parts.some(p => p > 255 || p < 0)) {
        return { valid: false, error: 'Invalid embedded IPv4 address' }
      }
    }
    
    // Handle compressed notation (::)
    const parts = ipv6Part.split(':')
    const doubleColonIndex = parts.indexOf('')
    
    // Count empty parts (from ::)
    const emptyParts = parts.filter(p => p === '').length
    
    // Expand compressed notation
    let expandedParts: string[] = []
    
    // Validation rules
    if (doubleColonIndex !== -1) {
      // Special case for :: (all zeros)
      if (addr === '::') {
        // This is valid - represents all zeros
        expandedParts = Array(8).fill('0')
      } else if (emptyParts > 2 || (emptyParts === 2 && parts[0] !== '' && parts[parts.length - 1] !== '')) {
        // :: can only appear once
        return { valid: false, error: 'Invalid use of :: compression' }
      }
    }
    
    if (doubleColonIndex !== -1 && addr !== '::') {
      const beforeCompress = parts.slice(0, doubleColonIndex).filter(p => p !== '')
      const afterCompress = parts.slice(doubleColonIndex + 1).filter(p => p !== '')
      const missingParts = (hasIPv4 ? 6 : 8) - beforeCompress.length - afterCompress.length
      
      if (missingParts < 0) {
        return { valid: false, error: 'Too many parts in IPv6 address' }
      }
      
      expandedParts = [
        ...beforeCompress,
        ...Array(missingParts).fill('0'),
        ...afterCompress
      ]
    } else if (addr !== '::') {
      expandedParts = parts
    }
    
    // Validate parts
    const expectedParts = hasIPv4 ? 6 : 8
    if (expandedParts.length !== expectedParts) {
      return { valid: false, error: `Expected ${expectedParts} parts, got ${expandedParts.length}` }
    }
    
    // Validate each hextet
    for (const part of expandedParts) {
      if (part.length > 4) {
        return { valid: false, error: 'Hextet too long' }
      }
      if (!/^[0-9a-fA-F]*$/.test(part)) {
        return { valid: false, error: 'Invalid hexadecimal in hextet' }
      }
    }
    
    // Normalize address (canonical form)
    const normalized = expandedParts.map(p => p.padStart(4, '0').toLowerCase()).join(':')
    const fullNormalized = hasIPv4 ? `${normalized}:${ipv4Match![1]}` : normalized
    
    // Classify the address
    const classification = classifyIPv6(expandedParts)
    
    return {
      valid: true,
      normalized: fullNormalized,
      ...classification
    }
  } catch (error) {
    return {
      valid: false,
      error: error instanceof Error ? error.message : 'Unknown parsing error'
    }
  }
}

/**
 * Classify IPv6 address type based on prefix
 */
function classifyIPv6(parts: string[]): Partial<IPv6ParseResult> {
  const first = parseInt(parts[0] || '0', 16)
  
  // Loopback (::1)
  const normalized = parts.join(':')
  if (normalized === '0000:0000:0000:0000:0000:0000:0000:0001' || 
      normalized === '0:0:0:0:0:0:0:1') {
    return { isLoopback: true, isPrivate: true }
  }
  
  // Unspecified (::)
  if (parts.every(p => p === '0' || p === '')) {
    return { isLoopback: true, isPrivate: true }
  }
  
  // Link-local (fe80::/10)
  if (first >= 0xfe80 && first <= 0xfebf) {
    return { isLinkLocal: true, isPrivate: true }
  }
  
  // Unique local (fc00::/7)
  if (first >= 0xfc00 && first <= 0xfdff) {
    return { isUniqueLocal: true, isPrivate: true }
  }
  
  // Documentation (2001:db8::/32)
  if (parts[0] === '2001' && parts[1] === 'db8') {
    return { isDocumentation: true, isPrivate: false }
  }
  
  // Multicast (ff00::/8)
  if (first >= 0xff00 && first <= 0xffff) {
    return { isPrivate: false } // Multicast is not private
  }
  
  // Global unicast (everything else)
  return { isPrivate: false }
}

/**
 * Extract potential IPv6 addresses from text using a simple pattern
 * This is the "coarse" extraction phase before strict parsing
 */
export function extractIPv6Candidates(text: string): string[] {
  // Coarse pattern to find potential IPv6 addresses
  // Matches sequences that look like they could be IPv6
  const patterns = [
    // Standard IPv6 patterns
    /\b(?:[0-9a-fA-F]{0,4}:){2,7}[0-9a-fA-F]{0,4}\b/g,
    // Compressed notation starting with ::
    /\b::[0-9a-fA-F:]*[0-9a-fA-F]\b/g,
    // Compressed notation ending with ::
    /\b[0-9a-fA-F][0-9a-fA-F:]*::\b/g,
    // Special case for just ::
    /\b::\b/g,
    // Special case for ::1
    /\b::1\b/g,
  ]
  
  const candidates = new Set<string>()
  
  for (const pattern of patterns) {
    let match: RegExpExecArray | null
    pattern.lastIndex = 0
    while ((match = pattern.exec(text)) !== null) {
      candidates.add(match[0])
    }
  }
  
  // Also check for bracketed IPv6 (from URLs)
  const bracketPattern = /\[([0-9a-fA-F:]+)\]/g
  let match: RegExpExecArray | null
  while ((match = bracketPattern.exec(text)) !== null) {
    candidates.add(match[1])
  }
  
  return Array.from(candidates)
}

/**
 * Validate and filter IPv6 candidates
 */
export function validateIPv6Candidates(candidates: string[]): Array<{
  original: string
  parsed: IPv6ParseResult
}> {
  const results: Array<{ original: string; parsed: IPv6ParseResult }> = []
  
  for (const candidate of candidates) {
    const parsed = parseIPv6(candidate)
    if (parsed.valid) {
      results.push({ original: candidate, parsed })
    }
  }
  
  return results
}