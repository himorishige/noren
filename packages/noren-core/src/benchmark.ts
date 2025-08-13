/**
 * P3-2: Performance benchmark system for continuous optimization
 * Measures detection speed, memory usage, and throughput
 */

/**
 * Performance metrics for a single operation
 */
export interface PerformanceResult {
  operation: string
  duration_ms: number
  memory_peak_mb: number
  memory_delta_mb: number
  throughput_ops_per_sec: number
  input_size: number
  output_size: number
  timestamp: number
}

/**
 * Configuration for benchmark runs
 */
export interface BenchmarkConfig {
  iterations: number
  warmup_iterations: number
  text_sizes: number[] // Character counts to test
  pii_densities: number[] // Percentage of PII in text (0-100)
  collect_memory: boolean
  collect_gc: boolean
  timeout_ms?: number
}

/**
 * Aggregated benchmark results
 */
export interface BenchmarkSummary {
  operation: string
  total_runs: number
  avg_duration_ms: number
  median_duration_ms: number
  p95_duration_ms: number
  p99_duration_ms: number
  min_duration_ms: number
  max_duration_ms: number
  avg_throughput_ops_per_sec: number
  avg_memory_peak_mb: number
  avg_memory_delta_mb: number
  memory_efficiency_mb_per_kb: number // Memory per KB of input
  text_size_correlation: number // How much size affects performance (-1 to 1)
  pii_density_correlation: number // How much PII density affects performance
  error_count: number
}

/**
 * Text generator for benchmark data
 */
export class BenchmarkTextGenerator {
  private readonly emailPatterns = [
    'user@company.com',
    'admin@service.org',
    'contact@startup.io',
    'support@tech.co.jp',
    'info@business.net',
    'hello@domain.com',
  ]

  private readonly phonePatterns = [
    '090-1234-5678',
    '080-9876-5432',
    '070-1111-2222',
    '(555) 123-4567',
    '+81-90-1234-5678',
    '03-1234-5678',
  ]

  private readonly ipPatterns = [
    '192.168.1.1',
    '10.0.0.1',
    '172.16.0.1',
    '2001:db8::1',
    '::1',
    '203.0.113.1',
  ]

  private readonly creditCardPatterns = [
    '4111111111111111',
    '5555555555554444',
    '378282246310005',
    '6011111111111117',
    '30569309025904',
  ]

  private readonly namePatterns = [
    'John Smith',
    'Jane Doe',
    'Alice Johnson',
    'Bob Wilson',
    '田中太郎',
    'アリス・スミス',
    'Mike Brown',
  ]

  private readonly normalWords = [
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
    'sed',
    'do',
    'eiusmod',
    'tempor',
    'incididunt',
    'ut',
    'labore',
    'et',
    'dolore',
    'magna',
    'aliqua',
    'enim',
    'ad',
    'minim',
    'veniam',
    'quis',
    'nostrud',
    'exercitation',
    'ullamco',
    'laboris',
    'nisi',
    'aliquip',
    'ex',
    'ea',
    'commodo',
    'consequat',
    'duis',
    'aute',
    'irure',
    'in',
    'reprehenderit',
    'voluptate',
    'velit',
    'esse',
    'cillum',
    'fugiat',
    'nulla',
    'pariatur',
    'excepteur',
    'sint',
    'occaecat',
    'cupidatat',
    'non',
    'proident',
    'sunt',
    'culpa',
    'qui',
    'officia',
    'deserunt',
    'mollit',
    'anim',
    'id',
    'est',
  ]

  /**
   * Generate text with specified size and PII density
   */
  generateText(targetSize: number, piiDensity: number): string {
    const piiTypes = [
      { patterns: this.emailPatterns, weight: 30 },
      { patterns: this.phonePatterns, weight: 25 },
      { patterns: this.ipPatterns, weight: 15 },
      { patterns: this.creditCardPatterns, weight: 15 },
      { patterns: this.namePatterns, weight: 15 },
    ]

    const words: string[] = []
    let currentSize = 0
    const targetPiiCount = Math.floor((targetSize * (piiDensity / 100)) / 20) // Rough estimate
    let piiCount = 0

    while (currentSize < targetSize) {
      const shouldAddPii =
        piiCount < targetPiiCount && (words.length === 0 || Math.random() < piiDensity / 100)

      if (shouldAddPii) {
        // Add PII
        const typeWeights = piiTypes.map((t) => t.weight)
        const totalWeight = typeWeights.reduce((a, b) => a + b, 0)
        let random = Math.random() * totalWeight

        let selectedType = piiTypes[0]
        for (const type of piiTypes) {
          random -= type.weight
          if (random <= 0) {
            selectedType = type
            break
          }
        }

        const pattern =
          selectedType.patterns[Math.floor(Math.random() * selectedType.patterns.length)]
        words.push(pattern)
        currentSize += pattern.length + 1 // +1 for space
        piiCount++
      } else {
        // Add normal word
        const word = this.normalWords[Math.floor(Math.random() * this.normalWords.length)]
        words.push(word)
        currentSize += word.length + 1 // +1 for space
      }
    }

    return words.join(' ').substring(0, targetSize)
  }

  /**
   * Generate structured document (JSON, XML, etc.)
   */
  generateStructuredText(
    targetSize: number,
    format: 'json' | 'xml' | 'csv',
    piiDensity: number,
  ): string {
    switch (format) {
      case 'json':
        return this.generateJsonDocument(targetSize, piiDensity)
      case 'xml':
        return this.generateXmlDocument(targetSize, piiDensity)
      case 'csv':
        return this.generateCsvDocument(targetSize, piiDensity)
      default:
        return this.generateText(targetSize, piiDensity)
    }
  }

  private generateJsonDocument(targetSize: number, piiDensity: number): string {
    const entries: unknown[] = []
    let currentSize = 100 // Base JSON overhead

    while (currentSize < targetSize) {
      const entry: Record<string, unknown> = {
        id: Math.random().toString(36).substr(2, 9),
        timestamp: Date.now(),
        data: {},
      }

      // Add PII fields based on density
      if (Math.random() < piiDensity / 100) {
        entry.email = this.emailPatterns[Math.floor(Math.random() * this.emailPatterns.length)]
      }
      if (Math.random() < piiDensity / 100) {
        entry.phone = this.phonePatterns[Math.floor(Math.random() * this.phonePatterns.length)]
      }
      if (Math.random() < piiDensity / 100) {
        entry.name = this.namePatterns[Math.floor(Math.random() * this.namePatterns.length)]
      }

      // Add some normal data
      entry.description = this.generateText(50, 0)
      entry.category = this.normalWords[Math.floor(Math.random() * this.normalWords.length)]

      const entryJson = JSON.stringify(entry)
      currentSize += entryJson.length + 1 // +1 for comma

      if (currentSize <= targetSize) {
        entries.push(entry)
      } else {
        break
      }
    }

    return JSON.stringify(entries, null, 2).substring(0, targetSize)
  }

  private generateXmlDocument(targetSize: number, piiDensity: number): string {
    let xml = '<?xml version="1.0" encoding="UTF-8"?>\\n<documents>\\n'
    let currentSize = xml.length

    let docIndex = 1
    while (currentSize < targetSize) {
      let doc = `  <document id="${docIndex}">\\n`

      // Add PII fields based on density
      if (Math.random() < piiDensity / 100) {
        const email = this.emailPatterns[Math.floor(Math.random() * this.emailPatterns.length)]
        doc += `    <email>${email}</email>\\n`
      }
      if (Math.random() < piiDensity / 100) {
        const phone = this.phonePatterns[Math.floor(Math.random() * this.phonePatterns.length)]
        doc += `    <phone>${phone}</phone>\\n`
      }
      if (Math.random() < piiDensity / 100) {
        const name = this.namePatterns[Math.floor(Math.random() * this.namePatterns.length)]
        doc += `    <name>${name}</name>\\n`
      }

      // Add normal content
      const content = this.generateText(50, 0)
      doc += `    <content>${content}</content>\\n`
      doc += `  </document>\\n`

      if (currentSize + doc.length + 12 <= targetSize) {
        // +12 for closing tag
        xml += doc
        currentSize += doc.length
        docIndex++
      } else {
        break
      }
    }

    xml += '</documents>'
    return xml.substring(0, targetSize)
  }

  private generateCsvDocument(targetSize: number, piiDensity: number): string {
    let csv = 'id,name,email,phone,description\\n'
    let currentSize = csv.length

    let rowIndex = 1
    while (currentSize < targetSize) {
      const name =
        Math.random() < piiDensity / 100
          ? this.namePatterns[Math.floor(Math.random() * this.namePatterns.length)]
          : ''
      const email =
        Math.random() < piiDensity / 100
          ? this.emailPatterns[Math.floor(Math.random() * this.emailPatterns.length)]
          : ''
      const phone =
        Math.random() < piiDensity / 100
          ? this.phonePatterns[Math.floor(Math.random() * this.phonePatterns.length)]
          : ''
      const description = this.generateText(30, 0).replace(/,/g, ';') // Escape commas

      const row = `${rowIndex},"${name}","${email}","${phone}","${description}"\\n`

      if (currentSize + row.length <= targetSize) {
        csv += row
        currentSize += row.length
        rowIndex++
      } else {
        break
      }
    }

    return csv
  }
}

/**
 * Memory monitoring utilities
 */
export class MemoryMonitor {
  private initialMemory: NodeJS.MemoryUsage = {
    rss: 0,
    heapUsed: 0,
    heapTotal: 0,
    external: 0,
    arrayBuffers: 0,
  }
  private peakMemory = 0
  private monitoring = false
  private monitorInterval?: NodeJS.Timeout

  startMonitoring(): void {
    if (typeof process === 'undefined' || !process.memoryUsage) {
      // Browser environment or limited environment
      this.initialMemory = { rss: 0, heapUsed: 0, heapTotal: 0, external: 0, arrayBuffers: 0 }
      return
    }

    this.initialMemory = process.memoryUsage()
    this.peakMemory = this.initialMemory.heapUsed
    this.monitoring = true

    // Monitor memory every 10ms during operation
    this.monitorInterval = setInterval(() => {
      if (!this.monitoring) return
      const current = process.memoryUsage()
      this.peakMemory = Math.max(this.peakMemory, current.heapUsed)
    }, 10)
  }

  stopMonitoring(): { peak_mb: number; delta_mb: number } {
    this.monitoring = false
    if (this.monitorInterval) {
      clearInterval(this.monitorInterval)
      this.monitorInterval = undefined
    }

    if (typeof process === 'undefined' || !process.memoryUsage) {
      return { peak_mb: 0, delta_mb: 0 }
    }

    const finalMemory = process.memoryUsage()
    const peakMb = this.peakMemory / 1024 / 1024
    const deltaMb = (finalMemory.heapUsed - this.initialMemory.heapUsed) / 1024 / 1024

    return { peak_mb: peakMb, delta_mb: deltaMb }
  }

  /**
   * Force garbage collection if available
   */
  static forceGC(): void {
    if (typeof global !== 'undefined' && global.gc) {
      global.gc()
    }
  }
}

/**
 * High precision timer for performance measurement
 */
export class PrecisionTimer {
  private startTime: [number, number] | number
  private endTime: [number, number] | number | null = null

  constructor() {
    // Use process.hrtime in Node.js for microsecond precision
    if (typeof process !== 'undefined' && process.hrtime) {
      this.startTime = process.hrtime()
    } else {
      // Fallback to performance.now() in browsers
      this.startTime = performance.now()
    }
  }

  stop(): number {
    if (typeof process !== 'undefined' && process.hrtime && Array.isArray(this.startTime)) {
      this.endTime = process.hrtime(this.startTime)
      return this.endTime[0] * 1000 + this.endTime[1] / 1000000 // Convert to milliseconds
    } else {
      this.endTime = performance.now()
      return this.endTime - (this.startTime as number)
    }
  }
}

/**
 * Core benchmark runner
 */
export class BenchmarkRunner {
  private textGenerator = new BenchmarkTextGenerator()

  /**
   * Run a single benchmark iteration
   */
  async runSingle<T>(
    operation: string,
    fn: () => Promise<T> | T,
    inputSize: number,
    collectMemory = true,
  ): Promise<PerformanceResult> {
    // Force GC before measurement if available
    if (collectMemory) {
      MemoryMonitor.forceGC()
      await this.sleep(50) // Allow GC to complete
    }

    const memoryMonitor = new MemoryMonitor()
    if (collectMemory) {
      memoryMonitor.startMonitoring()
    }

    const timer = new PrecisionTimer()

    let result: T
    let outputSize = 0
    try {
      result = await fn()

      // Estimate output size
      if (typeof result === 'string') {
        outputSize = result.length
      } else if (result && typeof result === 'object') {
        if ('hits' in result && Array.isArray((result as Record<string, unknown>).hits)) {
          outputSize = ((result as Record<string, unknown>).hits as unknown[]).length
        } else {
          outputSize = JSON.stringify(result).length
        }
      }
    } catch (error) {
      throw new Error(`Benchmark operation failed: ${error}`)
    }

    const durationMs = timer.stop()
    const memory = collectMemory ? memoryMonitor.stopMonitoring() : { peak_mb: 0, delta_mb: 0 }

    const throughput = inputSize > 0 ? inputSize / (durationMs / 1000) : 0

    return {
      operation,
      duration_ms: durationMs,
      memory_peak_mb: memory.peak_mb,
      memory_delta_mb: memory.delta_mb,
      throughput_ops_per_sec: throughput,
      input_size: inputSize,
      output_size: outputSize,
      timestamp: Date.now(),
    }
  }

  /**
   * Run multiple benchmark iterations and aggregate results
   */
  async runBenchmark<T>(
    operation: string,
    fn: () => Promise<T> | T,
    config: BenchmarkConfig,
  ): Promise<{ summary: BenchmarkSummary; results: PerformanceResult[] }> {
    const results: PerformanceResult[] = []
    let errorCount = 0

    // Generate test data for different sizes and densities
    const testCases: Array<{ text: string; size: number; density: number }> = []

    for (const size of config.text_sizes) {
      for (const density of config.pii_densities) {
        const text = this.textGenerator.generateText(size, density)
        testCases.push({ text, size, density })
      }
    }

    console.log(
      `Running benchmark '${operation}' with ${testCases.length} test cases, ${config.iterations} iterations each...`,
    )

    // Warmup phase
    if (config.warmup_iterations > 0) {
      console.log(`Warming up with ${config.warmup_iterations} iterations...`)
      const warmupCase = testCases[0]
      for (let i = 0; i < config.warmup_iterations; i++) {
        try {
          await this.runSingle(operation, fn, warmupCase.size, false)
        } catch (_error) {
          // Ignore warmup errors
        }
      }
    }

    // Main benchmark phase
    let totalIterations = 0
    const targetIterations = testCases.length * config.iterations

    for (const testCase of testCases) {
      for (let iteration = 0; iteration < config.iterations; iteration++) {
        try {
          const result = await this.runSingle(operation, fn, testCase.size, config.collect_memory)

          // Add metadata about test case
          result.input_size = testCase.size
          results.push(result)

          totalIterations++
          if (totalIterations % Math.max(1, Math.floor(targetIterations / 10)) === 0) {
            const progress = ((totalIterations / targetIterations) * 100).toFixed(1)
            console.log(`  Progress: ${progress}% (${totalIterations}/${targetIterations})`)
          }
        } catch (error) {
          errorCount++
          console.warn(`Iteration ${iteration + 1} failed:`, error)

          if (config.timeout_ms && Date.now() > config.timeout_ms) {
            console.log('Benchmark timeout reached')
            break
          }
        }
      }
    }

    if (results.length === 0) {
      throw new Error(`All benchmark iterations failed (${errorCount} errors)`)
    }

    const summary = this.calculateSummary(operation, results, errorCount)
    return { summary, results }
  }

  /**
   * Generate benchmark text with specific characteristics
   */
  generateBenchmarkText(size: number, piiDensity: number, format?: 'json' | 'xml' | 'csv'): string {
    if (format) {
      return this.textGenerator.generateStructuredText(size, format, piiDensity)
    }
    return this.textGenerator.generateText(size, piiDensity)
  }

  private calculateSummary(
    operation: string,
    results: PerformanceResult[],
    errorCount: number,
  ): BenchmarkSummary {
    if (results.length === 0) {
      throw new Error('No results to summarize')
    }

    const durations = results.map((r) => r.duration_ms).sort((a, b) => a - b)
    const throughputs = results.map((r) => r.throughput_ops_per_sec)
    const memoryPeaks = results.map((r) => r.memory_peak_mb)
    const memoryDeltas = results.map((r) => r.memory_delta_mb)

    // Calculate percentiles
    const p95Index = Math.floor(durations.length * 0.95)
    const p99Index = Math.floor(durations.length * 0.99)
    const medianIndex = Math.floor(durations.length * 0.5)

    // Calculate correlations (simplified Pearson correlation)
    const textSizeCorrelation = this.calculateCorrelation(
      results.map((r) => r.input_size),
      durations,
    )

    // For PII density correlation, we'd need to track that metadata
    // For now, use a placeholder
    const piiDensityCorrelation = 0

    // Memory efficiency: MB per KB of input
    const avgInputSizeKb = results.reduce((sum, r) => sum + r.input_size, 0) / results.length / 1024
    const avgMemoryMb = memoryPeaks.reduce((sum, m) => sum + m, 0) / memoryPeaks.length
    const memoryEfficiency = avgInputSizeKb > 0 ? avgMemoryMb / avgInputSizeKb : 0

    return {
      operation,
      total_runs: results.length,
      avg_duration_ms: durations.reduce((sum, d) => sum + d, 0) / durations.length,
      median_duration_ms: durations[medianIndex],
      p95_duration_ms: durations[p95Index],
      p99_duration_ms: durations[p99Index],
      min_duration_ms: Math.min(...durations),
      max_duration_ms: Math.max(...durations),
      avg_throughput_ops_per_sec: throughputs.reduce((sum, t) => sum + t, 0) / throughputs.length,
      avg_memory_peak_mb: avgMemoryMb,
      avg_memory_delta_mb: memoryDeltas.reduce((sum, d) => sum + d, 0) / memoryDeltas.length,
      memory_efficiency_mb_per_kb: memoryEfficiency,
      text_size_correlation: textSizeCorrelation,
      pii_density_correlation: piiDensityCorrelation,
      error_count: errorCount,
    }
  }

  private calculateCorrelation(x: number[], y: number[]): number {
    if (x.length !== y.length || x.length < 2) return 0

    const n = x.length
    const sumX = x.reduce((a, b) => a + b, 0)
    const sumY = y.reduce((a, b) => a + b, 0)
    const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0)
    const sumX2 = x.reduce((sum, xi) => sum + xi * xi, 0)
    const sumY2 = y.reduce((sum, yi) => sum + yi * yi, 0)

    const numerator = n * sumXY - sumX * sumY
    const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY))

    return denominator === 0 ? 0 : numerator / denominator
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }
}

/**
 * Default benchmark configurations for different scenarios
 */
export const BENCHMARK_CONFIGS = {
  // Quick smoke test
  quick: {
    iterations: 5,
    warmup_iterations: 2,
    text_sizes: [100, 1000, 10000],
    pii_densities: [5, 15],
    collect_memory: true,
    collect_gc: true,
  } as BenchmarkConfig,

  // Standard performance test
  standard: {
    iterations: 20,
    warmup_iterations: 5,
    text_sizes: [100, 500, 1000, 5000, 10000, 50000],
    pii_densities: [0, 5, 15, 30],
    collect_memory: true,
    collect_gc: true,
  } as BenchmarkConfig,

  // Comprehensive stress test
  comprehensive: {
    iterations: 50,
    warmup_iterations: 10,
    text_sizes: [100, 500, 1000, 2000, 5000, 10000, 20000, 50000, 100000],
    pii_densities: [0, 2, 5, 10, 15, 25, 40],
    collect_memory: true,
    collect_gc: true,
    timeout_ms: 600000, // 10 minutes
  } as BenchmarkConfig,

  // Memory-focused test
  memory: {
    iterations: 10,
    warmup_iterations: 3,
    text_sizes: [10000, 50000, 100000, 500000],
    pii_densities: [10, 20],
    collect_memory: true,
    collect_gc: true,
  } as BenchmarkConfig,
}
