import type { DetectUtils, Hit } from '@himorishige/noren-core'
import { detectors } from '@himorishige/noren-plugin-jp'
import { describe, expect, it } from 'vitest'

function runDetect(src: string, ctxHints: string[] = []): Hit[] {
  const hits: Hit[] = []
  const u: DetectUtils = {
    src,
    hasCtx: (ws?: string[]) =>
      (ws ?? ctxHints).some((w) => src.toLowerCase().includes(w.toLowerCase())),
    push: (h: Hit) => hits.push(h),
    canPush: () => true,
  }
  for (const d of detectors) void d.match(u)
  return hits
}

describe('Japanese boundary detection improvements', () => {
  it('should detect postal codes with Japanese context properly', () => {
    // 正常検出
    const validCases = [
      { text: '住所: 〒123-4567', expected: true, desc: 'Normal postal with context' },
      { text: '郵便番号：123-4567です', expected: true, desc: 'Postal number with Japanese colon' },
      { text: 'ZIP code: 123-4567', expected: true, desc: 'English context hint' },
    ]

    for (const { text, expected, desc } of validCases) {
      const hits = runDetect(text)
      const hasPostal = hits.some((h) => h.type === 'postal_jp')
      expect(hasPostal, `${desc}: "${text}"`).toBe(expected)
    }
  })

  it('should not detect false postal codes in numeric sequences', () => {
    // 境界検出による偽陽性排除テスト
    const falseCases = [
      { text: '電話番号: 0312345678', expected: false, desc: 'Phone number sequence' },
      { text: 'ID: 12345678901234', expected: false, desc: 'Long numeric ID' },
      { text: 'Amount: ¥1234567', expected: false, desc: 'Currency amount' },
      { text: '時間: 12:34:56.789', expected: false, desc: 'Timestamp with milliseconds' },
    ]

    for (const { text, expected, desc } of falseCases) {
      const hits = runDetect(text)
      const hasPostal = hits.some((h) => h.type === 'postal_jp')
      expect(hasPostal, `${desc}: "${text}"`).toBe(expected)
    }
  })

  it('should handle international phone numbers correctly', () => {
    // +81プレフィックス付き国際電話の単独検出テスト
    const internationalCases = [
      { text: '+81-90-1234-5678', expected: true, desc: 'International mobile with +81' },
      { text: '+81 3 1234 5678', expected: true, desc: 'International landline with spaces' },
      {
        text: 'Call +81-90-1111-2222 for support',
        expected: true,
        desc: 'International in sentence',
      },
      {
        text: '連絡先: +81-80-9999-8888',
        expected: true,
        desc: 'International with Japanese context',
      },
    ]

    for (const { text, expected, desc } of internationalCases) {
      const hits = runDetect(text)
      const hasPhone = hits.some((h) => h.type === 'phone_jp')
      expect(hasPhone, `${desc}: "${text}"`).toBe(expected)

      // +81付きは高い信頼度を持つべき
      const phoneHit = hits.find((h) => h.type === 'phone_jp')
      if (phoneHit && text.includes('+81')) {
        expect(phoneHit.confidence, `${desc} confidence`).toBeGreaterThanOrEqual(0.9)
      }
    }
  })

  it('should respect Japanese character boundaries', () => {
    // 日本語文字境界テスト（全角数字との混合）
    const boundaryCases = [
      {
        text: '住所：１２３-４５６７',
        expected: false,
        desc: 'Full-width numbers should not match',
      },
      { text: '郵便123-4567番地', expected: true, desc: 'Half-width postal in Japanese text' },
      {
        text: 'Tel: ０９０-１２３４-５６７８',
        expected: false,
        desc: 'Full-width phone should not match',
      },
      {
        text: '電話: 090-1234-5678',
        expected: true,
        desc: 'Half-width phone with Japanese context',
      },
    ]

    for (const { text, expected, desc } of boundaryCases) {
      const hits = runDetect(text)
      const hasPII = hits.length > 0
      expect(hasPII, `${desc}: "${text}"`).toBe(expected)
    }
  })

  it('should validate My Number boundary detection', () => {
    // マイナンバーの境界検出テスト
    const myNumberCases = [
      { text: 'マイナンバー: 123456789012', expected: true, desc: 'Valid My Number with context' },
      { text: 'ID: 1234567890123456', expected: false, desc: 'Longer number should not match' },
      { text: '個人番号123456789012です', expected: true, desc: 'My Number without separator' },
      { text: 'Code: ABC123456789012XYZ', expected: false, desc: 'Alphanumeric sequence' },
    ]

    for (const { text, expected, desc } of myNumberCases) {
      const hits = runDetect(text)
      const hasMyNumber = hits.some((h) => h.type === 'mynumber_jp')
      expect(hasMyNumber, `${desc}: "${text}"`).toBe(expected)
    }
  })

  it('should handle edge cases with mixed contexts', () => {
    // 複合的なエッジケース
    const edgeCases = [
      {
        text: '住所: 〒123-4567 電話: 03-1234-5678 マイナンバー: 123456789012',
        expectedTypes: ['postal_jp', 'phone_jp', 'mynumber_jp'],
        desc: 'Multiple PII types in one text',
      },
      {
        text: 'Contact info: +81-90-1234-5678 ZIP: 123-4567',
        expectedTypes: ['phone_jp', 'postal_jp'],
        desc: 'International phone with postal',
      },
    ]

    for (const { text, expectedTypes, desc } of edgeCases) {
      const hits = runDetect(text)
      const detectedTypes = hits.map((h) => h.type)

      for (const expectedType of expectedTypes) {
        expect(detectedTypes, `${desc} - missing ${expectedType}`).toContain(expectedType)
      }
    }
  })
})
