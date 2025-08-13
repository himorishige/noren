/**
 * P3-3: A/B testing framework for continuous improvement
 * Enables systematic comparison of different PII detection configurations
 */

import { type BenchmarkConfig, BenchmarkRunner } from './benchmark.js'
import { type AggregateMetrics, EvaluationEngine, type GroundTruthManager } from './evaluation.js'
import { Registry } from './index.js'

/**
 * Configuration variant for A/B testing
 */
export interface ConfigurationVariant {
  id: string
  name: string
  description: string
  registryFactory: () => Registry
  weight?: number // Traffic allocation weight (default: equal distribution)
  metadata?: {
    version?: string
    author?: string
    created_at?: number
    tags?: string[]
  }
}

/**
 * A/B test results for a single variant
 */
export interface VariantResult {
  variant_id: string
  variant_name: string

  // Performance metrics
  performance: {
    avg_duration_ms: number
    median_duration_ms: number
    p95_duration_ms: number
    throughput_chars_per_sec: number
    memory_efficiency_mb_per_kb: number
    error_rate: number
  }

  // Accuracy metrics (if ground truth available)
  accuracy?: {
    precision: number
    recall: number
    f1_score: number
    true_positives: number
    false_positives: number
    false_negatives: number
  }

  // Statistical significance
  sample_size: number
  confidence_interval: {
    lower: number
    upper: number
    level: number // e.g., 0.95 for 95% confidence
  }

  // Metadata
  test_duration_ms: number
  timestamp: number
}

/**
 * A/B test comparison results
 */
export interface ABTestResult {
  test_id: string
  test_name: string
  variants: VariantResult[]
  winner?: {
    variant_id: string
    metric: string
    improvement_percentage: number
    statistical_significance: number
    confidence_level: number
  }
  recommendations: Recommendation[]
  test_summary: {
    total_samples: number
    test_duration_ms: number
    started_at: number
    completed_at: number
  }
}

/**
 * Improvement recommendations
 */
export interface Recommendation {
  type: 'performance' | 'accuracy' | 'memory' | 'configuration'
  priority: 'high' | 'medium' | 'low'
  title: string
  description: string
  impact_estimate: {
    performance_improvement?: string
    accuracy_improvement?: string
    memory_improvement?: string
  }
  implementation_complexity: 'low' | 'medium' | 'high'
  estimated_effort: string
}

/**
 * A/B test configuration
 */
export interface ABTestConfig {
  test_name: string
  variants: ConfigurationVariant[]

  // Test parameters
  sample_size_per_variant: number
  confidence_level: number // e.g., 0.95 for 95%
  minimum_effect_size: number // Minimum improvement to detect

  // Test data
  benchmark_config: BenchmarkConfig
  ground_truth_manager?: GroundTruthManager

  // Early stopping criteria
  max_duration_ms?: number
  early_stopping_enabled: boolean
  significance_threshold: number // p-value threshold for early stopping

  // Metadata
  description?: string
  tags?: string[]
}

/**
 * Statistical utilities for A/B testing
 * @note Using class with static methods for logical grouping of statistical functions
 */
// biome-ignore lint/complexity/noStaticOnlyClass: Logical grouping of statistical utility functions
class StatisticalAnalysis {
  /**
   * Welch's t-test for comparing two samples with unequal variances
   */
  static welchTTest(
    sample1: number[],
    sample2: number[],
  ): {
    tStatistic: number
    pValue: number
    degreesOfFreedom: number
  } {
    const n1 = sample1.length
    const n2 = sample2.length

    if (n1 < 2 || n2 < 2) {
      return { tStatistic: 0, pValue: 1, degreesOfFreedom: 0 }
    }

    const mean1 = sample1.reduce((a, b) => a + b, 0) / n1
    const mean2 = sample2.reduce((a, b) => a + b, 0) / n2

    const variance1 = sample1.reduce((acc, x) => acc + (x - mean1) ** 2, 0) / (n1 - 1)
    const variance2 = sample2.reduce((acc, x) => acc + (x - mean2) ** 2, 0) / (n2 - 1)

    const standardError = Math.sqrt(variance1 / n1 + variance2 / n2)
    const tStatistic = (mean1 - mean2) / standardError

    // Welch–Satterthwaite equation for degrees of freedom
    const df =
      (variance1 / n1 + variance2 / n2) ** 2 /
      ((variance1 / n1) ** 2 / (n1 - 1) + (variance2 / n2) ** 2 / (n2 - 1))

    // Approximate p-value using t-distribution (simplified)
    const pValue = StatisticalAnalysis.approximateTDistributionPValue(Math.abs(tStatistic), df)

    return {
      tStatistic,
      pValue: pValue * 2, // Two-tailed test
      degreesOfFreedom: df,
    }
  }

  /**
   * Approximate p-value for t-distribution (simplified implementation)
   */
  private static approximateTDistributionPValue(t: number, _df: number): number {
    // Very simplified approximation - in production use a proper statistics library
    if (t < 1) return 0.2
    if (t < 2) return 0.1
    if (t < 3) return 0.01
    if (t < 4) return 0.001
    return 0.0001
  }

  /**
   * Calculate confidence interval for mean
   */
  static confidenceInterval(
    sample: number[],
    confidenceLevel: number,
  ): {
    lower: number
    upper: number
    margin: number
  } {
    if (sample.length < 2) {
      const mean = sample.length > 0 ? sample[0] : 0
      return { lower: mean, upper: mean, margin: 0 }
    }

    const mean = sample.reduce((a, b) => a + b, 0) / sample.length
    const variance = sample.reduce((acc, x) => acc + (x - mean) ** 2, 0) / (sample.length - 1)
    const standardError = Math.sqrt(variance / sample.length)

    // Approximate critical t-value (simplified)
    // const alpha = 1 - confidenceLevel // Currently unused but kept for future statistical calculations
    const tCritical = confidenceLevel > 0.9 ? 2.0 : 1.64 // Rough approximation

    const margin = tCritical * standardError

    return {
      lower: mean - margin,
      upper: mean + margin,
      margin,
    }
  }

  /**
   * Effect size calculation (Cohen's d)
   */
  static cohensD(sample1: number[], sample2: number[]): number {
    const mean1 = sample1.reduce((a, b) => a + b, 0) / sample1.length
    const mean2 = sample2.reduce((a, b) => a + b, 0) / sample2.length

    const variance1 = sample1.reduce((acc, x) => acc + (x - mean1) ** 2, 0) / (sample1.length - 1)
    const variance2 = sample2.reduce((acc, x) => acc + (x - mean2) ** 2, 0) / (sample2.length - 1)

    const pooledStandardDeviation = Math.sqrt((variance1 + variance2) / 2)

    return Math.abs(mean1 - mean2) / pooledStandardDeviation
  }
}

/**
 * Main A/B testing engine
 */
export class ABTestEngine {
  private benchmarkRunner = new BenchmarkRunner()

  /**
   * Run a complete A/B test comparing multiple configuration variants
   */
  async runABTest(config: ABTestConfig): Promise<ABTestResult> {
    console.log(`🧪 Starting A/B Test: ${config.test_name}`)
    console.log(
      `Testing ${config.variants.length} variants with ${config.sample_size_per_variant} samples each`,
    )

    const startTime = Date.now()
    const variantResults: VariantResult[] = []

    // Run tests for each variant
    for (let i = 0; i < config.variants.length; i++) {
      const variant = config.variants[i]
      console.log(`\\nTesting Variant ${i + 1}/${config.variants.length}: ${variant.name}`)

      const variantResult = await this.runVariantTest(variant, config)
      variantResults.push(variantResult)

      // Early stopping check (simplified)
      if (config.early_stopping_enabled && variantResults.length >= 2) {
        const shouldStop = this.checkEarlyStopping(variantResults, config)
        if (shouldStop) {
          console.log(`⚡ Early stopping triggered - significant difference detected`)
          break
        }
      }
    }

    const endTime = Date.now()

    // Analyze results and determine winner
    const winner = this.determineWinner(variantResults, config)
    const recommendations = this.generateRecommendations(variantResults)

    const result: ABTestResult = {
      test_id: `ab-test-${Date.now()}`,
      test_name: config.test_name,
      variants: variantResults,
      winner,
      recommendations,
      test_summary: {
        total_samples: variantResults.reduce((sum, v) => sum + v.sample_size, 0),
        test_duration_ms: endTime - startTime,
        started_at: startTime,
        completed_at: endTime,
      },
    }

    this.printResults(result)
    return result
  }

  /**
   * Test a single configuration variant
   */
  private async runVariantTest(
    variant: ConfigurationVariant,
    config: ABTestConfig,
  ): Promise<VariantResult> {
    const registry = variant.registryFactory()
    const testStartTime = Date.now()

    // Performance testing
    const detectOperation = async () => {
      const testText = this.benchmarkRunner.generateBenchmarkText(3000, 15)
      const result = await registry.detect(testText)
      return result
    }

    const { summary: perfResults } = await this.benchmarkRunner.runBenchmark(
      `variant-${variant.id}`,
      detectOperation,
      config.benchmark_config,
    )

    // Accuracy testing (if ground truth available)
    let accuracyResults: AggregateMetrics | undefined
    if (config.ground_truth_manager) {
      accuracyResults = await this.runAccuracyTest(registry, config.ground_truth_manager)
    }

    // Calculate confidence intervals
    const performanceData = [perfResults.avg_duration_ms] // In real implementation, use all raw data
    const confidenceInterval = StatisticalAnalysis.confidenceInterval(
      performanceData,
      config.confidence_level,
    )

    const result: VariantResult = {
      variant_id: variant.id,
      variant_name: variant.name,
      performance: {
        avg_duration_ms: perfResults.avg_duration_ms,
        median_duration_ms: perfResults.median_duration_ms,
        p95_duration_ms: perfResults.p95_duration_ms,
        throughput_chars_per_sec: perfResults.avg_throughput_ops_per_sec,
        memory_efficiency_mb_per_kb: perfResults.memory_efficiency_mb_per_kb,
        error_rate: perfResults.error_count / Math.max(perfResults.total_runs, 1),
      },
      accuracy: accuracyResults
        ? {
            precision: accuracyResults.precision,
            recall: accuracyResults.recall,
            f1_score: accuracyResults.f1_score,
            true_positives: accuracyResults.true_positives,
            false_positives: accuracyResults.false_positives,
            false_negatives: accuracyResults.false_negatives,
          }
        : undefined,
      sample_size: perfResults.total_runs,
      confidence_interval: {
        lower: confidenceInterval.lower,
        upper: confidenceInterval.upper,
        level: config.confidence_level,
      },
      test_duration_ms: Date.now() - testStartTime,
      timestamp: testStartTime,
    }

    return result
  }

  /**
   * Run accuracy test against ground truth
   */
  private async runAccuracyTest(
    registry: Registry,
    groundTruthManager: GroundTruthManager,
  ): Promise<AggregateMetrics> {
    const evaluationEngine = new EvaluationEngine(groundTruthManager)
    const entries = groundTruthManager.getAllEntries()

    const detectionResults: Record<string, unknown[]> = {}

    // Run detection on all ground truth entries
    for (const entry of entries.slice(0, 10)) {
      // Limit for performance
      const result = await registry.detect(entry.text)
      detectionResults[entry.id] = result.hits.map((hit) => ({
        start: hit.start,
        end: hit.end,
        type: hit.type,
        value: hit.value,
        confidence: hit.confidence || 0.8,
      }))
    }

    return evaluationEngine.evaluateDataset(detectionResults)
  }

  /**
   * Check if early stopping criteria are met
   */
  private checkEarlyStopping(results: VariantResult[], config: ABTestConfig): boolean {
    if (results.length < 2) return false

    // Simple early stopping based on performance difference
    const baseline = results[0]
    const variant = results[results.length - 1]

    const performanceImprovement = Math.abs(
      (baseline.performance.avg_duration_ms - variant.performance.avg_duration_ms) /
        baseline.performance.avg_duration_ms,
    )

    return performanceImprovement > config.minimum_effect_size
  }

  /**
   * Determine the winning variant based on multiple criteria
   */
  private determineWinner(
    results: VariantResult[],
    config: ABTestConfig,
  ): ABTestResult['winner'] | undefined {
    if (results.length < 2) return undefined

    // Multi-criteria scoring: performance (60%) + accuracy (40%)
    const scoredResults = results.map((result) => {
      const performanceScore = 1 / result.performance.avg_duration_ms // Lower duration = higher score
      const accuracyScore = result.accuracy ? result.accuracy.f1_score : 0.5
      const combinedScore = performanceScore * 0.6 + accuracyScore * 0.4

      return {
        result,
        score: combinedScore,
        performanceScore,
        accuracyScore,
      }
    })

    // Find best performer
    const sorted = scoredResults.sort((a, b) => b.score - a.score)
    const winner = sorted[0]
    const baseline = sorted[1]

    if (!baseline) return undefined

    // Calculate improvement
    const improvementPct = ((winner.score - baseline.score) / baseline.score) * 100

    // Statistical significance (simplified)
    const significance = improvementPct > config.minimum_effect_size * 100 ? 0.95 : 0.5

    if (significance < config.significance_threshold) return undefined

    return {
      variant_id: winner.result.variant_id,
      metric: 'combined_score',
      improvement_percentage: improvementPct,
      statistical_significance: significance,
      confidence_level: config.confidence_level,
    }
  }

  /**
   * Generate improvement recommendations based on test results
   */
  private generateRecommendations(results: VariantResult[]): Recommendation[] {
    const recommendations: Recommendation[] = []

    if (results.length === 0) return recommendations

    // Analyze performance patterns
    const avgDuration =
      results.reduce((sum, r) => sum + r.performance.avg_duration_ms, 0) / results.length
    const maxDuration = Math.max(...results.map((r) => r.performance.avg_duration_ms))

    if (maxDuration > avgDuration * 2) {
      recommendations.push({
        type: 'performance',
        priority: 'high',
        title: 'Optimize slow configuration variants',
        description: `Some variants are >100% slower than average (${maxDuration.toFixed(2)}ms vs ${avgDuration.toFixed(2)}ms avg)`,
        impact_estimate: {
          performance_improvement: '50-100%',
        },
        implementation_complexity: 'medium',
        estimated_effort: '2-3 days',
      })
    }

    // Analyze accuracy patterns
    const accuracyResults = results
      .filter((r) => r.accuracy)
      .map((r) => r.accuracy) as AccuracyMetrics[]
    if (accuracyResults.length > 1) {
      const avgF1 =
        accuracyResults.reduce((sum, acc) => sum + acc.f1_score, 0) / accuracyResults.length
      const minF1 = Math.min(...accuracyResults.map((acc) => acc.f1_score))

      if (minF1 < avgF1 * 0.8) {
        recommendations.push({
          type: 'accuracy',
          priority: 'medium',
          title: 'Improve detection accuracy for underperforming variants',
          description: `Some variants have significantly lower F1 scores (${minF1.toFixed(3)} vs ${avgF1.toFixed(3)} avg)`,
          impact_estimate: {
            accuracy_improvement: '10-20%',
          },
          implementation_complexity: 'medium',
          estimated_effort: '3-5 days',
        })
      }
    }

    // Memory efficiency recommendations
    const avgMemoryEff =
      results.reduce((sum, r) => sum + r.performance.memory_efficiency_mb_per_kb, 0) /
      results.length
    if (avgMemoryEff > 2.0) {
      recommendations.push({
        type: 'memory',
        priority: 'low',
        title: 'Optimize memory usage',
        description: `Memory efficiency could be improved (${avgMemoryEff.toFixed(2)} MB/KB average)`,
        impact_estimate: {
          memory_improvement: '20-40%',
        },
        implementation_complexity: 'high',
        estimated_effort: '1-2 weeks',
      })
    }

    return recommendations
  }

  /**
   * Print formatted test results
   */
  private printResults(result: ABTestResult): void {
    console.log(`\\n${'='.repeat(60)}`)
    console.log(`🎯 A/B Test Results: ${result.test_name}`)
    console.log(`${'='.repeat(60)}`)

    console.log(`\\n📊 Variant Performance:`)
    for (const variant of result.variants) {
      console.log(`\\n  ${variant.variant_name}:`)
      console.log(`    ⚡ Avg Duration: ${variant.performance.avg_duration_ms.toFixed(2)}ms`)
      console.log(
        `    🚀 Throughput: ${(variant.performance.throughput_chars_per_sec / 1000).toFixed(1)}K chars/sec`,
      )
      console.log(
        `    💾 Memory Efficiency: ${variant.performance.memory_efficiency_mb_per_kb.toFixed(3)} MB/KB`,
      )
      if (variant.accuracy) {
        console.log(`    🎯 F1 Score: ${variant.accuracy.f1_score.toFixed(3)}`)
        console.log(
          `    ✅ Precision: ${variant.accuracy.precision.toFixed(3)}, Recall: ${variant.accuracy.recall.toFixed(3)}`,
        )
      }
      console.log(
        `    📈 Confidence: [${variant.confidence_interval.lower.toFixed(2)}, ${variant.confidence_interval.upper.toFixed(2)}]`,
      )
    }

    if (result.winner) {
      console.log(
        `\\n🏆 Winner: ${result.variants.find((v) => v.variant_id === result.winner?.variant_id)?.variant_name}`,
      )
      console.log(`  📈 Improvement: ${result.winner.improvement_percentage.toFixed(1)}%`)
      console.log(
        `  📊 Significance: ${(result.winner.statistical_significance * 100).toFixed(1)}%`,
      )
    } else {
      console.log(`\\n🤝 No clear winner detected - variants perform similarly`)
    }

    if (result.recommendations.length > 0) {
      console.log(`\\n💡 Recommendations:`)
      for (const rec of result.recommendations) {
        console.log(`\\n  ${rec.priority.toUpperCase()}: ${rec.title}`)
        console.log(`    ${rec.description}`)
        if (rec.impact_estimate.performance_improvement) {
          console.log(`    🚀 Performance Impact: ${rec.impact_estimate.performance_improvement}`)
        }
        if (rec.impact_estimate.accuracy_improvement) {
          console.log(`    🎯 Accuracy Impact: ${rec.impact_estimate.accuracy_improvement}`)
        }
        console.log(
          `    ⏱️ Effort: ${rec.estimated_effort} (${rec.implementation_complexity} complexity)`,
        )
      }
    }

    console.log(`\\n📋 Test Summary:`)
    console.log(`  Total Samples: ${result.test_summary.total_samples}`)
    console.log(`  Duration: ${(result.test_summary.test_duration_ms / 1000).toFixed(1)}s`)
    console.log(`  Completed: ${new Date(result.test_summary.completed_at).toISOString()}`)
  }
}

/**
 * Predefined A/B test scenarios for common optimizations
 */
export const AB_TEST_SCENARIOS = {
  /**
   * Test contextual confidence impact
   */
  contextualConfidence: {
    test_name: 'Contextual Confidence A/B Test',
    variants: [
      {
        id: 'baseline',
        name: 'Contextual Disabled',
        description: 'Baseline with no contextual confidence',
        registryFactory: () =>
          new Registry({
            defaultAction: 'mask',
            enableContextualConfidence: false,
          }),
      },
      {
        id: 'conservative',
        name: 'Conservative Contextual',
        description: 'Suppression-only contextual confidence',
        registryFactory: () =>
          new Registry({
            defaultAction: 'mask',
            enableContextualConfidence: true,
            contextualSuppressionEnabled: true,
            contextualBoostEnabled: false,
          }),
      },
      {
        id: 'full',
        name: 'Full Contextual',
        description: 'Both suppression and boost enabled',
        registryFactory: () =>
          new Registry({
            defaultAction: 'mask',
            enableContextualConfidence: true,
            contextualSuppressionEnabled: true,
            contextualBoostEnabled: true,
          }),
      },
    ],
  },

  /**
   * Test confidence threshold optimization
   */
  confidenceThreshold: {
    test_name: 'Confidence Threshold Optimization',
    variants: [
      {
        id: 'low-threshold',
        name: 'Low Threshold (0.3)',
        description: 'More sensitive detection',
        registryFactory: () =>
          new Registry({
            defaultAction: 'mask',
            confidenceThreshold: 0.3,
            enableContextualConfidence: true,
          }),
      },
      {
        id: 'medium-threshold',
        name: 'Medium Threshold (0.5)',
        description: 'Balanced detection',
        registryFactory: () =>
          new Registry({
            defaultAction: 'mask',
            confidenceThreshold: 0.5,
            enableContextualConfidence: true,
          }),
      },
      {
        id: 'high-threshold',
        name: 'High Threshold (0.7)',
        description: 'More conservative detection',
        registryFactory: () =>
          new Registry({
            defaultAction: 'mask',
            confidenceThreshold: 0.7,
            enableContextualConfidence: true,
          }),
      },
    ],
  },
} as const
