// Noren Core - Fast, lightweight PII detection and masking (Web Standards only)

export { type AllowDenyConfig, AllowDenyManager } from './allowlist.js'
export { CONFIDENCE_THRESHOLDS, filterByConfidence } from './confidence.js'
export {
  CONTEXT_KEYWORDS,
  NEGATIVE_CONTEXT_KEYWORDS,
  STRICTNESS_LEVELS,
  type StrictnessLevel,
} from './constants.js'
export {
  type ContextAnalysis,
  calculateContextScore,
  extractSurroundingText,
  meetsContextThreshold,
} from './context-scoring.js'
export {
  createJSONDetector,
  JSONDetector,
  type JsonDetectionResult,
  type JsonHit,
} from './json-detector.js'
// Advanced exports for plugins and power users
export type { LazyPlugin } from './lazy.js'
export { clearPluginCache } from './lazy.js'
export { HitPool } from './pool.js'
export { createRedactionTransform } from './stream-utils.js'
// Essential API exports for v0.5.0
export type {
  Action,
  DetectionSensitivity,
  Detector,
  DetectUtils,
  Hit,
  Masker,
  PiiType,
  Policy,
  ValidationStrictness,
} from './types.js'
export { hmacToken, importHmacKey } from './utils.js'
export {
  debugValidation,
  type ValidationContext,
  type ValidationResult,
  validateCandidate,
} from './validators.js'

import { type AllowDenyConfig, AllowDenyManager, type Environment } from './allowlist.js'
import { calculateConfidence, filterByConfidence } from './confidence.js'
import { builtinDetect } from './detection.js'
import { createJSONDetector } from './json-detector.js'
import { type LazyPlugin, loadPlugin } from './lazy.js'
import { defaultMask } from './masking.js'
import { hitPool } from './pool.js'
import type { Detector, DetectUtils, Hit, Masker, PiiType, Policy } from './types.js'
import { hmacToken, importHmacKey, normalize, SECURITY_LIMITS } from './utils.js'
import { type ValidationContext, validateCandidate } from './validators.js'

// Risk level weights for tiebreaker comparison
const RISK_WEIGHTS = { high: 3, medium: 2, low: 1 } as const
const DEFAULT_BUILTIN_PRIORITY = 10

// Priority comparison: lower number = higher priority (e.g., -5 > -1 > 1 > 5)
function isHigherPriority(a: number, b: number): boolean {
  return a < b
}

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

export interface RegistryOptions extends Policy {
  environment?: Environment
  allowDenyConfig?: AllowDenyConfig
  enableConfidenceScoring?: boolean // Enable confidence scoring (default: true)
  enableJsonDetection?: boolean // Enable JSON/structured data detection (default: false)
}

export class Registry {
  private detectors: Detector[] = []
  private maskers = new Map<PiiType, Masker>()
  private base: Policy
  private contextHintsSet: Set<string>
  private allowDenyManager: AllowDenyManager
  private enableConfidenceScoring: boolean
  private enableJsonDetection: boolean

  constructor(options: RegistryOptions) {
    // Validate configuration
    this.validateOptions(options)

    const {
      environment,
      allowDenyConfig,
      enableConfidenceScoring,
      enableJsonDetection,
      ...policy
    } = options
    this.base = policy
    this.contextHintsSet = new Set(policy.contextHints ?? [])
    this.enableConfidenceScoring = enableConfidenceScoring ?? true
    this.enableJsonDetection = enableJsonDetection ?? false

    // Initialize allowlist/denylist manager
    this.allowDenyManager = new AllowDenyManager({
      environment: environment ?? 'production',
      ...allowDenyConfig,
    })
  }

  /**
   * Validate registry configuration options
   */
  private validateOptions(options: RegistryOptions) {
    // Validate validation strictness
    if (
      options.validationStrictness &&
      !['fast', 'balanced', 'strict'].includes(options.validationStrictness)
    ) {
      throw new Error(
        `Invalid validationStrictness: ${options.validationStrictness}. Must be 'fast', 'balanced', or 'strict'`,
      )
    }

    // Validate HMAC key strength (only for string keys)
    if (options.hmacKey && typeof options.hmacKey === 'string' && options.hmacKey.length < 32) {
      throw new Error('HMAC key must be at least 32 characters long for security')
    }

    // Validate context hints
    if (options.contextHints && !Array.isArray(options.contextHints)) {
      throw new Error('contextHints must be an array of strings')
    }

    // Validate rules structure
    if (options.rules) {
      for (const [type, rule] of Object.entries(options.rules)) {
        if (rule && typeof rule === 'object') {
          if (rule.action && !['mask', 'remove', 'tokenize'].includes(rule.action)) {
            throw new Error(
              `Invalid action '${rule.action}' for type '${type}'. Must be 'mask', 'remove', or 'tokenize'`,
            )
          }
        }
      }
    }

    // Validate default action
    if (options.defaultAction && !['mask', 'remove', 'tokenize'].includes(options.defaultAction)) {
      throw new Error(
        `Invalid defaultAction: ${options.defaultAction}. Must be 'mask', 'remove', or 'tokenize'`,
      )
    }
  }

  use(detectors: Detector[] = [], maskers: Record<string, Masker> = {}, ctx: string[] = []) {
    for (const d of detectors) this.detectors.push(d)
    // Sort so that higher priority detectors run first (lower number first)
    this.detectors.sort((a, b) => {
      const ap = a.priority ?? 0
      const bp = b.priority ?? 0
      if (isHigherPriority(ap, bp)) return -1
      if (isHigherPriority(bp, ap)) return 1
      return 0
    })

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

  /**
   * Try JSON detection on the input text
   */
  private tryJsonDetection(src: string, utils: DetectUtils): void {
    const jsonDetector = createJSONDetector()
    const result = jsonDetector.detectInJson(src, utils)

    if (result.isValidJson && result.hits.length > 0) {
      // Convert JsonHit to regular Hit for integration
      for (const jsonHit of result.hits) {
        const hit: Hit = {
          type: jsonHit.type,
          start: jsonHit.start,
          end: jsonHit.end,
          value: jsonHit.value,
          risk: jsonHit.risk,
          priority: -5, // Higher priority than default built-ins for JSON-based detection
          confidence: jsonHit.confidence,
          reasons: jsonHit.reasons,
          features: {
            ...jsonHit.features,
            isJsonDetection: true,
            jsonPath: jsonHit.jsonPath,
            keyName: jsonHit.keyName,
          },
        }
        utils.push(hit)
      }
    }
  }

  async detect(
    raw: string,
    ctxHints = this.base.contextHints ?? [],
  ): Promise<{ src: string; hits: Hit[] }> {
    // Input validation and size limits
    if (typeof raw !== 'string') {
      throw new Error('Input must be a string')
    }

    if (raw.length > SECURITY_LIMITS.maxInputLength) {
      throw new Error(
        `Input too large: ${raw.length} chars exceeds limit of ${SECURITY_LIMITS.maxInputLength}`,
      )
    }

    const src = normalize(raw)
    const hits: Hit[] = []

    // Lazily compute lowercase and hints only when needed to reduce overhead on hot path
    let srcLower: string | null = null
    const getSrcLower = () => {
      if (srcLower === null) {
        srcLower = src.toLowerCase()
      }
      return srcLower
    }
    let contextCheckCache: boolean | null = null

    const u: DetectUtils = {
      src,
      hasCtx: (ws) => {
        const hay = getSrcLower()
        if (!ws) {
          if (contextCheckCache === null) {
            const hints = ctxHints.length > 0 ? ctxHints : Array.from(this.contextHintsSet)
            contextCheckCache = hints.some((w) => hay.includes(w.toLowerCase()))
          }
          return contextCheckCache
        }
        return ws.some((w) => hay.includes(w.toLowerCase()))
      },
      push: (h) => {
        if (hits.length >= SECURITY_LIMITS.maxPatternMatches) return
        hits.push(h)
      },
      canPush: () => hits.length < SECURITY_LIMITS.maxPatternMatches,
    }

    // Get validation strictness from policy (default to 'fast' for backward compatibility)
    const validationStrictness = this.base.validationStrictness ?? 'fast'
    builtinDetect(u, validationStrictness)

    // Try JSON detection if enabled
    if (this.enableJsonDetection) {
      this.tryJsonDetection(src, u)
    }

    // Assign default priority for builtin hits that didn't set one
    for (let i = 0; i < hits.length; i++) {
      if (hits[i].priority === undefined) hits[i].priority = DEFAULT_BUILTIN_PRIORITY
    }
    for (const d of this.detectors) {
      const originalPush = u.push
      // Override push to set detector priority and apply validation if not already set
      u.push = (hit: Hit) => {
        if (hit.priority === undefined) {
          hit.priority = d.priority ?? 0
        }

        // Apply validation for non-fast modes
        if (validationStrictness !== 'fast') {
          try {
            // Extract context around the hit for validation
            const windowSize = 48
            const beforeStart = Math.max(0, hit.start - windowSize)
            const afterEnd = Math.min(src.length, hit.end + windowSize)
            const surroundingText = src.slice(beforeStart, afterEnd)

            const validationContext: ValidationContext = {
              surroundingText,
              strictness: validationStrictness,
              originalIndex: hit.start - beforeStart,
            }

            const validationResult = validateCandidate(hit.value, hit.type, validationContext)

            // Only push if validation passes
            if (validationResult.valid) {
              originalPush(hit)
            }
            // For plugins, we don't log validation failures to avoid noise
          } catch (_error) {
            // If validation fails, fall back to accepting the hit
            originalPush(hit)
          }
        } else {
          // Fast mode: no validation
          originalPush(hit)
        }
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

        if (isHigherPriority(currentPriority, lastPriority)) {
          // Current hit has higher priority, replace the last one
          const toRelease = lastAcceptedHit
          hits[writeIndex - 1] = currentHit
          currentEnd = currentHit.end
          hitPool.releaseOne(toRelease)
        } else if (currentPriority === lastPriority) {
          // Same priority - use tiebreaker rules
          const shouldReplace = resolveSamePriorityConflict(currentHit, lastAcceptedHit)
          if (shouldReplace) {
            const toRelease = lastAcceptedHit
            hits[writeIndex - 1] = currentHit
            currentEnd = currentHit.end
            hitPool.releaseOne(toRelease)
          } else {
            hitPool.releaseOne(currentHit)
          }
        } else {
          // Keep the existing hit, discard current one
          hitPool.releaseOne(currentHit)
        }
      }
    }

    // Filter hits through allowlist/denylist
    const filteredHits: Hit[] = []
    for (let i = 0; i < writeIndex; i++) {
      const hit = hits[i]
      // Extract context around the hit for allowlist/denylist checking
      const contextWindowSize = 100
      const contextStart = Math.max(0, hit.start - contextWindowSize)
      const contextEnd = Math.min(src.length, hit.end + contextWindowSize)
      const context = src.slice(contextStart, contextEnd)

      // Check if this value should be allowed (not treated as PII)
      if (!this.allowDenyManager.isAllowed(hit.value, hit.type, context)) {
        filteredHits.push(hit)
      }
    }

    // Apply confidence scoring if enabled
    const scoredHits: Hit[] = []
    for (const hit of filteredHits) {
      if (this.enableConfidenceScoring) {
        const confidenceResult = calculateConfidence(hit, src)
        const scoredHit: Hit = {
          ...hit,
          confidence: confidenceResult.confidence,
          reasons: confidenceResult.reasons,
          features: {
            ...hit.features, // Preserve existing features (like JSON detection info)
            ...confidenceResult.features, // Add confidence-related features
          },
        }

        scoredHits.push(scoredHit)
      } else {
        scoredHits.push(hit)
      }
    }

    // Apply confidence-based filtering
    const finalFilteredHits =
      this.enableConfidenceScoring && this.base.sensitivity
        ? filterByConfidence(scoredHits, this.base.sensitivity, this.base.confidenceThreshold)
        : scoredHits

    // Create clean copies of final hits to avoid pool reference issues
    const finalHits: Hit[] = new Array(finalFilteredHits.length)
    for (let i = 0; i < finalFilteredHits.length; i++) {
      const hit = finalFilteredHits[i]
      finalHits[i] = {
        type: hit.type,
        start: hit.start,
        end: hit.end,
        value: hit.value,
        risk: hit.risk,
        priority: hit.priority,
        confidence: hit.confidence,
        reasons: hit.reasons,
        features: hit.features,
      }
    }

    // Return accepted hit objects to the pool; rejected ones were already released
    if (writeIndex > 0) {
      hitPool.releaseRange(hits, writeIndex)
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
