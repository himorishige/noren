/**
 * Performance benchmark system for continuous optimization
 * Streamlined implementation with unified statistical analysis and reporting
 */

import type { Registry } from '@himorishige/noren-core'
import {
  createBenchmarkReport,
  type PerformanceMetrics,
  printProgress,
  printReport,
} from './report-common.js'
import {
  calculateSummaryStats,
  mean,
  pearsonCorrelation,
  type SummaryStats,
} from './stats-common.js'

// ===== Core Interfaces =====

export interface PerformanceResult {
  operation: string
  duration: number
  memoryPeak: number
  memoryDelta: number
  throughput: number
  inputSize: number
  outputSize: number
  timestamp: number
}

export interface BenchmarkConfig {
  test_cases: Array<{
    id: string
    name: string
    text: string
    expected_pii_count?: number
  }>
  iterations: number
  warmup_runs?: number
  memory_monitoring?: boolean
  timeout_ms?: number
}

export interface BenchmarkTestCaseResult {
  testCase: { id: string; name: string }
  results: PerformanceResult[]
  summary: SummaryStats
}

export interface BenchmarkSummary {
  operation: string
  totalRuns: number
  duration: SummaryStats
  throughput: number
  memoryEfficiency: number
  errorRate?: number
  textSizeCorrelation: number
}

// ===== Text Generator =====

export class BenchmarkTextGenerator {
  private static readonly PII_PATTERNS = {
    emails: ['user@company.com', 'admin@service.org', 'contact@startup.io', 'hello@domain.com'],
    phones: ['090-1234-5678', '080-9876-5432', '(555) 123-4567', '03-1234-5678'],
    ips: ['192.168.1.1', '10.0.0.1', '2001:db8::1', '203.0.113.1'],
    names: ['John Smith', 'Jane Doe', '田中太郎', 'Mike Brown'],
    cards: ['4111111111111111', '5555555555554444', '378282246310005'],
  }

  private static readonly NORMAL_WORDS = [
    'the',
    'quick',
    'brown',
    'fox',
    'jumps',
    'over',
    'lazy',
    'dog',
    'lorem',
    'ipsum',
    'dolor',
    'sit',
    'amet',
    'consectetur',
    'adipiscing',
    'elit',
    'technology',
    'system',
  ]

  generateText(targetSize: number, piiDensity: number): string {
    const words: string[] = []
    let currentSize = 0
    const targetPiiCount = Math.floor((targetSize * (piiDensity / 100)) / 20)
    let piiCount = 0

    while (currentSize < targetSize) {
      const shouldAddPii = piiCount < targetPiiCount && Math.random() < piiDensity / 100

      if (shouldAddPii) {
        const patterns = Object.values(BenchmarkTextGenerator.PII_PATTERNS).flat()
        const pattern = patterns[Math.floor(Math.random() * patterns.length)]
        words.push(pattern)
        currentSize += pattern.length + 1
        piiCount++
      } else {
        const word =
          BenchmarkTextGenerator.NORMAL_WORDS[
            Math.floor(Math.random() * BenchmarkTextGenerator.NORMAL_WORDS.length)
          ]
        words.push(word)
        currentSize += word.length + 1
      }
    }

    return words.join(' ').substring(0, targetSize)
  }

  generateJson(targetSize: number, piiDensity: number): string {
    const entries: unknown[] = []
    let currentSize = 50

    while (currentSize < targetSize) {
      const entry: Record<string, unknown> = { id: Math.random().toString(36).substr(2, 9) }

      if (Math.random() < piiDensity / 100) {
        entry.email = BenchmarkTextGenerator.PII_PATTERNS.emails[0]
        entry.name = BenchmarkTextGenerator.PII_PATTERNS.names[0]
      }

      entry.data = this.generateText(30, 0)
      const json = JSON.stringify(entry)

      if (currentSize + json.length <= targetSize) {
        entries.push(entry)
        currentSize += json.length + 1
      } else {
        break
      }
    }

    return JSON.stringify(entries).substring(0, targetSize)
  }
}

// ===== Performance Monitoring =====

export class MemoryMonitor {
  private initialMemory = 0
  private peakMemory = 0
  private intervalId?: NodeJS.Timeout

  start(): void {
    if (typeof process === 'undefined') return

    const initial = process.memoryUsage()
    this.initialMemory = initial.heapUsed
    this.peakMemory = initial.heapUsed

    this.intervalId = setInterval(() => {
      const current = process.memoryUsage()
      this.peakMemory = Math.max(this.peakMemory, current.heapUsed)
    }, 10)
  }

  stop(): { peak: number; delta: number } {
    if (this.intervalId) {
      clearInterval(this.intervalId)
      this.intervalId = undefined
    }

    if (typeof process === 'undefined') {
      return { peak: 0, delta: 0 }
    }

    const final = process.memoryUsage()
    return {
      peak: this.peakMemory / 1024 / 1024, // MB
      delta: (final.heapUsed - this.initialMemory) / 1024 / 1024, // MB
    }
  }
}

export class PrecisionTimer {
  private startTime: [number, number] | number

  constructor() {
    this.startTime =
      typeof process !== 'undefined' && process.hrtime ? process.hrtime() : performance.now()
  }

  stop(): number {
    if (Array.isArray(this.startTime)) {
      const diff = process.hrtime(this.startTime)
      return diff[0] * 1000 + diff[1] / 1000000 // Convert to ms
    } else {
      return performance.now() - this.startTime
    }
  }
}

// ===== Main Benchmark Runner =====

export class BenchmarkRunner {
  async runBenchmark(
    operation: string,
    registry: Registry,
    testCases: BenchmarkConfig['test_cases'],
    options: {
      iterations: number
      warmupRuns?: number
      memoryMonitoring?: boolean
    },
  ): Promise<{
    summary: BenchmarkSummary
    testCaseResults: BenchmarkTestCaseResult[]
  }> {
    console.log(
      `🔧 Running benchmark: ${operation} (${testCases.length} test cases, ${options.iterations} iterations)`,
    )

    const testCaseResults: BenchmarkTestCaseResult[] = []
    const totalResults: PerformanceResult[] = []

    // Warmup
    if (options.warmupRuns && options.warmupRuns > 0) {
      console.log(`🔥 Warming up: ${options.warmupRuns} runs`)
      const warmupCase = testCases[0]
      for (let i = 0; i < options.warmupRuns; i++) {
        try {
          await this.runSingleTest(warmupCase.text, registry, false)
        } catch {
          // Ignore warmup errors
        }
      }
    }

    // Main benchmark
    for (let i = 0; i < testCases.length; i++) {
      const testCase = testCases[i]
      console.log(`\n📊 Test Case ${i + 1}/${testCases.length}: ${testCase.name}`)

      const results: PerformanceResult[] = []

      for (let iteration = 0; iteration < options.iterations; iteration++) {
        try {
          const result = await this.runSingleTest(
            testCase.text,
            registry,
            options.memoryMonitoring ?? true,
          )

          result.operation = operation
          result.timestamp = Date.now()
          results.push(result)

          if ((iteration + 1) % Math.max(1, Math.floor(options.iterations / 5)) === 0) {
            printProgress(iteration + 1, options.iterations, 'Testing')
          }
        } catch (error) {
          console.warn(`Iteration ${iteration + 1} failed:`, error)
        }
      }

      if (results.length > 0) {
        const durations = results.map((r) => r.duration)
        const summary = calculateSummaryStats(durations)

        testCaseResults.push({
          testCase: { id: testCase.id, name: testCase.name },
          results,
          summary,
        })

        totalResults.push(...results)
      }
    }

    if (totalResults.length === 0) {
      throw new Error('All benchmark iterations failed')
    }

    // Calculate overall summary
    const durations = totalResults.map((r) => r.duration)
    const inputSizes = totalResults.map((r) => r.inputSize)
    const throughputs = totalResults.map((r) => r.throughput)
    const memoryUsage = totalResults.map((r) => r.memoryPeak)

    const summary: BenchmarkSummary = {
      operation,
      totalRuns: totalResults.length,
      duration: calculateSummaryStats(durations),
      throughput: mean(throughputs) / 1000, // Convert to K chars/sec
      memoryEfficiency: mean(memoryUsage),
      textSizeCorrelation: pearsonCorrelation(inputSizes, durations),
      errorRate: 0, // Could track this if needed
    }

    // Generate report
    this.printBenchmarkReport(operation, summary, testCaseResults)

    return { summary, testCaseResults }
  }

  private async runSingleTest(
    text: string,
    registry: Registry,
    memoryMonitoring: boolean,
  ): Promise<PerformanceResult> {
    // Force GC if available
    if (typeof global !== 'undefined' && global.gc) {
      global.gc()
      await new Promise((resolve) => setTimeout(resolve, 10))
    }

    const memoryMonitor = new MemoryMonitor()
    if (memoryMonitoring) {
      memoryMonitor.start()
    }

    const timer = new PrecisionTimer()

    // Run the actual detection
    const detections = await registry.detect(text)

    const duration = timer.stop()
    const memory = memoryMonitoring ? memoryMonitor.stop() : { peak: 0, delta: 0 }

    const throughput = text.length > 0 ? text.length / (duration / 1000) : 0

    return {
      operation: '',
      duration,
      memoryPeak: memory.peak,
      memoryDelta: memory.delta,
      throughput,
      inputSize: text.length,
      outputSize: detections.hits.length,
      timestamp: 0,
    }
  }

  private printBenchmarkReport(
    operation: string,
    summary: BenchmarkSummary,
    testCaseResults: BenchmarkTestCaseResult[],
  ): void {
    const results = testCaseResults.map((tc) => ({
      name: tc.testCase.name,
      metrics: {
        duration: summary.duration.mean,
        throughput: summary.throughput,
        memoryUsage: summary.memoryEfficiency,
        errorRate: summary.errorRate,
      } as PerformanceMetrics,
    }))

    const report = createBenchmarkReport(operation, results)
    printReport(report)
  }
}

// ===== Predefined Configurations =====

export const BENCHMARK_CONFIGS = {
  quick: {
    test_cases: [
      {
        id: 'small',
        name: 'Small Text (1KB)',
        text: new BenchmarkTextGenerator().generateText(1000, 10),
      },
      {
        id: 'medium',
        name: 'Medium Text (10KB)',
        text: new BenchmarkTextGenerator().generateText(10000, 15),
      },
    ],
    iterations: 10,
    warmup_runs: 2,
    memory_monitoring: true,
  } as BenchmarkConfig,

  standard: {
    test_cases: [
      {
        id: 'small',
        name: 'Small Text (1KB)',
        text: new BenchmarkTextGenerator().generateText(1000, 10),
      },
      {
        id: 'medium',
        name: 'Medium Text (10KB)',
        text: new BenchmarkTextGenerator().generateText(10000, 15),
      },
      {
        id: 'large',
        name: 'Large Text (50KB)',
        text: new BenchmarkTextGenerator().generateText(50000, 20),
      },
      {
        id: 'json',
        name: 'JSON Data (5KB)',
        text: new BenchmarkTextGenerator().generateJson(5000, 25),
      },
    ],
    iterations: 25,
    warmup_runs: 5,
    memory_monitoring: true,
  } as BenchmarkConfig,

  comprehensive: {
    test_cases: [
      {
        id: 'tiny',
        name: 'Tiny Text (100B)',
        text: new BenchmarkTextGenerator().generateText(100, 5),
      },
      {
        id: 'small',
        name: 'Small Text (1KB)',
        text: new BenchmarkTextGenerator().generateText(1000, 10),
      },
      {
        id: 'medium',
        name: 'Medium Text (10KB)',
        text: new BenchmarkTextGenerator().generateText(10000, 15),
      },
      {
        id: 'large',
        name: 'Large Text (50KB)',
        text: new BenchmarkTextGenerator().generateText(50000, 20),
      },
      {
        id: 'xlarge',
        name: 'XLarge Text (100KB)',
        text: new BenchmarkTextGenerator().generateText(100000, 25),
      },
      {
        id: 'json_small',
        name: 'JSON Small (1KB)',
        text: new BenchmarkTextGenerator().generateJson(1000, 30),
      },
      {
        id: 'json_large',
        name: 'JSON Large (10KB)',
        text: new BenchmarkTextGenerator().generateJson(10000, 35),
      },
    ],
    iterations: 50,
    warmup_runs: 10,
    memory_monitoring: true,
    timeout_ms: 600000,
  } as BenchmarkConfig,
} as const
