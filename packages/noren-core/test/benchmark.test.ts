/**
 * P3-2: Tests for performance benchmark system
 * Validates benchmark framework functionality
 */

import { ok, strictEqual, throws } from 'node:assert'
import { test } from 'node:test'
import {
  BENCHMARK_CONFIGS,
  type BenchmarkConfig,
  BenchmarkRunner,
  BenchmarkTextGenerator,
  MemoryMonitor,
  PrecisionTimer,
} from '../src/benchmark.js'

test('BenchmarkTextGenerator - text generation', async (t) => {
  await t.test('should generate text with specified size', () => {
    const generator = new BenchmarkTextGenerator()

    const text100 = generator.generateText(100, 10)
    const text500 = generator.generateText(500, 20)

    // Allow small variance due to word boundaries
    ok(Math.abs(text100.length - 100) <= 20, `Text length ${text100.length} should be close to 100`)
    ok(Math.abs(text500.length - 500) <= 50, `Text length ${text500.length} should be close to 500`)
  })

  await t.test('should include PII based on density', () => {
    const generator = new BenchmarkTextGenerator()

    const _textNoPii = generator.generateText(1000, 0)
    const textHighPii = generator.generateText(1000, 50)

    // High PII density should contain email patterns
    const hasEmail = /@/.test(textHighPii)
    const hasPhone = /\d{3}[-\s]?\d{3,4}[-\s]?\d{4}/.test(textHighPii)

    // At 50% density, should have some PII
    ok(hasEmail || hasPhone, 'High PII density text should contain PII patterns')
  })

  await t.test('should generate structured documents', () => {
    const generator = new BenchmarkTextGenerator()

    const json = generator.generateStructuredText(500, 'json', 20)
    const xml = generator.generateStructuredText(500, 'xml', 20)
    const csv = generator.generateStructuredText(500, 'csv', 20)

    ok(json.includes('{') && json.includes('}'), 'JSON should have valid structure')
    ok(xml.includes('<') && xml.includes('>'), 'XML should have valid structure')
    ok(csv.includes(',') && csv.includes('\\n'), 'CSV should have valid structure')
  })
})

test('MemoryMonitor - memory tracking', async (t) => {
  await t.test('should track memory usage', () => {
    const monitor = new MemoryMonitor()

    monitor.startMonitoring()

    // Allocate some memory
    const bigArray = new Array(10000).fill('test data')

    const result = monitor.stopMonitoring()

    // In environments with memory tracking, should show usage
    ok(typeof result.peak_mb === 'number', 'Should return peak memory')
    ok(typeof result.delta_mb === 'number', 'Should return memory delta')
    ok(result.peak_mb >= 0, 'Peak memory should be non-negative')

    // Clean up
    bigArray.length = 0
  })

  await t.test('should handle environments without process.memoryUsage', () => {
    // Temporarily mock missing memoryUsage
    const originalProcess = global.process
    // @ts-ignore
    global.process = undefined

    const monitor = new MemoryMonitor()
    monitor.startMonitoring()
    const result = monitor.stopMonitoring()

    strictEqual(result.peak_mb, 0, 'Should return 0 in limited environment')
    strictEqual(result.delta_mb, 0, 'Should return 0 in limited environment')

    // Restore
    global.process = originalProcess
  })
})

test('PrecisionTimer - timing accuracy', async (t) => {
  await t.test('should measure elapsed time', async () => {
    const timer = new PrecisionTimer()

    // Wait for a known duration
    await new Promise((resolve) => setTimeout(resolve, 10))

    const elapsed = timer.stop()

    // Should be at least 10ms, allow some variance
    ok(elapsed >= 8, `Elapsed time ${elapsed}ms should be at least 8ms`)
    ok(elapsed <= 50, `Elapsed time ${elapsed}ms should be reasonable`)
  })

  await t.test('should work in different environments', () => {
    // Test with process.hrtime if available
    if (typeof process !== 'undefined' && process.hrtime) {
      const timer = new PrecisionTimer()
      const elapsed = timer.stop()
      ok(typeof elapsed === 'number', 'Should return number with hrtime')
    }

    // Test fallback to performance.now()
    const timer2 = new PrecisionTimer()
    const elapsed2 = timer2.stop()
    ok(typeof elapsed2 === 'number', 'Should return number with performance.now()')
  })
})

test('BenchmarkRunner - single operations', async (t) => {
  await t.test('should run single benchmark', async () => {
    const runner = new BenchmarkRunner()

    const testOperation = () => {
      const data = new Array(1000).fill(0).map(() => Math.random())
      return data.reduce((sum, n) => sum + n, 0)
    }

    const result = await runner.runSingle('test-op', testOperation, 1000, true)

    strictEqual(result.operation, 'test-op')
    ok(result.duration_ms > 0, 'Duration should be positive')
    ok(result.input_size === 1000, 'Input size should match')
    ok(result.timestamp > 0, 'Should have timestamp')
    ok(result.throughput_ops_per_sec > 0, 'Should calculate throughput')
  })

  await t.test('should handle async operations', async () => {
    const runner = new BenchmarkRunner()

    const asyncOperation = async () => {
      await new Promise((resolve) => setTimeout(resolve, 1))
      return 'async result'
    }

    const result = await runner.runSingle('async-op', asyncOperation, 100, false)

    strictEqual(result.operation, 'async-op')
    ok(result.duration_ms >= 1, 'Should measure async duration')
    strictEqual(result.output_size, 12, 'Should measure output size')
  })

  await t.test('should handle operation failures', async () => {
    const runner = new BenchmarkRunner()

    const failingOperation = () => {
      throw new Error('Test failure')
    }

    await throws(
      () => runner.runSingle('failing-op', failingOperation, 100),
      /Benchmark operation failed/,
    )
  })
})

test('BenchmarkRunner - full benchmarks', async (t) => {
  await t.test('should run complete benchmark suite', async () => {
    const runner = new BenchmarkRunner()

    // Simple test operation
    const testOperation = () => {
      return Math.random().toString(36)
    }

    const quickConfig: BenchmarkConfig = {
      iterations: 3,
      warmup_iterations: 1,
      text_sizes: [100, 200],
      pii_densities: [10],
      collect_memory: false, // Skip memory collection for speed
      collect_gc: false,
    }

    const { summary, results } = await runner.runBenchmark('quick-test', testOperation, quickConfig)

    strictEqual(summary.operation, 'quick-test')
    ok(summary.total_runs > 0, 'Should have completed runs')
    ok(summary.avg_duration_ms > 0, 'Should have average duration')
    ok(summary.min_duration_ms <= summary.avg_duration_ms, 'Min should be <= avg')
    ok(summary.avg_duration_ms <= summary.max_duration_ms, 'Avg should be <= max')
    ok(summary.median_duration_ms > 0, 'Should calculate median')
    ok(summary.p95_duration_ms >= summary.median_duration_ms, 'P95 should be >= median')

    strictEqual(results.length, summary.total_runs, 'Results should match summary count')
    ok(summary.error_count === 0, 'Should have no errors in successful run')
  })

  await t.test('should handle benchmark failures gracefully', async () => {
    const runner = new BenchmarkRunner()

    let callCount = 0
    const flakyOperation = () => {
      callCount++
      if (callCount <= 2) {
        throw new Error('Simulated failure')
      }
      return 'success'
    }

    const config: BenchmarkConfig = {
      iterations: 5,
      warmup_iterations: 0,
      text_sizes: [100],
      pii_densities: [10],
      collect_memory: false,
      collect_gc: false,
    }

    const { summary, results } = await runner.runBenchmark('flaky-test', flakyOperation, config)

    ok(summary.error_count > 0, 'Should record errors')
    ok(summary.total_runs > 0, 'Should have some successful runs')
    ok(results.length === summary.total_runs, 'Results should match successful runs')
  })

  await t.test('should calculate correlations', async () => {
    const runner = new BenchmarkRunner()

    // Operation that scales with input size
    const scalingOperation = () => {
      const size = Math.floor(Math.random() * 1000)
      const data = new Array(size).fill(0)
      return data.length
    }

    const config: BenchmarkConfig = {
      iterations: 5,
      warmup_iterations: 1,
      text_sizes: [100, 500, 1000],
      pii_densities: [10],
      collect_memory: false,
      collect_gc: false,
    }

    const { summary } = await runner.runBenchmark('scaling-test', scalingOperation, config)

    ok(typeof summary.text_size_correlation === 'number', 'Should calculate size correlation')
    ok(
      summary.text_size_correlation >= -1 && summary.text_size_correlation <= 1,
      'Correlation should be between -1 and 1',
    )
  })
})

test('BenchmarkRunner - text generation utilities', async (t) => {
  await t.test('should generate benchmark text', () => {
    const runner = new BenchmarkRunner()

    const plainText = runner.generateBenchmarkText(500, 15)
    const jsonText = runner.generateBenchmarkText(500, 20, 'json')
    const xmlText = runner.generateBenchmarkText(400, 25, 'xml')
    const csvText = runner.generateBenchmarkText(300, 30, 'csv')

    ok(plainText.length > 400, 'Should generate text of approximately correct size')
    ok(jsonText.includes('{'), 'Should generate JSON format')
    ok(xmlText.includes('<'), 'Should generate XML format')
    ok(csvText.includes(','), 'Should generate CSV format')
  })
})

test('BENCHMARK_CONFIGS - predefined configurations', async (t) => {
  await t.test('should provide valid configurations', () => {
    const configs = ['quick', 'standard', 'comprehensive', 'memory'] as const

    for (const configName of configs) {
      const config = BENCHMARK_CONFIGS[configName]

      ok(config.iterations > 0, `${configName} should have positive iterations`)
      ok(config.warmup_iterations >= 0, `${configName} should have non-negative warmup`)
      ok(config.text_sizes.length > 0, `${configName} should have text sizes`)
      ok(config.pii_densities.length > 0, `${configName} should have PII densities`)
      ok(
        typeof config.collect_memory === 'boolean',
        `${configName} should specify memory collection`,
      )
      ok(typeof config.collect_gc === 'boolean', `${configName} should specify GC collection`)

      // Check that sizes and densities are reasonable
      for (const size of config.text_sizes) {
        ok(size > 0 && size <= 1000000, `Text size ${size} should be reasonable`)
      }

      for (const density of config.pii_densities) {
        ok(density >= 0 && density <= 100, `PII density ${density} should be 0-100%`)
      }
    }
  })

  await t.test('should have appropriate complexity levels', () => {
    // Quick should be lightest
    ok(BENCHMARK_CONFIGS.quick.iterations <= BENCHMARK_CONFIGS.standard.iterations)
    ok(BENCHMARK_CONFIGS.quick.text_sizes.length <= BENCHMARK_CONFIGS.standard.text_sizes.length)

    // Comprehensive should be heaviest
    ok(BENCHMARK_CONFIGS.standard.iterations <= BENCHMARK_CONFIGS.comprehensive.iterations)
    ok(
      BENCHMARK_CONFIGS.standard.text_sizes.length <=
        BENCHMARK_CONFIGS.comprehensive.text_sizes.length,
    )

    // Memory config should focus on large texts
    const memoryMaxSize = Math.max(...BENCHMARK_CONFIGS.memory.text_sizes)
    const standardMaxSize = Math.max(...BENCHMARK_CONFIGS.standard.text_sizes)
    ok(memoryMaxSize >= standardMaxSize, 'Memory config should test larger sizes')
  })
})
