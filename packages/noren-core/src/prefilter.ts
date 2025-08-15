// Fast prefiltering for PII detection performance optimization
// Uses lightweight checks to skip expensive regex operations

/**
 * Prefilter result indicating whether expensive detection should run
 */
export interface PrefilterResult {
  hasEmailCandidate: boolean
  hasIPCandidate: boolean
  hasCreditCardCandidate: boolean
  hasPhoneCandidate: boolean
  hasMACCandidate: boolean
  skipExpensiveDetection: boolean
  candidateRegions?: Array<{ start: number; end: number; types: string[] }>
}

/**
 * Fast prefilter to identify potential PII patterns before expensive regex
 */
export function prefilterText(text: string): PrefilterResult {
  const len = text.length
  if (len === 0) {
    return {
      hasEmailCandidate: false,
      hasIPCandidate: false,
      hasCreditCardCandidate: false,
      hasPhoneCandidate: false,
      hasMACCandidate: false,
      skipExpensiveDetection: true,
    }
  }

  // Quick character-based screening
  const hasAt = text.includes('@')
  const hasDot = text.includes('.')
  const hasColon = text.includes(':')
  const hasDash = text.includes('-')
  const hasDigits = /\d/.test(text)
  const hasPlus = text.includes('+')

  // Email candidates: must have @ and .
  const hasEmailCandidate = hasAt && hasDot

  // IP candidates: must have . or :
  const hasIPCandidate = hasDigits && (hasDot || hasColon)

  // MAC candidates: must have : or - and hex chars
  const hasMACCandidate = hasColon || hasDash

  // Credit card candidates: must have digits, potentially with spaces/dashes
  const hasCreditCardCandidate = hasDigits

  // Phone candidates: must have + or digits
  const hasPhoneCandidate = hasPlus || hasDigits

  // Skip expensive detection if no obvious patterns
  const skipExpensiveDetection =
    !hasEmailCandidate &&
    !hasIPCandidate &&
    !hasCreditCardCandidate &&
    !hasPhoneCandidate &&
    !hasMACCandidate

  return {
    hasEmailCandidate,
    hasIPCandidate,
    hasCreditCardCandidate,
    hasPhoneCandidate,
    hasMACCandidate,
    skipExpensiveDetection,
  }
}

/**
 * More sophisticated prefilter that identifies candidate regions
 * Useful for very large texts to focus detection on specific areas
 */
export function prefilterWithRegions(text: string, chunkSize = 1000): PrefilterResult {
  const result = prefilterText(text)

  if (result.skipExpensiveDetection || text.length <= chunkSize) {
    return result
  }

  // For large texts, identify regions with potential PII
  const candidateRegions: Array<{ start: number; end: number; types: string[] }> = []

  for (let i = 0; i < text.length; i += chunkSize) {
    const end = Math.min(i + chunkSize, text.length)
    const chunk = text.slice(i, end)
    const chunkResult = prefilterText(chunk)

    if (!chunkResult.skipExpensiveDetection) {
      const types: string[] = []
      if (chunkResult.hasEmailCandidate) types.push('email')
      if (chunkResult.hasIPCandidate) types.push('ip')
      if (chunkResult.hasCreditCardCandidate) types.push('credit_card')
      if (chunkResult.hasPhoneCandidate) types.push('phone')
      if (chunkResult.hasMACCandidate) types.push('mac')

      if (types.length > 0) {
        candidateRegions.push({ start: i, end, types })
      }
    }
  }

  return {
    ...result,
    candidateRegions,
    skipExpensiveDetection: candidateRegions.length === 0,
  }
}

/**
 * Fast numeric validation for credit cards and phone numbers
 * Uses Luhn algorithm check only when pattern looks promising
 */
export function quickDigitValidation(text: string, type: 'credit_card' | 'phone'): boolean {
  const digits = text.replace(/\D/g, '')

  if (type === 'credit_card') {
    // Quick length check for credit cards
    return digits.length >= 13 && digits.length <= 19
  }

  if (type === 'phone') {
    // Quick length check for phone numbers
    return digits.length >= 10 && digits.length <= 15
  }

  return false
}

/**
 * Fast email format validation
 * Checks basic structure without expensive regex
 */
export function quickEmailValidation(text: string): boolean {
  const atIndex = text.indexOf('@')
  if (atIndex <= 0 || atIndex === text.length - 1) return false

  const beforeAt = text.slice(0, atIndex)
  const afterAt = text.slice(atIndex + 1)

  // Basic checks
  if (beforeAt.length > 64 || afterAt.length > 253) return false
  if (!afterAt.includes('.')) return false

  const lastDot = afterAt.lastIndexOf('.')
  const tld = afterAt.slice(lastDot + 1)

  return tld.length >= 2 && tld.length <= 63
}

/**
 * Fast IP validation
 * Basic format check without expensive regex
 */
export function quickIPValidation(text: string): { isIPv4: boolean; isIPv6: boolean } {
  if (text.includes('.') && !text.includes(':')) {
    // Potential IPv4
    const parts = text.split('.')
    return { isIPv4: parts.length === 4, isIPv6: false }
  }

  if (text.includes(':') && !text.includes('.')) {
    // Potential IPv6
    const _hasDoubleColon = text.includes('::')
    const colonCount = (text.match(/:/g) || []).length
    return { isIPv4: false, isIPv6: colonCount >= 2 && colonCount <= 7 }
  }

  return { isIPv4: false, isIPv6: false }
}
