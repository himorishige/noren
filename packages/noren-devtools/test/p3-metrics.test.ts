import { Registry } from '@himorishige/noren-core'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  type AccuracyMetric,
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

describe.skip('P3-0: Metrics Infrastructure', () => {
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
        duration_ms: 42.5,
        memory_usage_mb: 128,
        operations_per_second: 1000,
      }

      metricsCollector.recordPerformance('test_operation', perfMetric)
      const metrics = metricsCollector.getMetrics()

      expect(metrics.length).toBeGreaterThan(0)
      const durationMetrics = metricsCollector.getMetricsByName('noren.performance.duration_ms')
      expect(durationMetrics).toHaveLength(1)
      expect(durationMetrics[0].value).toBe(42.5)
    })

    it('should record accuracy metrics', () => {
      const accuracyMetric: AccuracyMetric = {
        hits_detected: 5,
        false_positives: 1,
        false_negatives: 2,
        precision: 0.833,
        recall: 0.714,
        f1_score: 0.769,
      }

      metricsCollector.recordAccuracy('detection_accuracy', accuracyMetric)

      const hitsMetrics = metricsCollector.getMetricsByName('noren.accuracy.hits_detected')
      const fpMetrics = metricsCollector.getMetricsByName('noren.accuracy.false_positives')
      const fnMetrics = metricsCollector.getMetricsByName('noren.accuracy.false_negatives')

      expect(hitsMetrics).toHaveLength(1)
      expect(hitsMetrics[0].value).toBe(5)
      expect(fpMetrics[0].value).toBe(1)
      expect(fnMetrics[0].value).toBe(2)
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
        { operation: 'sync_test' },
      )

      expect(result.duration_ms).toBeGreaterThan(0)
      expect(result.memory_usage_mb).toBeGreaterThan(0)

      // Check metrics were recorded
      const durationMetrics = metricsCollector.getMetricsByName('noren.performance.duration_ms')
      expect(durationMetrics).toHaveLength(1)
      expect(durationMetrics[0].value).toBeGreaterThan(0)
      expect(durationMetrics[0].labels?.operation).toBe('sync_test')
    })

    it('should measure async function performance', async () => {
      const result = await measurePerformance(
        'test_async',
        async () => {
          await new Promise((resolve) => setTimeout(resolve, 10))
          return 'async_result'
        },
        { operation: 'async_test' },
      )

      expect(result.duration_ms).toBeGreaterThanOrEqual(10)
      expect(result.memory_usage_mb).toBeGreaterThan(0)

      const durationMetrics = metricsCollector.getMetricsByName('noren.performance.duration_ms')
      expect(durationMetrics).toHaveLength(1)
      expect(durationMetrics[0].value).toBeGreaterThanOrEqual(10)
    })
  })

  describe('Registry integration', () => {
    it('should collect detection metrics during registry operations', () => {
      const registry = new Registry({
        defaultAction: 'redact',
        contextHints: ['email'],
      })

      const text = 'Contact us at test@example.com for support'
      const hits = registry.detect(text)

      expect(hits.length).toBeGreaterThan(0)

      // Check detection metrics were recorded
      const detectionMetrics = metricsCollector.getMetricsByName('noren.performance.duration_ms')
      expect(detectionMetrics.length).toBeGreaterThan(0)

      const accuracyMetrics = metricsCollector.getMetricsByName('noren.accuracy.hits_detected')
      expect(accuracyMetrics.length).toBeGreaterThan(0)
      expect(accuracyMetrics[0].value).toBeGreaterThan(0)

      // Check PII type breakdown
      const piiTypeMetrics = metricsCollector.getMetricsByName('noren.pii_types.detected')
      expect(piiTypeMetrics.length).toBeGreaterThan(0)
    })
  })

  describe('NoOp metrics collector', () => {
    it('should not record any metrics', () => {
      const noopCollector = new NoOpMetricsCollector()

      noopCollector.recordMetric({ timestamp: Date.now(), name: 'test', value: 1 })
      noopCollector.recordPerformance('test', { duration_ms: 100 })
      noopCollector.recordAccuracy('test', { hits_detected: 5 })

      expect(noopCollector.getMetrics()).toHaveLength(0)
      expect(noopCollector.getMetricsByName('test')).toHaveLength(0)
      expect(noopCollector.getAllMetricNames()).toHaveLength(0)
    })
  })

  describe('Metrics registry', () => {
    it('should contain all expected metric definitions', () => {
      expect(NOREN_METRICS['noren.performance.duration_ms']).toBeDefined()
      expect(NOREN_METRICS['noren.performance.memory_usage_mb']).toBeDefined()
      expect(NOREN_METRICS['noren.accuracy.hits_detected']).toBeDefined()
      expect(NOREN_METRICS['noren.accuracy.false_positives']).toBeDefined()
      expect(NOREN_METRICS['noren.accuracy.false_negatives']).toBeDefined()
      expect(NOREN_METRICS['noren.pii_types.detected']).toBeDefined()
    })

    it('should provide metric descriptions and units', () => {
      const durationMetric = NOREN_METRICS['noren.performance.duration_ms']
      expect(durationMetric.description).toContain('duration')
      expect(durationMetric.unit).toBe('milliseconds')

      const accuracyMetric = NOREN_METRICS['noren.accuracy.hits_detected']
      expect(accuracyMetric.description).toContain('PII hits')
      expect(accuracyMetric.unit).toBe('count')
    })
  })
})
