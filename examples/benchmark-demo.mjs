/**
 * P3-2: Performance benchmark demonstration
 * Shows how to measure PII detection performance across different scenarios
 */

import { 
  Registry,
  BenchmarkRunner, 
  BENCHMARK_CONFIGS
} from '../packages/noren-core/dist/index.js'

/**
 * Demo: Basic performance benchmarking
 */
async function basicPerformanceBenchmark() {
  console.log('=== Basic Performance Benchmark ===')
  
  // Initialize registry with moderate configuration
  const registry = new Registry({
    defaultAction: 'mask',
    contextHints: ['email', 'phone', 'address'],
    enableContextualConfidence: true,
    contextualSuppressionEnabled: true,
    contextualBoostEnabled: false
  })
  
  const runner = new BenchmarkRunner()
  
  // Define PII detection operation
  const detectOperation = async () => {
    // Generate test text with realistic PII patterns
    const testText = runner.generateBenchmarkText(5000, 15) // 5KB text, 15% PII
    const result = await registry.detect(testText)
    return result
  }
  
  console.log('Running PII detection benchmark...')
  const { summary, results } = await runner.runBenchmark(
    'pii-detection',
    detectOperation,
    BENCHMARK_CONFIGS.quick
  )
  
  console.log('\\n=== Performance Results ===')
  console.log(`Operation: ${summary.operation}`)
  console.log(`Total Runs: ${summary.total_runs}`)
  console.log(`Average Duration: ${summary.avg_duration_ms.toFixed(2)}ms`)
  console.log(`Median Duration: ${summary.median_duration_ms.toFixed(2)}ms`)
  console.log(`95th Percentile: ${summary.p95_duration_ms.toFixed(2)}ms`)
  console.log(`99th Percentile: ${summary.p99_duration_ms.toFixed(2)}ms`)
  console.log(`Throughput: ${summary.avg_throughput_ops_per_sec.toFixed(0)} chars/sec`)
  
  if (summary.avg_memory_peak_mb > 0) {
    console.log(`\\n=== Memory Usage ===`)
    console.log(`Average Peak Memory: ${summary.avg_memory_peak_mb.toFixed(2)}MB`)
    console.log(`Average Memory Delta: ${summary.avg_memory_delta_mb.toFixed(2)}MB`)
    console.log(`Memory Efficiency: ${summary.memory_efficiency_mb_per_kb.toFixed(4)}MB per KB input`)
  }
  
  console.log(`\\n=== Scaling Analysis ===`)
  console.log(`Text Size Correlation: ${summary.text_size_correlation.toFixed(3)}`)
  console.log(`Error Count: ${summary.error_count}`)
  
  // Show distribution of results
  const durations = results.map(r => r.duration_ms).sort((a, b) => a - b)
  const fastestRun = Math.min(...durations)
  const slowestRun = Math.max(...durations)
  console.log(`\\n=== Performance Distribution ===`)
  console.log(`Fastest Run: ${fastestRun.toFixed(2)}ms`)
  console.log(`Slowest Run: ${slowestRun.toFixed(2)}ms`)
  console.log(`Performance Variance: ${((slowestRun / fastestRun - 1) * 100).toFixed(1)}%`)
  
  return summary
}

/**
 * Demo: Memory usage analysis
 */
async function memoryUsageBenchmark() {
  console.log('\\n\\n=== Memory Usage Analysis ===')
  
  const registry = new Registry({
    defaultAction: 'mask',
    enableContextualConfidence: true,
    contextHints: ['email', 'phone', 'credit_card', 'ip'] // Multiple hints for memory testing
  })
  
  const runner = new BenchmarkRunner()
  
  // Test different text sizes to analyze memory scaling
  const testSizes = [1000, 5000, 10000, 50000] // 1KB to 50KB
  
  console.log('Testing memory usage across different text sizes...')
  
  for (const size of testSizes) {
    const detectOperation = async () => {
      const testText = runner.generateBenchmarkText(size, 20) // 20% PII density
      const result = await registry.detect(testText)
      return result
    }
    
    const singleResult = await runner.runSingle('memory-test', detectOperation, size, true)
    
    console.log(`\\nText Size: ${size} chars`)
    console.log(`  Duration: ${singleResult.duration_ms.toFixed(2)}ms`)
    console.log(`  Peak Memory: ${singleResult.memory_peak_mb.toFixed(2)}MB`)
    console.log(`  Memory Delta: ${singleResult.memory_delta_mb.toFixed(2)}MB`)
    console.log(`  Throughput: ${singleResult.throughput_ops_per_sec.toFixed(0)} chars/sec`)
    console.log(`  Memory/Size Ratio: ${(singleResult.memory_peak_mb / (size/1024)).toFixed(4)} MB/KB`)
    console.log(`  Detected Items: ${singleResult.output_size}`)
  }
}

/**
 * Demo: Format-specific performance comparison
 */
async function formatPerformanceBenchmark() {
  console.log('\\n\\n=== Format-Specific Performance ===')
  
  const registry = new Registry({
    defaultAction: 'mask',
    enableContextualConfidence: true,
    contextualSuppressionEnabled: true
  })
  
  const runner = new BenchmarkRunner()
  const formats = ['plain', 'json', 'xml', 'csv']
  
  console.log('Comparing detection performance across different document formats...')
  
  for (const format of formats) {
    console.log(`\\nTesting ${format.toUpperCase()} format...`)
    
    const detectOperation = async () => {
      const testText = format === 'plain' 
        ? runner.generateBenchmarkText(5000, 25)
        : runner.generateBenchmarkText(5000, 25, format)
      
      const result = await registry.detect(testText)
      return result
    }
    
    // Use minimal config for quick comparison
    const quickConfig = {
      iterations: 10,
      warmup_iterations: 2,
      text_sizes: [5000], // Fixed size for fair comparison
      pii_densities: [25],
      collect_memory: true,
      collect_gc: false
    }
    
    const { summary } = await runner.runBenchmark(`${format}-format`, detectOperation, quickConfig)
    
    console.log(`  Average Duration: ${summary.avg_duration_ms.toFixed(2)}ms`)
    console.log(`  Median Duration: ${summary.median_duration_ms.toFixed(2)}ms`)
    console.log(`  95th Percentile: ${summary.p95_duration_ms.toFixed(2)}ms`)
    console.log(`  Throughput: ${summary.avg_throughput_ops_per_sec.toFixed(0)} chars/sec`)
    console.log(`  Memory Efficiency: ${summary.memory_efficiency_mb_per_kb.toFixed(4)} MB/KB`)
  }
}

/**
 * Demo: Contextual confidence impact on performance
 */
async function contextualConfidenceBenchmark() {
  console.log('\\n\\n=== Contextual Confidence Performance Impact ===')
  
  const runner = new BenchmarkRunner()
  
  // Test with contextual confidence disabled vs enabled
  const configs = [
    {
      name: 'Disabled',
      registry: new Registry({
        defaultAction: 'mask',
        enableContextualConfidence: false
      })
    },
    {
      name: 'Enabled (Conservative)',
      registry: new Registry({
        defaultAction: 'mask',
        enableContextualConfidence: true,
        contextualSuppressionEnabled: true,
        contextualBoostEnabled: false
      })
    },
    {
      name: 'Enabled (Full)',
      registry: new Registry({
        defaultAction: 'mask',
        enableContextualConfidence: true,
        contextualSuppressionEnabled: true,
        contextualBoostEnabled: true
      })
    }
  ]
  
  console.log('Comparing performance with different contextual confidence settings...')
  
  const results = {}
  
  for (const config of configs) {
    console.log(`\\nTesting: ${config.name}`)
    
    const detectOperation = async () => {
      // Generate text with context markers for better testing
      const baseText = runner.generateBenchmarkText(3000, 20)
      const contextText = `Example document with sample data: ${baseText} (This is test data)`
      const result = await config.registry.detect(contextText)
      return result
    }
    
    const quickConfig = {
      iterations: 15,
      warmup_iterations: 3,
      text_sizes: [3000],
      pii_densities: [20],
      collect_memory: true,
      collect_gc: false
    }
    
    const { summary } = await runner.runBenchmark(`contextual-${config.name.toLowerCase()}`, detectOperation, quickConfig)
    
    console.log(`  Average Duration: ${summary.avg_duration_ms.toFixed(2)}ms`)
    console.log(`  Throughput: ${summary.avg_throughput_ops_per_sec.toFixed(0)} chars/sec`)
    console.log(`  Memory Usage: ${summary.avg_memory_peak_mb.toFixed(2)}MB`)
    
    results[config.name] = summary
  }
  
  // Calculate performance impact
  const baseDuration = results['Disabled'].avg_duration_ms
  console.log('\\n=== Performance Impact Analysis ===')
  for (const [name, summary] of Object.entries(results)) {
    if (name === 'Disabled') continue
    const impact = ((summary.avg_duration_ms / baseDuration - 1) * 100).toFixed(1)
    console.log(`${name}: ${impact > 0 ? '+' : ''}${impact}% slower than disabled`)
  }
}

/**
 * Demo: Stress testing with large documents
 */
async function stressBenchmark() {
  console.log('\\n\\n=== Stress Test with Large Documents ===')
  
  const registry = new Registry({
    defaultAction: 'mask',
    enableContextualConfidence: true
  })
  
  const runner = new BenchmarkRunner()
  
  // Test progressively larger documents
  const stressSizes = [50000, 100000, 200000] // 50KB to 200KB
  
  console.log('Testing performance with large documents...')
  
  for (const size of stressSizes) {
    console.log(`\\nTesting ${size/1000}KB document...`)
    
    const detectOperation = async () => {
      const testText = runner.generateBenchmarkText(size, 10) // Lower PII density for realism
      const result = await registry.detect(testText)
      return result
    }
    
    try {
      const singleResult = await runner.runSingle('stress-test', detectOperation, size, true)
      
      console.log(`  Duration: ${singleResult.duration_ms.toFixed(2)}ms`)
      console.log(`  Throughput: ${(singleResult.throughput_ops_per_sec/1000).toFixed(1)}K chars/sec`)
      console.log(`  Peak Memory: ${singleResult.memory_peak_mb.toFixed(2)}MB`)
      console.log(`  Detected Items: ${singleResult.output_size}`)
      console.log(`  Processing Rate: ${(size/singleResult.duration_ms).toFixed(1)} chars/ms`)
      
      // Memory efficiency check
      const memoryPerChar = singleResult.memory_peak_mb * 1024 * 1024 / size
      console.log(`  Memory Efficiency: ${memoryPerChar.toFixed(2)} bytes/char`)
      
      // Performance warning for very slow operations
      if (singleResult.duration_ms > 1000) {
        console.log(`  ⚠️  Warning: Processing took over 1 second`)
      }
      
      if (singleResult.memory_peak_mb > 50) {
        console.log(`  ⚠️  Warning: Memory usage exceeded 50MB`)
      }
      
    } catch (error) {
      console.log(`  ❌ Failed: ${error.message}`)
    }
  }
}

/**
 * Main benchmark runner
 */
async function main() {
  try {
    console.log('🚀 Starting Noren Performance Benchmark Suite')
    console.log('='.repeat(50))
    
    await basicPerformanceBenchmark()
    await memoryUsageBenchmark() 
    await formatPerformanceBenchmark()
    await contextualConfidenceBenchmark()
    await stressBenchmark()
    
    console.log('\\n' + '='.repeat(50))
    console.log('✅ All benchmarks completed successfully!')
    console.log('\\n📊 Performance Summary:')
    console.log('- Basic detection: Measured timing and memory usage')
    console.log('- Memory scaling: Analyzed across different text sizes')
    console.log('- Format impact: Compared plain text vs structured formats')
    console.log('- Feature cost: Measured contextual confidence overhead')
    console.log('- Stress limits: Tested with large documents up to 200KB')
    
  } catch (error) {
    console.error('❌ Benchmark failed:', error)
    process.exit(1)
  }
}

// Run the demo
main()