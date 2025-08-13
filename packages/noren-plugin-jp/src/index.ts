import type { Detector, DetectUtils, Masker } from '@himorishige/noren-core'
import { validateMyNumber } from './validators'

// Pre-compiled regex patterns for JP detectors
const JP_PATTERNS = {
  postal: /\b\d{3}-?\d{4}\b/g,
  cellPhone: /\b0(?:60|70|80|90)-?\d{4}-?\d{4}\b/g,
  landlinePhone: /\b0[1-9]\d?-?\d{3,4}-?\d{4}\b/g,
  internationalPhone: /\+81-?\d{1,4}-?\d{1,4}-?\d{3,4}\b/g,
  myNumber: /\b\d{12}\b/g,
}

// Context hints as constants for better performance
const JP_CONTEXTS = {
  postal: ['〒', '住所', 'Address', 'Zip'],
  phone: ['TEL', '電話', 'Phone'],
  myNumber: ['マイナンバー', '個人番号'],
}

export const detectors: Detector[] = [
  {
    id: 'jp.postal',
    match: ({ src, push, hasCtx }: DetectUtils) => {
      const hasContext = hasCtx(JP_CONTEXTS.postal)

      for (const m of src.matchAll(JP_PATTERNS.postal)) {
        // 文脈なしでも低信頼度で検出（PRレビュー指摘事項対応）
        const confidence = hasContext ? 0.75 : 0.4

        // 文脈なしの場合は信頼度閾値でフィルタリング可能にする
        if (!hasContext && confidence < 0.4) continue

        push({
          type: 'jp_postal',
          start: m.index,
          end: m.index + m[0].length,
          value: m[0],
          risk: 'low',
          confidence,
          reasons: ['postal_pattern_match', hasContext ? 'context_match' : 'no_context'],
          features: {
            hasContext,
            normalized: m[0].replace(/[^\d]/g, '').replace(/(\d{3})(\d{4})/, '$1-$2'),
          },
        })
      }
    },
  },
  {
    id: 'jp.phone',
    match: ({ src, push, hasCtx }: DetectUtils) => {
      const hasContext = hasCtx(JP_CONTEXTS.phone)

      // Cell phone detection
      for (const m of src.matchAll(JP_PATTERNS.cellPhone)) {
        const confidence = 0.8 // Cell phones are fairly reliable
        push({
          type: 'phone_jp',
          start: m.index,
          end: m.index + m[0].length,
          value: m[0],
          risk: 'medium',
          confidence,
          reasons: ['cell_phone_pattern', hasContext ? 'context_match' : 'no_context'],
          features: {
            phoneType: 'cellular',
            hasContext,
            normalized: m[0].replace(/[^\d]/g, '').replace(/(\d{3})(\d{4})(\d{4})/, '$1-$2-$3'),
          },
        })
      }

      // Landline phone detection
      for (const m of src.matchAll(JP_PATTERNS.landlinePhone)) {
        const confidence = hasContext ? 0.7 : 0.5
        push({
          type: 'phone_jp',
          start: m.index,
          end: m.index + m[0].length,
          value: m[0],
          risk: 'low',
          confidence,
          reasons: ['landline_pattern', hasContext ? 'context_match' : 'no_context'],
          features: {
            phoneType: 'landline',
            hasContext,
            normalized: m[0].replace(/[^\d]/g, '').replace(/(\d{2,4})(\d{3,4})(\d{4})/, '$1-$2-$3'),
          },
        })
      }

      // International phone with context check
      if (hasContext) {
        for (const m of src.matchAll(JP_PATTERNS.internationalPhone)) {
          push({
            type: 'phone_jp',
            start: m.index,
            end: m.index + m[0].length,
            value: m[0],
            risk: 'medium',
            confidence: 0.85,
            reasons: ['international_pattern', 'context_match'],
            features: {
              phoneType: 'international',
              hasContext: true,
              normalized: m[0].replace(/[^\d+]/g, ''),
            },
          })
        }
      }
    },
  },
  {
    id: 'jp.mynumber',
    priority: -10,
    match: ({ src, push, hasCtx }: DetectUtils) => {
      const hasContext = hasCtx(JP_CONTEXTS.myNumber)
      if (!hasContext) return

      for (const m of src.matchAll(JP_PATTERNS.myNumber)) {
        const validation = validateMyNumber(m[0])

        // Only push if basic format is valid or context is strong
        if (validation.valid || hasContext) {
          push({
            type: 'jp_my_number',
            start: m.index,
            end: m.index + m[0].length,
            value: m[0],
            risk: 'high',
            confidence: validation.confidence || (hasContext ? 0.6 : 0.3),
            reasons: [
              'mynumber_pattern',
              validation.reason,
              hasContext ? 'context_match' : 'no_context',
            ],
            features: {
              checksumValid: validation.valid,
              hasContext,
              normalized: validation.normalized || m[0],
              validationReason: validation.reason,
            },
          })
        }
      }
    },
  },
]

export const maskers: Record<string, Masker> = {
  jp_postal: () => '•••-••••',
  phone_jp: (h) => h.value.replace(/\d/g, '•'),
  jp_my_number: () => '[REDACTED:MYNUMBER]',
}
