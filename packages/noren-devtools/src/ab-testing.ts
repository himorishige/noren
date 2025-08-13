/**
 * A/B testing framework for PII detection configurations
 * Streamlined implementation with unified statistical analysis and reporting
 */

import { Registry } from '@himorishige/noren-core'
import { type BenchmarkConfig, BenchmarkRunner } from './benchmark.js'
import { EvaluationEngine, type GroundTruthManager } from './evaluation.js'
import {
  type AccuracyMetrics,
  createABTestReport,
  type PerformanceMetrics,
  printReport,
} from './report-common.js'
import {
  type ConfidenceInterval,
  confidenceInterval,
  mean,
  type TTestResult,
  tTest,
} from './stats-common.js'

// ===== Core Interfaces =====

export interface ConfigurationVariant {
  id: string
  name: string
  description: string
  registryFactory: () => Registry
  weight?: number
  metadata?: Record<string, unknown>
}

export interface VariantResult {
  variant_id: string
  variant_name: string
  performance: PerformanceMetrics
  accuracy?: AccuracyMetrics
  sample_size: number
  confidence_interval: ConfidenceInterval
  raw_samples: number[]
  metadata?: Record<string, unknown>
}

export interface ABTestResult {
  test_name: string
  test_id: string
  variants: VariantResult[]
  winner?: {
    variant_id: string
    improvement_percentage: number
    statistical_significance: number
  }
  recommendations: Recommendation[]
  statistical_analysis: TTestResult
  metadata: {
    start_time: number
    end_time: number
    total_samples: number
    test_duration_ms: number
  }
}

export interface Recommendation {
  type: 'performance' | 'accuracy' | 'configuration'
  priority: 'high' | 'medium' | 'low'
  title: string
  description: string
  impact_estimate?: string
}

export interface ABTestConfig {
  test_name: string
  variants: ConfigurationVariant[]
  sample_size_per_variant: number
  confidence_level: number
  benchmark_config: BenchmarkConfig
  ground_truth_manager?: GroundTruthManager
  early_stopping_enabled?: boolean
  significance_threshold?: number
  description?: string
}

// ===== Predefined Test Scenarios =====

export const AB_TEST_SCENARIOS = {
  CONFIDENCE_SCORING: 'confidence-scoring-impact',
  PLUGIN_COMPARISON: 'plugin-performance-comparison',
  PATTERN_OPTIMIZATION: 'pattern-optimization-test',
  MEMORY_EFFICIENCY: 'memory-efficiency-test',
} as const

// ===== Main A/B Testing Engine =====

export class ABTestEngine {
  private benchmarkRunner: BenchmarkRunner
  private evaluationEngine?: EvaluationEngine

  constructor() {
    this.benchmarkRunner = new BenchmarkRunner()
    this.evaluationEngine = new EvaluationEngine()
  }

  async runTest(config: ABTestConfig): Promise<ABTestResult> {
    const startTime = Date.now()
    const testId = `test_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

    console.log(`🧪 Starting A/B Test: ${config.test_name}`)
    console.log(
      `Testing ${config.variants.length} variants with ${config.sample_size_per_variant} samples each`,
    )

    const variantResults: VariantResult[] = []

    // Run tests for each variant
    for (let i = 0; i < config.variants.length; i++) {
      const variant = config.variants[i]
      console.log(`\nTesting Variant ${i + 1}/${config.variants.length}: ${variant.name}`)

      const result = await this.testVariant(variant, config)
      variantResults.push(result)
    }

    const endTime = Date.now()

    // Statistical analysis
    const statisticalAnalysis = this.performStatisticalAnalysis(
      variantResults,
      config.confidence_level,
    )
    const winner = this.determineWinner(variantResults, statisticalAnalysis)
    const recommendations = this.generateRecommendations(variantResults, winner)

    const abTestResult: ABTestResult = {
      test_name: config.test_name,
      test_id: testId,
      variants: variantResults,
      winner,
      recommendations,
      statistical_analysis: statisticalAnalysis,
      metadata: {
        start_time: startTime,
        end_time: endTime,
        total_samples: variantResults.reduce((sum, v) => sum + v.sample_size, 0),
        test_duration_ms: endTime - startTime,
      },
    }

    // Generate and print report
    this.printResults(abTestResult)

    return abTestResult
  }

  private async testVariant(
    variant: ConfigurationVariant,
    config: ABTestConfig,
  ): Promise<VariantResult> {
    const registry = variant.registryFactory()
    const benchmarkId = `variant-${variant.id}`

    // Run benchmark
    const benchmarkResult = await this.benchmarkRunner.runBenchmark(
      benchmarkId,
      registry,
      config.benchmark_config.test_cases,
      {
        iterations: config.sample_size_per_variant,
        warmupRuns: Math.max(1, Math.floor(config.sample_size_per_variant * 0.2)),
        memoryMonitoring: true,
      },
    )

    // Performance metrics
    const durations = benchmarkResult.testCaseResults.flatMap((tc) =>
      tc.results.map((r) => r.duration),
    )
    const performanceMetrics: PerformanceMetrics = {
      duration: mean(durations),
      throughput: benchmarkResult.summary.throughput / 1000, // Convert to K chars/sec
      memoryUsage: benchmarkResult.summary.memoryEfficiency,
      errorRate: benchmarkResult.summary.errorRate || 0,
    }

    // Accuracy metrics (if ground truth available)
    let accuracyMetrics: AccuracyMetrics | undefined
    if (config.ground_truth_manager) {
      try {
        const evalResult = await this.evaluationEngine?.evaluateAgainstGroundTruth(
          registry,
          config.ground_truth_manager,
          {
            sample_size: Math.min(config.sample_size_per_variant, 100), // Limit accuracy evaluation
            include_false_positives: true,
            include_false_negatives: true,
          },
        )

        if (evalResult) {
          accuracyMetrics = {
            precision: evalResult.aggregate.precision,
            recall: evalResult.aggregate.recall,
            f1Score: evalResult.aggregate.f1_score,
            truePositives: evalResult.aggregate.true_positives,
            falsePositives: evalResult.aggregate.false_positives,
            falseNegatives: evalResult.aggregate.false_negatives,
          }
        }
      } catch (error) {
        console.warn(`Accuracy evaluation failed for variant ${variant.name}:`, error)
      }
    }

    return {
      variant_id: variant.id,
      variant_name: variant.name,
      performance: performanceMetrics,
      accuracy: accuracyMetrics,
      sample_size: durations.length,
      confidence_interval: confidenceInterval(durations, config.confidence_level),
      raw_samples: durations,
      metadata: {
        ...variant.metadata,
        benchmark_id: benchmarkId,
        test_timestamp: Date.now(),
      },
    }
  }

  private performStatisticalAnalysis(
    variants: VariantResult[],
    confidenceLevel: number,
  ): TTestResult {
    if (variants.length !== 2) {
      // For more than 2 variants, use the first two for simplicity
      return {
        tStatistic: 0,
        pValue: 1,
        significant: false,
        degreesOfFreedom: variants[0]?.sample_size || 0,
      }
    }

    const [variantA, variantB] = variants
    return tTest(variantA.raw_samples, variantB.raw_samples, 1 - confidenceLevel)
  }

  private determineWinner(
    variants: VariantResult[],
    statisticalAnalysis: TTestResult,
  ): ABTestResult['winner'] {
    if (variants.length < 2) return undefined

    // Find variant with best performance (lowest duration)
    const bestVariant = variants.reduce((best, current) =>
      current.performance.duration < best.performance.duration ? current : best,
    )

    const worstVariant = variants.reduce((worst, current) =>
      current.performance.duration > worst.performance.duration ? current : worst,
    )

    const improvementPercentage =
      worstVariant.performance.duration === 0
        ? 0
        : ((worstVariant.performance.duration - bestVariant.performance.duration) /
            worstVariant.performance.duration) *
          100

    const significance = statisticalAnalysis.significant ? 95 : 50 // Simplified

    return {
      variant_id: bestVariant.variant_id,
      improvement_percentage: improvementPercentage,
      statistical_significance: significance,
    }
  }

  private generateRecommendations(
    variants: VariantResult[],
    winner?: ABTestResult['winner'],
  ): Recommendation[] {
    const recommendations: Recommendation[] = []

    if (winner && winner.improvement_percentage > 10) {
      recommendations.push({
        type: 'performance',
        priority: 'high',
        title: `Use ${winner.variant_id} Configuration`,
        description: `Switching to this configuration could improve performance by ${winner.improvement_percentage.toFixed(1)}%`,
        impact_estimate: `${winner.improvement_percentage.toFixed(1)}% faster processing`,
      })
    }

    // Memory recommendations
    const memoryEfficient = variants.reduce((best, current) =>
      current.performance.memoryUsage < best.performance.memoryUsage ? current : best,
    )

    if (memoryEfficient.performance.memoryUsage < variants[0].performance.memoryUsage * 0.8) {
      recommendations.push({
        type: 'performance',
        priority: 'medium',
        title: 'Consider Memory Optimization',
        description: `${memoryEfficient.variant_name} uses 20% less memory`,
        impact_estimate: 'Reduced memory footprint for edge deployments',
      })
    }

    return recommendations
  }

  private printResults(result: ABTestResult): void {
    const variants = result.variants.map((v) => ({
      name: v.variant_name,
      performance: v.performance,
      accuracy: v.accuracy,
    }))

    const winner = result.winner
      ? result.variants.find((v) => v.variant_id === result.winner?.variant_id)?.variant_name ||
        'Unknown'
      : 'No clear winner detected - variants perform similarly'

    const improvement = result.winner?.improvement_percentage || 0
    const significance = result.winner?.statistical_significance || 50

    const report = createABTestReport(
      result.test_name,
      variants[0] || { name: 'N/A', performance: { duration: 0, throughput: 0, memoryUsage: 0 } },
      variants[1] || { name: 'N/A', performance: { duration: 0, throughput: 0, memoryUsage: 0 } },
      winner,
      improvement,
      significance,
      result.metadata.total_samples,
      result.metadata.test_duration_ms,
    )

    printReport(report)
  }
}

// ===== Utility Functions =====

export function createSimpleVariant(
  id: string,
  name: string,
  registryOptions: ConstructorParameters<typeof Registry>[0],
): ConfigurationVariant {
  return {
    id,
    name,
    description: `${name} configuration`,
    registryFactory: () => new Registry(registryOptions),
  }
}

export function createQuickABTest(
  variantA: ConfigurationVariant,
  variantB: ConfigurationVariant,
  testData: string[],
): ABTestConfig {
  return {
    test_name: `${variantA.name} vs ${variantB.name}`,
    variants: [variantA, variantB],
    sample_size_per_variant: 10,
    confidence_level: 0.95,
    benchmark_config: {
      test_cases: testData.map((text, i) => ({
        id: `test_${i}`,
        name: `Test Case ${i + 1}`,
        text,
        expected_pii_count: 0,
      })),
      iterations: 10,
    },
  }
}
