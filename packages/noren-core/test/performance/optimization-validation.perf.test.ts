import { describe, expect, it } from 'vitest'
import { Registry } from '../../src/index.js'
import { normalize } from '../../src/utils.js'

/**
 * Performance validation tests for optimizations
 */
describe('Performance Optimization Validation', () => {
  describe('Normalize function optimization', () => {
    it('should use fast path for ASCII-only text', () => {
      const asciiText = 'simple text with basic punctuation!'

      const startTime = performance.now()
      for (let i = 0; i < 10000; i++) {
        normalize(asciiText)
      }
      const duration = performance.now() - startTime

      expect(duration).toBeLessThan(10) // Should be very fast (< 10ms for 10k iterations)
    })

    it('should handle Unicode normalization efficiently', () => {
      const unicodeText = 'テスト文字列　全角スペース—ダッシュ'

      const startTime = performance.now()
      for (let i = 0; i < 1000; i++) {
        normalize(unicodeText)
      }
      const duration = performance.now() - startTime

      expect(duration).toBeLessThan(20) // Should be reasonably fast
    })
  })

  describe('Detection performance benchmarks', () => {
    const reg = new Registry({ defaultAction: 'mask' })

    it('should maintain sub-millisecond detection for simple cases', async () => {
      const simpleText = 'Email: user@example.com Phone: +1-555-123-4567'

      // Warmup
      await reg.detect(simpleText)

      const startTime = performance.now()
      await reg.detect(simpleText)
      const duration = performance.now() - startTime

      expect(duration).toBeLessThan(1) // Should be < 1ms per detection
    })

    it('should handle multiple PII types efficiently', async () => {
      const complexText = `
        Email: user@example.com
        Phone: +1-555-123-4567  
        Card: 4242 4242 4242 4242
        IP: 192.168.1.1
        IPv6: 2001:db8::1
        MAC: 00:11:22:33:44:55
      `

      // Warmup
      await reg.detect(complexText)

      const iterations = 100
      const startTime = performance.now()

      for (let i = 0; i < iterations; i++) {
        await reg.detect(complexText)
      }

      const duration = performance.now() - startTime
      const avgPerDetection = duration / iterations

      expect(avgPerDetection).toBeLessThan(0.2) // Should be < 0.2ms per detection on average
    })

    it('should scale linearly with input size', async () => {
      const baseText = 'Email: user@example.com Phone: +1-555-123-4567'

      // Test different sizes
      const sizes = [1, 5, 10, 20]
      const times: number[] = []

      for (const size of sizes) {
        const scaledText = Array(size).fill(baseText).join('\\n')

        // Warmup
        await reg.detect(scaledText)

        const startTime = performance.now()
        await reg.detect(scaledText)
        const duration = performance.now() - startTime

        times.push(duration)
      }

      // Check that scaling is roughly linear (not exponential)
      const ratio20to1 = times[3] / times[0] // 20x input vs 1x input
      expect(ratio20to1).toBeLessThan(30) // Should not be more than 30x slower (allows some overhead)
      expect(ratio20to1).toBeGreaterThan(15) // But should be at least 15x (some scaling expected)
    })
  })

  describe('Memory usage validation', () => {
    it('should not leak memory during repeated operations', async () => {
      const reg = new Registry({ defaultAction: 'mask' })
      const testText = 'Email: test@example.com Phone: +1-555-123-4567'

      // Force GC if available (Node.js)
      if (global.gc) {
        global.gc()
      }

      const initialMemory = process.memoryUsage()

      // Perform many operations
      for (let i = 0; i < 1000; i++) {
        await reg.detect(testText)
      }

      // Force GC again
      if (global.gc) {
        global.gc()
      }

      const finalMemory = process.memoryUsage()
      const heapIncrease = finalMemory.heapUsed - initialMemory.heapUsed

      // Memory increase should be minimal (< 1MB)
      expect(heapIncrease).toBeLessThan(1024 * 1024)
    })
  })

  describe('Optimization regression tests', () => {
    it('should maintain optimization benefits over time', async () => {
      const reg = new Registry({ defaultAction: 'mask' })

      // Performance baseline expectations based on current optimizations
      const performanceTargets = {
        simpleDetectionMs: 0.1, // < 0.1ms for simple case
        normalizeAsciiMs: 0.001, // < 0.001ms for ASCII normalize
        complexDetectionMs: 0.5, // < 0.5ms for complex case
      }

      // Simple detection test
      const simpleText = 'user@example.com'
      const simpleStart = performance.now()
      await reg.detect(simpleText)
      const simpleTime = performance.now() - simpleStart
      expect(simpleTime).toBeLessThan(performanceTargets.simpleDetectionMs)

      // ASCII normalize test
      const asciiText = 'basic ascii text'
      const normalizeStart = performance.now()
      normalize(asciiText)
      const normalizeTime = performance.now() - normalizeStart
      expect(normalizeTime).toBeLessThan(performanceTargets.normalizeAsciiMs)

      // Complex detection test
      const complexText = 'Email: a@b.com IP: 1.2.3.4 Card: 4242424242424242'
      const complexStart = performance.now()
      await reg.detect(complexText)
      const complexTime = performance.now() - complexStart
      expect(complexTime).toBeLessThan(performanceTargets.complexDetectionMs)
    })
  })
})
