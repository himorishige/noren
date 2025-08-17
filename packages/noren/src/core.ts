/**
 * Functional API for noren-guard
 *
 * This module provides a functional programming approach to prompt injection detection.
 * It offers better tree-shaking, easier testing, and more flexibility through function composition.
 */

import { ALL_PATTERNS } from './patterns.js'
import { detectMultiplePatterns } from './aho-corasick.js'
import { DEFAULT_SANITIZE_RULES, normalizeEncoding, sanitizeContent } from './sanitizer.js'
import {
  calculateTrustAdjustedRisk,
  detectTrustMixing,
  mergeSegments,
  segmentText,
} from './trust-segment.js'
import type {
  DetectionResult,
  GuardConfig,
  InjectionPattern,
  PatternMatch,
  PerformanceMetrics,
  SanitizeRule,
  TrustLevel,
} from './types.js'

/**
 * Guard context containing configuration and state
 */
export interface GuardContext {
  config: GuardConfig
  patterns: InjectionPattern[]
  compiledPatterns: CompiledPattern[]
  metrics: PerformanceMetrics
  customRules?: SanitizeRule[]
}

/**
 * Functional guard API interface
 */
export interface FunctionalGuardAPI {
  scan: (content: string, trustLevel?: TrustLevel) => Promise<DetectionResult>
  quickScan: (content: string) => { safe: boolean; risk: number }
  updateConfig: (config: Partial<GuardConfig>) => void
  getMetrics: () => PerformanceMetrics
  resetMetrics: () => void
}

/**
 * Default configuration
 */
const DEFAULT_CONFIG: GuardConfig = {
  riskThreshold: 60,
  enableSanitization: true,
  enableContextSeparation: true,
  maxProcessingTime: 100,
  enablePerfMonitoring: false,
}

// Cache compiled patterns for performance with improved stability
class PatternCache {
  private cache = new Map<string, CompiledPattern[]>()
  private maxSize = 100 // LRU cache limit
  private accessOrder = new Map<string, number>()
  private accessCounter = 0

  private createCacheKey(patterns: InjectionPattern[]): string {
    // Create stable cache key from pattern IDs and versions
    const key = patterns
      .map(p => `${p.id}:${p.weight}:${p.severity}`)
      .sort()
      .join('|')
    return key
  }

  get(patterns: InjectionPattern[]): CompiledPattern[] | undefined {
    const key = this.createCacheKey(patterns)
    const result = this.cache.get(key)
    
    if (result) {
      // Update access order for LRU
      this.accessOrder.set(key, ++this.accessCounter)
    }
    
    return result
  }

  set(patterns: InjectionPattern[], compiled: CompiledPattern[]): void {
    const key = this.createCacheKey(patterns)
    
    // Evict old entries if cache is full
    if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
      this.evictLRU()
    }
    
    this.cache.set(key, compiled)
    this.accessOrder.set(key, ++this.accessCounter)
  }

  private evictLRU(): void {
    let oldestKey = ''
    let oldestAccess = Infinity
    
    for (const [key, access] of this.accessOrder) {
      if (access < oldestAccess) {
        oldestAccess = access
        oldestKey = key
      }
    }
    
    if (oldestKey) {
      this.cache.delete(oldestKey)
      this.accessOrder.delete(oldestKey)
    }
  }

  clear(): void {
    this.cache.clear()
    this.accessOrder.clear()
    this.accessCounter = 0
  }

  getStats(): {
    size: number
    maxSize: number
    hitRate: number
  } {
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      hitRate: this.accessCounter > 0 ? this.cache.size / this.accessCounter : 0
    }
  }
}

const COMPILED_PATTERNS_CACHE = new PatternCache()

// Compiled pattern interface for better performance
interface CompiledPattern {
  id: string
  regex: RegExp
  severity: InjectionPattern['severity']
  category: string
  weight: number
  priority: number // Higher number = higher priority
}

/**
 * Creates a new guard context with the given configuration
 */
export function createGuardContext(config?: Partial<GuardConfig>): GuardContext {
  const finalConfig = { ...DEFAULT_CONFIG, ...config }

  // Use cached patterns if no custom patterns
  let patterns: InjectionPattern[]
  if (!config?.customPatterns || config.customPatterns.length === 0) {
    patterns = ALL_PATTERNS
  } else {
    patterns = [...ALL_PATTERNS, ...config.customPatterns]
  }

  // Compile patterns for optimized performance
  const compiledPatterns = compilePatterns(patterns)

  return {
    config: finalConfig,
    patterns,
    compiledPatterns,
    metrics: createMetrics(),
    customRules: config?.customRules,
  }
}

/**
 * Creates a new performance metrics object
 */
export function createMetrics(): PerformanceMetrics {
  return {
    totalTime: 0,
    patternTime: 0,
    sanitizeTime: 0,
    patternsChecked: 0,
    matchesFound: 0,
  }
}

/**
 * Compiles patterns for optimized performance
 */
function compilePatterns(patterns: InjectionPattern[]): CompiledPattern[] {
  // Check cache first with improved stability
  const cached = COMPILED_PATTERNS_CACHE.get(patterns)
  if (cached) {
    return cached
  }

  const severityPriority = {
    critical: 100,
    high: 80,
    medium: 60,
    low: 40,
  }

  const compiled = patterns
    .map((pattern) => {
      try {
        // Pre-compile regex for performance
        const regex = new RegExp(pattern.pattern.source, pattern.pattern.flags)

        return {
          id: pattern.id,
          regex,
          severity: pattern.severity,
          category: pattern.category,
          weight: pattern.weight,
          priority: severityPriority[pattern.severity] + pattern.weight,
        }
      } catch (error) {
        console.warn(`Failed to compile pattern ${pattern.id}:`, error)
        return null
      }
    })
    .filter((p): p is CompiledPattern => p !== null)
    // Sort by priority (higher priority first) for early detection
    .sort((a, b) => b.priority - a.priority)

  // Cache the compiled patterns with improved cache
  COMPILED_PATTERNS_CACHE.set(patterns, compiled)

  return compiled
}

/**
 * Pure function to detect patterns in content with optimized performance
 */
export function detectPatterns(
  context: GuardContext,
  content: string,
  options?: {
    maxMatches?: number
    earlyExit?: boolean
    severityFilter?: InjectionPattern['severity'][]
    useAhoCorasick?: boolean
  },
): PatternMatch[] {
  const { patterns } = context
  const maxMatches = options?.maxMatches || 50
  const earlyExit = options?.earlyExit ?? false
  const severityFilter = options?.severityFilter
  const useAhoCorasick = options?.useAhoCorasick ?? true // Default to AC for better performance

  // Filter patterns by severity if specified
  const patternsToCheck = severityFilter
    ? patterns.filter((p) => severityFilter.includes(p.severity))
    : patterns

  if (patternsToCheck.length === 0) {
    return []
  }

  // Use Aho-Corasick for multi-pattern matching (faster for many patterns)
  if (useAhoCorasick && patternsToCheck.length > 5) {
    return detectMultiplePatterns(content, patternsToCheck, {
      maxMatches,
      severityFilter
    })
  }

  // Fallback to original regex-based detection for few patterns
  const { compiledPatterns } = context
  const matches: PatternMatch[] = []

  // Filter compiled patterns by severity
  const compiledToCheck = severityFilter
    ? compiledPatterns.filter((p) => severityFilter.includes(p.severity))
    : compiledPatterns

  for (const pattern of compiledToCheck) {
    try {
      // Reset regex state for each pattern
      pattern.regex.lastIndex = 0

      let _matchCount = 0

      // Use match() for global patterns to avoid state issues
      if (pattern.regex.global) {
        const allMatches = content.match(pattern.regex)
        if (allMatches) {
          for (const matchStr of allMatches.slice(0, 10)) {
            matches.push({
              pattern: pattern.id,
              index: content.indexOf(matchStr),
              match: matchStr,
              severity: pattern.severity,
              category: pattern.category,
              confidence: pattern.weight,
            })
            _matchCount++

            // Early exit for critical patterns
            if (earlyExit && pattern.severity === 'critical') {
              return matches
            }
          }
        }
      } else {
        // For non-global patterns, use exec once
        const match = pattern.regex.exec(content)
        if (match) {
          matches.push({
            pattern: pattern.id,
            index: match.index,
            match: match[0],
            severity: pattern.severity,
            category: pattern.category,
            confidence: pattern.weight,
          })

          // Early exit for critical patterns
          if (earlyExit && pattern.severity === 'critical') {
            return matches
          }
        }
      }

      // Early exit if we have enough matches
      if (matches.length >= maxMatches) {
        break
      }
    } catch (_error) {
      // Skip invalid patterns
    }
  }

  return matches
}

/**
 * Pure function to calculate risk score
 */
export function calculateRisk(
  _context: GuardContext,
  matches: PatternMatch[],
  _trustLevel: TrustLevel = 'user',
): number {
  const trustMixing = { riskIncrease: 0 } // Simplified for now
  if (matches.length === 0 && trustMixing.riskIncrease === 0) {
    return 0
  }

  let totalRisk = 0
  const severityWeights = {
    low: 20,
    medium: 45,
    high: 85,
    critical: 100,
  }

  // Calculate base risk from patterns
  for (const match of matches) {
    const baseWeight = severityWeights[match.severity]
    const confidence = match.confidence / 100
    totalRisk += baseWeight * confidence
  }

  // Add trust mixing risk
  totalRisk += trustMixing.riskIncrease

  // Apply scaling for multiple matches
  if (matches.length > 1) {
    totalRisk *= 1.1 // Increase risk for multiple patterns
  }

  return Math.min(100, Math.max(0, totalRisk))
}

/**
 * Main scanning function (pure)
 */
export async function scan(
  context: GuardContext,
  content: string,
  trustLevel: TrustLevel = 'user',
): Promise<DetectionResult> {
  const startTime = performance.now()

  try {
    // Input validation
    if (typeof content !== 'string') {
      throw new Error('Content must be a string')
    }

    // Handle empty string
    if (content.trim() === '') {
      return {
        input: content,
        sanitized: content,
        risk: 0,
        safe: true,
        matches: [],
        segments: [],
        processingTime: performance.now() - startTime,
      }
    }

    const normalizedContent = normalizeEncoding(content)

    // Segment content
    const segments = context.config.enableContextSeparation
      ? mergeSegments(segmentText(normalizedContent, trustLevel))
      : [{ content: normalizedContent, trust: trustLevel, risk: 0 }]

    // Detect trust mixing
    const _trustMixing = detectTrustMixing(segments)

    // Pattern matching
    const patternStartTime = performance.now()
    const matches = detectPatterns(context, normalizedContent)
    const patternTime = performance.now() - patternStartTime

    // Calculate risk
    const baseRisk = calculateRisk(context, matches, trustLevel)
    const adjustedRisk = calculateTrustAdjustedRisk(baseRisk, trustLevel)

    // Sanitization
    const sanitizeStartTime = performance.now()
    const sanitized = context.config.enableSanitization
      ? sanitizeContent(
          normalizedContent,
          matches,
          context.customRules ? [...context.customRules, ...DEFAULT_SANITIZE_RULES] : undefined,
        )
      : normalizedContent
    const sanitizeTime = performance.now() - sanitizeStartTime

    const processingTime = performance.now() - startTime

    // Update metrics if monitoring is enabled
    if (context.config.enablePerfMonitoring) {
      updateMetrics(context.metrics, {
        totalTime: processingTime,
        patternTime,
        sanitizeTime,
        patternsChecked: context.patterns.length,
        matchesFound: matches.length,
      })
    }

    return {
      input: content,
      sanitized,
      risk: adjustedRisk,
      safe: adjustedRisk < context.config.riskThreshold,
      matches,
      segments,
      processingTime,
    }
  } catch (_error) {
    return {
      input: content,
      sanitized: content,
      risk: 100,
      safe: false,
      matches: [],
      segments: [],
      processingTime: performance.now() - startTime,
    }
  }
}

/**
 * Quick scan with progressive severity filtering for optimal performance
 */
export function quickScan(context: GuardContext, content: string): { safe: boolean; risk: number } {
  try {
    const normalizedContent = normalizeEncoding(content)
    const threshold = context.config.riskThreshold

    // Stage 1: Check only critical patterns first (fastest)
    let matches = detectPatterns(context, normalizedContent, {
      severityFilter: ['critical'],
      earlyExit: true,
      maxMatches: 5,
    })

    let risk = calculateQuickRisk(matches)

    // Early exit if critical threshold exceeded
    if (risk >= threshold) {
      return { safe: false, risk: Math.min(100, risk) }
    }

    // Stage 2: Add high severity patterns if needed
    if (matches.length === 0 || risk < threshold * 0.5) {
      const highMatches = detectPatterns(context, normalizedContent, {
        severityFilter: ['high'],
        maxMatches: 10,
      })

      matches = [...matches, ...highMatches]
      risk = calculateQuickRisk(matches)

      // Early exit if high severity threshold exceeded
      if (risk >= threshold) {
        return { safe: false, risk: Math.min(100, risk) }
      }
    }

    // Stage 3: Check medium patterns only if still unclear
    if (risk > threshold * 0.3 && risk < threshold * 0.8) {
      const mediumMatches = detectPatterns(context, normalizedContent, {
        severityFilter: ['medium'],
        maxMatches: 5,
      })

      matches = [...matches, ...mediumMatches]
      risk = calculateQuickRisk(matches)
    }

    return {
      safe: risk < threshold,
      risk: Math.min(100, risk),
    }
  } catch {
    return { safe: false, risk: 100 }
  }
}

/**
 * Fast risk calculation for quick scan
 */
function calculateQuickRisk(matches: PatternMatch[]): number {
  if (matches.length === 0) return 0

  const severityWeights = {
    critical: 95,
    high: 75, // Increased from 70 to ensure high severity patterns exceed threshold
    medium: 45,
    low: 20,
  }

  let totalRisk = 0
  for (const match of matches) {
    const baseWeight = severityWeights[match.severity]
    const confidence = match.confidence / 100
    const adjustedRisk = baseWeight * confidence

    // Ensure minimum risk for high severity patterns
    if (match.severity === 'high' && adjustedRisk < 60) {
      totalRisk += 60 // Minimum risk of 60 for high severity
    } else if (match.severity === 'critical' && adjustedRisk < 80) {
      totalRisk += 80 // Minimum risk of 80 for critical severity
    } else {
      totalRisk += adjustedRisk
    }
  }

  // Apply diminishing returns for multiple matches
  if (matches.length > 1) {
    totalRisk = totalRisk * Math.min(1.2, 1 + matches.length * 0.1)
  }

  return totalRisk
}

/**
 * Updates metrics object (mutating)
 */
export function updateMetrics(
  metrics: PerformanceMetrics,
  updates: Partial<PerformanceMetrics>,
): void {
  Object.assign(metrics, updates)
}

/**
 * Creates a guard instance with encapsulated state
 */
export function createGuard(
  config?: Partial<GuardConfig>,
): FunctionalGuardAPI & { getContext: () => GuardContext } {
  let context = createGuardContext(config)

  return {
    scan: (content: string, trustLevel?: TrustLevel) => scan(context, content, trustLevel),

    quickScan: (content: string) => quickScan(context, content),

    updateConfig: (newConfig: Partial<GuardConfig>) => {
      context = createGuardContext({ ...context.config, ...newConfig })
    },

    getMetrics: () => ({ ...context.metrics }),

    resetMetrics: () => {
      context.metrics = createMetrics()
    },

    getContext: () => context,
  }
}

/**
 * Convenience function for one-off scans without creating an instance
 */
export async function scanText(
  content: string,
  options?: {
    trustLevel?: TrustLevel
    config?: Partial<GuardConfig>
  },
): Promise<DetectionResult> {
  const context = createGuardContext(options?.config)
  return scan(context, content, options?.trustLevel)
}

/**
 * Convenience function for quick safety checks
 */
export function isSafe(content: string, riskThreshold = 60): boolean {
  const context = createGuardContext({ riskThreshold })
  return quickScan(context, content).safe
}

/**
 * Batch scanning function
 */
export async function scanBatch(
  contents: Array<{ content: string; trust?: TrustLevel }>,
  config?: Partial<GuardConfig>,
): Promise<DetectionResult[]> {
  const context = createGuardContext(config)
  const results: DetectionResult[] = []

  for (const item of contents) {
    const result = await scan(context, item.content, item.trust)
    results.push(result)
  }

  return results
}

/**
 * Creates a configured scanner function (partial application)
 */
export function createScanner(
  config?: Partial<GuardConfig>,
): (content: string, trustLevel?: TrustLevel) => Promise<DetectionResult> {
  const context = createGuardContext(config)
  return (content, trustLevel) => scan(context, content, trustLevel)
}

/**
 * Apply mitigation (sanitization) to content
 */
export function applyMitigation(
  context: GuardContext,
  content: string,
  matches: PatternMatch[],
): string {
  if (!context.config.enableSanitization) {
    return content
  }
  return sanitizeContent(
    content,
    matches,
    context.customRules ? [...context.customRules, ...DEFAULT_SANITIZE_RULES] : undefined,
  )
}

/**
 * Function composition helper for building processing pipelines
 */
export function compose<T>(...fns: Array<(arg: T) => T>): (arg: T) => T {
  return (arg: T) => fns.reduce((acc, fn) => fn(acc), arg)
}

/**
 * Pipeline stage function type
 */
export type PipelineStage = (context: unknown, content: string) => unknown

/**
 * Creates a processing pipeline
 */
export function createPipeline(stages: PipelineStage[]) {
  return {
    stages,
    execute: async (content: string, initialContext?: unknown) => {
      let ctx = initialContext || {}
      let result = content

      for (const stage of stages) {
        const stageResult = await stage(ctx, result)
        if (typeof stageResult === 'string') {
          result = stageResult
        } else if (stageResult && typeof stageResult === 'object') {
          ctx = { ...ctx, ...stageResult }
          if ('content' in stageResult && typeof stageResult.content === 'string') {
            result = stageResult.content
          }
        }
      }

      return { ...ctx, content: result }
    },
  }
}

/**
 * Processes content through a pipeline
 */
export async function processWithPipeline(
  pipeline: ReturnType<typeof createPipeline>,
  content: string,
  context?: unknown,
): Promise<unknown> {
  return pipeline.execute(content, context)
}

/**
 * Pipeline builder for chaining operations
 */
export function pipeline<T>() {
  const steps: Array<(arg: T) => T | Promise<T>> = []

  return {
    add: (fn: (arg: T) => T | Promise<T>) => {
      steps.push(fn)
      return pipeline<T>()
    },

    execute: async (input: T): Promise<T> => {
      let result = input
      for (const step of steps) {
        result = await step(result)
      }
      return result
    },
  }
}

// Re-export types from parent module
export type { GuardConfig } from './types.js'
