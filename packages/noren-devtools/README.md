# @himorishige/noren-devtools

[![npm version](https://img.shields.io/npm/v/@himorishige/noren-devtools.svg)](https://www.npmjs.com/package/@himorishige/noren-devtools)

**Advanced development and testing tools for Noren PII detection library**

Professional-grade tools for testing, benchmarking, and optimizing your PII detection workflows. Perfect for development teams who need detailed insights into detection accuracy and performance.

## ✨ Features

- 🧪 **A/B Testing**: Compare detection configurations scientifically
- 📊 **Advanced Benchmarking**: Detailed performance analysis with memory monitoring
- 🎯 **Accuracy Evaluation**: Precision/recall metrics with ground truth datasets
- 🔄 **Improvement Cycles**: Automated configuration optimization
- 📈 **Context Analysis**: Advanced contextual confidence scoring
- 🔬 **Detailed Metrics**: In-depth analytics and reporting

## 🚀 Installation

```bash
npm install @himorishige/noren-devtools
# Peer dependency
npm install @himorishige/noren-core
```

## 📖 Quick Start

### Basic Benchmarking

```typescript
import { BenchmarkRunner, BenchmarkTextGenerator } from '@himorishige/noren-devtools'
import { Registry } from '@himorishige/noren-core'

const registry = new Registry({ defaultAction: 'mask' })
const generator = new BenchmarkTextGenerator()
const runner = new BenchmarkRunner()

// Generate test data
const testData = generator.generateText(10000, 20) // 10KB text with 20% PII density

// Run benchmark
const results = await runner.runBenchmark('basic-detection', registry, testData)

console.log(`Processing time: ${results.executionTime}ms`)
console.log(`Memory usage: ${results.memoryUsed}MB`)
console.log(`Throughput: ${results.throughput}MB/s`)
```

### A/B Testing

```typescript
import { ABTestEngine } from '@himorishige/noren-devtools'

const engine = new ABTestEngine()

// Define test configurations
const configA = new Registry({ 
  defaultAction: 'mask',
  enableConfidenceScoring: true 
})

const configB = new Registry({ 
  defaultAction: 'mask',
  enableConfidenceScoring: false 
})

// Run A/B test
const result = await engine.runComparison({
  name: 'confidence-scoring-impact',
  configA,
  configB,
  testData: generator.generateText(5000, 15),
  metrics: ['performance', 'accuracy', 'memory']
})

console.log(`Config A: ${result.configA.performance.averageTime}ms`)
console.log(`Config B: ${result.configB.performance.averageTime}ms`)
console.log(`Recommendation: ${result.recommendation}`)
```

### Accuracy Evaluation

```typescript
import { EvaluationEngine, TestDatasetBuilder } from '@himorishige/noren-devtools'

// Build ground truth dataset
const datasetBuilder = new TestDatasetBuilder()
const dataset = datasetBuilder
  .addEmail('test@example.com', { shouldDetect: true })
  .addCreditCard('4242-4242-4242-4242', { shouldDetect: true })
  .addText('This is normal text', { shouldDetect: false })
  .build()

// Evaluate accuracy
const evaluator = new EvaluationEngine()
const metrics = await evaluator.evaluate(registry, dataset)

console.log(`Precision: ${metrics.precision}`)
console.log(`Recall: ${metrics.recall}`)
console.log(`F1 Score: ${metrics.f1Score}`)
console.log(`False Positives: ${metrics.falsePositives}`)
```

## 🔧 Advanced Features

### Memory Monitoring

```typescript
import { MemoryMonitor } from '@himorishige/noren-devtools'

const monitor = new MemoryMonitor()

monitor.startMonitoring()

// Your PII detection code here
await redactText(registry, largeText)

const report = monitor.getReport()
console.log(`Peak memory: ${report.peakMemory}MB`)
console.log(`Memory growth: ${report.memoryGrowth}MB`)
```

### Custom Benchmark Scenarios

```typescript
import { BENCHMARK_CONFIGS, BenchmarkRunner } from '@himorishige/noren-devtools'

// Use predefined scenarios
const scenarios = [
  BENCHMARK_CONFIGS.SMALL_TEXT_DENSE_PII,
  BENCHMARK_CONFIGS.LARGE_TEXT_SPARSE_PII,
  BENCHMARK_CONFIGS.MIXED_CONTENT_REALISTIC
]

const runner = new BenchmarkRunner()

for (const scenario of scenarios) {
  const results = await runner.runScenario(registry, scenario)
  console.log(`${scenario.name}: ${results.summary}`)
}
```

### Context Analysis Tools

```typescript
import { 
  extractContextFeatures,
  calculateContextualConfidence 
} from '@himorishige/noren-devtools'

const text = "Employee email: john.doe@company.com"
const hit = { 
  type: 'email', 
  start: 16, 
  end: 38, 
  value: 'john.doe@company.com',
  risk: 'medium' 
}

// Analyze context
const context = extractContextFeatures(text, hit.start, hit.end)
const confidence = calculateContextualConfidence(hit, text, context)

console.log(`Context features:`, context)
console.log(`Adjusted confidence: ${confidence.confidence}`)
console.log(`Confidence reasons:`, confidence.reasons)
```

## 🎯 Pre-built Scenarios

### Benchmark Configurations

```typescript
import { BENCHMARK_CONFIGS } from '@himorishige/noren-devtools'

// Available scenarios:
BENCHMARK_CONFIGS.SMALL_TEXT_DENSE_PII     // Small text, many PIIs
BENCHMARK_CONFIGS.LARGE_TEXT_SPARSE_PII    // Large text, few PIIs  
BENCHMARK_CONFIGS.MIXED_CONTENT_REALISTIC  // Real-world mixed content
BENCHMARK_CONFIGS.EMAIL_HEAVY_CONTENT      // Email-focused content
BENCHMARK_CONFIGS.CREDIT_CARD_FOCUSED      // Financial data focused
BENCHMARK_CONFIGS.IP_ADDRESS_LOGS          // Network logs simulation
```

### A/B Test Scenarios

```typescript
import { AB_TEST_SCENARIOS } from '@himorishige/noren-devtools'

// Predefined A/B test scenarios:
AB_TEST_SCENARIOS.CONFIDENCE_SCORING       // With vs without confidence
AB_TEST_SCENARIOS.SENSITIVITY_LEVELS       // Strict vs relaxed detection
AB_TEST_SCENARIOS.CONTEXT_HINTS            // With vs without context hints
AB_TEST_SCENARIOS.PLUGIN_COMBINATIONS      // Different plugin sets
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

## 🛠 API Reference

### Core Classes

- **`BenchmarkRunner`**: Performance testing and analysis
- **`ABTestEngine`**: Configuration comparison and optimization
- **`EvaluationEngine`**: Accuracy testing with ground truth
- **`MemoryMonitor`**: Memory usage tracking
- **`TestDatasetBuilder`**: Ground truth dataset creation

### Utility Functions

- **`generateRealisticText()`**: Create test data resembling real content
- **`measurePerformance()`**: Detailed timing measurements
- **`analyzeDetectionPatterns()`**: Pattern analysis and optimization
- **`exportResults()`**: Report generation and export

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

## 🚀 Performance Tips

1. **Use realistic test data** - Generated data should match your production patterns
2. **Run multiple iterations** - Statistical significance requires adequate sample sizes
3. **Monitor memory usage** - Watch for memory leaks in long-running tests
4. **Profile incrementally** - Test individual components before full integration

## 📄 License

MIT License - see [LICENSE](../../LICENSE) for details.

---

**Part of the [Noren](../../README.md) PII protection suite**

For basic PII detection, see [@himorishige/noren-core](../noren-core).