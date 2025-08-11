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
  constructor(base: Policy) {
    this.base = base
  }

  use(detectors: Detector[] = [], maskers: Record<string, Masker> = {}, ctx: string[] = []) {
    for (const d of detectors) this.detectors.push(d)
    for (const [k, m] of Object.entries(maskers)) this.maskers.set(k as PiiType, m)
    if (ctx.length)
      this.base.contextHints = Array.from(new Set([...(this.base.contextHints ?? []), ...ctx]))
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
    const u: DetectUtils = {
      src,
      hasCtx: (ws) => (ws ?? ctxHints).some((w) => src.includes(w)),
      push: (h) => hits.push(h),
    }
    builtinDetect(u)
    const sorted = [...this.detectors].sort((a, b) => (a.priority ?? 0) - (b.priority ?? 0))
    for (const d of sorted) await d.match(u)

    // 区間マージ（重なりは長い方優先）
    hits.sort((a, b) => a.start - b.start || b.end - b.start - (a.end - a.start))
    const out: Hit[] = []
    let end = -1
    for (const h of hits) {
      if (h.start >= end) {
        out.push(h)
        end = h.end
      }
    }
    return { src, hits: out }
  }
}

export async function redactText(reg: Registry, input: string, override: Policy = {}) {
  const cfg = { ...reg.getPolicy(), ...override }
  const { src, hits } = await reg.detect(input, cfg.contextHints)
  const needTok =
    Object.values(cfg.rules ?? {}).some((v) => v?.action === 'tokenize') ||
    cfg.defaultAction === 'tokenize'
  const key = needTok && cfg.hmacKey ? await importHmacKey(cfg.hmacKey) : undefined

  let out = ''
  let cur = 0
  for (const h of hits) {
    const rule = cfg.rules?.[h.type] ?? { action: cfg.defaultAction ?? 'mask' }
    out += src.slice(cur, h.start)
    let rep = h.value
    if (rule.action === 'remove') rep = ''
    else if (rule.action === 'mask')
      rep = reg.maskerFor(h.type)?.(h) ?? defaultMask(h, rule.preserveLast4)
    else if (rule.action === 'tokenize') {
      if (!key) throw new Error(`hmacKey is required for tokenize action on type ${h.type}`)
      rep = `TKN_${String(h.type).toUpperCase()}_${await hmacToken(h.value, key)}`
    }
    out += rep
    cur = h.end
  }
  out += src.slice(cur)
  return out
}

// ---- Helpers ----
export const normalize = (s: string) =>
  s
    .normalize('NFKC')
    .replace(/[\u2212\u2010-\u2015\u30FC]/g, '-')
    .replace(/\u3000/g, ' ')
    .replace(/[ \t　]+/g, ' ')
    .trim()

function builtinDetect(u: DetectUtils) {
  // email
  const emailRe = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi
  for (const m of u.src.matchAll(emailRe)) u.push(hit('email', m as RegExpExecArray, 'medium'))

  // ipv4/ipv6/mac
  const ipv4 = /\b(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)\b/g
  const ipv6 = /\b(?:[A-F0-9]{1,4}:){7}[A-F0-9]{1,4}\b/gi
  const mac = /\b(?:[0-9A-F]{2}[:-]){5}[0-9A-F]{2}\b/gi
  for (const re of [ipv4, ipv6, mac]) {
    const type: PiiType = re === mac ? 'mac' : re === ipv6 ? 'ipv6' : 'ipv4'
    for (const m of u.src.matchAll(re)) u.push(hit(type, m as RegExpExecArray, 'low'))
  }

  // phone_e164（弱）—文脈で強め
  const e164 = /\+?\d[\d\-\s()]{8,15}/g
  for (const m of u.src.matchAll(e164)) u.push(hit('phone_e164', m as RegExpExecArray, 'medium'))

  // credit card（Luhn）
  const chunk = /(?:\d[ -]?){13,19}/g
  for (const m of u.src.matchAll(chunk)) {
    const digits = (m[0] as string).replace(/[ -]/g, '')
    if (digits.length >= 13 && digits.length <= 19 && luhn(digits))
      u.push(hit('credit_card', m as RegExpExecArray, 'high'))
  }
}

const hit = (type: PiiType, m: RegExpExecArray, risk: Hit['risk']): Hit => ({
  type,
  start: m.index,
  end: m.index + m[0].length,
  value: m[0],
  risk,
})

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
  return crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
}
async function hmacToken(value: string, key: CryptoKey) {
  const mac = await crypto.subtle.sign('HMAC', key, enc.encode(value))
  const b = new Uint8Array(mac)
  let hex = ''
  for (let i = 0; i < 8; i++) {
    // 64bitぶん
    const v = b[i]
    hex += (v >>> 4).toString(16) + (v & 0xf).toString(16)
  }
  return hex
}
