// Masking functions (tree-shakeable module)
import type { Hit } from './types.js'

export function defaultMask(h: Hit, keepLast4?: boolean) {
  if (h.type === 'credit_card' && keepLast4) {
    const last4 = h.value.replace(/\D/g, '').slice(-4)
    return `**** **** **** ${last4}`
  }
  if (h.type === 'phone_e164') return h.value.replace(/\d/g, '•')
  return `[REDACTED:${h.type}]`
}
