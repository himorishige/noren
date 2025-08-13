// Essential utility functions for Noren Core (simple version)
import { NORMALIZE_PATTERNS } from './patterns.js'

export const normalize = (s: string) => {
  // Fast path: if string is already ASCII-only and doesn't need normalization, return as-is
  if (s.length > 0 && /^[\x20-\x7E]*$/.test(s) && !/[ \t]{2,}/.test(s)) {
    return s
  }

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

// HMAC key import for tokenization
export async function importHmacKey(secret: string | CryptoKey) {
  if (secret instanceof CryptoKey) return secret

  if (typeof secret !== 'string' || secret.length < 32) {
    throw new Error('HMAC key must be at least 32 characters long')
  }

  const encoder = new TextEncoder()
  const keyData = encoder.encode(secret)

  return crypto.subtle.importKey('raw', keyData, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
}

// HMAC-based token generation
export async function hmacToken(value: string, key: CryptoKey) {
  const encoder = new TextEncoder()
  const data = encoder.encode(value)
  const signature = await crypto.subtle.sign('HMAC', key, data)

  // Convert to base64url (URL-safe)
  const base64 = btoa(String.fromCharCode(...new Uint8Array(signature)))
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

// Check if chunk contains binary data (for stream processing)
export function isBinaryChunk(chunk: Uint8Array): boolean {
  // Fast check for binary data: look for common binary markers
  const threshold = Math.min(chunk.length, 512) // Check first 512 bytes max
  let nullCount = 0
  let controlCount = 0

  for (let i = 0; i < threshold; i++) {
    const byte = chunk[i]

    // Null bytes are strong indicators of binary data
    if (byte === 0) {
      nullCount++
      if (nullCount >= 3) return true // Multiple nulls = likely binary
    }

    // Control characters (except common whitespace)
    if (byte < 32 && byte !== 9 && byte !== 10 && byte !== 13) {
      controlCount++
      if (controlCount >= 8) return true // Too many control chars
    }
  }

  // Heuristic: if >2% null bytes or >5% control chars, likely binary
  const nullRatio = nullCount / threshold
  const controlRatio = controlCount / threshold

  return nullRatio > 0.02 || controlRatio > 0.05
}

// Security limits for preventing DoS attacks
export const SECURITY_LIMITS = {
  maxInputLength: 10_000_000, // 10MB text limit
  maxPatternMatches: 200, // Limit number of regex matches
  chunkSize: 256, // Chunk size for large inputs
} as const
