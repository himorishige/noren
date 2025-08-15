import { describe, expect, it } from 'vitest'
import { NORMALIZED_TEST_CREDIT_CARDS } from '../src/constants.js'
import { luhn } from '../src/utils.js'
import { type ValidationContext, validateCandidate } from '../src/validators.js'

describe('Validation Debug', () => {
  it('should debug credit card validation step by step', () => {
    const validVisa = '4532015112830366'
    const context: ValidationContext = {
      surroundingText: 'Please enter your credit card number: 4532015112830366',
      strictness: 'balanced',
      originalIndex: 0,
    }

    console.log('\n🔍 Debugging validation for:', validVisa)

    // Step-by-step validation
    const digits = validVisa.replace(/[\s-]/g, '')
    console.log('1. Digits extracted:', digits)
    console.log(
      '2. Length:',
      digits.length,
      '(valid:',
      digits.length >= 13 && digits.length <= 19,
      ')',
    )

    // Luhn check
    const luhnResult = luhn(digits)
    console.log('3. Luhn check:', luhnResult)

    // Test number check
    const isTestNumber = NORMALIZED_TEST_CREDIT_CARDS.has(digits)
    console.log('4. Is test number:', isTestNumber)

    // Brand check
    const visaPattern = /^4/
    const isVisa = visaPattern.test(digits)
    const validLength = [13, 16, 19].includes(digits.length)
    console.log('5. Brand check: Visa=', isVisa, ', Valid length=', validLength)

    // Repeated digits check
    const repeatedPattern = /(\d)\1{3,}/
    const hasRepeated = repeatedPattern.test(digits)
    console.log('6. Repeated digits:', hasRepeated)

    // Sequential check
    const sequential = /(?:0123|1234|2345|3456|4567|5678|6789|9876|8765|7654|6543|5432|4321|3210)/
    const hasSequential = sequential.test(digits)
    console.log('7. Sequential digits:', hasSequential)

    // Bare digits check
    const hasNoSeparators = !/[\s-]/.test(validVisa)
    console.log('8. Has no separators (bare):', hasNoSeparators)

    console.log('\n🧪 Running actual validation...')
    const result = validateCandidate(validVisa, 'credit_card', context)
    console.log('Result:', result)

    // The test should pass - this is diagnostic
    expect(luhnResult).toBe(true)
    expect(isTestNumber).toBe(false)
    expect(isVisa).toBe(true)
    expect(validLength).toBe(true)
  })

  it('should debug IPv4 validation', () => {
    const validIP = '192.168.1.100'
    const context: ValidationContext = {
      surroundingText: 'Server IP: 192.168.1.100 is responding',
      strictness: 'balanced',
      originalIndex: 0,
    }

    console.log('\n🔍 Debugging IPv4 validation for:', validIP)

    const result = validateCandidate(validIP, 'ipv4', context)
    console.log('Result:', result)

    // Check if it's in private network
    const octets = validIP.split('.').map(Number)
    const [a, b] = octets
    const isPrivate = a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168)
    console.log('Is private network:', isPrivate)
  })

  it('should debug phone validation', () => {
    const validPhone = '+15551234567'
    const context: ValidationContext = {
      surroundingText: 'Contact phone: +15551234567',
      strictness: 'balanced',
      originalIndex: 0,
    }

    console.log('\n🔍 Debugging phone validation for:', validPhone)

    const digits = validPhone.replace(/\D/g, '')
    console.log('Digits:', digits)
    console.log('Starts with +:', validPhone.startsWith('+'))
    console.log('Length:', digits.length)
    console.log('Starts with 0:', digits.startsWith('0'))

    const result = validateCandidate(validPhone, 'phone_e164', context)
    console.log('Result:', result)
  })
})
