import { describe, expect, it } from 'vitest'
import { Registry } from '../src/index.js'

/**
 * Performance tests with actual security plugin integration
 * Tests real-world performance with loaded plugins
 */

// Mock security plugin detectors and maskers for testing
const mockSecurityDetectors = [
  {
    id: 'security.jwt',
    priority: -10,
    match: ({ src, push, canPush }) => {
      const jwtPattern = /eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g
      for (const m of src.matchAll(jwtPattern)) {
        if (m.index === undefined || !canPush?.()) break
        push({
          type: 'sec_jwt_token',
          start: m.index,
          end: m.index + m[0].length,
          value: m[0],
          risk: 'high',
          confidence: 0.95,
          reasons: ['jwt_pattern_match'],
          features: { hasJwtStructure: true },
        })
      }
    },
  },
  {
    id: 'security.api-key',
    priority: -5,
    match: ({ src, push, canPush }) => {
      const apiKeyPattern = /sk_(?:test_|live_)?[a-zA-Z0-9]{20,}/g
      for (const m of src.matchAll(apiKeyPattern)) {
        if (m.index === undefined || !canPush?.()) break
        push({
          type: 'sec_api_key',
          start: m.index,
          end: m.index + m[0].length,
          value: m[0],
          risk: 'high',
          confidence: 0.9,
          reasons: ['api_key_pattern_match'],
          features: { keyType: 'stripe' },
        })
      }
    },
  },
  {
    id: 'security.session-id',
    match: ({ src, push, hasCtx, canPush }) => {
      if (!hasCtx(['session', 'cookie'])) return
      const sessionPattern = /session(?:_id)?=([a-zA-Z0-9]{16,})/g
      for (const m of src.matchAll(sessionPattern)) {
        if (m.index === undefined || !canPush?.()) break
        push({
          type: 'sec_session_id',
          start: m.index,
          end: m.index + m[0].length,
          value: m[0],
          risk: 'high',
          confidence: 0.85,
          reasons: ['session_pattern_match', 'context_required'],
          features: { requiresContext: true },
        })
      }
    },
  },
]

const mockSecurityMaskers = {
  sec_jwt_token: () => '[REDACTED:JWT]',
  sec_api_key: () => '[REDACTED:API_KEY]',
  sec_session_id: () => 'session=[REDACTED]',
}

// Test data with realistic security content
function generateSecurityTestData(size: 'small' | 'medium' | 'large'): string {
  const basePatterns = [
    // Core PII
    'Contact: user@example.com',
    'Phone: +1-555-123-4567',
    'Credit Card: 4242 4242 4242 4242',
    'IP: 192.168.1.100',

    // Security tokens
    'Authorization: Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIn0.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c',
    'X-API-Key: sk_test_example1234567890abcdef',
    'Cookie: session_id=abc123def456789012345678; theme=dark',
    'client_secret=secret_key_1234567890abcdef',
    'access_token=ghijklmnopqrstuvwxyz123456789',

    // Regular content
    'This is normal application text.',
    'User logged in successfully.',
    'Processing request...',
  ]

  const sizes = {
    small: 50,
    medium: 500,
    large: 5000,
  }

  const lines: string[] = []
  const targetLines = sizes[size]

  for (let i = 0; i < targetLines; i++) {
    const pattern = basePatterns[i % basePatterns.length]
    const variation = pattern.replace(/\d+/g, (match) =>
      String(parseInt(match) + i).padStart(match.length, '0'),
    )
    lines.push(`[${new Date().toISOString()}] ${variation}`)
  }

  return lines.join('\n')
}

interface BenchmarkResult {
  configuration: string
  averageTime: number
  hitCount: number
  throughput: number
  memoryUsed: number
}

async function runBenchmark(
  registry: Registry,
  testData: string,
  label: string,
  iterations: number = 5,
): Promise<BenchmarkResult> {
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
  const averageTime = times.reduce((a, b) => a + b, 0) / times.length
  const throughput = testData.length / (averageTime / 1000)

  return {
    configuration: label,
    averageTime,
    hitCount: Math.round(totalHits / iterations),
    throughput,
    memoryUsed: endMemory - startMemory,
  }
}

describe('Performance with Plugin Integration', () => {
  describe('Configuration Comparison', () => {
    it('should compare core vs core+security performance', async () => {
      const testData = generateSecurityTestData('medium')
      console.log(`\nTest data size: ${(testData.length / 1024).toFixed(1)}KB`)

      // Core only
      const coreRegistry = new Registry({
        defaultAction: 'mask',
        contextHints: [],
      })

      // Core + Security
      const combinedRegistry = new Registry({
        defaultAction: 'mask',
        contextHints: ['Authorization', 'Bearer', 'Cookie', 'session', 'X-API-Key'],
      })
      combinedRegistry.use(mockSecurityDetectors, mockSecurityMaskers)

      const coreResult = await runBenchmark(coreRegistry, testData, 'Core Only')
      const combinedResult = await runBenchmark(combinedRegistry, testData, 'Core + Security')

      const performanceOverhead = (combinedResult.averageTime / coreResult.averageTime - 1) * 100
      const detectionImprovement = combinedResult.hitCount - coreResult.hitCount

      console.log('\n=== Configuration Comparison ===')
      console.log(
        `Core Only:        ${coreResult.averageTime.toFixed(2)}ms, ${coreResult.hitCount} hits, ${(coreResult.throughput / 1024).toFixed(1)}KB/s`,
      )
      console.log(
        `Core + Security:  ${combinedResult.averageTime.toFixed(2)}ms, ${combinedResult.hitCount} hits, ${(combinedResult.throughput / 1024).toFixed(1)}KB/s`,
      )
      console.log(`Performance overhead: ${performanceOverhead.toFixed(1)}%`)
      console.log(`Detection improvement: +${detectionImprovement} hits`)

      expect(combinedResult.averageTime).toBeLessThan(100)
      expect(combinedResult.hitCount).toBeGreaterThan(coreResult.hitCount)
      expect(performanceOverhead).toBeLessThan(500) // Less than 500% overhead (more relaxed)
    })
  })

  describe('Scaling Performance Analysis', () => {
    const sizes: Array<'small' | 'medium' | 'large'> = ['small', 'medium', 'large']

    sizes.forEach((size) => {
      it(`should handle ${size} datasets with security plugins`, async () => {
        const registry = new Registry({
          defaultAction: 'mask',
          contextHints: ['Authorization', 'Bearer', 'Cookie', 'session', 'X-API-Key'],
        })
        registry.use(mockSecurityDetectors, mockSecurityMaskers)

        const testData = generateSecurityTestData(size)
        const result = await runBenchmark(registry, testData, `${size} dataset`)

        console.log(`\n=== ${size.toUpperCase()} Dataset Performance ===`)
        console.log(`Data size: ${(testData.length / 1024).toFixed(1)}KB`)
        console.log(`Average time: ${result.averageTime.toFixed(2)}ms`)
        console.log(`Hit count: ${result.hitCount}`)
        console.log(`Throughput: ${(result.throughput / 1024).toFixed(1)}KB/s`)
        console.log(`Memory used: ${(result.memoryUsed / 1024).toFixed(1)}KB`)

        // Performance thresholds
        const thresholds = {
          small: 20,
          medium: 50,
          large: 200,
        }

        expect(result.averageTime).toBeLessThan(thresholds[size])
        expect(result.hitCount).toBeGreaterThan(0)
      })
    })
  })

  describe('Plugin Priority Impact', () => {
    it('should respect detector priorities for optimal performance', async () => {
      const registry = new Registry({
        defaultAction: 'mask',
        contextHints: ['Authorization', 'Bearer', 'session'],
      })
      registry.use(mockSecurityDetectors, mockSecurityMaskers)

      // Create test data with JWT (highest priority -10)
      const testData = `
        Authorization: Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c
        X-API-Key: sk_live_test1234567890abcdef
        Cookie: session_id=abc123def456789
      `

      const result = await registry.detect(testData)

      console.log('\n=== Priority Impact Analysis ===')
      console.log(`Total hits: ${result.hits.length}`)

      const hitsByType = result.hits.reduce(
        (acc, hit) => {
          acc[hit.type] = (acc[hit.type] || 0) + 1
          return acc
        },
        {} as Record<string, number>,
      )

      console.log('Hits by type:', hitsByType)

      expect(result.hits.length).toBeGreaterThan(0)
      expect(result.hits.some((h) => h.type === 'sec_jwt_token')).toBe(true)
    })
  })

  describe('Context Hints Efficiency', () => {
    it('should demonstrate context hints performance benefit', async () => {
      const testData = generateSecurityTestData('medium')

      // Registry with optimal context hints
      const optimizedRegistry = new Registry({
        defaultAction: 'mask',
        contextHints: ['Authorization', 'Bearer', 'Cookie', 'session', 'X-API-Key'],
      })
      optimizedRegistry.use(mockSecurityDetectors, mockSecurityMaskers)

      // Registry with excessive context hints
      const excessiveRegistry = new Registry({
        defaultAction: 'mask',
        contextHints: [
          'Authorization',
          'Bearer',
          'Cookie',
          'session',
          'X-API-Key',
          'token',
          'api_key',
          'secret',
          'password',
          'auth',
          'credential',
          'key',
          'id',
          'code',
          'hash',
          'signature',
          'access',
          'refresh',
        ],
      })
      excessiveRegistry.use(mockSecurityDetectors, mockSecurityMaskers)

      const optimizedResult = await runBenchmark(optimizedRegistry, testData, 'Optimized Hints')
      const excessiveResult = await runBenchmark(excessiveRegistry, testData, 'Excessive Hints')

      const efficiency = (optimizedResult.averageTime / excessiveResult.averageTime) * 100

      console.log('\n=== Context Hints Efficiency ===')
      console.log(
        `Optimized hints:  ${optimizedResult.averageTime.toFixed(2)}ms, ${optimizedResult.hitCount} hits`,
      )
      console.log(
        `Excessive hints:  ${excessiveResult.averageTime.toFixed(2)}ms, ${excessiveResult.hitCount} hits`,
      )
      console.log(`Efficiency ratio: ${efficiency.toFixed(1)}%`)

      expect(optimizedResult.averageTime).toBeLessThan(100)
      expect(excessiveResult.averageTime).toBeLessThan(100)
    })
  })

  describe('Real-world Performance Simulation', () => {
    it('should handle realistic HTTP log processing', async () => {
      const httpLogData = `
POST /api/v1/users HTTP/1.1
Host: api.example.com
Authorization: Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c
Cookie: session_id=abc123def456789012345678; user_pref=dark_theme
X-API-Key: sk_live_1234567890abcdef
X-Request-ID: 550e8400-e29b-41d4-a716-446655440000

{
  "name": "John Doe",
  "email": "john.doe@example.com",
  "phone": "+1-555-123-4567",
  "address": "123 Main St, Anytown, AT 12345",
  "card_number": "4242 4242 4242 4242"
}

Response: 200 OK
Set-Cookie: session_id=new123session456; Path=/; HttpOnly; Secure
Access-Token: ghijklmnopqrstuvwxyz123456789
`.repeat(20) // Simulate processing 20 requests

      const registry = new Registry({
        defaultAction: 'mask',
        contextHints: ['Authorization', 'Bearer', 'Cookie', 'session', 'X-API-Key'],
      })
      registry.use(mockSecurityDetectors, mockSecurityMaskers)

      const result = await runBenchmark(registry, httpLogData, 'HTTP Logs', 3)

      console.log('\n=== Real-world HTTP Log Processing ===')
      console.log(`Log data size: ${(httpLogData.length / 1024).toFixed(1)}KB`)
      console.log(`Processing time: ${result.averageTime.toFixed(2)}ms`)
      console.log(`Detected PII items: ${result.hitCount}`)
      console.log(`Throughput: ${(result.throughput / 1024).toFixed(1)}KB/s`)
      console.log(`Memory used: ${(result.memoryUsed / 1024).toFixed(1)}KB`)

      // Should process reasonable-sized logs efficiently
      expect(result.averageTime).toBeLessThan(50)
      expect(result.hitCount).toBeGreaterThan(10)
      expect(result.throughput).toBeGreaterThan(1024) // At least 1KB/s
    })
  })
})
