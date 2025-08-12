// Masking functions (tree-shakeable module)
import type { Hit } from './types.js'

export function defaultMask(h: Hit, keepLast4?: boolean) {
  if (keepLast4) {
    if (h.type === 'credit_card') {
      const last4 = h.value.replace(/\D/g, '').slice(-4)
      return `**** **** **** ${last4}`
    } else {
      // For other types, preserve last 4 characters
      const last4 = h.value.slice(-4)
      return `[REDACTED:${h.type}]${last4}`
    }
  }
  
  if (h.type === 'phone_e164') return h.value.replace(/\d/g, '•')
  return `[REDACTED:${h.type}]`
}
