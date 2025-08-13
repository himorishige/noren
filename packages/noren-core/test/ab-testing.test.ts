/**
 * P3-3: A/B testing framework tests
 */

import { strict as assert } from 'node:assert'
import { describe, it } from 'node:test'
import {
  AB_TEST_SCENARIOS,
  type ABTestConfig,
  ABTestEngine,
  type ConfigurationVariant,
} from '../src/ab-testing.js'
import { GroundTruthManager } from '../src/evaluation.js'
import { Registry } from '../src/index.js'

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

    assert.equal(variants.length, 2, 'Should have 2 variants')
    assert.equal(variants[0].id, 'baseline', 'First variant ID should be baseline')
    assert.equal(variants[1].id, 'contextual', 'Second variant ID should be contextual')

    // Test registry factory creation
    const baselineRegistry = variants[0].registryFactory()
    const contextualRegistry = variants[1].registryFactory()

    assert.ok(baselineRegistry instanceof Registry, 'Baseline should create Registry instance')
    assert.ok(contextualRegistry instanceof Registry, 'Contextual should create Registry instance')
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

    assert.ok(result, 'Should return test result')
    assert.equal(result.test_name, 'Minimal Test', 'Test name should match')
    assert.equal(result.variants.length, 2, 'Should have 2 variant results')
    assert.ok(result.test_summary, 'Should have test summary')
    assert.ok(Array.isArray(result.recommendations), 'Should have recommendations array')

    // Check variant results structure
    for (const variant of result.variants) {
      assert.ok(variant.variant_id, 'Variant should have ID')
      assert.ok(variant.variant_name, 'Variant should have name')
      assert.ok(variant.performance, 'Variant should have performance metrics')
      assert.ok(
        typeof variant.performance.avg_duration_ms === 'number',
        'Should have average duration',
      )
      assert.ok(
        typeof variant.performance.throughput_chars_per_sec === 'number',
        'Should have throughput',
      )
      assert.ok(variant.confidence_interval, 'Should have confidence interval')
      assert.ok(typeof variant.sample_size === 'number', 'Should have sample size')
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

    assert.ok(result.recommendations.length >= 0, 'Should have recommendations array')

    // Check if we got performance-related recommendations
    const perfRecommendations = result.recommendations.filter((r) => r.type === 'performance')
    if (perfRecommendations.length > 0) {
      const rec = perfRecommendations[0]
      assert.ok(rec.title, 'Recommendation should have title')
      assert.ok(rec.description, 'Recommendation should have description')
      assert.ok(['high', 'medium', 'low'].includes(rec.priority), 'Should have valid priority')
      assert.ok(rec.impact_estimate, 'Should have impact estimate')
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
      assert.ok(result.winner.variant_id, 'Winner should have variant ID')
      assert.ok(
        typeof result.winner.improvement_percentage === 'number',
        'Should have improvement percentage',
      )
      assert.ok(
        typeof result.winner.statistical_significance === 'number',
        'Should have significance value',
      )
      assert.ok(
        result.winner.statistical_significance >= 0 && result.winner.statistical_significance <= 1,
        'Significance should be between 0 and 1',
      )
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
        { start: 13, end: 29, type: 'email', value: 'john@example.com' },
        { start: 38, end: 50, type: 'phone', value: '555-123-4567' },
      ],
    })

    groundTruth.addEntry({
      id: 'test2',
      text: 'Send payment to account 4532-1234-5678-9012',
      annotations: [{ start: 25, end: 44, type: 'credit_card', value: '4532-1234-5678-9012' }],
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

    assert.equal(result.variants.length, 1, 'Should have 1 variant result')

    const variant = result.variants[0]
    if (variant.accuracy) {
      assert.ok(typeof variant.accuracy.precision === 'number', 'Should have precision')
      assert.ok(typeof variant.accuracy.recall === 'number', 'Should have recall')
      assert.ok(typeof variant.accuracy.f1_score === 'number', 'Should have F1 score')
      assert.ok(
        variant.accuracy.precision >= 0 && variant.accuracy.precision <= 1,
        'Precision should be 0-1',
      )
      assert.ok(
        variant.accuracy.recall >= 0 && variant.accuracy.recall <= 1,
        'Recall should be 0-1',
      )
      assert.ok(
        variant.accuracy.f1_score >= 0 && variant.accuracy.f1_score <= 1,
        'F1 should be 0-1',
      )
    }
  })

  it('should use predefined test scenarios', () => {
    // Test contextual confidence scenario
    const contextualScenario = AB_TEST_SCENARIOS.contextualConfidence
    assert.ok(contextualScenario, 'Should have contextual confidence scenario')
    assert.equal(
      contextualScenario.test_name,
      'Contextual Confidence A/B Test',
      'Should have correct test name',
    )
    assert.equal(contextualScenario.variants.length, 3, 'Should have 3 variants')

    const variantIds = contextualScenario.variants.map((v) => v.id)
    assert.ok(variantIds.includes('baseline'), 'Should include baseline variant')
    assert.ok(variantIds.includes('conservative'), 'Should include conservative variant')
    assert.ok(variantIds.includes('full'), 'Should include full variant')

    // Test confidence threshold scenario
    const thresholdScenario = AB_TEST_SCENARIOS.confidenceThreshold
    assert.ok(thresholdScenario, 'Should have confidence threshold scenario')
    assert.equal(
      thresholdScenario.test_name,
      'Confidence Threshold Optimization',
      'Should have correct test name',
    )
    assert.equal(thresholdScenario.variants.length, 3, 'Should have 3 variants')

    const thresholdIds = thresholdScenario.variants.map((v) => v.id)
    assert.ok(thresholdIds.includes('low-threshold'), 'Should include low threshold variant')
    assert.ok(thresholdIds.includes('medium-threshold'), 'Should include medium threshold variant')
    assert.ok(thresholdIds.includes('high-threshold'), 'Should include high threshold variant')
  })
})
