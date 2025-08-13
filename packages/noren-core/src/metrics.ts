/**
 * P3-0: Metrics collection infrastructure for performance and accuracy monitoring
 * Web Standards only - no Node.js-specific APIs
 */

/**
 * Individual metric data point
 */
export interface MetricEntry {
  timestamp: number
  name: string
  value: number
  labels?: Record<string, string>
  metadata?: Record<string, unknown>
}

/**
 * Metrics aggregation types
 */
export type AggregationType = 'sum' | 'average' | 'max' | 'min' | 'count' | 'histogram'

/**
 * Metric definition with aggregation rules
 */
export interface MetricDefinition {
  name: string
  description: string
  aggregation: AggregationType
  buckets?: number[] // For histogram metrics
  labels?: string[] // Expected label keys
}

/**
 * Performance measurement result
 */
export interface PerformanceMetric {
  duration_ms: number
  memory_delta_bytes?: number
  cpu_time_ms?: number
}

/**
 * Accuracy measurement result
 */
export interface AccuracyMetric {
  hits_detected: number
  false_positives?: number
  false_negatives?: number
  confidence_distribution?: number[]
}

/**
 * Contextual rule evaluation metrics
 */
export interface ContextualMetric {
  rules_evaluated: number
  rules_applied: number
  avg_confidence_adjustment: number
  rule_hit_counts: Record<string, number>
}

/**
 * Metrics collector interface - can be implemented for different backends
 */
export interface MetricsCollector {
  recordMetric(entry: MetricEntry): void
  recordPerformance(
    operation: string,
    metric: PerformanceMetric,
    labels?: Record<string, string>,
  ): void
  recordAccuracy(operation: string, metric: AccuracyMetric, labels?: Record<string, string>): void
  recordContextual(
    operation: string,
    metric: ContextualMetric,
    labels?: Record<string, string>,
  ): void
  flush(): Promise<void>
}

/**
 * In-memory metrics collector for testing and development
 */
export class InMemoryMetricsCollector implements MetricsCollector {
  private metrics: MetricEntry[] = []
  private readonly maxEntries: number

  constructor(maxEntries: number = 10000) {
    this.maxEntries = maxEntries
  }

  recordMetric(entry: MetricEntry): void {
    this.metrics.push({
      ...entry,
      timestamp: entry.timestamp || Date.now(),
    })

    // Prevent unbounded growth
    if (this.metrics.length > this.maxEntries) {
      this.metrics = this.metrics.slice(-this.maxEntries)
    }
  }

  recordPerformance(
    operation: string,
    metric: PerformanceMetric,
    labels: Record<string, string> = {},
  ): void {
    this.recordMetric({
      timestamp: Date.now(),
      name: 'noren.performance.duration_ms',
      value: metric.duration_ms,
      labels: { ...labels, operation },
      metadata: {
        memory_delta_bytes: metric.memory_delta_bytes,
        cpu_time_ms: metric.cpu_time_ms,
      },
    })
  }

  recordAccuracy(
    operation: string,
    metric: AccuracyMetric,
    labels: Record<string, string> = {},
  ): void {
    this.recordMetric({
      timestamp: Date.now(),
      name: 'noren.accuracy.hits_detected',
      value: metric.hits_detected,
      labels: { ...labels, operation },
    })

    if (metric.false_positives !== undefined) {
      this.recordMetric({
        timestamp: Date.now(),
        name: 'noren.accuracy.false_positives',
        value: metric.false_positives,
        labels: { ...labels, operation },
      })
    }

    if (metric.false_negatives !== undefined) {
      this.recordMetric({
        timestamp: Date.now(),
        name: 'noren.accuracy.false_negatives',
        value: metric.false_negatives,
        labels: { ...labels, operation },
      })
    }
  }

  recordContextual(
    operation: string,
    metric: ContextualMetric,
    labels: Record<string, string> = {},
  ): void {
    this.recordMetric({
      timestamp: Date.now(),
      name: 'noren.contextual.rules_evaluated',
      value: metric.rules_evaluated,
      labels: { ...labels, operation },
    })

    this.recordMetric({
      timestamp: Date.now(),
      name: 'noren.contextual.rules_applied',
      value: metric.rules_applied,
      labels: { ...labels, operation },
    })

    this.recordMetric({
      timestamp: Date.now(),
      name: 'noren.contextual.avg_confidence_adjustment',
      value: metric.avg_confidence_adjustment,
      labels: { ...labels, operation },
    })

    // Record individual rule hit counts
    for (const [ruleId, count] of Object.entries(metric.rule_hit_counts)) {
      this.recordMetric({
        timestamp: Date.now(),
        name: 'noren.contextual.rule_hits',
        value: count,
        labels: { ...labels, operation, rule_id: ruleId },
      })
    }
  }

  async flush(): Promise<void> {
    // In-memory collector doesn't need to flush, but could implement
    // periodic cleanup or export functionality here
    return Promise.resolve()
  }

  // Testing and debugging utilities
  getMetrics(): MetricEntry[] {
    return [...this.metrics]
  }

  getMetricsByName(name: string): MetricEntry[] {
    return this.metrics.filter((m) => m.name === name)
  }

  getMetricsByOperation(operation: string): MetricEntry[] {
    return this.metrics.filter((m) => m.labels?.operation === operation)
  }

  clear(): void {
    this.metrics = []
  }

  getMetricsSummary(): Record<string, { count: number; avg: number; min: number; max: number }> {
    const summary: Record<string, { count: number; total: number; min: number; max: number }> = {}

    for (const metric of this.metrics) {
      if (!summary[metric.name]) {
        summary[metric.name] = { count: 0, total: 0, min: Infinity, max: -Infinity }
      }

      const s = summary[metric.name]
      s.count++
      s.total += metric.value
      s.min = Math.min(s.min, metric.value)
      s.max = Math.max(s.max, metric.value)
    }

    // Convert totals to averages
    const result: Record<string, { count: number; avg: number; min: number; max: number }> = {}
    for (const [name, data] of Object.entries(summary)) {
      result[name] = {
        count: data.count,
        avg: data.total / data.count,
        min: data.min,
        max: data.max,
      }
    }

    return result
  }
}

/**
 * No-op metrics collector for production when metrics are disabled
 */
export class NoOpMetricsCollector implements MetricsCollector {
  recordMetric(_entry: MetricEntry): void {
    // No-op
  }

  recordPerformance(
    _operation: string,
    _metric: PerformanceMetric,
    _labels?: Record<string, string>,
  ): void {
    // No-op
  }

  recordAccuracy(
    _operation: string,
    _metric: AccuracyMetric,
    _labels?: Record<string, string>,
  ): void {
    // No-op
  }

  recordContextual(
    _operation: string,
    _metric: ContextualMetric,
    _labels?: Record<string, string>,
  ): void {
    // No-op
  }

  async flush(): Promise<void> {
    // No-op
    return Promise.resolve()
  }
}

/**
 * Global metrics collector instance
 */
let globalMetricsCollector: MetricsCollector = new NoOpMetricsCollector()

/**
 * Set the global metrics collector
 */
export function setMetricsCollector(collector: MetricsCollector): void {
  globalMetricsCollector = collector
}

/**
 * Get the current metrics collector
 */
export function getMetricsCollector(): MetricsCollector {
  return globalMetricsCollector
}

/**
 * Utility function to measure performance of an operation
 */
export async function measurePerformance<T>(
  operation: string,
  fn: () => T | Promise<T>,
  labels?: Record<string, string>,
): Promise<T> {
  const startTime = performance.now()
  const startMemory = (performance as unknown as { memory?: { usedJSHeapSize?: number } }).memory
    ?.usedJSHeapSize

  try {
    const result = await fn()

    const endTime = performance.now()
    const endMemory = (performance as unknown as { memory?: { usedJSHeapSize?: number } }).memory
      ?.usedJSHeapSize

    const metric: PerformanceMetric = {
      duration_ms: endTime - startTime,
      memory_delta_bytes: endMemory && startMemory ? endMemory - startMemory : undefined,
    }

    globalMetricsCollector.recordPerformance(operation, metric, labels)

    return result
  } catch (error) {
    const endTime = performance.now()

    const metric: PerformanceMetric = {
      duration_ms: endTime - startTime,
    }

    globalMetricsCollector.recordPerformance(operation, metric, {
      ...labels,
      error: 'true',
      error_type: error instanceof Error ? error.name : 'unknown',
    })

    throw error
  }
}

/**
 * Predefined metric definitions for Noren
 */
export const NOREN_METRICS: Record<string, MetricDefinition> = {
  // Performance metrics
  'noren.performance.duration_ms': {
    name: 'noren.performance.duration_ms',
    description: 'Operation duration in milliseconds',
    aggregation: 'histogram',
    buckets: [1, 5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000],
    labels: ['operation', 'error', 'error_type'],
  },

  // Accuracy metrics
  'noren.accuracy.hits_detected': {
    name: 'noren.accuracy.hits_detected',
    description: 'Number of PII hits detected',
    aggregation: 'sum',
    labels: ['operation', 'pii_type', 'plugin'],
  },

  'noren.accuracy.false_positives': {
    name: 'noren.accuracy.false_positives',
    description: 'Number of false positive detections',
    aggregation: 'sum',
    labels: ['operation', 'pii_type', 'plugin'],
  },

  'noren.accuracy.false_negatives': {
    name: 'noren.accuracy.false_negatives',
    description: 'Number of false negative (missed) detections',
    aggregation: 'sum',
    labels: ['operation', 'pii_type', 'plugin'],
  },

  // Contextual metrics
  'noren.contextual.rules_evaluated': {
    name: 'noren.contextual.rules_evaluated',
    description: 'Number of contextual rules evaluated',
    aggregation: 'sum',
    labels: ['operation'],
  },

  'noren.contextual.rules_applied': {
    name: 'noren.contextual.rules_applied',
    description: 'Number of contextual rules applied',
    aggregation: 'sum',
    labels: ['operation'],
  },

  'noren.contextual.avg_confidence_adjustment': {
    name: 'noren.contextual.avg_confidence_adjustment',
    description: 'Average confidence adjustment from contextual rules',
    aggregation: 'average',
    labels: ['operation'],
  },

  'noren.contextual.rule_hits': {
    name: 'noren.contextual.rule_hits',
    description: 'Individual rule hit counts',
    aggregation: 'sum',
    labels: ['operation', 'rule_id'],
  },
}
