/**
 * P3-3: Continuous improvement cycle for PII detection optimization
 * Integrates A/B testing results into systematic configuration improvements
 */

import {
  type ABTestConfig,
  ABTestEngine,
  type ABTestResult,
  type Recommendation,
} from './ab-testing.js'
import { type BenchmarkConfig, BenchmarkRunner } from './benchmark.js'
import { EvaluationEngine, type GroundTruthManager } from './evaluation.js'
import { Registry } from './index.js'
import { getMetricsCollector } from './metrics.js'

/**
 * Improvement cycle configuration
 */
export interface ImprovementCycleConfig {
  // Testing configuration
  baseline_variant: {
    id: string
    name: string
    registry_factory: () => Registry
  }

  // Automatic test generation
  auto_generate_variants: boolean
  max_variants_per_cycle: number
  min_effect_size_threshold: number

  // Cycle parameters
  cycle_duration_ms: number
  min_data_points_per_variant: number
  significance_threshold: number

  // Safety constraints
  max_performance_degradation: number // e.g., 0.5 = max 50% slower
  min_accuracy_threshold: number // e.g., 0.8 = min 80% F1 score

  // Ground truth and benchmarking
  ground_truth_manager?: GroundTruthManager
  benchmark_config: BenchmarkConfig
}

/**
 * Improvement cycle state
 */
export interface CycleState {
  cycle_id: string
  started_at: number
  current_phase: 'baseline' | 'testing' | 'analysis' | 'deployment' | 'monitoring'
  baseline_results: {
    performance_baseline: number // avg duration in ms
    accuracy_baseline?: number // F1 score
  }
  test_results: ABTestResult[]
  selected_improvement?: {
    variant_id: string
    expected_improvement: number
    deployment_timestamp: number
  }
  monitoring_data: {
    samples_collected: number
    performance_impact: number
    accuracy_impact?: number
  }
}

/**
 * Improvement recommendation with implementation
 */
export interface ActionableRecommendation extends Recommendation {
  // Configuration changes to implement
  config_changes: {
    parameter: string
    current_value: unknown
    suggested_value: unknown
    justification: string
  }[]

  // Rollback plan
  rollback_config: Record<string, unknown>

  // Success criteria
  success_criteria: {
    performance_improvement_min: number
    accuracy_maintained_min?: number
    confidence_level: number
  }

  // Risk assessment
  risk_level: 'low' | 'medium' | 'high'
  mitigation_strategy: string
}

/**
 * Configuration variant generator
 * Static class for variant generation utilities
 * @note Using class with static methods for logical grouping of related functions
 */
// biome-ignore lint/complexity/noStaticOnlyClass: Logical grouping of variant generation utilities
export class VariantGenerator {
  /**
   * Generate configuration variants based on baseline and recommendations
   */
  static generateVariantsFromRecommendations(
    baseline: () => Registry,
    recommendations: Recommendation[],
  ): { id: string; name: string; description: string; registryFactory: () => Registry }[] {
    const variants = []

    for (const rec of recommendations) {
      if (rec.type === 'performance' && rec.priority === 'high') {
        // Generate performance-focused variant
        variants.push({
          id: `perf-opt-${Date.now()}`,
          name: 'Performance Optimized',
          description: rec.title,
          registryFactory: () => {
            const baseConfig = baseline().getPolicy()
            return new Registry({
              ...baseConfig,
              enableContextualConfidence: false, // Disable for speed
              contextHints: baseConfig.contextHints?.slice(0, 3) || [], // Limit hints
            })
          },
        })
      }

      if (rec.type === 'accuracy' && rec.priority !== 'low') {
        // Generate accuracy-focused variant
        variants.push({
          id: `acc-opt-${Date.now()}`,
          name: 'Accuracy Optimized',
          description: rec.title,
          registryFactory: () => {
            const baseConfig = baseline().getPolicy()
            return new Registry({
              ...baseConfig,
              enableContextualConfidence: true,
              contextualSuppressionEnabled: true,
              contextualBoostEnabled: true,
              confidenceThreshold: (baseConfig.confidenceThreshold || 0.5) * 0.9, // Lower threshold
            })
          },
        })
      }

      if (rec.type === 'configuration') {
        // Generate configuration-tuned variant
        variants.push({
          id: `config-opt-${Date.now()}`,
          name: 'Configuration Tuned',
          description: rec.title,
          registryFactory: () => {
            const baseConfig = baseline().getPolicy()
            return new Registry({
              ...baseConfig,
              enableContextualConfidence: true,
              contextualSuppressionEnabled: true,
              contextualBoostEnabled: false, // Conservative boost
              confidenceThreshold: 0.6, // Moderate threshold
            })
          },
        })
      }
    }

    return variants.slice(0, 3) // Limit to 3 variants for practical testing
  }

  /**
   * Generate exploratory variants for discovery
   */
  static generateExploratoryVariants(
    baseline: () => Registry,
  ): { id: string; name: string; description: string; registryFactory: () => Registry }[] {
    const baseConfig = baseline().getPolicy()

    return [
      {
        id: 'minimal-config',
        name: 'Minimal Configuration',
        description: 'Fastest possible configuration with basic detection',
        registryFactory: () =>
          new Registry({
            defaultAction: 'mask',
            enableContextualConfidence: false,
            contextHints: ['email'], // Only most essential hint
          }),
      },
      {
        id: 'balanced-tuned',
        name: 'Balanced Tuned',
        description: 'Optimized balance between speed and accuracy',
        registryFactory: () =>
          new Registry({
            ...baseConfig,
            enableContextualConfidence: true,
            contextualSuppressionEnabled: true,
            contextualBoostEnabled: false,
            confidenceThreshold: 0.55,
            contextHints: ['email', 'phone', 'credit_card'], // Core hints
          }),
      },
      {
        id: 'comprehensive-detection',
        name: 'Comprehensive Detection',
        description: 'Maximum detection coverage with all features',
        registryFactory: () =>
          new Registry({
            ...baseConfig,
            enableContextualConfidence: true,
            contextualSuppressionEnabled: true,
            contextualBoostEnabled: true,
            confidenceThreshold: 0.4, // Lower for maximum recall
            contextHints: ['email', 'phone', 'credit_card', 'ip', 'address', 'name', 'ssn'],
          }),
      },
    ]
  }
}

/**
 * Main improvement cycle engine
 */
export class ImprovementCycleEngine {
  private config: ImprovementCycleConfig
  private abTestEngine: ABTestEngine
  private currentState?: CycleState

  constructor(config: ImprovementCycleConfig) {
    this.config = config
    this.abTestEngine = new ABTestEngine()
  }

  /**
   * Start a new improvement cycle
   */
  async startCycle(): Promise<CycleState> {
    console.log('🔄 Starting improvement cycle...')

    const state: CycleState = {
      cycle_id: `cycle-${Date.now()}`,
      started_at: Date.now(),
      current_phase: 'baseline',
      baseline_results: {
        performance_baseline: 0,
      },
      test_results: [],
      monitoring_data: {
        samples_collected: 0,
        performance_impact: 0,
      },
    }

    this.currentState = state

    // Phase 1: Establish baseline
    await this.establishBaseline(state)

    // Phase 2: Generate and test variants
    await this.runTestingPhase(state)

    // Phase 3: Analyze results and select improvement
    await this.runAnalysisPhase(state)

    return state
  }

  /**
   * Establish performance and accuracy baseline
   */
  private async establishBaseline(state: CycleState): Promise<void> {
    console.log('📊 Establishing baseline metrics...')
    state.current_phase = 'baseline'

    const registry = this.config.baseline_variant.registry_factory()
    const runner = new BenchmarkRunner()

    // Performance baseline
    const detectOperation = async () => {
      const testText = runner.generateBenchmarkText(3000, 15)
      return await registry.detect(testText)
    }

    const { summary } = await runner.runBenchmark(
      'baseline-performance',
      detectOperation,
      this.config.benchmark_config,
    )

    state.baseline_results.performance_baseline = summary.avg_duration_ms

    // Accuracy baseline (if ground truth available)
    if (this.config.ground_truth_manager) {
      const evaluationEngine = new EvaluationEngine(this.config.ground_truth_manager)
      const entries = this.config.ground_truth_manager.getAllEntries()

      const detectionResults: Record<string, unknown[]> = {}
      for (const entry of entries.slice(0, 10)) {
        const result = await registry.detect(entry.text)
        detectionResults[entry.id] = result.hits.map((hit) => ({
          start: hit.start,
          end: hit.end,
          type: hit.type,
          value: hit.value,
          confidence: hit.confidence || 0.8,
        }))
      }

      const metrics = evaluationEngine.evaluateDataset(detectionResults)
      state.baseline_results.accuracy_baseline = metrics.f1_score
    }

    console.log(
      `✅ Baseline established: ${state.baseline_results.performance_baseline.toFixed(2)}ms avg`,
    )
    if (state.baseline_results.accuracy_baseline) {
      console.log(`   Accuracy baseline: ${state.baseline_results.accuracy_baseline.toFixed(3)} F1`)
    }
  }

  /**
   * Generate variants and run A/B tests
   */
  private async runTestingPhase(state: CycleState): Promise<void> {
    console.log('🧪 Running testing phase...')
    state.current_phase = 'testing'

    // Generate test variants
    let variants: {
      id: string
      name: string
      description: string
      registryFactory: () => Registry
    }[] = []

    if (this.config.auto_generate_variants) {
      // Start with exploratory variants if no recommendations exist
      variants = VariantGenerator.generateExploratoryVariants(
        this.config.baseline_variant.registry_factory,
      )
    }

    // Add baseline variant
    variants.unshift({
      id: this.config.baseline_variant.id,
      name: this.config.baseline_variant.name,
      description: 'Current baseline configuration',
      registryFactory: this.config.baseline_variant.registry_factory,
    })

    // Limit variants
    variants = variants.slice(0, this.config.max_variants_per_cycle)

    // Run A/B test
    const abTestConfig: ABTestConfig = {
      test_name: `Improvement Cycle ${state.cycle_id}`,
      variants,
      sample_size_per_variant: this.config.min_data_points_per_variant,
      confidence_level: 0.95,
      minimum_effect_size: this.config.min_effect_size_threshold,
      benchmark_config: this.config.benchmark_config,
      ground_truth_manager: this.config.ground_truth_manager,
      early_stopping_enabled: true,
      significance_threshold: this.config.significance_threshold,
    }

    const testResult = await this.abTestEngine.runABTest(abTestConfig)
    state.test_results.push(testResult)

    console.log(`✅ Testing completed with ${variants.length} variants`)
  }

  /**
   * Analyze results and select best improvement
   */
  private async runAnalysisPhase(state: CycleState): Promise<void> {
    console.log('📈 Analyzing test results...')
    state.current_phase = 'analysis'

    const testResult = state.test_results[0]
    if (!testResult || !testResult.winner) {
      console.log('ℹ️ No significant improvement found in this cycle')
      return
    }

    const winnerVariant = testResult.variants.find(
      (v) => v.variant_id === testResult.winner?.variant_id,
    )
    if (!winnerVariant) return

    // Safety checks
    const performanceImpact =
      winnerVariant.performance.avg_duration_ms / state.baseline_results.performance_baseline - 1
    const accuracyImpact =
      winnerVariant.accuracy && state.baseline_results.accuracy_baseline
        ? winnerVariant.accuracy.f1_score / state.baseline_results.accuracy_baseline - 1
        : 0

    // Check safety constraints
    if (performanceImpact > this.config.max_performance_degradation) {
      console.log(`⚠️ Performance degradation too high: ${(performanceImpact * 100).toFixed(1)}%`)
      return
    }

    if (
      winnerVariant.accuracy &&
      winnerVariant.accuracy.f1_score < this.config.min_accuracy_threshold
    ) {
      console.log(`⚠️ Accuracy below threshold: ${winnerVariant.accuracy.f1_score.toFixed(3)}`)
      return
    }

    // Select improvement
    state.selected_improvement = {
      variant_id: testResult.winner.variant_id,
      expected_improvement: testResult.winner.improvement_percentage,
      deployment_timestamp: Date.now(),
    }

    console.log(`🎯 Selected improvement: ${winnerVariant.variant_name}`)
    console.log(`   Expected improvement: ${testResult.winner.improvement_percentage.toFixed(1)}%`)
    console.log(`   Performance impact: ${(performanceImpact * 100).toFixed(1)}%`)
    if (accuracyImpact !== 0) {
      console.log(`   Accuracy impact: ${(accuracyImpact * 100).toFixed(1)}%`)
    }

    // Record improvement metrics
    const metricsCollector = getMetricsCollector()
    metricsCollector.recordMetric({
      timestamp: Date.now(),
      name: 'noren.improvement_cycle.improvement_selected',
      value: testResult.winner.improvement_percentage,
      labels: {
        cycle_id: state.cycle_id,
        variant_id: testResult.winner.variant_id,
        metric: testResult.winner.metric,
      },
    })
  }

  /**
   * Get current cycle state
   */
  getCurrentState(): CycleState | undefined {
    return this.currentState
  }

  /**
   * Generate actionable recommendations from A/B test results
   */
  generateActionableRecommendations(testResult: ABTestResult): ActionableRecommendation[] {
    const actionable: ActionableRecommendation[] = []

    for (const rec of testResult.recommendations) {
      if (rec.type === 'performance' && rec.priority === 'high') {
        actionable.push({
          ...rec,
          config_changes: [
            {
              parameter: 'enableContextualConfidence',
              current_value: true,
              suggested_value: false,
              justification: 'Contextual confidence causes 200-400% performance degradation',
            },
            {
              parameter: 'contextHints',
              current_value: ['email', 'phone', 'credit_card', 'ip', 'address'],
              suggested_value: ['email', 'phone'],
              justification: 'Reduce context hint processing overhead',
            },
          ],
          rollback_config: {
            enableContextualConfidence: true,
            contextHints: ['email', 'phone', 'credit_card', 'ip', 'address'],
          },
          success_criteria: {
            performance_improvement_min: 50, // 50% faster
            confidence_level: 0.95,
          },
          risk_level: 'medium',
          mitigation_strategy: 'Monitor accuracy metrics and rollback if F1 score drops below 0.8',
        })
      }
    }

    return actionable
  }
}
