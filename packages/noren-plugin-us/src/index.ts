import type { Detector, DetectUtils, Hit, Masker } from '@himorishige/noren-core'

// Pre-compiled regex patterns for US detectors
const US_PATTERNS = {
  phone: /\b(?:\+1[-.\s]?)?(?:\(?[2-9]\d{2}\)?[-.\s]?)\d{3}[-.\s]?\d{4}\b/g,
  zip: /\b\d{5}(?:-\d{4})?\b/g,
  ssn: /\b(?!000|666|9\d{2})\d{3}-(?!00)\d{2}-(?!0000)\d{4}\b/g,
}

// Context hints as constants for better performance
const US_CONTEXTS = {
  zip: ['Zip', 'ZIP', 'Postal', 'Address'],
  ssn: ['SSN', 'Social Security'],
}

export const detectors: Detector[] = [
  {
    id: 'us.phone',
    match: ({ src, push }: DetectUtils) => {
      for (const m of src.matchAll(US_PATTERNS.phone))
        push({
          type: 'us_phone',
          start: m.index,
          end: m.index + m[0].length,
          value: m[0],
          risk: 'medium',
        })
    },
  },
  {
    id: 'us.zip',
    match: ({ src, push, hasCtx }: DetectUtils) => {
      if (!hasCtx(US_CONTEXTS.zip)) return
      for (const m of src.matchAll(US_PATTERNS.zip))
        push({
          type: 'us_zip',
          start: m.index,
          end: m.index + m[0].length,
          value: m[0],
          risk: 'low',
        })
    },
  },
  {
    id: 'us.ssn',
    priority: -10,
    match: ({ src, push, hasCtx }: DetectUtils) => {
      if (!hasCtx(US_CONTEXTS.ssn)) return
      for (const m of src.matchAll(US_PATTERNS.ssn))
        push({
          type: 'us_ssn',
          start: m.index,
          end: m.index + m[0].length,
          value: m[0],
          risk: 'high',
        })
    },
  },
]

export const maskers: Record<string, Masker> = {
  us_phone: (h: Hit) => h.value.replace(/\d/g, '•'),
  us_zip: (h: Hit) => (h.value.length > 5 ? '•••••-••••' : '•••••'),
  us_ssn: (h: Hit) => `***-**-${h.value.replace(/\D/g, '').slice(-4)}`,
}
