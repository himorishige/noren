// Noren DevTools - Development and testing tools for PII detection
// v0.5.0 Optimized with unified statistical analysis and reporting

export {
  AB_TEST_SCENARIOS,
  type ABTestConfig,
  ABTestEngine,
  type ABTestResult,
  type ConfigurationVariant,
  type Recommendation,
  type VariantResult,
} from './ab-testing.js'
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
  type ContextFeatures,
  type ContextMarkers,
  type DocumentStructure,
  detectContextMarkers,
  detectDocumentStructure,
  extractContextFeatures,
  extractValidatedContextFeatures,
  type ValidatedDocumentStructure,
  validateDocumentStructure,
} from './context-detection.js'
export {
  applyContextualConfidence,
  CONSERVATIVE_CONTEXTUAL_CONFIG,
  type ContextualConfidenceResult,
  type ContextualConfig,
  type ContextualExplanation,
  type ContextualRule,
  calculateContextualConfidence,
  calculateContextualConfidenceWithDebug,
  createContextualConfig,
  DEFAULT_CONTEXTUAL_CONFIG,
  DISABLED_CONTEXTUAL_CONFIG,
  visualizeRules,
} from './contextual-confidence.js'
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
  type ActionableRecommendation,
  type CycleState,
  type ImprovementCycleConfig,
  ImprovementCycleEngine,
  VariantGenerator,
} from './improvement-cycle.js'
export {
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
} from './metrics.js'
export * from './report-common.js'
// Common utilities (new in v0.5.0)
export * from './stats-common.js'
