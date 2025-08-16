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
 * Main Guard class for prompt injection detection and protection
 * Lightweight, fast, rule-based approach optimized for MCP servers
 */
export class PromptGuard {
  private config: GuardConfig
  private patterns: InjectionPattern[]
  private performanceMetrics: PerformanceMetrics = {
    totalTime: 0,
    patternTime: 0,
    sanitizeTime: 0,
    patternsChecked: 0,
    matchesFound: 0,
  }

  constructor(config: Partial<GuardConfig> = {}) {
    this.config = {
      riskThreshold: 70,
      enableSanitization: true,
      enableContextSeparation: true,
      maxProcessingTime: 100, // 100ms max
      enablePerfMonitoring: false,
      ...config,
    }

    // Compile patterns (combine defaults with custom)
    this.patterns = [...ALL_PATTERNS, ...(config.customPatterns || [])]

    // Pre-compile all regex patterns for better performance
    this.compilePatterns()
  }

  /**
   * Scans content for prompt injection patterns
   */
  async scan(content: string, trustLevel: TrustLevel = 'user'): Promise<DetectionResult> {
    const startTime = performance.now()

    try {
      // Input validation and normalization
      if (typeof content !== 'string') {
        throw new Error('Content must be a string')
      }

      // Handle empty string as safe
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

      // Step 1: Segment content by trust boundaries
      const segments = this.config.enableContextSeparation
        ? mergeSegments(segmentText(normalizedContent, trustLevel))
        : [{ content: normalizedContent, trust: trustLevel, risk: 0 }]

      // Step 2: Detect trust mixing issues
      const trustMixing = detectTrustMixing(segments)

      // Step 3: Pattern matching
      const patternStartTime = performance.now()
      const matches = this.detectPatterns(normalizedContent)
      const patternTime = performance.now() - patternStartTime

      // Step 4: Calculate risk score
      const baseRisk = this.calculateRiskScore(matches, trustMixing)
      const adjustedRisk = calculateTrustAdjustedRisk(baseRisk, trustLevel)

      // Step 5: Sanitization
      const sanitizeStartTime = performance.now()
      const sanitized = this.config.enableSanitization
        ? sanitizeContent(normalizedContent, matches)
        : normalizedContent
      const sanitizeTime = performance.now() - sanitizeStartTime

      const totalTime = performance.now() - startTime

      // Update performance metrics
      if (this.config.enablePerfMonitoring) {
        this.updateMetrics({
          totalTime,
          patternTime,
          sanitizeTime,
          patternsChecked: this.patterns.length,
          matchesFound: matches.length,
        })
      }

      // Check timeout
      if (totalTime > this.config.maxProcessingTime) {
        console.warn(`Guard processing exceeded max time: ${totalTime}ms`)
      }

      return {
        input: content,
        sanitized,
        risk: adjustedRisk,
        safe: adjustedRisk < this.config.riskThreshold,
        matches,
        segments,
        processingTime: totalTime,
      }
    } catch (_error) {
      // Fail-safe: return high-risk result on error
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
   * Quick scan for basic safety check (optimized for speed)
   */
  quickScan(content: string): { safe: boolean; risk: number } {
    try {
      const normalizedContent = normalizeEncoding(content)

      // Check high and critical patterns for quick scan
      const highPriorityPatterns = this.patterns.filter(
        (p) => p.severity === 'critical' || p.severity === 'high',
      )
      const matches = this.detectPatternsSubset(normalizedContent, highPriorityPatterns)

      // Calculate risk based on severity
      let risk = 0
      for (const match of matches) {
        const severityBonus = match.severity === 'critical' ? 95 : 70
        const confidenceMultiplier = match.confidence / 100
        risk += severityBonus * confidenceMultiplier
      }
      risk = Math.min(100, risk)

      return {
        safe: risk < this.config.riskThreshold,
        risk,
      }
    } catch {
      return { safe: false, risk: 100 }
    }
  }

  /**
   * Batch scanning for multiple inputs
   */
  async scanBatch(
    inputs: Array<{ content: string; trust?: TrustLevel }>,
  ): Promise<DetectionResult[]> {
    const results: DetectionResult[] = []

    for (const input of inputs) {
      const result = await this.scan(input.content, input.trust)
      results.push(result)
    }

    return results
  }

  /**
   * Get current performance metrics
   */
  getMetrics(): PerformanceMetrics {
    return { ...this.performanceMetrics }
  }

  /**
   * Reset performance metrics
   */
  resetMetrics(): void {
    this.performanceMetrics = {
      totalTime: 0,
      patternTime: 0,
      sanitizeTime: 0,
      patternsChecked: 0,
      matchesFound: 0,
    }
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<GuardConfig>): void {
    this.config = { ...this.config, ...newConfig }

    // Recompile patterns if custom patterns changed
    if (newConfig.customPatterns) {
      this.patterns = [...ALL_PATTERNS, ...newConfig.customPatterns]
      this.compilePatterns()
    }
  }

  /**
   * Pre-compile patterns for better performance
   */
  private compilePatterns(): void {
    // Patterns are already compiled as RegExp objects
    // This method ensures all patterns are valid
    for (const pattern of this.patterns) {
      try {
        // Test pattern compilation
        'test'.match(pattern.pattern)
      } catch (error) {
        console.warn(`Invalid pattern ${pattern.id}:`, error)
      }
    }
  }

  /**
   * Detect patterns in content
   */
  private detectPatterns(content: string): PatternMatch[] {
    const matches: PatternMatch[] = []

    for (const pattern of this.patterns) {
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

          // Prevent infinite loops with global regex
          if (!pattern.pattern.global) break

          match = regex.exec(content)
        }
      } catch (error) {
        console.warn(`Pattern matching error for ${pattern.id}:`, error)
      }
    }

    return matches
  }

  /**
   * Detect patterns with subset of patterns (for quick scan)
   */
  private detectPatternsSubset(content: string, patterns: InjectionPattern[]): PatternMatch[] {
    const matches: PatternMatch[] = []

    for (const pattern of patterns) {
      try {
        const regex = new RegExp(pattern.pattern.source, pattern.pattern.flags)
        const match = regex.exec(content)
        if (match) {
          matches.push({
            pattern: pattern.id,
            index: match.index,
            match: match[0],
            severity: pattern.severity,
            category: pattern.category,
            confidence: pattern.weight,
          })
        }
      } catch (error) {
        console.warn(`Pattern matching error for ${pattern.id}:`, error)
      }
    }

    return matches
  }

  /**
   * Calculate overall risk score
   */
  private calculateRiskScore(
    matches: PatternMatch[],
    trustMixing: { riskIncrease: number },
  ): number {
    if (matches.length === 0 && trustMixing.riskIncrease === 0) {
      return 0
    }

    // Base risk from pattern matches
    let risk = 0
    const severityWeights = {
      low: 15,
      medium: 35,
      high: 70,
      critical: 95,
    }

    for (const match of matches) {
      const severityBonus = severityWeights[match.severity]
      const confidenceMultiplier = match.confidence / 100
      risk += severityBonus * confidenceMultiplier
    }

    // Add trust mixing risk
    risk += trustMixing.riskIncrease

    // Slight diminishing returns for many matches (prevent runaway scores)
    if (matches.length > 3) {
      risk = risk * 0.9
    }

    return Math.min(100, Math.max(0, risk))
  }

  /**
   * Update performance metrics
   */
  private updateMetrics(metrics: Partial<PerformanceMetrics>): void {
    Object.assign(this.performanceMetrics, metrics)
  }
}

/**
 * Convenience function to create a guard with default settings
 */
export function createGuard(config?: Partial<GuardConfig>): PromptGuard {
  return new PromptGuard(config)
}

/**
 * Quick scan function for simple use cases
 */
export async function scanPrompt(
  content: string,
  options: { trust?: TrustLevel; riskThreshold?: number } = {},
): Promise<DetectionResult> {
  const guard = createGuard({
    riskThreshold: options.riskThreshold ?? 60,
  })

  return guard.scan(content, options.trust ?? 'user')
}

/**
 * Simple safety check
 */
export function isPromptSafe(content: string, threshold = 60): boolean {
  const guard = createGuard({ riskThreshold: threshold })
  const result = guard.quickScan(content)
  return result.safe
}
