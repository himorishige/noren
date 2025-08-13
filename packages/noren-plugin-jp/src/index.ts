import type { Detector, DetectUtils, Masker } from '@himorishige/noren-core'
import { validateMyNumber } from './validators.js'

// Pre-compiled regex patterns for JP detectors with Japanese-aware boundaries
const JP_PATTERNS = {
  postal: /(?<![0-9０-９¥$€£¢])\d{3}-?\d{4}(?![0-9０-９])/g,
  cellPhone: /(?<![0-9０-９])0(?:60|70|80|90)-?\d{4}-?\d{4}(?![0-9０-９])/g,
  landlinePhone: /(?<![0-9０-９])0[1-9]\d?-?\d{3,4}-?\d{4}(?![0-9０-９])/g,
  internationalPhone: /\+81[-.\s]?\d{1,4}[-.\s]?\d{1,4}[-.\s]?\d{3,4}(?![0-9０-９])/g,
  myNumber: /(?<![0-9０-９])\d{12}(?![0-9０-９])/g,
}

// Context hints as Sets for better performance (O(1) lookup)
const JP_CONTEXTS = {
  postal: new Set(['〒', '住所', 'address', 'zip']),
  phone: new Set(['tel', '電話', 'phone']),
  myNumber: new Set(['マイナンバー', '個人番号', 'mynumber']),
}

export const detectors: Detector[] = [
  {
    id: 'jp.postal',
    match: ({ src, push, hasCtx }: DetectUtils) => {
      const hasContext = hasCtx(Array.from(JP_CONTEXTS.postal))

      for (const m of src.matchAll(JP_PATTERNS.postal)) {
        if (m.index == null) continue
        // 文脈なしでも低信頼度で検出（PRレビュー指摘事項対応）
        const confidence = hasContext ? 0.75 : 0.4

        push({
          type: 'postal_jp',
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
      const hasContext = hasCtx(Array.from(JP_CONTEXTS.phone))

      // Cell phone detection
      for (const m of src.matchAll(JP_PATTERNS.cellPhone)) {
        if (m.index == null) continue
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
        if (m.index == null) continue
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

      // International phone detection - +81 prefix is reliable without context
      for (const m of src.matchAll(JP_PATTERNS.internationalPhone)) {
        if (m.index == null) continue
        // +81プレフィックスは高信頼度で単独検出可能
        const hasInternationalPrefix = m[0].startsWith('+81')
        if (hasContext || hasInternationalPrefix) {
          push({
            type: 'phone_jp',
            start: m.index,
            end: m.index + m[0].length,
            value: m[0],
            risk: 'medium',
            confidence: hasInternationalPrefix ? 0.9 : 0.85,
            reasons: [
              'international_pattern',
              hasContext ? 'context_match' : 'international_prefix',
            ],
            features: {
              phoneType: 'international',
              hasContext,
              hasInternationalPrefix,
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
      const hasContext = hasCtx(Array.from(JP_CONTEXTS.myNumber))
      if (!hasContext) return

      for (const m of src.matchAll(JP_PATTERNS.myNumber)) {
        const validation = validateMyNumber(m[0])

        // Only push if basic format is valid or context is strong
        if (validation.valid || hasContext) {
          push({
            type: 'mynumber_jp',
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
  postal_jp: () => '•••-••••',
  phone_jp: (h) => h.value.replace(/\d/g, '•'),
  mynumber_jp: () => '[REDACTED:MYNUMBER]',
}
