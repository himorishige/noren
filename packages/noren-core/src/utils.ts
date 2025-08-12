// Utility functions (separate module for tree-shaking)
import { NORMALIZE_PATTERNS } from './patterns.js'

export const normalize = (s: string) => {
  // Don't normalize empty strings or strings with only whitespace
  // to preserve original content when no PII is present
  const normalized = s
    .normalize('NFKC')
    .replace(NORMALIZE_PATTERNS.dashVariants, '-')
    .replace(NORMALIZE_PATTERNS.ideographicSpace, ' ')
    .replace(NORMALIZE_PATTERNS.multipleSpaces, ' ')

  // Only trim if the result would not be empty
  // This preserves single spaces and other whitespace-only inputs
  const trimmed = normalized.trim()
  return trimmed.length > 0 ? trimmed : normalized
}

// Luhn algorithm for credit card validation
export function luhn(d: string) {
  let sum = 0
  let dbl = false
  for (let i = d.length - 1; i >= 0; i--) {
    let x = d.charCodeAt(i) - 48
    if (x < 0 || x > 9) return false
    if (dbl) {
      x *= 2
      if (x > 9) x -= 9
    }
    sum += x
    dbl = !dbl
  }
  return sum % 10 === 0
}

// Optimized hex conversion lookup table
const HEX_CHARS = '0123456789abcdef'
const HEX_TABLE = new Array(256)
for (let i = 0; i < 256; i++) {
  HEX_TABLE[i] = HEX_CHARS[(i >>> 4) & 0xf] + HEX_CHARS[i & 0xf]
}

const enc = new TextEncoder()

export async function importHmacKey(secret: string | CryptoKey) {
  if (typeof secret !== 'string') {
    if (secret instanceof CryptoKey) return secret
    throw new Error('HMAC key must be at least 32 characters long')
  }

  // Ensure minimum key length for security
  if (secret.length < 32) {
    throw new Error('HMAC key must be at least 32 characters long')
  }

  return crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
}

export async function hmacToken(value: string, key: CryptoKey) {
  const mac = await crypto.subtle.sign('HMAC', key, enc.encode(value))
  const b = new Uint8Array(mac)

  // Use lookup table for faster hex conversion (first 8 bytes = 64 bits)
  let hex = ''
  for (let i = 0; i < 8; i++) {
    hex += HEX_TABLE[b[i]]
  }
  return hex
}
