// Validation utilities for US PII types

export type ValidationResult = {
  valid: boolean
  basic: boolean
  strict: boolean
  reason: string[]
  confidence?: number
  normalized?: string
}

/**
 * Validates US Social Security Number with basic and strict rules
 * @param input - Input string (may contain hyphens or spaces)
 * @returns Validation result with basic and strict validation levels
 */
export function validateSSN(input: string): ValidationResult {
  const digits = input.replace(/[^\d]/g, '')

  if (digits.length !== 9) {
    return {
      valid: false,
      basic: false,
      strict: false,
      reason: ['invalid_length'],
      confidence: 0.0,
    }
  }

  const area = digits.slice(0, 3)
  const group = digits.slice(3, 5)
  const serial = digits.slice(5, 9)
  const normalized = `${area}-${group}-${serial}`

  const reasons: string[] = []

  // Basic validation rules
  const isValidArea = area !== '000' && area !== '666' && Number(area) < 900
  const isValidGroup = group !== '00'
  const isValidSerial = serial !== '0000'
  const basicValid = isValidArea && isValidGroup && isValidSerial

  if (!basicValid) {
    if (!isValidArea) reasons.push('invalid_area')
    if (!isValidGroup) reasons.push('invalid_group')
    if (!isValidSerial) reasons.push('invalid_serial')
  } else {
    reasons.push('basic_rules_valid')
  }

  // Strict validation (additional checks)
  const isNotRepeating = !/^(\d)\1{8}$/.test(digits)
  const isNotSequential = !isSequentialPattern(digits)
  const strictValid = basicValid && isNotRepeating && isNotSequential

  if (basicValid && !strictValid) {
    if (!isNotRepeating) reasons.push('repeating_digits')
    if (!isNotSequential) reasons.push('sequential_pattern')
  } else if (strictValid) {
    reasons.push('strict_rules_valid')
  }

  // Calculate confidence
  const confidence = strictValid ? 0.9 : basicValid ? 0.75 : 0.3

  return {
    valid: basicValid,
    basic: basicValid,
    strict: strictValid,
    reason: reasons,
    confidence,
    normalized,
  }
}

/**
 * Check if digits form a sequential pattern (e.g., 123456789, 987654321)
 */
function isSequentialPattern(digits: string): boolean {
  let isAscending = true
  let isDescending = true

  // Early termination optimization
  for (let i = 1; i < digits.length && (isAscending || isDescending); i++) {
    const current = Number(digits[i])
    const previous = Number(digits[i - 1])

    if (current !== previous + 1) isAscending = false
    if (current !== previous - 1) isDescending = false
  }

  return isAscending || isDescending
}
