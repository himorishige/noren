# @himorishige/noren-devtools

[![npm version](https://img.shields.io/npm/v/@himorishige/noren-devtools.svg)](https://www.npmjs.com/package/@himorishige/noren-devtools)

**Advanced development and testing tools for Noren PII detection library**

Professional-grade tools for testing, benchmarking, and optimizing your PII detection workflows. Perfect for development teams who need detailed insights into detection accuracy and performance.

## ✨ Features (v0.5.0)

- 🧪 **A/B Testing**: Scientific configuration comparison with unified statistical analysis
- 📊 **Advanced Benchmarking**: Performance analysis with memory monitoring and correlation metrics
- 🎯 **Accuracy Evaluation**: Precision/recall metrics with streamlined ground truth datasets
- 📈 **Context Analysis**: Simplified contextual confidence scoring with rule-based adjustments
- 🔬 **Common Statistics**: Unified statistical functions (t-tests, confidence intervals, correlations)
- 📋 **Unified Reporting**: Consistent report generation across all tools
- ⚡ **Optimized Performance**: ~30% code reduction with improved maintainability

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

### A/B Testing

```typescript
import { 
  ABTestEngine, 
  createSimpleVariant, 
  createQuickABTest 
} from '@himorishige/noren-devtools'

const engine = new ABTestEngine()

// Create test variants with different configurations
const variantA = createSimpleVariant('config-a', 'Standard Config', {
  defaultAction: 'mask'
})

const variantB = createSimpleVariant('config-b', 'Optimized Config', {
  defaultAction: 'redact',
  enableContextualConfidence: true
})

// Create and run quick A/B test
const testData = ['Contact support@example.com for help', 'Call 555-0123 today']
const testConfig = createQuickABTest(variantA, variantB, testData)

const result = await engine.runTest(testConfig)

console.log(`Winner: ${result.winner?.variant_id}`)
console.log(`Improvement: ${result.winner?.improvement_percentage?.toFixed(1)}%`)
console.log(`Statistical significance: ${result.winner?.statistical_significance}%`)
```

### Accuracy Evaluation

```typescript
import { 
  EvaluationEngine, 
  GroundTruthManager, 
  TestDatasetBuilder 
} from '@himorishige/noren-devtools'

// Create ground truth dataset
const groundTruth = new GroundTruthManager()

// Use pre-built test dataset
const emailDataset = TestDatasetBuilder.createEmailTestDataset()

// Or create synthetic entries
const syntheticEntry = TestDatasetBuilder.createSyntheticEntry('test1', [
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

## 🔧 Advanced Features (v0.5.0)

### Unified Statistical Analysis

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

### Contextual Confidence Scoring

```typescript
import { 
  calculateContextualConfidence, 
  DEFAULT_CONTEXTUAL_CONFIG,
  CONSERVATIVE_CONTEXTUAL_CONFIG,
  visualizeRules 
} from '@himorishige/noren-devtools'

const text = "Example email: test@example.com for testing"
const hit = { 
  type: 'email', 
  start: 15, 
  end: 31, 
  value: 'test@example.com',
  confidence: 0.9 
}

// Calculate contextual confidence
const result = calculateContextualConfidence(hit, text, 0.9, DEFAULT_CONTEXTUAL_CONFIG)

console.log(`Base confidence: ${result.baseConfidence}`)
console.log(`Contextual confidence: ${result.contextualConfidence}`)
console.log(`Adjustment factor: ${result.adjustmentFactor}`)
console.log(`Applied rules:`, result.explanations)

// Visualize rule configuration
const rules = visualizeRules(CONSERVATIVE_CONTEXTUAL_CONFIG)
console.log(`Active rules: ${rules.length}`)
rules.forEach(rule => {
  console.log(`- ${rule.ruleId}: ${rule.effect} (${rule.strength})`)
})
```

### Custom Reporting

```typescript
import { 
  ReportBuilder, 
  createBenchmarkReport,
  createABTestReport,
  printReport 
} from '@himorishige/noren-devtools'

// Build custom report
const report = new ReportBuilder()
  .title('Custom Performance Analysis')
  .performance('Configuration A', {
    duration: 12.5,
    throughput: 89.3,
    memoryUsage: 15.7
  })
  .performance('Configuration B', {
    duration: 10.1,
    throughput: 102.8,
    memoryUsage: 14.2
  })
  .comparison('Configuration B', 19.2, 95.0)
  .build()

printReport(report)
```

## 🎯 Pre-built Configurations (v0.5.0)

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

### A/B Test Scenarios

```typescript
import { AB_TEST_SCENARIOS } from '@himorishige/noren-devtools'

// Streamlined A/B test scenarios:
AB_TEST_SCENARIOS.CONFIDENCE_SCORING      // Impact of confidence scoring
AB_TEST_SCENARIOS.PLUGIN_COMPARISON       // Plugin performance comparison  
AB_TEST_SCENARIOS.PATTERN_OPTIMIZATION    // Pattern optimization impact
AB_TEST_SCENARIOS.MEMORY_EFFICIENCY       // Memory usage comparison
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

### A/B Test Report

```typescript
const comparison = await engine.runComparison(testConfig)

// Comprehensive comparison:
{
  winner: 'configB',
  confidence: 0.85,
  metrics: {
    performance: { improvement: '+15%', significance: 'high' },
    accuracy: { improvement: '-2%', significance: 'low' },
    memory: { improvement: '+8%', significance: 'medium' }
  },
  recommendation: 'Use configB for performance-critical applications'
}
```

## 🔬 Development Workflow

### 1. **Profile Your Configuration**
```bash
npm run profile -- --config production --samples 1000
```

### 2. **Compare Alternatives**
```bash
npm run ab-test -- --configA basic --configB optimized
```

### 3. **Validate Accuracy**
```bash
npm run evaluate -- --dataset ./test-data.json --config production
```

### 4. **Generate Reports**
```bash
npm run report -- --output ./reports/ --format json,html
```

## 🛠 API Reference (v0.5.0)

### Core Classes

- **`BenchmarkRunner`**: Streamlined performance testing with correlation analysis
- **`ABTestEngine`**: Scientific A/B testing with statistical significance
- **`EvaluationEngine`**: Ground truth evaluation with simplified workflow
- **`GroundTruthManager`**: Dataset management and validation
- **`TestDatasetBuilder`**: Synthetic and realistic dataset creation

### Statistical Functions

- **`mean(values)`**: Calculate arithmetic mean
- **`tTest(sample1, sample2, alpha)`**: Independent samples t-test
- **`confidenceInterval(values, level)`**: Calculate confidence intervals
- **`pearsonCorrelation(x, y)`**: Calculate correlation coefficient

### Utility Functions

- **`calculateContextualConfidence()`**: Context-aware confidence scoring
- **`createSimpleVariant()`**: Quick A/B test variant creation
- **`createQuickABTest()`**: Rapid A/B test setup
- **`visualizeRules()`**: Rule configuration analysis

### Reporting Functions

- **`ReportBuilder`**: Flexible report construction
- **`createBenchmarkReport()`**: Standardized benchmark reports
- **`createABTestReport()`**: Standardized A/B test reports
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

### Config File (`noren-devtools.config.js`)

```javascript
export default {
  benchmark: {
    iterations: 100,
    warmupRuns: 10,
    memoryTracking: true
  },
  abtest: {
    sampleSize: 1000,
    confidenceLevel: 0.95,
    metrics: ['performance', 'accuracy']
  },
  evaluation: {
    groundTruthPath: './test-data/',
    outputFormat: ['json', 'csv']
  }
}
```

## 🚀 Performance Tips (v0.5.0)

1. **Use predefined configurations** - BENCHMARK_CONFIGS provide optimized test scenarios
2. **Leverage unified statistics** - Built-in statistical functions ensure consistent analysis
3. **Enable memory monitoring** - Built-in MemoryMonitor tracks resource usage automatically
4. **Utilize correlation analysis** - Text size correlation helps identify scaling issues
5. **Apply contextual confidence** - Rule-based scoring reduces false positives effectively
6. **Use streaming reports** - Unified reporting reduces memory overhead for large datasets

## 📄 License

MIT License - see [LICENSE](../../LICENSE) for details.

---

**Part of the [Noren](../../README.md) PII protection suite**

For basic PII detection, see [@himorishige/noren-core](../noren-core).