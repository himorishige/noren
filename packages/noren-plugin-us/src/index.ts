import type { Detector, DetectUtils, Hit, Masker } from '@himorishige/noren-core'
import { validateSSN } from './validators'

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
    match: ({ src, push, hasCtx }: DetectUtils) => {
      const hasContext = hasCtx(['phone', 'tel', 'call', 'contact'])

      for (const m of src.matchAll(US_PATTERNS.phone)) {
        const confidence = hasContext ? 0.8 : 0.65 // US phones are fairly recognizable
        push({
          type: 'us_phone',
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
      const hasContext = hasCtx(US_CONTEXTS.zip)
      if (!hasContext) return

      for (const m of src.matchAll(US_PATTERNS.zip)) {
        const isExtended = m[0].includes('-')
        const confidence = hasContext ? (isExtended ? 0.85 : 0.75) : 0.5

        push({
          type: 'us_zip',
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
      const hasContext = hasCtx(US_CONTEXTS.ssn)
      if (!hasContext) return

      for (const m of src.matchAll(US_PATTERNS.ssn)) {
        const validation = validateSSN(m[0])

        // Only push if basic validation passes or context is very strong
        if (validation.basic || hasContext) {
          push({
            type: 'us_ssn',
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
  us_phone: (h: Hit) => h.value.replace(/\d/g, '•'),
  us_zip: (h: Hit) => (h.value.length > 5 ? '•••••-••••' : '•••••'),
  us_ssn: (h: Hit) => `***-**-${h.value.replace(/\D/g, '').slice(-4)}`,
}
