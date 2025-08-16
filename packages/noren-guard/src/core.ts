/**
 * Functional API for noren-guard
 *
 * This module provides a functional programming approach to prompt injection detection.
 * It offers better tree-shaking, easier testing, and more flexibility through function composition.
 */

import { ALL_PATTERNS } from './patterns.js'
import { normalizeEncoding, sanitizeContent } from './sanitizer.js'
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
  TrustLevel,
} from './types.js'

/**
 * Guard context containing configuration and state
 */
export interface GuardContext {
  config: GuardConfig
  patterns: InjectionPattern[]
  metrics: PerformanceMetrics
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

// Cache compiled patterns for performance
const COMPILED_PATTERNS_CACHE = new WeakMap<InjectionPattern[], InjectionPattern[]>()

/**
 * Creates a new guard context with the given configuration
 */
export function createGuardContext(config?: Partial<GuardConfig>): GuardContext {
  const finalConfig = { ...DEFAULT_CONFIG, ...config }

  // Use cached patterns if no custom patterns
  let patterns: InjectionPattern[]
  if (!config?.customPatterns || config.customPatterns.length === 0) {
    // Use shared patterns instance for default patterns
    if (!COMPILED_PATTERNS_CACHE.has(ALL_PATTERNS)) {
      COMPILED_PATTERNS_CACHE.set(ALL_PATTERNS, ALL_PATTERNS)
    }
    patterns = ALL_PATTERNS
  } else {
    patterns = [...ALL_PATTERNS, ...config.customPatterns]
  }

  // Pre-compile patterns for performance
  patterns.forEach((pattern) => {
    try {
      // Test pattern compilation
      'test'.match(pattern.pattern)
    } catch (_error) {
      console.warn(`Invalid pattern ${pattern.id}:`, _error)
    }
  })

  return {
    config: finalConfig,
    patterns,
    metrics: createMetrics(),
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
 * Pure function to detect patterns in content
 */
export function detectPatterns(context: GuardContext, content: string): PatternMatch[] {
  const patterns = context.patterns
  const matches: PatternMatch[] = []

  for (const pattern of patterns) {
    try {
      const regex = new RegExp(pattern.pattern.source, pattern.pattern.flags)
      let match: RegExpExecArray | null

      match = regex.exec(content)
      while (match !== null) {
        matches.push({
          pattern: pattern.id,
          index: match.index,
          match: match[0],
          severity: pattern.severity,
          category: pattern.category,
          confidence: pattern.weight,
        })

        // Only continue if global flag is set
        if (!pattern.pattern.global) break
        match = regex.exec(content)
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
      ? sanitizeContent(normalizedContent, matches)
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
 * Quick scan for simple safety checks (pure)
 */
export function quickScan(context: GuardContext, content: string): { safe: boolean; risk: number } {
  try {
    const normalizedContent = normalizeEncoding(content)

    // Only check critical and high severity patterns
    const criticalPatterns = context.patterns.filter(
      (p) => p.severity === 'critical' || p.severity === 'high',
    )

    const criticalContext = { ...context, patterns: criticalPatterns }
    const matches = detectPatterns(criticalContext, normalizedContent)

    let risk = 0
    for (const match of matches) {
      const weight = match.severity === 'critical' ? 95 : 70
      risk += weight * (match.confidence / 100)
    }

    risk = Math.min(100, risk)

    return {
      safe: risk < context.config.riskThreshold,
      risk,
    }
  } catch {
    return { safe: false, risk: 100 }
  }
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
  return sanitizeContent(content, matches)
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
