# @himorishige/noren-devtools

[![npm version](https://img.shields.io/npm/v/@himorishige/noren-devtools.svg)](https://www.npmjs.com/package/@himorishige/noren-devtools)

**Lightweight development and testing tools for Noren PII detection library**

Essential tools for testing, benchmarking, and evaluating your PII detection workflows. Focused on core functionality with minimal overhead.

## ✨ Features (v0.5.0 - Lightweight Edition)

- 📊 **Performance Benchmarking**: Memory monitoring and throughput analysis
- 🎯 **Accuracy Evaluation**: Precision/recall metrics with ground truth datasets
- 📈 **Metrics Collection**: Performance and accuracy tracking
- 🔬 **Statistical Analysis**: Common statistical functions for data analysis
- 📋 **Unified Reporting**: Consistent report generation
- ⚡ **Optimized Performance**: 70% size reduction with streamlined functionality

## 🚀 Installation

```bash
npm install @himorishige/noren-devtools
# Peer dependency
npm install @himorishige/noren-core
```

## 📖 Quick Start

### Basic Benchmarking

```typescript
import { 
  BenchmarkRunner, 
  BenchmarkTextGenerator, 
  BENCHMARK_CONFIGS 
} from '@himorishige/noren-devtools'
import { Registry } from '@himorishige/noren-core'

const registry = new Registry({ defaultAction: 'mask' })
const runner = new BenchmarkRunner()

// Use predefined benchmark configuration
const result = await runner.runBenchmark(
  'basic-detection',
  registry,
  BENCHMARK_CONFIGS.standard.test_cases,
  {
    iterations: 25,
    warmupRuns: 5,
    memoryMonitoring: true
  }
)

console.log(`Throughput: ${result.summary.throughput}K chars/sec`)
console.log(`Memory efficiency: ${result.summary.memoryEfficiency}MB`)
console.log(`Text size correlation: ${result.summary.textSizeCorrelation}`)
```

### Accuracy Evaluation

```typescript
import { 
  EvaluationEngine, 
  GroundTruthManager, 
  createEmailTestDataset,
  createSyntheticEntry
} from '@himorishige/noren-devtools'

// Create ground truth dataset
const groundTruth = new GroundTruthManager()

// Use pre-built test dataset
const emailDataset = createEmailTestDataset()

// Or create synthetic entries
const syntheticEntry = createSyntheticEntry('test1', [
  { type: 'email', pattern: 'user@company.com' },
  { type: 'phone', pattern: '555-0123' }
])
groundTruth.addEntry(syntheticEntry)

// Run evaluation
const evaluator = new EvaluationEngine()
const result = await evaluator.evaluateAgainstGroundTruth(registry, emailDataset, {
  sample_size: 50,
  confidence_threshold: 0.5
})

console.log(`Precision: ${result.aggregate.precision.toFixed(3)}`)
console.log(`Recall: ${result.aggregate.recall.toFixed(3)}`)
console.log(`F1 Score: ${result.aggregate.f1_score.toFixed(3)}`)
```

### Performance Metrics Collection

```typescript
import { 
  measurePerformance,
  setMetricsCollector,
  InMemoryMetricsCollector,
  getMetricsCollector
} from '@himorishige/noren-devtools'

// Set up metrics collection
const metricsCollector = new InMemoryMetricsCollector()
setMetricsCollector(metricsCollector)

// Measure function performance
const result = await measurePerformance(
  'detection-test',
  () => registry.detect(text),
  { operation: 'basic-detection' }
)

console.log(`Duration: ${result.duration_ms}ms`)
console.log(`Memory usage: ${result.memory_usage_mb}MB`)

// Get collected metrics
const metrics = metricsCollector.getMetrics()
console.log(`Total metrics collected: ${metrics.length}`)
```

## 🔧 Core Features

### Statistical Analysis

```typescript
import { 
  mean, 
  tTest, 
  confidenceInterval, 
  pearsonCorrelation 
} from '@himorishige/noren-devtools'

const sampleA = [12.5, 11.8, 13.1, 12.0, 11.9]
const sampleB = [14.2, 13.5, 14.8, 13.9, 14.1]

// Statistical comparison
const testResult = tTest(sampleA, sampleB)
console.log(`T-statistic: ${testResult.tStatistic}`)
console.log(`Significant: ${testResult.significant}`)

// Confidence intervals
const ciA = confidenceInterval(sampleA, 0.95)
console.log(`Sample A: ${mean(sampleA)} ± ${(ciA.upper - ciA.lower) / 2}`)

// Correlation analysis
const sizes = [100, 500, 1000, 2000, 5000]
const durations = [1.2, 4.8, 9.1, 18.5, 45.2]
const correlation = pearsonCorrelation(sizes, durations)
console.log(`Size-duration correlation: ${correlation}`)
```

### Custom Reporting

```typescript
import { 
  createBenchmarkReport,
  createEvaluationReport,
  printReport 
} from '@himorishige/noren-devtools'

// Create benchmark report
const benchmarkReport = createBenchmarkReport(benchmarkResults)
printReport(benchmarkReport)

// Create evaluation report
const evaluationReport = createEvaluationReport(evaluationResults)
printReport(evaluationReport)
```

## 🎯 Pre-built Configurations

### Benchmark Configurations

```typescript
import { BENCHMARK_CONFIGS } from '@himorishige/noren-devtools'

// Optimized benchmark configurations:
BENCHMARK_CONFIGS.quick         // Fast testing (10 iterations)
BENCHMARK_CONFIGS.standard      // Standard testing (25 iterations)
BENCHMARK_CONFIGS.comprehensive // Thorough testing (50 iterations)

// Usage example
const runner = new BenchmarkRunner()
const results = await runner.runBenchmark(
  'performance-test',
  registry,
  BENCHMARK_CONFIGS.standard.test_cases,
  {
    iterations: BENCHMARK_CONFIGS.standard.iterations,
    warmupRuns: BENCHMARK_CONFIGS.standard.warmup_runs,
    memoryMonitoring: BENCHMARK_CONFIGS.standard.memory_monitoring
  }
)
```

## 📊 Example Reports

### Benchmark Report

```typescript
const results = await runner.runBenchmark('comprehensive', registry, testData)

// Generated report includes:
{
  executionTime: '45.7ms',
  memoryUsed: '12.3MB',
  throughput: '2.1MB/s',
  hitRate: '8.5%',
  accuracy: {
    precision: 0.95,
    recall: 0.89,
    f1Score: 0.92
  },
  performance: {
    averageDetectionTime: '0.12ms',
    medianDetectionTime: '0.08ms',
    percentile95: '0.25ms'
  }
}
```

### Evaluation Report

```typescript
const evaluation = await evaluator.evaluateAgainstGroundTruth(registry, dataset)

// Comprehensive evaluation:
{
  aggregate: {
    precision: 0.94,
    recall: 0.87,
    f1_score: 0.90
  },
  by_type: {
    email: { precision: 0.96, recall: 0.92, f1_score: 0.94 },
    phone: { precision: 0.91, recall: 0.83, f1_score: 0.87 }
  },
  recommendations: [
    'Consider tuning phone detection patterns',
    'Email detection performs well'
  ]
}
```

## 🔬 Development Workflow

### 1. **Profile Your Configuration**
```bash
node examples/benchmark-demo.mjs
```

### 2. **Validate Accuracy**
```bash
node examples/evaluation-demo.mjs
```

### 3. **Monitor Performance**
```typescript
// Enable metrics collection in your application
import { setMetricsCollector, InMemoryMetricsCollector } from '@himorishige/noren-devtools'

setMetricsCollector(new InMemoryMetricsCollector())
// Your PII detection code runs here
// Metrics are automatically collected
```

## 🛠 API Reference

### Core Classes

- **`BenchmarkRunner`**: Performance testing with correlation analysis
- **`EvaluationEngine`**: Ground truth evaluation with detailed metrics
- **`GroundTruthManager`**: Dataset management and validation
- **`MemoryMonitor`**: Memory usage tracking
- **`PrecisionTimer`**: High-precision timing

### Metrics Collection

- **`InMemoryMetricsCollector`**: In-memory metrics storage
- **`NoOpMetricsCollector`**: No-op collector for production
- **`setMetricsCollector()`**: Set global metrics collector
- **`getMetricsCollector()`**: Get current metrics collector
- **`measurePerformance()`**: Measure function performance

### Statistical Functions

- **`mean(values)`**: Calculate arithmetic mean
- **`tTest(sample1, sample2, alpha)`**: Independent samples t-test
- **`confidenceInterval(values, level)`**: Calculate confidence intervals
- **`pearsonCorrelation(x, y)`**: Calculate correlation coefficient

### Reporting Functions

- **`createBenchmarkReport()`**: Standardized benchmark reports
- **`createEvaluationReport()`**: Standardized evaluation reports
- **`printReport()`**: Console output with formatting

## 🔧 Configuration

### Environment Variables

```bash
# Enable detailed logging
NOREN_DEVTOOLS_DEBUG=true

# Set output directory for reports
NOREN_DEVTOOLS_OUTPUT_DIR=./reports

# Configure memory monitoring
NOREN_DEVTOOLS_MEMORY_SAMPLING=1000ms
```

## 🚀 Performance Tips

1. **Use predefined configurations** - BENCHMARK_CONFIGS provide optimized test scenarios
2. **Leverage unified statistics** - Built-in statistical functions ensure consistent analysis
3. **Enable memory monitoring** - Built-in MemoryMonitor tracks resource usage automatically
4. **Utilize correlation analysis** - Text size correlation helps identify scaling issues
5. **Use streaming reports** - Unified reporting reduces memory overhead for large datasets

## 📄 License

MIT License - see [LICENSE](../../LICENSE) for details.

---

**Part of the [Noren](../../README.md) PII protection suite**

For basic PII detection, see [@himorishige/noren-core](../noren-core).