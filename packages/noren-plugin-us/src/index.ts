import type { Detector, DetectUtils, Hit, Masker } from '@himorishige/noren-core'
import { validateSSN } from './validators.js'

// Pre-compiled regex patterns for US detectors
const US_PATTERNS = {
  phone: /\b(?:\+1[-.\s]?)?(?:\(?[2-9]\d{2}\)?[-.\s]?)\d{3}[-.\s]?\d{4}\b/g,
  zip: /\b\d{5}(?:-\d{4})?\b/g,
  ssn: /\b(?!000|666|9\d{2})\d{3}-(?!00)\d{2}-(?!0000)\d{4}\b/g,
}

// Context hints as Sets for better performance (O(1) lookup)
const US_CONTEXTS = {
  zip: new Set(['zip', 'ZIP', 'postal', 'address']),
  ssn: new Set(['SSN', 'social', 'security']),
  phone: new Set(['phone', 'tel', 'call', 'contact']),
}

export const detectors: Detector[] = [
  {
    id: 'us.phone',
    match: ({ src, push, hasCtx }: DetectUtils) => {
      const hasContext = hasCtx(Array.from(US_CONTEXTS.phone))

      for (const m of src.matchAll(US_PATTERNS.phone)) {
        if (m.index == null) continue
        const confidence = hasContext ? 0.8 : 0.65
        push({
          type: 'phone_us',
          start: m.index,
          end: m.index + m[0].length,
          value: m[0],
          risk: 'medium',
          confidence,
          reasons: ['us_phone_pattern', hasContext ? 'context_match' : 'no_context'],
          features: {
            hasContext,
            normalized: m[0].replace(/[^\d]/g, '').replace(/(\d{3})(\d{3})(\d{4})/, '$1-$2-$3'),
            hasCountryCode: m[0].includes('+1'),
          },
        })
      }
    },
  },
  {
    id: 'us.zip',
    match: ({ src, push, hasCtx }: DetectUtils) => {
      const hasContext = hasCtx(Array.from(US_CONTEXTS.zip))
      if (!hasContext) return

      for (const m of src.matchAll(US_PATTERNS.zip)) {
        if (m.index == null) continue
        const isExtended = m[0].includes('-')
        const confidence = hasContext ? (isExtended ? 0.85 : 0.75) : 0.5

        push({
          type: 'zip_us',
          start: m.index,
          end: m.index + m[0].length,
          value: m[0],
          risk: 'low',
          confidence,
          reasons: ['zip_pattern', hasContext ? 'context_match' : 'no_context'],
          features: {
            hasContext,
            isExtended,
            normalized: isExtended ? m[0] : `${m[0].slice(0, 5)}-${m[0].slice(5) || '0000'}`,
          },
        })
      }
    },
  },
  {
    id: 'us.ssn',
    priority: -10,
    match: ({ src, push, hasCtx }: DetectUtils) => {
      const hasContext = hasCtx(Array.from(US_CONTEXTS.ssn))
      if (!hasContext) return

      for (const m of src.matchAll(US_PATTERNS.ssn)) {
        const validation = validateSSN(m[0])

        // Only push if basic validation passes or context is very strong
        if (validation.basic || hasContext) {
          if (m.index == null) continue
          push({
            type: 'ssn_us',
            start: m.index,
            end: m.index + m[0].length,
            value: m[0],
            risk: 'high',
            confidence: validation.confidence || (hasContext ? 0.6 : 0.3),
            reasons: [
              'ssn_pattern',
              ...validation.reason,
              hasContext ? 'context_match' : 'no_context',
            ],
            features: {
              basicValid: validation.basic,
              strictValid: validation.strict,
              hasContext,
              normalized: validation.normalized || m[0],
              validationReasons: validation.reason,
            },
          })
        }
      }
    },
  },
]

export const maskers: Record<string, Masker> = {
  phone_us: (h: Hit) => h.value.replace(/\d/g, '•'),
  zip_us: (h: Hit) => (h.value.length > 5 ? '•••••-••••' : '•••••'),
  ssn_us: (h: Hit) => `***-**-${h.value.replace(/\D/g, '').slice(-4)}`,
}
