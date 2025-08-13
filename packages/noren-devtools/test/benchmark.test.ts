/**
 * P3-2: Tests for performance benchmark system
 * Validates benchmark framework functionality
 */

import { describe, expect, it } from 'vitest'
import {
  BENCHMARK_CONFIGS,
  type BenchmarkConfig,
  BenchmarkRunner,
  BenchmarkTextGenerator,
  MemoryMonitor,
  PrecisionTimer,
} from '../src/benchmark.js'

describe('BenchmarkTextGenerator - text generation', () => {
  it('should generate text with specified size', () => {
    const generator = new BenchmarkTextGenerator()

    const text100 = generator.generateText(100, 10)
    const text500 = generator.generateText(500, 20)

    // Allow small variance due to word boundaries
    expect(Math.abs(text100.length - 100)).toBeLessThanOrEqual(20)
    expect(Math.abs(text500.length - 500)).toBeLessThanOrEqual(50)
  })

  it('should include PII based on density', () => {
    const generator = new BenchmarkTextGenerator()

    const _textNoPii = generator.generateText(1000, 0)
    const textHighPii = generator.generateText(1000, 50)

    // High PII density should contain email patterns
    const hasEmail = /@/.test(textHighPii)
    const hasPhone = /\d{3}[-\s]?\d{3,4}[-\s]?\d{4}/.test(textHighPii)

    // At 50% density, should have some PII
    expect(hasEmail || hasPhone).toBe(true)
  })

  it('should generate structured documents', () => {
    const generator = new BenchmarkTextGenerator()

    const json = generator.generateStructuredText(500, 'json', 20)
    const xml = generator.generateStructuredText(500, 'xml', 20)
    const csv = generator.generateStructuredText(500, 'csv', 20)

    expect(json.includes('{') && json.includes('}')).toBe(true)
    expect(xml.includes('<') && xml.includes('>')).toBe(true)
    expect(csv.includes(',') && csv.includes('\\n')).toBe(true)
  })
})

describe('MemoryMonitor - memory tracking', () => {
  it('should track memory usage', () => {
    const monitor = new MemoryMonitor()

    monitor.startMonitoring()

    // Allocate some memory
    const bigArray = new Array(10000).fill('test data')

    const result = monitor.stopMonitoring()

    // In environments with memory tracking, should show usage
    expect(typeof result.peak_mb).toBe('number')
    expect(typeof result.delta_mb).toBe('number')
    expect(result.peak_mb).toBeGreaterThanOrEqual(0)

    // Clean up
    bigArray.length = 0
  })

  it('should handle environments without process.memoryUsage', () => {
    // Temporarily mock missing memoryUsage
    const originalProcess = global.process
    // @ts-ignore
    global.process = undefined

    const monitor = new MemoryMonitor()
    monitor.startMonitoring()
    const result = monitor.stopMonitoring()

    expect(result.peak_mb).toBe(0)
    expect(result.delta_mb).toBe(0)

    // Restore
    global.process = originalProcess
  })
})

describe('PrecisionTimer - timing accuracy', () => {
  it('should measure elapsed time', async () => {
    const timer = new PrecisionTimer()

    // Wait for a known duration
    await new Promise((resolve) => setTimeout(resolve, 10))

    const elapsed = timer.stop()

    // Should be at least 10ms, allow some variance
    expect(elapsed).toBeGreaterThanOrEqual(8)
    expect(elapsed).toBeLessThanOrEqual(50)
  })

  it('should work in different environments', () => {
    // Test with process.hrtime if available
    if (typeof process !== 'undefined' && process.hrtime) {
      const timer = new PrecisionTimer()
      const elapsed = timer.stop()
      expect(typeof elapsed).toBe('number')
    }

    // Test fallback to performance.now()
    const timer2 = new PrecisionTimer()
    const elapsed2 = timer2.stop()
    expect(typeof elapsed2).toBe('number')
  })
})

describe('BenchmarkRunner - single operations', () => {
  it('should run single benchmark', async () => {
    const runner = new BenchmarkRunner()

    const testOperation = () => {
      const data = new Array(1000).fill(0).map(() => Math.random())
      return data.reduce((sum, n) => sum + n, 0)
    }

    const result = await runner.runSingle('test-op', testOperation, 1000, true)

    expect(result.operation).toBe('test-op')
    expect(result.duration_ms).toBeGreaterThan(0)
    expect(result.input_size).toBe(1000)
    expect(result.timestamp).toBeGreaterThan(0)
    expect(result.throughput_ops_per_sec).toBeGreaterThan(0)
  })

  it('should handle async operations', async () => {
    const runner = new BenchmarkRunner()

    const asyncOperation = async () => {
      await new Promise((resolve) => setTimeout(resolve, 1))
      return 'async result'
    }

    const result = await runner.runSingle('async-op', asyncOperation, 100, false)

    expect(result.operation).toBe('async-op')
    expect(result.duration_ms).toBeGreaterThanOrEqual(1)
    expect(result.output_size).toBe(12)
  })

  it('should handle operation failures', async () => {
    const runner = new BenchmarkRunner()

    const failingOperation = () => {
      throw new Error('Test failure')
    }

    await expect(async () => {
      await runner.runSingle('failing-op', failingOperation, 100)
    }).rejects.toThrow(/Benchmark operation failed/)
  })
})

describe('BenchmarkRunner - full benchmarks', () => {
  it('should run complete benchmark suite', async () => {
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

    expect(summary.operation).toBe('quick-test')
    expect(summary.total_runs).toBeGreaterThan(0)
    expect(summary.avg_duration_ms).toBeGreaterThan(0)
    expect(summary.min_duration_ms).toBeLessThanOrEqual(summary.avg_duration_ms)
    expect(summary.avg_duration_ms).toBeLessThanOrEqual(summary.max_duration_ms)
    expect(summary.median_duration_ms).toBeGreaterThan(0)
    expect(summary.p95_duration_ms).toBeGreaterThanOrEqual(summary.median_duration_ms)

    expect(results.length).toBe(summary.total_runs)
    expect(summary.error_count).toBe(0)
  })

  it('should handle benchmark failures gracefully', async () => {
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

    expect(summary.error_count).toBeGreaterThan(0)
    expect(summary.total_runs).toBeGreaterThan(0)
    expect(results.length).toBe(summary.total_runs)
  })

  it('should calculate correlations', async () => {
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

    expect(typeof summary.text_size_correlation).toBe('number')
    expect(summary.text_size_correlation).toBeGreaterThanOrEqual(-1)
    expect(summary.text_size_correlation).toBeLessThanOrEqual(1)
  })
})

describe('BenchmarkRunner - text generation utilities', () => {
  it('should generate benchmark text', () => {
    const runner = new BenchmarkRunner()

    const plainText = runner.generateBenchmarkText(500, 15)
    const jsonText = runner.generateBenchmarkText(500, 20, 'json')
    const xmlText = runner.generateBenchmarkText(400, 25, 'xml')
    const csvText = runner.generateBenchmarkText(300, 30, 'csv')

    expect(plainText.length).toBeGreaterThan(400)
    expect(jsonText.includes('{')).toBe(true)
    expect(xmlText.includes('<')).toBe(true)
    expect(csvText.includes(',')).toBe(true)
  })
})

describe('BENCHMARK_CONFIGS - predefined configurations', () => {
  it('should provide valid configurations', () => {
    const configs = ['quick', 'standard', 'comprehensive', 'memory'] as const

    for (const configName of configs) {
      const config = BENCHMARK_CONFIGS[configName]

      expect(config.iterations).toBeGreaterThan(0)
      expect(config.warmup_iterations).toBeGreaterThanOrEqual(0)
      expect(config.text_sizes.length).toBeGreaterThan(0)
      expect(config.pii_densities.length).toBeGreaterThan(0)
      expect(typeof config.collect_memory).toBe('boolean')
      expect(typeof config.collect_gc).toBe('boolean')

      // Check that sizes and densities are reasonable
      for (const size of config.text_sizes) {
        expect(size).toBeGreaterThan(0)
        expect(size).toBeLessThanOrEqual(1000000)
      }

      for (const density of config.pii_densities) {
        expect(density).toBeGreaterThanOrEqual(0)
        expect(density).toBeLessThanOrEqual(100)
      }
    }
  })

  it('should have appropriate complexity levels', () => {
    // Quick should be lightest
    expect(BENCHMARK_CONFIGS.quick.iterations).toBeLessThanOrEqual(
      BENCHMARK_CONFIGS.standard.iterations,
    )
    expect(BENCHMARK_CONFIGS.quick.text_sizes.length).toBeLessThanOrEqual(
      BENCHMARK_CONFIGS.standard.text_sizes.length,
    )

    // Comprehensive should be heaviest
    expect(BENCHMARK_CONFIGS.standard.iterations).toBeLessThanOrEqual(
      BENCHMARK_CONFIGS.comprehensive.iterations,
    )
    expect(BENCHMARK_CONFIGS.standard.text_sizes.length).toBeLessThanOrEqual(
      BENCHMARK_CONFIGS.comprehensive.text_sizes.length,
    )

    // Memory config should focus on large texts
    const memoryMaxSize = Math.max(...BENCHMARK_CONFIGS.memory.text_sizes)
    const standardMaxSize = Math.max(...BENCHMARK_CONFIGS.standard.text_sizes)
    expect(memoryMaxSize).toBeGreaterThanOrEqual(standardMaxSize)
  })
})
