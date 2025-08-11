import type { Detector, Masker } from '@himorishige/noren-core'

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
    match: ({ src, push, hasCtx }) => {
      if (!hasCtx(JP_CONTEXTS.postal)) return
      for (const m of src.matchAll(JP_PATTERNS.postal))
        push({
          type: 'jp_postal',
          start: m.index,
          end: m.index + m[0].length,
          value: m[0],
          risk: 'low',
        })
    },
  },
  {
    id: 'jp.phone',
    match: ({ src, push, hasCtx }) => {
      // Cell phone detection
      for (const m of src.matchAll(JP_PATTERNS.cellPhone))
        push({
          type: 'phone_jp',
          start: m.index,
          end: m.index + m[0].length,
          value: m[0],
          risk: 'medium',
        })

      // Landline phone detection
      for (const m of src.matchAll(JP_PATTERNS.landlinePhone))
        push({
          type: 'phone_jp',
          start: m.index,
          end: m.index + m[0].length,
          value: m[0],
          risk: 'low',
        })

      // International phone with context check
      if (hasCtx(JP_CONTEXTS.phone))
        for (const m of src.matchAll(JP_PATTERNS.internationalPhone))
          push({
            type: 'phone_jp',
            start: m.index,
            end: m.index + m[0].length,
            value: m[0],
            risk: 'medium',
          })
    },
  },
  {
    id: 'jp.mynumber',
    priority: -10,
    match: ({ src, push, hasCtx }) => {
      if (!hasCtx(JP_CONTEXTS.myNumber)) return
      for (const m of src.matchAll(JP_PATTERNS.myNumber))
        push({
          type: 'jp_my_number',
          start: m.index,
          end: m.index + m[0].length,
          value: m[0],
          risk: 'high',
        })
    },
  },
]

export const maskers: Record<string, Masker> = {
  jp_postal: () => '〒•••-••••',
  phone_jp: (h) => h.value.replace(/\d/g, '•'),
  jp_my_number: () => '[REDACTED:MYNUMBER]',
}
