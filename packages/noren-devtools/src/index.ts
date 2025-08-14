// Noren DevTools - Development and testing tools for PII detection
// v0.5.0 Lightweight optimized version with core functionality only

export {
  BENCHMARK_CONFIGS,
  type BenchmarkConfig,
  BenchmarkRunner,
  type BenchmarkSummary,
  BenchmarkTextGenerator,
  MemoryMonitor,
  type PerformanceResult,
  PrecisionTimer,
} from './benchmark.js'
export {
  type AggregateMetrics,
  createEmailTestDataset,
  createSyntheticEntry,
  type DetectionResult as EvaluationDetectionResult,
  type EvaluationConfig,
  EvaluationEngine,
  type EvaluationResult,
  type GroundTruthAnnotation,
  type GroundTruthEntry,
  GroundTruthManager,
} from './evaluation.js'
export {
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
} from './metrics.js'
export * from './report-common.js'
// Common utilities (new in v0.5.0)
export * from './stats-common.js'
