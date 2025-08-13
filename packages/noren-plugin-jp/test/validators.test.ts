import { describe, expect, it } from 'vitest'
import { validateMyNumber } from '../src/validators'

describe('validateMyNumber', () => {
  it('validates correct My Number with proper checksum', () => {
    // Valid My Number: 123456789018 (checksum = 8)
    const result = validateMyNumber('123456789018')
    expect(result.valid).toBe(true)
    expect(result.reason).toBe('checksum_valid')
    expect(result.confidence).toBe(0.95)
    expect(result.normalized).toBe('1234-5678-9018')
  })

  it('validates My Number with hyphens', () => {
    const result = validateMyNumber('1234-5678-9018')
    expect(result.valid).toBe(true)
    expect(result.reason).toBe('checksum_valid')
    expect(result.normalized).toBe('1234-5678-9018')
  })

  it('validates My Number with spaces', () => {
    const result = validateMyNumber('1234 5678 9018')
    expect(result.valid).toBe(true)
    expect(result.reason).toBe('checksum_valid')
    expect(result.normalized).toBe('1234-5678-9018')
  })

  it('rejects My Number with invalid checksum', () => {
    // Invalid checksum (should be 8, but using 9)
    const result = validateMyNumber('123456789019')
    expect(result.valid).toBe(false)
    expect(result.reason).toBe('checksum_invalid')
    expect(result.confidence).toBe(0.3)
  })

  it('rejects My Number with wrong length', () => {
    const result = validateMyNumber('12345678901')
    expect(result.valid).toBe(false)
    expect(result.reason).toBe('invalid_length')
  })

  it('rejects My Number with all same digits', () => {
    const result = validateMyNumber('111111111111')
    expect(result.valid).toBe(false)
    expect(result.reason).toBe('repeating_digits')
  })

  it('validates another correct My Number', () => {
    // Let's calculate a correct one: 876543210987
    // Using weights [6,5,4,3,2,7,6,5,4,3,2] for digits [8,7,6,5,4,3,2,1,0,9,8]
    // Sum = 8*6 + 7*5 + 6*4 + 5*3 + 4*2 + 3*7 + 2*6 + 1*5 + 0*4 + 9*3 + 8*2
    //     = 48 + 35 + 24 + 15 + 8 + 21 + 12 + 5 + 0 + 27 + 16 = 211
    // 211 % 11 = 2, so checksum = 11 - 2 = 9
    const result = validateMyNumber('876543210989')
    expect(result.valid).toBe(true)
    expect(result.reason).toBe('checksum_valid')
    expect(result.confidence).toBe(0.95)
    expect(result.normalized).toBe('8765-4321-0989')
  })

  it('handles edge case with repeating digits', () => {
    // My Number with all same digits should be rejected
    const result = validateMyNumber('111111111111')
    expect(result.valid).toBe(false) // This should fail due to repeating digits check
    expect(result.reason).toBe('repeating_digits')
  })

  it('validates My Number with non-repeating digits and checksum calculation', () => {
    // Create a valid case - using the example we already know works
    // Using weights [6,5,4,3,2,7,6,5,4,3,2] for digits [1,2,3,4,5,6,7,8,9,0,1,8]
    // Sum = 1*6 + 2*5 + 3*4 + 4*3 + 5*2 + 6*7 + 7*6 + 8*5 + 9*4 + 0*3 + 1*2
    //     = 6 + 10 + 12 + 12 + 10 + 42 + 42 + 40 + 36 + 0 + 2 = 212
    // 212 % 11 = 3, so checksum = 11 - 3 = 8
    const result = validateMyNumber('123456789018')
    expect(result.valid).toBe(true)
    expect(result.reason).toBe('checksum_valid')
  })
})
