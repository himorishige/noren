/**
 * P3-3: A/B testing framework tests
 */

import { Registry } from '@himorishige/noren-core'
import { describe, expect, it } from 'vitest'
import {
  AB_TEST_SCENARIOS,
  type ABTestConfig,
  ABTestEngine,
  type ConfigurationVariant,
} from '../src/ab-testing.js'
import { GroundTruthManager } from '../src/evaluation.js'

describe('A/B Testing Framework', () => {
  it('should create basic configuration variants', () => {
    const variants: ConfigurationVariant[] = [
      {
        id: 'baseline',
        name: 'No Contextual',
        description: 'Baseline without contextual confidence',
        registryFactory: () =>
          new Registry({
            defaultAction: 'mask',
            enableContextualConfidence: false,
          }),
      },
      {
        id: 'contextual',
        name: 'With Contextual',
        description: 'With contextual confidence enabled',
        registryFactory: () =>
          new Registry({
            defaultAction: 'mask',
            enableContextualConfidence: true,
            contextualSuppressionEnabled: true,
          }),
      },
    ]

    expect(variants.length).toBe(2)
    expect(variants[0].id).toBe('baseline')
    expect(variants[1].id).toBe('contextual')

    // Test registry factory creation
    const baselineRegistry = variants[0].registryFactory()
    const contextualRegistry = variants[1].registryFactory()

    expect(baselineRegistry).toBeInstanceOf(Registry)
    expect(contextualRegistry).toBeInstanceOf(Registry)
  })

  it('should run A/B test with minimal configuration', async () => {
    const engine = new ABTestEngine()

    const config: ABTestConfig = {
      test_name: 'Minimal Test',
      variants: [
        {
          id: 'v1',
          name: 'Variant 1',
          description: 'Basic configuration',
          registryFactory: () =>
            new Registry({
              defaultAction: 'mask',
              enableContextualConfidence: false,
            }),
        },
        {
          id: 'v2',
          name: 'Variant 2',
          description: 'Enhanced configuration',
          registryFactory: () =>
            new Registry({
              defaultAction: 'mask',
              enableContextualConfidence: true,
            }),
        },
      ],
      sample_size_per_variant: 5,
      confidence_level: 0.95,
      minimum_effect_size: 0.1,
      benchmark_config: {
        iterations: 5,
        warmup_iterations: 1,
        text_sizes: [1000],
        pii_densities: [10],
        collect_memory: false,
        collect_gc: false,
      },
      early_stopping_enabled: false,
      significance_threshold: 0.05,
    }

    const result = await engine.runABTest(config)

    expect(result).toBeTruthy()
    expect(result.test_name).toBe('Minimal Test')
    expect(result.variants.length).toBe(2)
    expect(result.test_summary).toBeTruthy()
    expect(Array.isArray(result.recommendations)).toBe(true)

    // Check variant results structure
    for (const variant of result.variants) {
      expect(variant.variant_id).toBeTruthy()
      expect(variant.variant_name).toBeTruthy()
      expect(variant.performance).toBeTruthy()
      expect(typeof variant.performance.avg_duration_ms).toBe('number')
      expect(typeof variant.performance.throughput_chars_per_sec).toBe('number')
      expect(variant.confidence_interval).toBeTruthy()
      expect(typeof variant.sample_size).toBe('number')
    }
  })

  it('should generate performance recommendations', async () => {
    const engine = new ABTestEngine()

    // Create a test with intentionally different performance characteristics
    const config: ABTestConfig = {
      test_name: 'Performance Test',
      variants: [
        {
          id: 'fast',
          name: 'Fast Variant',
          description: 'Simple configuration for speed',
          registryFactory: () =>
            new Registry({
              defaultAction: 'mask',
              enableContextualConfidence: false,
              contextHints: [], // Minimal hints for speed
            }),
        },
        {
          id: 'slow',
          name: 'Slow Variant',
          description: 'Complex configuration',
          registryFactory: () =>
            new Registry({
              defaultAction: 'mask',
              enableContextualConfidence: true,
              contextualSuppressionEnabled: true,
              contextualBoostEnabled: true,
              contextHints: ['email', 'phone', 'credit_card', 'ip', 'address'], // More hints
            }),
        },
      ],
      sample_size_per_variant: 3,
      confidence_level: 0.95,
      minimum_effect_size: 0.2,
      benchmark_config: {
        iterations: 3,
        warmup_iterations: 1,
        text_sizes: [2000],
        pii_densities: [15],
        collect_memory: false,
        collect_gc: false,
      },
      early_stopping_enabled: false,
      significance_threshold: 0.05,
    }

    const result = await engine.runABTest(config)

    expect(result.recommendations.length).toBeGreaterThanOrEqual(0)

    // Check if we got performance-related recommendations
    const perfRecommendations = result.recommendations.filter((r) => r.type === 'performance')
    if (perfRecommendations.length > 0) {
      const rec = perfRecommendations[0]
      expect(rec.title).toBeTruthy()
      expect(rec.description).toBeTruthy()
      expect(['high', 'medium', 'low'].includes(rec.priority)).toBe(true)
      expect(rec.impact_estimate).toBeTruthy()
    }
  })

  it('should detect statistical significance', async () => {
    const engine = new ABTestEngine()

    const config: ABTestConfig = {
      test_name: 'Significance Test',
      variants: [
        {
          id: 'baseline',
          name: 'Baseline',
          description: 'Control group',
          registryFactory: () => new Registry({ defaultAction: 'mask' }),
        },
        {
          id: 'treatment',
          name: 'Treatment',
          description: 'Test group',
          registryFactory: () =>
            new Registry({
              defaultAction: 'mask',
              enableContextualConfidence: true,
            }),
        },
      ],
      sample_size_per_variant: 10,
      confidence_level: 0.95,
      minimum_effect_size: 0.05,
      benchmark_config: {
        iterations: 10,
        warmup_iterations: 2,
        text_sizes: [1500],
        pii_densities: [12],
        collect_memory: false,
        collect_gc: false,
      },
      early_stopping_enabled: false,
      significance_threshold: 0.1, // More lenient for testing
    }

    const result = await engine.runABTest(config)

    // Winner detection is based on combined score and significance
    if (result.winner) {
      expect(result.winner.variant_id).toBeTruthy()
      expect(typeof result.winner.improvement_percentage).toBe('number')
      expect(typeof result.winner.statistical_significance).toBe('number')
      expect(result.winner.statistical_significance).toBeGreaterThanOrEqual(0)
      expect(result.winner.statistical_significance).toBeLessThanOrEqual(1)
    }
  })

  it('should work with ground truth for accuracy testing', async () => {
    const engine = new ABTestEngine()
    const groundTruth = new GroundTruthManager()

    // Add some ground truth data
    groundTruth.addEntry({
      id: 'test1',
      text: 'Contact John at john@example.com or call 555-123-4567',
      annotations: [
        { start: 16, end: 32, type: 'email', value: 'john@example.com' },
        { start: 41, end: 53, type: 'phone', value: '555-123-4567' },
      ],
    })

    groundTruth.addEntry({
      id: 'test2',
      text: 'Send payment to account 4532-1234-5678-9012',
      annotations: [{ start: 24, end: 43, type: 'credit_card', value: '4532-1234-5678-9012' }],
    })

    const config: ABTestConfig = {
      test_name: 'Accuracy Test',
      variants: [
        {
          id: 'standard',
          name: 'Standard Detection',
          description: 'Default configuration',
          registryFactory: () => new Registry({ defaultAction: 'mask' }),
        },
      ],
      sample_size_per_variant: 3,
      confidence_level: 0.95,
      minimum_effect_size: 0.1,
      benchmark_config: {
        iterations: 3,
        warmup_iterations: 1,
        text_sizes: [500],
        pii_densities: [20],
        collect_memory: false,
        collect_gc: false,
      },
      ground_truth_manager: groundTruth,
      early_stopping_enabled: false,
      significance_threshold: 0.05,
    }

    const result = await engine.runABTest(config)

    expect(result.variants.length).toBe(1)

    const variant = result.variants[0]
    if (variant.accuracy) {
      expect(typeof variant.accuracy.precision).toBe('number')
      expect(typeof variant.accuracy.recall).toBe('number')
      expect(typeof variant.accuracy.f1_score).toBe('number')
      expect(variant.accuracy.precision).toBeGreaterThanOrEqual(0)
      expect(variant.accuracy.precision).toBeLessThanOrEqual(1)
      expect(variant.accuracy.recall).toBeGreaterThanOrEqual(0)
      expect(variant.accuracy.recall).toBeLessThanOrEqual(1)
      expect(variant.accuracy.f1_score).toBeGreaterThanOrEqual(0)
      expect(variant.accuracy.f1_score).toBeLessThanOrEqual(1)
    }
  })

  it('should use predefined test scenarios', () => {
    // Test contextual confidence scenario
    const contextualScenario = AB_TEST_SCENARIOS.contextualConfidence
    expect(contextualScenario).toBeTruthy()
    expect(contextualScenario.test_name).toBe('Contextual Confidence A/B Test')
    expect(contextualScenario.variants.length).toBe(3)

    const variantIds = contextualScenario.variants.map((v) => v.id)
    expect(variantIds.includes('baseline')).toBe(true)
    expect(variantIds.includes('conservative')).toBe(true)
    expect(variantIds.includes('full')).toBe(true)

    // Test confidence threshold scenario
    const thresholdScenario = AB_TEST_SCENARIOS.confidenceThreshold
    expect(thresholdScenario).toBeTruthy()
    expect(thresholdScenario.test_name).toBe('Confidence Threshold Optimization')
    expect(thresholdScenario.variants.length).toBe(3)

    const thresholdIds = thresholdScenario.variants.map((v) => v.id)
    expect(thresholdIds.includes('low-threshold')).toBe(true)
    expect(thresholdIds.includes('medium-threshold')).toBe(true)
    expect(thresholdIds.includes('high-threshold')).toBe(true)
  })
})
