// Validation utilities for Japanese PII types

export type ValidationResult = {
  valid: boolean
  reason: string
  confidence?: number
  normalized?: string
}

/**
 * Validates Japanese My Number (マイナンバー) with checksum verification
 * @param input - Input string (may contain hyphens or spaces)
 * @returns Validation result with checksum verification
 */
export function validateMyNumber(input: string): ValidationResult {
  // Extract only digits
  const digits = input.replace(/[^\d]/g, '')

  if (digits.length !== 12) {
    return { valid: false, reason: 'invalid_length' }
  }

  // Check if all digits are the same (obviously invalid)
  if (/^(\d)\1{11}$/.test(digits)) {
    return { valid: false, reason: 'repeating_digits' }
  }

  // Extract first 11 digits and check digit
  const base = digits.slice(0, 11)
  const checkDigit = Number(digits[11])

  // Calculate checksum using official algorithm
  // Weights: [6,5,4,3,2,7,6,5,4,3,2] applied from left to right
  const weights = [6, 5, 4, 3, 2, 7, 6, 5, 4, 3, 2]
  let sum = 0

  for (let i = 0; i < 11; i++) {
    sum += Number(base[i]) * weights[i]
  }

  const remainder = sum % 11
  const calculatedCheck = remainder <= 1 ? 0 : 11 - remainder

  const isValid = calculatedCheck === checkDigit

  return {
    valid: isValid,
    reason: isValid ? 'checksum_valid' : 'checksum_invalid',
    confidence: isValid ? 0.95 : 0.3,
    normalized: `${digits.slice(0, 4)}-${digits.slice(4, 8)}-${digits.slice(8)}`,
  }
}
