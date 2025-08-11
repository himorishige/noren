// Noren Core — 世界共通の薄い原理（Web標準のみ）

export type PiiType =
  | 'email'
  | 'ipv4'
  | 'ipv6'
  | 'mac'
  | 'phone_e164'
  | 'credit_card'
  | (string & {})

export type Hit = {
  type: PiiType
  start: number
  end: number
  value: string
  risk: 'low' | 'medium' | 'high'
}

export type Action = 'mask' | 'remove' | 'tokenize' | 'ignore'

export type Policy = {
  defaultAction?: Action
  rules?: Partial<Record<PiiType, { action: Action; preserveLast4?: boolean }>>
  contextHints?: string[]
  hmacKey?: string | CryptoKey
}

export type DetectUtils = {
  src: string // 正規化済み
  hasCtx: (words?: string[]) => boolean // 文脈ゲート
  push: (h: Hit) => void // 検出結果追加
}

export type Detector = {
  id: string
  priority?: number
  match: (u: DetectUtils) => void | Promise<void>
}
export type Masker = (hit: Hit) => string

export class Registry {
  private detectors: Detector[] = []
  private maskers = new Map<PiiType, Masker>()
  private base: Policy
  private contextHintsSet: Set<string>

  constructor(base: Policy) {
    this.base = base
    this.contextHintsSet = new Set(base.contextHints ?? [])
  }

  use(detectors: Detector[] = [], maskers: Record<string, Masker> = {}, ctx: string[] = []) {
    // Add detectors and sort immediately
    for (const d of detectors) this.detectors.push(d)
    this.detectors.sort((a, b) => (a.priority ?? 0) - (b.priority ?? 0))

    // Add maskers
    for (const [k, m] of Object.entries(maskers)) this.maskers.set(k as PiiType, m)

    // Update context hints using Set
    if (ctx.length) {
      for (const hint of ctx) this.contextHintsSet.add(hint)
      this.base.contextHints = Array.from(this.contextHintsSet)
    }
  }

  getPolicy() {
    return this.base
  }
  maskerFor(t: PiiType) {
    return this.maskers.get(t)
  }

  async detect(raw: string, ctxHints = this.base.contextHints ?? []) {
    const src = normalize(raw)
    const hits: Hit[] = []

    // Pre-allocate arrays with estimated capacity
    hits.length = 0
    // Reserve capacity based on input size heuristic
    const estimatedHits = Math.max(8, Math.floor(src.length / 200))

    // Create optimized context check function with caching
    const ctxHintsForCheck = ctxHints.length > 0 ? ctxHints : Array.from(this.contextHintsSet)
    let contextCheckCache: boolean | null = null
    
    const u: DetectUtils = {
      src,
      hasCtx: (ws) => {
        // Cache context check result if no specific words provided
        if (!ws) {
          if (contextCheckCache === null) {
            contextCheckCache = ctxHintsForCheck.some((w) => src.includes(w))
          }
          return contextCheckCache
        }
        return ws.some((w) => src.includes(w))
      },
      push: (h) => hits.push(h),
    }

    builtinDetect(u)
    // Use pre-sorted detectors
    for (const d of this.detectors) await d.match(u)

    // Optimized interval merging with early termination
    if (hits.length === 0) return { src, hits: [] }
    
    hits.sort((a, b) => a.start - b.start || b.end - b.start - (a.end - a.start))
    
    // In-place merging to reduce allocations
    let writeIndex = 0
    let currentEnd = -1
    
    for (let readIndex = 0; readIndex < hits.length; readIndex++) {
      const hit = hits[readIndex]
      if (hit.start >= currentEnd) {
        hits[writeIndex] = hit
        currentEnd = hit.end
        writeIndex++
      } else {
        // Release the overlapped hit back to pool
        hitPool.release([hit])
      }
    }
    
    // Trim array to actual size and release unused hits
    const finalHits = hits.slice(0, writeIndex)
    const releasedHits = hits.slice(writeIndex)
    if (releasedHits.length > 0) {
      hitPool.release(releasedHits)
    }
    
    return { src, hits: finalHits }
  }
}

export async function redactText(reg: Registry, input: string, override: Policy = {}) {
  const cfg = { ...reg.getPolicy(), ...override }
  const { src, hits } = await reg.detect(input, cfg.contextHints)
  
  // Early exit for no hits
  if (hits.length === 0) return src
  
  // Pre-check for tokenization to avoid repeated key import
  const needTok =
    Object.values(cfg.rules ?? {}).some((v) => v?.action === 'tokenize') ||
    cfg.defaultAction === 'tokenize'
  const key = needTok && cfg.hmacKey ? await importHmacKey(cfg.hmacKey) : undefined

  // Pre-allocate array with estimated size to reduce reallocations
  const parts: string[] = []
  const estimatedParts = hits.length * 2 + 1
  
  let cur = 0
  for (const h of hits) {
    const rule = cfg.rules?.[h.type] ?? { action: cfg.defaultAction ?? 'mask' }
    
    // Add text before hit
    if (h.start > cur) {
      parts.push(src.slice(cur, h.start))
    }
    
    // Process hit based on action
    let rep = h.value
    if (rule.action === 'remove') {
      rep = ''
    } else if (rule.action === 'mask') {
      rep = reg.maskerFor(h.type)?.(h) ?? defaultMask(h, rule.preserveLast4)
    } else if (rule.action === 'tokenize') {
      if (!key) throw new Error(`hmacKey is required for tokenize action on type ${h.type}`)
      rep = `TKN_${String(h.type).toUpperCase()}_${await hmacToken(h.value, key)}`
    }
    
    if (rep !== '') {
      parts.push(rep)
    }
    cur = h.end
  }
  
  // Add remaining text after last hit
  if (cur < src.length) {
    parts.push(src.slice(cur))
  }

  return parts.join('')
}

// ---- Helpers ----
// Hit object pool for reducing GC pressure
class HitPool {
  private pool: Hit[] = []
  private maxSize = 100 // Prevent unbounded growth

  acquire(type: PiiType, start: number, end: number, value: string, risk: Hit['risk']): Hit {
    const hit = this.pool.pop()
    if (hit) {
      // Reuse existing object
      hit.type = type
      hit.start = start
      hit.end = end
      hit.value = value
      hit.risk = risk
      return hit
    }
    // Create new object if pool is empty
    return { type, start, end, value, risk }
  }

  release(hits: Hit[]): void {
    // Return hits to pool for reuse
    for (const hit of hits) {
      if (this.pool.length < this.maxSize) {
        // Clear sensitive data and return to pool
        hit.value = ''
        hit.type = '' as PiiType
        this.pool.push(hit)
      }
    }
  }

  clear(): void {
    this.pool.length = 0
  }
}

const hitPool = new HitPool()

// Pre-compiled regex patterns for better performance
const NORMALIZE_PATTERNS = {
  dashVariants: /[\u2212\u2010-\u2015\u30FC]/g,
  ideographicSpace: /\u3000/g,
  multipleSpaces: /[ \t　]+/g,
}

const DETECTION_PATTERNS = {
  // Individual patterns for fallback/specific use
  email: /(?:^|[\s<>"'`])[A-Z0-9._%+-]{1,64}@[A-Z0-9.-]{1,253}\.[A-Z]{2,63}(?=[\s<>"'`]|$)/gi,
  ipv4: /\b(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9]?[0-9])(?:\.(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9]?[0-9])){3}\b/g,
  ipv6: /\b(?:[0-9A-F]{1,4}:){7}[0-9A-F]{1,4}\b|(?:(?:[0-9A-F]{0,4}:){0,6})?::(?:(?:[0-9A-F]{0,4}:){0,6}[0-9A-F]{0,4})?/gi,
  mac: /\b[0-9A-F]{2}(?:[:-][0-9A-F]{2}){5}\b/gi,
  e164: /(?:^|[\s(])\+(?:[1-9]\d{6,14}|[1-9]\d[\d\-\s()]{6,13}\d)(?=[\s)]|$)/g,
  creditCardChunk: /\b(?:\d[ -]?){12,18}\d\b/g,
}

// Unified pattern for single-pass detection (most performance-critical patterns)
const UNIFIED_PATTERN = new RegExp(
  [
    // Group 1: Email
    '((?:^|[\\s<>"`])[A-Z0-9._%+-]{1,64}@[A-Z0-9.-]{1,253}\\.[A-Z]{2,63}(?=[\\s<>"`]|$))',
    // Group 2: IPv4  
    '|\\b((?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9]?[0-9])(?:\\.(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9]?[0-9])){3})\\b',
    // Group 3: MAC Address
    '|\\b([0-9A-F]{2}(?:[:-][0-9A-F]{2}){5})\\b',
    // Group 4: Credit Card (simplified for unified pattern)
    '|\\b((?:\\d[ -]?){12,18}\\d)\\b',
  ].join(''),
  'gi'
)

// Pattern type mapping for unified detection
const PATTERN_TYPES: Array<{ type: PiiType; risk: Hit['risk'] }> = [
  { type: 'email', risk: 'medium' },
  { type: 'ipv4', risk: 'low' },
  { type: 'mac', risk: 'low' },
  { type: 'credit_card', risk: 'high' },
]

export const normalize = (s: string) =>
  s
    .normalize('NFKC')
    .replace(NORMALIZE_PATTERNS.dashVariants, '-')
    .replace(NORMALIZE_PATTERNS.ideographicSpace, ' ')
    .replace(NORMALIZE_PATTERNS.multipleSpaces, ' ')
    .trim()

function builtinDetect(u: DetectUtils) {
  // Helper function for pooled hit creation
  const createHit = (type: PiiType, match: RegExpMatchArray, risk: Hit['risk'], value?: string, start?: number, end?: number): Hit | null => {
    if (match.index === undefined && start === undefined) return null
    const actualStart = start ?? match.index!
    const actualEnd = end ?? (match.index! + match[0].length)
    const actualValue = value ?? match[0]
    return hitPool.acquire(type, actualStart, actualEnd, actualValue, risk)
  }

  // Unified pattern detection (single pass for most common patterns)
  for (const m of u.src.matchAll(UNIFIED_PATTERN)) {
    if (m.index === undefined) continue
    
    // Determine which capture group matched
    for (let i = 1; i < m.length; i++) {
      if (m[i]) {
        const patternInfo = PATTERN_TYPES[i - 1]
        if (patternInfo.type === 'credit_card') {
          // Credit card requires Luhn validation
          const digits = m[i].replace(/[ -]/g, '')
          if (digits.length >= 13 && digits.length <= 19 && luhn(digits)) {
            const hit = createHit(patternInfo.type, m, patternInfo.risk, m[i], m.index, m.index + m[i].length)
            if (hit) u.push(hit)
          }
        } else {
          const hit = createHit(patternInfo.type, m, patternInfo.risk, m[i], m.index, m.index + m[i].length)
          if (hit) u.push(hit)
        }
        break // Only match first capture group
      }
    }
  }

  // IPv6 (complex pattern, kept separate)
  for (const m of u.src.matchAll(DETECTION_PATTERNS.ipv6)) {
    const hit = createHit('ipv6', m, 'low')
    if (hit) u.push(hit)
  }

  // E.164 phone numbers (context-sensitive, kept separate)
  for (const m of u.src.matchAll(DETECTION_PATTERNS.e164)) {
    const hit = createHit('phone_e164', m, 'medium')
    if (hit) u.push(hit)
  }
}

// Maintaining original hit function for backwards compatibility
// This function is used in external packages or user-defined plugins
// biome-ignore lint/correctness/noUnusedVariables: kept for backwards compatibility with external packages
function hit(type: PiiType, m: RegExpMatchArray, risk: Hit['risk']): Hit | null {
  if (m.index === undefined) return null
  return {
    type,
    start: m.index,
    end: m.index + m[0].length,
    value: m[0],
    risk,
  }
}

function luhn(d: string) {
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

function defaultMask(h: Hit, keepLast4?: boolean) {
  if (h.type === 'credit_card' && keepLast4) {
    const last4 = h.value.replace(/\D/g, '').slice(-4)
    return `**** **** **** ${last4}`
  }
  if (h.type === 'phone_e164') return h.value.replace(/\d/g, '•')
  return `[REDACTED:${h.type}]`
}

// HMAC（トークン）— 出力は hex16 で簡潔に
const enc = new TextEncoder()
async function importHmacKey(secret: string | CryptoKey) {
  if (typeof secret !== 'string') return secret

  // Ensure minimum key length for security
  if (secret.length < 16) {
    throw new Error('HMAC key must be at least 16 characters long')
  }

  return crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
}
// Optimized hex conversion lookup table
const HEX_CHARS = '0123456789abcdef'
const HEX_TABLE = new Array(256)
for (let i = 0; i < 256; i++) {
  HEX_TABLE[i] = HEX_CHARS[(i >>> 4) & 0xf] + HEX_CHARS[i & 0xf]
}

async function hmacToken(value: string, key: CryptoKey) {
  const mac = await crypto.subtle.sign('HMAC', key, enc.encode(value))
  const b = new Uint8Array(mac)
  
  // Use lookup table for faster hex conversion (first 8 bytes = 64 bits)
  let hex = ''
  for (let i = 0; i < 8; i++) {
    hex += HEX_TABLE[b[i]]
  }
  return hex
}
