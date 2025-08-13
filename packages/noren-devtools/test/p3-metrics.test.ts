import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  calculateContextualConfidence,
  DEFAULT_CONTEXTUAL_CONFIG,
} from '../src/contextual-confidence.js'
import { Registry } from '../src/index.js'
import {
  type AccuracyMetric,
  type ContextualMetric,
  getMetricsCollector,
  InMemoryMetricsCollector,
  type MetricEntry,
  type MetricsCollector,
  measurePerformance,
  NOREN_METRICS,
  NoOpMetricsCollector,
  type PerformanceMetric,
  setMetricsCollector,
} from '../src/metrics.js'
import type { Hit } from '../src/types.js'

describe('P3-0: Metrics Infrastructure', () => {
  let originalCollector: MetricsCollector
  let metricsCollector: InMemoryMetricsCollector

  beforeEach(() => {
    originalCollector = getMetricsCollector()
    metricsCollector = new InMemoryMetricsCollector()
    setMetricsCollector(metricsCollector)
  })

  afterEach(() => {
    setMetricsCollector(originalCollector)
  })

  describe('Basic metrics collection', () => {
    it('should record individual metrics', () => {
      const entry: MetricEntry = {
        timestamp: Date.now(),
        name: 'test.metric',
        value: 42,
        labels: { operation: 'test' },
      }

      metricsCollector.recordMetric(entry)
      const metrics = metricsCollector.getMetrics()

      expect(metrics).toHaveLength(1)
      expect(metrics[0]).toMatchObject({
        name: 'test.metric',
        value: 42,
        labels: { operation: 'test' },
      })
    })

    it('should record performance metrics', () => {
      const perfMetric: PerformanceMetric = {
        duration_ms: 123.45,
        memory_delta_bytes: 1024,
      }

      metricsCollector.recordPerformance('test_operation', perfMetric, { user: 'test' })
      const metrics = metricsCollector.getMetricsByName('noren.performance.duration_ms')

      expect(metrics).toHaveLength(1)
      expect(metrics[0].value).toBe(123.45)
      expect(metrics[0].labels).toMatchObject({ operation: 'test_operation', user: 'test' })
      expect(metrics[0].metadata).toMatchObject({ memory_delta_bytes: 1024 })
    })

    it('should record accuracy metrics', () => {
      const accMetric: AccuracyMetric = {
        hits_detected: 5,
        false_positives: 1,
        false_negatives: 2,
      }

      metricsCollector.recordAccuracy('detection', accMetric, { text_type: 'email' })

      const hitsMetrics = metricsCollector.getMetricsByName('noren.accuracy.hits_detected')
      const fpMetrics = metricsCollector.getMetricsByName('noren.accuracy.false_positives')
      const fnMetrics = metricsCollector.getMetricsByName('noren.accuracy.false_negatives')

      expect(hitsMetrics).toHaveLength(1)
      expect(hitsMetrics[0].value).toBe(5)
      expect(fpMetrics[0].value).toBe(1)
      expect(fnMetrics[0].value).toBe(2)
    })

    it('should record contextual metrics', () => {
      const contextMetric: ContextualMetric = {
        rules_evaluated: 10,
        rules_applied: 3,
        avg_confidence_adjustment: 0.75,
        rule_hit_counts: {
          'example-marker-strong': 2,
          'json-key-value': 1,
        },
      }

      metricsCollector.recordContextual('contextual_scoring', contextMetric)

      const evaluatedMetrics = metricsCollector.getMetricsByName('noren.contextual.rules_evaluated')
      const appliedMetrics = metricsCollector.getMetricsByName('noren.contextual.rules_applied')
      const adjustmentMetrics = metricsCollector.getMetricsByName(
        'noren.contextual.avg_confidence_adjustment',
      )
      const ruleHitMetrics = metricsCollector.getMetricsByName('noren.contextual.rule_hits')

      expect(evaluatedMetrics).toHaveLength(1)
      expect(evaluatedMetrics[0].value).toBe(10)
      expect(appliedMetrics[0].value).toBe(3)
      expect(adjustmentMetrics[0].value).toBe(0.75)
      expect(ruleHitMetrics).toHaveLength(2)
      expect(ruleHitMetrics[0].labels?.rule_id).toBe('example-marker-strong')
    })
  })

  describe('Performance measurement utility', () => {
    it('should measure sync function performance', async () => {
      const result = await measurePerformance(
        'test_sync',
        () => {
          // Simulate some work
          let sum = 0
          for (let i = 0; i < 1000; i++) {
            sum += Math.sqrt(i)
          }
          return sum
        },
        { test_label: 'sync' },
      )

      expect(typeof result).toBe('number')

      const perfMetrics = metricsCollector.getMetricsByName('noren.performance.duration_ms')
      expect(perfMetrics).toHaveLength(1)
      expect(perfMetrics[0].value).toBeGreaterThan(0)
      expect(perfMetrics[0].labels).toMatchObject({ operation: 'test_sync', test_label: 'sync' })
    })

    it('should measure async function performance', async () => {
      const result = await measurePerformance('test_async', async () => {
        // Simulate async work
        await new Promise((resolve) => setTimeout(resolve, 10))
        return 'done'
      })

      expect(result).toBe('done')

      const perfMetrics = metricsCollector.getMetricsByName('noren.performance.duration_ms')
      expect(perfMetrics).toHaveLength(1)
      expect(perfMetrics[0].value).toBeGreaterThanOrEqual(10)
    })

    it('should record errors in performance measurement', async () => {
      const error = new Error('Test error')

      await expect(
        measurePerformance('test_error', () => {
          throw error
        }),
      ).rejects.toThrow('Test error')

      const perfMetrics = metricsCollector.getMetricsByName('noren.performance.duration_ms')
      expect(perfMetrics).toHaveLength(1)
      expect(perfMetrics[0].labels).toMatchObject({
        operation: 'test_error',
        error: 'true',
        error_type: 'Error',
      })
    })
  })

  describe('Metrics aggregation and analysis', () => {
    beforeEach(() => {
      // Add sample data
      for (let i = 0; i < 10; i++) {
        metricsCollector.recordMetric({
          timestamp: Date.now() + i,
          name: 'test.values',
          value: i * 10,
          labels: { batch: 'A' },
        })
      }
    })

    it('should provide metrics summary', () => {
      const summary = metricsCollector.getMetricsSummary()

      expect(summary['test.values']).toBeDefined()
      expect(summary['test.values'].count).toBe(10)
      expect(summary['test.values'].avg).toBe(45) // (0+10+20+...+90)/10
      expect(summary['test.values'].min).toBe(0)
      expect(summary['test.values'].max).toBe(90)
    })

    it('should filter metrics by operation', () => {
      metricsCollector.recordPerformance('op1', { duration_ms: 100 })
      metricsCollector.recordPerformance('op2', { duration_ms: 200 })

      const op1Metrics = metricsCollector.getMetricsByOperation('op1')
      const op2Metrics = metricsCollector.getMetricsByOperation('op2')

      expect(op1Metrics).toHaveLength(1)
      expect(op2Metrics).toHaveLength(1)
      expect(op1Metrics[0].value).toBe(100)
      expect(op2Metrics[0].value).toBe(200)
    })

    it('should respect maximum entries limit', () => {
      const limitedCollector = new InMemoryMetricsCollector(5)

      // Add 10 metrics
      for (let i = 0; i < 10; i++) {
        limitedCollector.recordMetric({
          timestamp: Date.now(),
          name: 'test',
          value: i,
        })
      }

      const metrics = limitedCollector.getMetrics()
      expect(metrics).toHaveLength(5)
      // Should keep the last 5 entries
      expect(metrics[0].value).toBe(5)
      expect(metrics[4].value).toBe(9)
    })
  })

  describe('Integration with detection system', () => {
    it('should collect metrics during detection', async () => {
      const registry = new Registry({
        defaultAction: 'mask',
        enableConfidenceScoring: true,
        enableContextualConfidence: true,
      })

      const text = 'Contact: john@example.com for more info'
      const _result = await registry.detect(text)

      // Check that detection metrics were recorded
      const perfMetrics = metricsCollector.getMetricsByName('noren.performance.duration_ms')
      expect(perfMetrics.length).toBeGreaterThan(0)

      const detectionMetrics = perfMetrics.filter((m) => m.labels?.operation === 'detect')
      expect(detectionMetrics).toHaveLength(1)
      expect(detectionMetrics[0].value).toBeGreaterThan(0)

      // Check accuracy metrics
      const accuracyMetrics = metricsCollector.getMetricsByName('noren.accuracy.hits_detected')
      expect(accuracyMetrics).toHaveLength(1)
      expect(accuracyMetrics[0].value).toBeGreaterThan(0)

      // Check PII type breakdown
      const piiTypeMetrics = metricsCollector.getMetricsByName('noren.pii_types.detected')
      expect(piiTypeMetrics.length).toBeGreaterThan(0)
    })

    it('should collect contextual scoring metrics', () => {
      const hit: Hit = {
        type: 'email',
        start: 10,
        end: 27,
        value: 'user@example.com',
        risk: 'medium',
        confidence: 0.8,
      }

      const text = 'Example: user@example.com is a test email'
      calculateContextualConfidence(hit, text, 0.8, DEFAULT_CONTEXTUAL_CONFIG)

      // Check contextual metrics were recorded
      const rulesEvaluatedMetrics = metricsCollector.getMetricsByName(
        'noren.contextual.rules_evaluated',
      )
      expect(rulesEvaluatedMetrics).toHaveLength(1)
      expect(rulesEvaluatedMetrics[0].value).toBeGreaterThan(0)

      const rulesAppliedMetrics = metricsCollector.getMetricsByName(
        'noren.contextual.rules_applied',
      )
      expect(rulesAppliedMetrics).toHaveLength(1)

      const ruleHitMetrics = metricsCollector.getMetricsByName('noren.contextual.rule_hits')
      expect(ruleHitMetrics.length).toBeGreaterThan(0)
    })
  })

  describe('NoOp metrics collector', () => {
    it('should not record any metrics', () => {
      const noopCollector = new NoOpMetricsCollector()

      noopCollector.recordMetric({ timestamp: Date.now(), name: 'test', value: 1 })
      noopCollector.recordPerformance('test', { duration_ms: 100 })
      noopCollector.recordAccuracy('test', { hits_detected: 5 })
      noopCollector.recordContextual('test', {
        rules_evaluated: 3,
        rules_applied: 1,
        avg_confidence_adjustment: 0.5,
        rule_hit_counts: {},
      })

      // No way to verify since it's no-op, but shouldn't throw errors
      expect(() => noopCollector.flush()).not.toThrow()
    })
  })

  describe('Metric definitions', () => {
    it('should provide predefined metric definitions', () => {
      expect(NOREN_METRICS).toBeDefined()
      expect(NOREN_METRICS['noren.performance.duration_ms']).toBeDefined()
      expect(NOREN_METRICS['noren.accuracy.hits_detected']).toBeDefined()
      expect(NOREN_METRICS['noren.contextual.rules_evaluated']).toBeDefined()

      const perfMetric = NOREN_METRICS['noren.performance.duration_ms']
      expect(perfMetric.aggregation).toBe('histogram')
      expect(perfMetric.buckets).toBeDefined()
      expect(perfMetric.labels).toContain('operation')
    })
  })

  describe('Performance benchmarks', () => {
    it('should maintain low overhead for metrics collection', async () => {
      const iterations = 1000

      const start = performance.now()
      for (let i = 0; i < iterations; i++) {
        metricsCollector.recordMetric({
          timestamp: Date.now(),
          name: 'benchmark.test',
          value: i,
          labels: { iteration: i.toString() },
        })
      }
      const duration = performance.now() - start

      // Should be able to record 1000 metrics quickly (less than 100ms)
      expect(duration).toBeLessThan(100)
      expect(metricsCollector.getMetrics()).toHaveLength(iterations)
    })

    it('should handle large amounts of data efficiently', () => {
      const largeCollector = new InMemoryMetricsCollector(50000)

      const start = performance.now()
      for (let i = 0; i < 10000; i++) {
        largeCollector.recordPerformance(
          'large_test',
          {
            duration_ms: Math.random() * 1000,
            memory_delta_bytes: Math.floor(Math.random() * 1024 * 1024),
          },
          {
            iteration: i.toString(),
            batch: Math.floor(i / 100).toString(),
          },
        )
      }
      const recordingDuration = performance.now() - start

      const summaryStart = performance.now()
      const summary = largeCollector.getMetricsSummary()
      const summaryDuration = performance.now() - summaryStart

      expect(recordingDuration).toBeLessThan(500) // Recording should be fast
      expect(summaryDuration).toBeLessThan(100) // Summary should be fast
      expect(Object.keys(summary)).toContain('noren.performance.duration_ms')
    })
  })
})
