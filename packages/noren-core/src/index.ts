// Noren Core - Global PII detection and masking (Web Standards only)

export type { LazyPlugin } from './lazy.js'
export { clearPluginCache } from './lazy.js'
export { HitPool } from './pool.js'
export type {
  Action,
  Detector,
  DetectUtils,
  Hit,
  Masker,
  PiiType,
  Policy,
} from './types'
export { hmacToken, importHmacKey, normalize } from './utils.js'

import { builtinDetect } from './detection.js'
import { type LazyPlugin, loadPlugin } from './lazy.js'
import { defaultMask } from './masking.js'
import { hitPool } from './pool.js'
import type { Detector, DetectUtils, Hit, Masker, PiiType, Policy } from './types.js'
import { hmacToken, importHmacKey, normalize } from './utils.js'

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
    for (const d of detectors) this.detectors.push(d)
    this.detectors.sort((a, b) => (a.priority ?? 0) - (b.priority ?? 0))

    for (const [k, m] of Object.entries(maskers)) this.maskers.set(k as PiiType, m)

    if (ctx.length) {
      for (const hint of ctx) this.contextHintsSet.add(hint)
      this.base.contextHints = Array.from(this.contextHintsSet)
    }
  }

  async useLazy(pluginName: string, plugin: LazyPlugin): Promise<void> {
    const loaded = await loadPlugin(pluginName, plugin)
    this.use(loaded.detectors, loaded.maskers, loaded.contextHints)
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

    const ctxHintsForCheck = ctxHints.length > 0 ? ctxHints : Array.from(this.contextHintsSet)
    let contextCheckCache: boolean | null = null

    const u: DetectUtils = {
      src,
      hasCtx: (ws) => {
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
    for (const d of this.detectors) await d.match(u)

    if (hits.length === 0) return { src, hits: [] }

    hits.sort((a, b) => a.start - b.start || b.end - b.start - (a.end - a.start))

    let writeIndex = 0
    let currentEnd = -1

    for (let readIndex = 0; readIndex < hits.length; readIndex++) {
      const hit = hits[readIndex]
      if (hit.start >= currentEnd) {
        hits[writeIndex] = hit
        currentEnd = hit.end
        writeIndex++
      } else {
        hitPool.release([hit])
      }
    }

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

  if (hits.length === 0) return src

  const needTok =
    Object.values(cfg.rules ?? {}).some((v) => v?.action === 'tokenize') ||
    cfg.defaultAction === 'tokenize'
  const key = needTok && cfg.hmacKey ? await importHmacKey(cfg.hmacKey) : undefined

  const parts: string[] = []

  let cur = 0
  for (const h of hits) {
    const rule = cfg.rules?.[h.type] ?? { action: cfg.defaultAction ?? 'mask' }

    if (h.start > cur) {
      parts.push(src.slice(cur, h.start))
    }

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

  if (cur < src.length) {
    parts.push(src.slice(cur))
  }

  return parts.join('')
}
