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

// Risk level weights for tiebreaker comparison
const RISK_WEIGHTS = { high: 3, medium: 2, low: 1 } as const

/**
 * Resolve conflicts between hits with same priority
 * Returns true if current hit should replace the existing hit
 */
function resolveSamePriorityConflict(current: Hit, existing: Hit): boolean {
  // 1. Prefer higher risk levels
  const currentRiskWeight = RISK_WEIGHTS[current.risk]
  const existingRiskWeight = RISK_WEIGHTS[existing.risk]

  if (currentRiskWeight !== existingRiskWeight) {
    return currentRiskWeight > existingRiskWeight
  }

  // 2. Prefer longer hits (more specific matches)
  const currentLength = current.end - current.start
  const existingLength = existing.end - existing.start

  if (currentLength !== existingLength) {
    return currentLength > existingLength
  }

  // 3. As final tiebreaker, prefer hits that appear earlier in text
  return current.start < existing.start
}

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
    this.detectors.sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0))

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
    const srcLower = src.toLowerCase()
    let contextCheckCache: boolean | null = null

    const u: DetectUtils = {
      src,
      hasCtx: (ws) => {
        if (!ws) {
          if (contextCheckCache === null) {
            contextCheckCache = ctxHintsForCheck.some((w) => srcLower.includes(w.toLowerCase()))
          }
          return contextCheckCache
        }
        return ws.some((w) => srcLower.includes(w.toLowerCase()))
      },
      push: (h) => hits.push(h),
    }

    builtinDetect(u)
    for (const d of this.detectors) {
      const originalPush = u.push
      // Override push to set detector priority if not already set
      u.push = (hit: Hit) => {
        if (hit.priority === undefined) {
          hit.priority = d.priority ?? 0
        }
        originalPush(hit)
      }
      await d.match(u)
      // Restore original push
      u.push = originalPush
    }

    if (hits.length === 0) return { src, hits: [] }

    hits.sort((a, b) => a.start - b.start || b.end - b.start - (a.end - a.start))

    let writeIndex = 0
    let currentEnd = -1

    for (let readIndex = 0; readIndex < hits.length; readIndex++) {
      const currentHit = hits[readIndex]

      if (currentHit.start >= currentEnd) {
        // No overlap, keep this hit
        hits[writeIndex] = currentHit
        currentEnd = currentHit.end
        writeIndex++
      } else {
        // Overlap detected - check if current hit has higher priority
        const lastAcceptedHit = hits[writeIndex - 1]
        const currentPriority = currentHit.priority ?? 0
        const lastPriority = lastAcceptedHit.priority ?? 0

        if (currentPriority < lastPriority) {
          // Current hit has higher priority (lower number = higher priority), replace the last one
          const toRelease = lastAcceptedHit
          hits[writeIndex - 1] = currentHit
          currentEnd = currentHit.end
          hitPool.release([toRelease])
        } else if (currentPriority === lastPriority) {
          // Same priority - use tiebreaker rules
          const shouldReplace = resolveSamePriorityConflict(currentHit, lastAcceptedHit)
          if (shouldReplace) {
            const toRelease = lastAcceptedHit
            hits[writeIndex - 1] = currentHit
            currentEnd = currentHit.end
            hitPool.release([toRelease])
          } else {
            hitPool.release([currentHit])
          }
        } else {
          // Keep the existing hit, discard current one
          hitPool.release([currentHit])
        }
      }
    }

    // Create clean copies of final hits to avoid pool reference issues
    const finalHits = hits.slice(0, writeIndex).map(hit => ({
      type: hit.type,
      start: hit.start,
      end: hit.end,
      value: hit.value,
      risk: hit.risk,
      priority: hit.priority,
    }))
    
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
