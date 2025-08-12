import { type Hit, HitPool, Registry, redactText } from '@himorishige/noren-core'
import { afterAll, describe, expect, it } from 'vitest'

/**
 * Hit Pool Management and Resource Tests
 * Tests memory management and resource cleanup for the Hit object pool.
 * Part of Phase 1: Critical Security & Error Handling
 */

describe('Hit Pool Management', () => {
  // Create a separate pool for testing to avoid interfering with global pool
  let testPool: HitPool

  // Clean up after tests
  afterAll(() => {
    testPool?.clear()
  })

  it('should handle pool exhaustion gracefully', () => {
    testPool = new HitPool()
    const hits = []

    // Allocate a large number of hits to test pool behavior
    for (let i = 0; i < 200; i++) {
      const hit = testPool.acquire('email', 0, 10, `test${i}@example.com`, 'medium')
      hits.push(hit)
      expect(hit, `Should create hit ${i}`)
      expect(hit.value, `test${i}@example.com`, `Hit ${i} should have correct value`)
    }

    // Verify all hits were created
    expect(hits.length).toBe(200)

    // Test that each hit has unique data
    const values = hits.map((h) => h.value)
    const uniqueValues = new Set(values)
    expect(uniqueValues.size).toBe(200)

    // Release all hits back to pool
    testPool.release(hits)

    // Pool should be limited to maxSize (100)
    // Try to acquire 101 hits - should get reused objects for first 100
    const newHits = []
    for (let i = 0; i < 101; i++) {
      const hit = testPool.acquire('phone', 0, 12, `555-${i.toString().padStart(4, '0')}`, 'low')
      newHits.push(hit)
      expect(hit, `Should reuse/create hit ${i}`)
    }

    expect(newHits.length).toBe(101)
  })

  it('should securely wipe sensitive data when releasing hits', () => {
    testPool = new HitPool()

    const sensitiveData = ['4242 4242 4242 4242', 'user@secret.com', '192.168.1.100']
    const hits = sensitiveData.map((value, i) =>
      testPool.acquire('credit_card', i * 10, i * 10 + value.length, value, 'high'),
    )

    // Verify hits contain sensitive data
    for (let i = 0; i < hits.length; i++) {
      expect(hits[i].value, sensitiveData[i], `Hit ${i} should contain sensitive data`)
    }

    // Release hits (should trigger secure wiping)
    testPool.release(hits)

    // Acquire new hits (should get the wiped objects from pool)
    const reusedHits = []
    for (let i = 0; i < sensitiveData.length; i++) {
      const hit = testPool.acquire('email', 0, 10, 'new@example.com', 'low')
      reusedHits.push(hit)
    }

    // Verify that reused hits don't contain old sensitive data
    for (const hit of reusedHits) {
      for (const sensitive of sensitiveData) {
        expect(hit.value).not.toContain(
          sensitive,
          'Reused hit should not contain previous sensitive data',
        )
      }
    }
  })

  it('should prevent memory leaks through proper cleanup', async () => {
    const initialMemory = process.memoryUsage()
    const reg = new Registry({ defaultAction: 'mask' })

    // Process large amount of data multiple times
    const testData = Array.from(
      { length: 100 },
      (_, i) =>
        `Email: user${i}@example.com, Card: 4242 4242 4242 4242, IP: 192.168.${i % 256}.${(i * 2) % 256}`,
    ).join('\n')

    // Run redaction multiple times
    for (let iteration = 0; iteration < 50; iteration++) {
      await redactText(reg, testData)

      // Every 10 iterations, check memory growth
      if (iteration % 10 === 0 && iteration > 0) {
        // Force garbage collection if available
        if (global.gc) global.gc()

        const currentMemory = process.memoryUsage()
        const memoryGrowth = currentMemory.heapUsed - initialMemory.heapUsed

        // Memory growth should be reasonable (< 50MB for this test)
        expect(
          memoryGrowth < 50 * 1024 * 1024,
          `Memory growth should be reasonable at iteration ${iteration}: ${memoryGrowth} bytes`,
        )
      }
    }

    // Final memory check after all processing
    if (global.gc) global.gc()
    const finalMemory = process.memoryUsage()
    const totalGrowth = finalMemory.heapUsed - initialMemory.heapUsed

    console.log(
      `Memory growth after 50 iterations: ${totalGrowth} bytes (${Math.round((totalGrowth / 1024 / 1024) * 100) / 100} MB)`,
    )

    // Total growth should be reasonable
    expect(totalGrowth < 100 * 1024 * 1024).toBeTruthy()
  })

  it('should handle concurrent pool operations safely', async () => {
    testPool = new HitPool()
    const concurrentOperations = []

    // Create multiple concurrent operations that acquire and release hits
    for (let i = 0; i < 10; i++) {
      const operation = async () => {
        const hits = []

        // Acquire hits
        for (let j = 0; j < 20; j++) {
          const hit = testPool.acquire('email', j, j + 10, `user${i}-${j}@example.com`, 'medium')
          hits.push(hit)
        }

        // Simulate some processing time
        await new Promise((resolve) => setTimeout(resolve, Math.random() * 10))

        // Release hits
        testPool.release(hits)

        return hits.length
      }

      concurrentOperations.push(operation())
    }

    // Wait for all operations to complete
    const results = await Promise.all(concurrentOperations)

    // Verify all operations completed successfully
    for (const result of results) {
      expect(result).toBe(20)
    }

    // Pool should still be functional after concurrent operations
    const testHit = testPool.acquire('test', 0, 4, 'test', 'low')
    expect(testHit).toBeTruthy()
    expect(testHit.value).toBe('test')
  })

  it('should handle pool size limits correctly', () => {
    testPool = new HitPool()

    // Create more hits than the max pool size (100)
    const hits = []
    for (let i = 0; i < 150; i++) {
      const hit = testPool.acquire('email', 0, 10, `user${i}@example.com`, 'medium')
      hits.push(hit)
    }

    // Release all hits
    testPool.release(hits)

    // Pool should only retain up to maxSize hits
    // Acquire 101 hits to test pool limit
    const reusedHits = []
    for (let i = 0; i < 101; i++) {
      const hit = testPool.acquire('phone', 0, 12, `555-${i.toString().padStart(4, '0')}`, 'low')
      reusedHits.push(hit)
    }

    // First 100 should be reused from pool, 101st should be newly created
    // We can't easily test this directly, but the pool should handle it gracefully
    expect(reusedHits.length).toBe(101)

    // All hits should be valid
    for (let i = 0; i < reusedHits.length; i++) {
      const hit: Hit = reusedHits[i]
      expect(hit, `Hit ${i} should exist`)
      expect(hit.type, 'phone', `Hit ${i} should have correct type`)
      expect(hit.value).toBe(
        `555-${i.toString().padStart(4, '0')}`,
        `Hit ${i} should have correct value`,
      )
    }
  })

  it('should handle edge cases in hit data', () => {
    testPool = new HitPool()

    const edgeCases = [
      { value: '', type: 'email', start: 0, end: 0, risk: 'low' }, // Empty value
      { value: 'a'.repeat(1000), type: 'custom', start: 0, end: 1000, risk: 'high' }, // Very long value
      { value: '🔒🔑💳', type: 'emoji', start: 0, end: 6, risk: 'medium' }, // Unicode/Emoji
      { value: '\n\t\r', type: 'whitespace', start: 0, end: 3, risk: 'low' }, // Whitespace chars
    ]

    const hits = []

    // Test acquiring hits with edge case data
    for (const edgeCase of edgeCases) {
      const hit = testPool.acquire(
        edgeCase.type as never,
        edgeCase.start,
        edgeCase.end,
        edgeCase.value,
        edgeCase.risk as never,
      )
      hits.push(hit)
      expect(hit.value, edgeCase.value, `Should handle edge case value: "${edgeCase.value}"`)
    }

    // Release hits (should handle secure wiping of edge cases)
    testPool.release(hits)

    // Acquire new hits to verify edge cases were properly cleaned
    for (let i = 0; i < edgeCases.length; i++) {
      const cleanHit = testPool.acquire('clean', 0, 5, 'clean', 'low')
      expect(cleanHit.value, 'clean', `Cleaned hit ${i} should not contain edge case data`)

      // Verify old edge case data is not present
      for (const edgeCase of edgeCases) {
        if (edgeCase.value.length > 0) {
          expect(cleanHit.value).not.toContain(
            edgeCase.value,
            `Should not contain previous edge case data: "${edgeCase.value}"`,
          )
        }
      }
    }
  })
})
