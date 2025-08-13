import { describe, expect, it } from 'vitest'
import { validateSSN } from '../src/validators'

describe('validateSSN', () => {
  it('validates correct SSN with basic and strict rules', () => {
    // Use a non-sequential SSN
    const result = validateSSN('456-78-9123')
    expect(result.valid).toBe(true)
    expect(result.basic).toBe(true)
    expect(result.strict).toBe(true)
    expect(result.confidence).toBe(0.9)
    expect(result.normalized).toBe('456-78-9123')
    expect(result.reason).toContain('basic_rules_valid')
    expect(result.reason).toContain('strict_rules_valid')
  })

  it('validates SSN without hyphens', () => {
    const result = validateSSN('456789123')
    expect(result.valid).toBe(true)
    expect(result.basic).toBe(true)
    expect(result.strict).toBe(true)
    expect(result.normalized).toBe('456-78-9123')
  })

  it('validates SSN with spaces', () => {
    const result = validateSSN('456 78 9123')
    expect(result.valid).toBe(true)
    expect(result.basic).toBe(true)
    expect(result.strict).toBe(true)
    expect(result.normalized).toBe('456-78-9123')
  })

  it('rejects SSN with invalid area code 000', () => {
    const result = validateSSN('000-45-6789')
    expect(result.valid).toBe(false)
    expect(result.basic).toBe(false)
    expect(result.strict).toBe(false)
    expect(result.confidence).toBe(0.3)
    expect(result.reason).toContain('invalid_area')
  })

  it('rejects SSN with invalid area code 666', () => {
    const result = validateSSN('666-45-6789')
    expect(result.valid).toBe(false)
    expect(result.basic).toBe(false)
    expect(result.strict).toBe(false)
    expect(result.reason).toContain('invalid_area')
  })

  it('rejects SSN with invalid area code 900+', () => {
    const result = validateSSN('900-45-6789')
    expect(result.valid).toBe(false)
    expect(result.basic).toBe(false)
    expect(result.strict).toBe(false)
    expect(result.reason).toContain('invalid_area')
  })

  it('rejects SSN with invalid group 00', () => {
    const result = validateSSN('123-00-6789')
    expect(result.valid).toBe(false)
    expect(result.basic).toBe(false)
    expect(result.strict).toBe(false)
    expect(result.reason).toContain('invalid_group')
  })

  it('rejects SSN with invalid serial 0000', () => {
    const result = validateSSN('123-45-0000')
    expect(result.valid).toBe(false)
    expect(result.basic).toBe(false)
    expect(result.strict).toBe(false)
    expect(result.reason).toContain('invalid_serial')
  })

  it('rejects SSN with all same digits (repeating)', () => {
    const result = validateSSN('111-11-1111')
    expect(result.valid).toBe(true) // Area 111 is valid, passes basic
    expect(result.basic).toBe(true)
    expect(result.strict).toBe(false) // Fails strict due to repeating
    expect(result.confidence).toBe(0.75) // Basic only
    expect(result.reason).toContain('repeating_digits')
  })

  it('handles SSN that passes basic but fails strict (repeating digits)', () => {
    const result = validateSSN('222-22-2222')
    expect(result.valid).toBe(true) // Basic rules pass
    expect(result.basic).toBe(true)
    expect(result.strict).toBe(false) // Strict fails due to repeating
    expect(result.confidence).toBe(0.75) // Basic confidence
    expect(result.reason).toContain('basic_rules_valid')
    expect(result.reason).toContain('repeating_digits')
  })

  it('rejects SSN with sequential pattern (ascending)', () => {
    const result = validateSSN('123-45-6789')
    expect(result.valid).toBe(true)
    expect(result.basic).toBe(true)
    // Note: 123456789 is sequential, so strict should fail
    expect(result.strict).toBe(false)
    expect(result.confidence).toBe(0.75)
    expect(result.reason).toContain('sequential_pattern')
  })

  it('rejects SSN with sequential pattern (descending)', () => {
    // Use valid area code but sequential pattern
    const result = validateSSN('876-54-3210')
    expect(result.valid).toBe(true) // Passes basic validation
    expect(result.basic).toBe(true)
    expect(result.strict).toBe(false) // Fails strict due to sequential
    expect(result.confidence).toBe(0.75)
    expect(result.reason).toContain('basic_rules_valid')
    expect(result.reason).toContain('sequential_pattern')
  })

  it('rejects SSN with invalid length', () => {
    const result = validateSSN('123-45-67890')
    expect(result.valid).toBe(false)
    expect(result.basic).toBe(false)
    expect(result.strict).toBe(false)
    expect(result.confidence).toBe(0.0)
    expect(result.reason).toContain('invalid_length')
  })

  it('validates SSN that passes both basic and strict rules', () => {
    // Non-sequential, non-repeating, valid area/group/serial
    const result = validateSSN('234-56-7891')
    expect(result.valid).toBe(true)
    expect(result.basic).toBe(true)
    expect(result.strict).toBe(true)
    expect(result.confidence).toBe(0.9)
    expect(result.reason).toContain('basic_rules_valid')
    expect(result.reason).toContain('strict_rules_valid')
  })

  it('handles edge case with area code 899', () => {
    const result = validateSSN('899-45-6789')
    expect(result.valid).toBe(true) // Below 900
    expect(result.basic).toBe(true)
    expect(result.normalized).toBe('899-45-6789')
  })

  it('should handle mixed format validation', () => {
    // PRレビュー指摘事項対応: 混在フォーマットテストケース追加
    const result = validateSSN('456 78-9123')
    expect(result.valid).toBe(true)
    expect(result.basic).toBe(true)
    expect(result.strict).toBe(true)
    expect(result.confidence).toBe(0.9)
    expect(result.normalized).toBe('456-78-9123')
  })

  it('should handle various separator formats', () => {
    // 様々な区切り文字形式のテスト
    const testCases = [
      '456-78-9123', // ハイフン
      '456 78 9123', // スペース
      '456.78.9123', // ドット
      '456_78_9123', // アンダースコア
      '456789123', // 区切りなし
    ]

    testCases.forEach((input) => {
      const result = validateSSN(input)
      expect(result.valid).toBe(true)
      expect(result.basic).toBe(true)
      expect(result.strict).toBe(true)
      expect(result.confidence).toBe(0.9)
      expect(result.normalized).toBe('456-78-9123')
    })
  })
})
