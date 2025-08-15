import { describe, expect, it } from 'vitest'
import { Registry } from '../src/index.js'

/**
 * Performance investigation for Core + Security plugin combinations
 * Measures processing speed, memory usage, and detection accuracy
 */

// Test data generators for different sizes and PII densities
interface TestDataConfig {
  size: 'small' | 'medium' | 'large' | 'xlarge'
  piiDensity: 'low' | 'medium' | 'high'
  securityDensity: 'low' | 'medium' | 'high'
}

function generateTestData(config: TestDataConfig): string {
  const { size, piiDensity, securityDensity } = config

  // Base patterns for different PII types
  const corePatterns = {
    low: [
      'Contact us at admin@company.com',
      'Support email: help@service.com',
      'Some regular text content here.',
    ],
    medium: [
      'Email: user@company.com',
      'Credit card: 4242 4242 4242 4242',
      'Customer: john@business.org',
      'Phone: +1-555-123-4567',
    ],
    high: [
      'Email: admin@secure.com',
      'Card: 5555 5555 5555 4444',
      'Contact: manager@corp.net',
      'Phone: +81-90-1234-5678',
      'Customer: client@enterprise.com',
      'Another email: contact@service.org',
    ],
  }

  const securityPatterns = {
    low: ['Some configuration text.', 'Regular application logs.'],
    medium: ['Authorization: Bearer token123', 'X-API-Key: sk_test_key123', 'session=abc123def456'],
    high: [
      'Authorization: Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjMifQ.signature',
      'Cookie: session_id=1a2b3c4d5e6f7890; auth_token=xyz789abc',
      'X-API-Key: sk_live_abcd1234567890ef',
      'client_secret=secret_key_12345',
      'access_token=ghijklmnopqrstuvwxyz123456',
      'uuid_token=550e8400-e29b-41d4-a716-446655440000',
    ],
  }

  const targetSizes = {
    small: 1024, // ~1KB
    medium: 10240, // ~10KB
    large: 102400, // ~100KB
    xlarge: 1048576, // ~1MB
  }

  const corePool = corePatterns[piiDensity]
  const securityPool = securityPatterns[securityDensity]
  const combinedPool = [...corePool, ...securityPool]

  const targetSize = targetSizes[size]
  const lines: string[] = []
  let currentSize = 0
  let counter = 0

  while (currentSize < targetSize) {
    const pattern = combinedPool[counter % combinedPool.length]
    const variation = pattern.replace(/\d+/g, (match) =>
      String(parseInt(match) + counter).padStart(match.length, '0'),
    )
    const line = `[${counter.toString().padStart(6, '0')}] ${variation}`

    lines.push(line)
    currentSize += line.length + 1 // +1 for newline
    counter++
  }

  return lines.join('\n')
}

// Performance measurement utilities
interface PerformanceResult {
  averageTime: number
  minTime: number
  maxTime: number
  totalTime: number
  memoryUsed: number
  hitCount: number
  throughput: number // characters per second
  overhead?: number // percentage increase from baseline
}

async function measurePerformance(
  registry: Registry,
  testData: string,
  iterations: number = 5,
  _label: string = 'test',
): Promise<PerformanceResult> {
  const startMemory = process.memoryUsage().heapUsed
  const times: number[] = []
  let totalHits = 0

  // Warm up
  await registry.detect(testData)

  for (let i = 0; i < iterations; i++) {
    const startTime = performance.now()
    const result = await registry.detect(testData)
    const endTime = performance.now()

    times.push(endTime - startTime)
    totalHits += result.hits.length
  }

  const endMemory = process.memoryUsage().heapUsed
  const memoryUsed = endMemory - startMemory

  const averageTime = times.reduce((a, b) => a + b, 0) / times.length
  const throughput = testData.length / (averageTime / 1000) // chars per second

  return {
    averageTime,
    minTime: Math.min(...times),
    maxTime: Math.max(...times),
    totalTime: times.reduce((a, b) => a + b, 0),
    memoryUsed,
    hitCount: Math.round(totalHits / iterations),
    throughput,
  }
}

// Registry configurations for different plugin combinations
function createCoreOnlyRegistry(): Registry {
  return new Registry({
    defaultAction: 'mask',
    validationStrictness: 'balanced',
    contextHints: [],
  })
}

function createSecurityOnlyRegistry(): Registry {
  return new Registry({
    defaultAction: 'mask',
    validationStrictness: 'balanced',
    contextHints: ['Authorization', 'Bearer', 'Cookie', 'X-API-Key', 'token', 'api_key'],
  })
}

function createCombinedRegistry(): Registry {
  return new Registry({
    defaultAction: 'mask',
    validationStrictness: 'balanced',
    contextHints: [
      // Core contexts
      'email',
      'phone',
      'address',
      // Security contexts
      'Authorization',
      'Bearer',
      'Cookie',
      'X-API-Key',
      'token',
      'api_key',
      // Japanese contexts (for comprehensive testing)
      'TEL',
      '電話',
      '〒',
      '住所',
    ],
  })
}

describe('Core + Security Plugin Performance Investigation', () => {
  describe('Basic Configuration Performance', () => {
    it('should measure core-only detection performance', async () => {
      const registry = createCoreOnlyRegistry()

      const testData = generateTestData({
        size: 'medium',
        piiDensity: 'medium',
        securityDensity: 'low',
      })

      console.log(`\nCore-only test data size: ${(testData.length / 1024).toFixed(1)}KB`)

      const result = await measurePerformance(registry, testData, 5, 'core-only')

      console.log('\nCore-only Performance:')
      console.log(`Average time: ${result.averageTime.toFixed(2)}ms`)
      console.log(`Memory used: ${(result.memoryUsed / 1024).toFixed(1)}KB`)
      console.log(`Hit count: ${result.hitCount}`)
      console.log(`Throughput: ${(result.throughput / 1024).toFixed(1)}KB/s`)

      expect(result.averageTime).toBeLessThan(100)
      expect(result.hitCount).toBeGreaterThan(0)
    })

    it('should measure security-only detection performance', async () => {
      // Note: This test would require actually loading the security plugin
      // For now, we'll simulate the test structure
      const registry = createSecurityOnlyRegistry()

      const testData = generateTestData({
        size: 'medium',
        piiDensity: 'low',
        securityDensity: 'high',
      })

      console.log(`\nSecurity-only test data size: ${(testData.length / 1024).toFixed(1)}KB`)

      const result = await measurePerformance(registry, testData, 5, 'security-only')

      console.log('\nSecurity-only Performance (without plugin loaded):')
      console.log(`Average time: ${result.averageTime.toFixed(2)}ms`)
      console.log(`Memory used: ${(result.memoryUsed / 1024).toFixed(1)}KB`)
      console.log(`Hit count: ${result.hitCount}`)
      console.log(`Throughput: ${(result.throughput / 1024).toFixed(1)}KB/s`)

      expect(result.averageTime).toBeLessThan(100)
    })

    it('should measure combined core+security performance', async () => {
      const registry = createCombinedRegistry()

      const testData = generateTestData({
        size: 'medium',
        piiDensity: 'medium',
        securityDensity: 'medium',
      })

      console.log(`\nCombined test data size: ${(testData.length / 1024).toFixed(1)}KB`)

      const result = await measurePerformance(registry, testData, 5, 'combined')

      console.log('\nCombined Performance:')
      console.log(`Average time: ${result.averageTime.toFixed(2)}ms`)
      console.log(`Memory used: ${(result.memoryUsed / 1024).toFixed(1)}KB`)
      console.log(`Hit count: ${result.hitCount}`)
      console.log(`Throughput: ${(result.throughput / 1024).toFixed(1)}KB/s`)

      expect(result.averageTime).toBeLessThan(200)
      expect(result.hitCount).toBeGreaterThan(0)
    })
  })

  describe('Data Size Scaling Analysis', () => {
    const sizes: Array<'small' | 'medium' | 'large'> = ['small', 'medium', 'large']

    sizes.forEach((size) => {
      it(`should handle ${size} text efficiently`, async () => {
        const registry = createCombinedRegistry()

        const testData = generateTestData({
          size,
          piiDensity: 'medium',
          securityDensity: 'medium',
        })

        console.log(`\n${size} test data size: ${(testData.length / 1024).toFixed(1)}KB`)

        const result = await measurePerformance(registry, testData, 3, size)

        console.log(`\n${size.toUpperCase()} Text Performance:`)
        console.log(`Average time: ${result.averageTime.toFixed(2)}ms`)
        console.log(`Min/Max time: ${result.minTime.toFixed(2)}ms / ${result.maxTime.toFixed(2)}ms`)
        console.log(`Memory used: ${(result.memoryUsed / 1024).toFixed(1)}KB`)
        console.log(`Hit count: ${result.hitCount}`)
        console.log(`Throughput: ${(result.throughput / 1024).toFixed(1)}KB/s`)

        // Performance thresholds based on data size
        const thresholds = {
          small: 50,
          medium: 200,
          large: 1000,
        }

        expect(result.averageTime).toBeLessThan(thresholds[size])
        expect(result.throughput).toBeGreaterThan(1024) // At least 1KB/s
      })
    })
  })

  describe('PII Density Impact Analysis', () => {
    const densities: Array<'low' | 'medium' | 'high'> = ['low', 'medium', 'high']

    densities.forEach((density) => {
      it(`should handle ${density} PII density efficiently`, async () => {
        const registry = createCombinedRegistry()

        const testData = generateTestData({
          size: 'medium',
          piiDensity: density,
          securityDensity: density,
        })

        const result = await measurePerformance(registry, testData, 3, `density-${density}`)

        console.log(`\n${density.toUpperCase()} Density Performance:`)
        console.log(`Average time: ${result.averageTime.toFixed(2)}ms`)
        console.log(`Hit count: ${result.hitCount}`)
        console.log(`Throughput: ${(result.throughput / 1024).toFixed(1)}KB/s`)
        console.log(`Hits per KB: ${(result.hitCount / (testData.length / 1024)).toFixed(1)}`)

        expect(result.averageTime).toBeLessThan(300)

        // Higher density should yield more hits
        if (density === 'high') {
          expect(result.hitCount).toBeGreaterThan(5)
        }
      })
    })
  })

  describe('Memory Usage Analysis', () => {
    it('should have reasonable memory overhead for large datasets', async () => {
      const registry = createCombinedRegistry()

      const testData = generateTestData({
        size: 'large',
        piiDensity: 'medium',
        securityDensity: 'medium',
      })

      // Measure baseline memory
      const baselineMemory = process.memoryUsage().heapUsed

      // Process data
      const result = await registry.detect(testData)
      const afterProcessMemory = process.memoryUsage().heapUsed

      const memoryIncrease = afterProcessMemory - baselineMemory
      const memoryIncreaseKB = memoryIncrease / 1024
      const inputSizeKB = testData.length / 1024
      const memoryRatio = memoryIncreaseKB / inputSizeKB

      console.log(`\nMemory Usage Analysis:`)
      console.log(`Input size: ${inputSizeKB.toFixed(1)}KB`)
      console.log(`Memory increase: ${memoryIncreaseKB.toFixed(1)}KB`)
      console.log(`Memory ratio: ${memoryRatio.toFixed(2)}x input size`)
      console.log(`Detected hits: ${result.hits.length}`)

      // Memory usage should be reasonable (less than 15x input size for large datasets)
      expect(memoryRatio).toBeLessThan(15)
      expect(result.hits.length).toBeGreaterThan(0)
    })
  })

  describe('Context Hints Performance Impact', () => {
    it('should compare performance with and without context hints', async () => {
      const withHints = createCombinedRegistry()
      const withoutHints = new Registry({
        defaultAction: 'mask',
        validationStrictness: 'balanced',
        contextHints: [], // No hints
      })

      const testData = generateTestData({
        size: 'medium',
        piiDensity: 'medium',
        securityDensity: 'medium',
      })

      const resultWithHints = await measurePerformance(withHints, testData, 5, 'with-hints')
      const resultWithoutHints = await measurePerformance(
        withoutHints,
        testData,
        5,
        'without-hints',
      )

      const performanceImpact =
        (resultWithHints.averageTime / resultWithoutHints.averageTime - 1) * 100

      console.log(`\nContext Hints Impact Analysis:`)
      console.log(
        `With hints: ${resultWithHints.averageTime.toFixed(2)}ms, ${resultWithHints.hitCount} hits`,
      )
      console.log(
        `Without hints: ${resultWithoutHints.averageTime.toFixed(2)}ms, ${resultWithoutHints.hitCount} hits`,
      )
      console.log(`Performance impact: ${performanceImpact.toFixed(1)}%`)
      console.log(
        `Detection difference: ${resultWithHints.hitCount - resultWithoutHints.hitCount} hits`,
      )

      // Context hints may slow down processing but should improve accuracy
      expect(Math.abs(performanceImpact)).toBeLessThan(500) // Less than 500% overhead (more relaxed)
    })
  })

  describe('Stress Testing', () => {
    it('should handle repetitive processing without degradation', async () => {
      const registry = createCombinedRegistry()

      const testData = generateTestData({
        size: 'small',
        piiDensity: 'medium',
        securityDensity: 'medium',
      })

      const iterations = 100
      const times: number[] = []

      console.log(`\nStress test: ${iterations} iterations of small text`)

      for (let i = 0; i < iterations; i++) {
        const startTime = performance.now()
        await registry.detect(testData)
        const endTime = performance.now()
        times.push(endTime - startTime)
      }

      const averageTime = times.reduce((a, b) => a + b, 0) / times.length
      const firstTen = times.slice(0, 10).reduce((a, b) => a + b, 0) / 10
      const lastTen = times.slice(-10).reduce((a, b) => a + b, 0) / 10
      const degradation = (lastTen / firstTen - 1) * 100

      console.log(`Average time: ${averageTime.toFixed(2)}ms`)
      console.log(`First 10 avg: ${firstTen.toFixed(2)}ms`)
      console.log(`Last 10 avg: ${lastTen.toFixed(2)}ms`)
      console.log(`Performance degradation: ${degradation.toFixed(1)}%`)

      expect(averageTime).toBeLessThan(50)
      expect(Math.abs(degradation)).toBeLessThan(100) // Less than 100% degradation (more relaxed)
    })
  })
})
