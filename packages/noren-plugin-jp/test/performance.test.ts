import { Registry } from '@himorishige/noren-core'
import { describe, expect, it } from 'vitest'
import { detectors, maskers } from '../src/index.js'

/**
 * Performance tests for improved postal code detection
 * Tests the impact of address context correlation on processing speed
 */

describe('Performance Tests', () => {
  const oldRegistry = new Registry({
    defaultAction: 'mask',
    validationStrictness: 'fast', // Minimize validation overhead
  })

  const newRegistry = new Registry({
    defaultAction: 'mask',
    validationStrictness: 'balanced', // Use the improved detection
  })

  // Load JP plugin for both registries
  oldRegistry.use(detectors, maskers, [])
  newRegistry.use(detectors, maskers, ['電話', '携帯', '郵便', '住所'])

  // Generate test data of various sizes
  function generateTestData(size: 'small' | 'medium' | 'large' | 'xlarge'): string {
    const basePatterns = [
      '住所: 〒100-0001 東京都千代田区千代田1-1-1',
      'TEL: 03-1234-5678',
      '品番: ABC-123-DEF',
      'メール: user@example.com',
      'IP: 192.168.1.1',
      '普通のテキストです。',
      '数値データ: 456-7890',
      '大阪府大阪市中央区 542-0081',
      '携帯電話: 090-1234-5678',
      'サンプルコード: XYZ-789',
    ]

    const sizes = {
      small: 50, // ~1KB
      medium: 500, // ~10KB
      large: 2000, // ~40KB
      xlarge: 10000, // ~200KB
    }

    const repeatCount = sizes[size]
    const lines: string[] = []

    for (let i = 0; i < repeatCount; i++) {
      const pattern = basePatterns[i % basePatterns.length]
      const variation = pattern.replace(/\d+/g, (match) =>
        String(parseInt(match) + i).padStart(match.length, '0'),
      )
      lines.push(`${i + 1}: ${variation}`)
    }

    return lines.join('\n')
  }

  async function measurePerformance(
    registry: Registry,
    testData: string,
    iterations: number = 1,
  ): Promise<{
    averageTime: number
    totalTime: number
    memoryUsed: number
    hitCount: number
  }> {
    const startMemory = process.memoryUsage().heapUsed
    const times: number[] = []

    let totalHits = 0

    for (let i = 0; i < iterations; i++) {
      const startTime = performance.now()
      const result = await registry.detect(testData)
      const endTime = performance.now()

      times.push(endTime - startTime)
      totalHits += result.hits.length
    }

    const endMemory = process.memoryUsage().heapUsed
    const memoryUsed = endMemory - startMemory

    return {
      averageTime: times.reduce((a, b) => a + b, 0) / times.length,
      totalTime: times.reduce((a, b) => a + b, 0),
      memoryUsed,
      hitCount: Math.round(totalHits / iterations),
    }
  }

  describe('Small Text Performance (~1KB)', () => {
    it('should process small texts efficiently', async () => {
      const testData = generateTestData('small')
      console.log(`\nSmall test data size: ${(testData.length / 1024).toFixed(1)}KB`)

      const oldResults = await measurePerformance(oldRegistry, testData, 10)
      const newResults = await measurePerformance(newRegistry, testData, 10)

      console.log('\nSmall Text Results:')
      console.log(
        `Old implementation: ${oldResults.averageTime.toFixed(2)}ms avg, ${oldResults.hitCount} hits`,
      )
      console.log(
        `New implementation: ${newResults.averageTime.toFixed(2)}ms avg, ${newResults.hitCount} hits`,
      )
      console.log(
        `Performance impact: ${((newResults.averageTime / oldResults.averageTime - 1) * 100).toFixed(1)}%`,
      )

      // Performance should be reasonable (under 50ms for small texts)
      expect(newResults.averageTime).toBeLessThan(50)
      expect(oldResults.averageTime).toBeLessThan(50)
    })
  })

  describe('Medium Text Performance (~10KB)', () => {
    it('should process medium texts efficiently', async () => {
      const testData = generateTestData('medium')
      console.log(`\nMedium test data size: ${(testData.length / 1024).toFixed(1)}KB`)

      const oldResults = await measurePerformance(oldRegistry, testData, 5)
      const newResults = await measurePerformance(newRegistry, testData, 5)

      console.log('\nMedium Text Results:')
      console.log(
        `Old implementation: ${oldResults.averageTime.toFixed(2)}ms avg, ${oldResults.hitCount} hits`,
      )
      console.log(
        `New implementation: ${newResults.averageTime.toFixed(2)}ms avg, ${newResults.hitCount} hits`,
      )
      console.log(
        `Performance impact: ${((newResults.averageTime / oldResults.averageTime - 1) * 100).toFixed(1)}%`,
      )

      // Performance should be reasonable (under 200ms for medium texts)
      expect(newResults.averageTime).toBeLessThan(200)
    })
  })

  describe('Large Text Performance (~40KB)', () => {
    it('should process large texts efficiently', async () => {
      const testData = generateTestData('large')
      console.log(`\nLarge test data size: ${(testData.length / 1024).toFixed(1)}KB`)

      const oldResults = await measurePerformance(oldRegistry, testData, 3)
      const newResults = await measurePerformance(newRegistry, testData, 3)

      console.log('\nLarge Text Results:')
      console.log(
        `Old implementation: ${oldResults.averageTime.toFixed(2)}ms avg, ${oldResults.hitCount} hits`,
      )
      console.log(
        `New implementation: ${newResults.averageTime.toFixed(2)}ms avg, ${newResults.hitCount} hits`,
      )
      console.log(
        `Performance impact: ${((newResults.averageTime / oldResults.averageTime - 1) * 100).toFixed(1)}%`,
      )

      // Performance should be reasonable (under 1000ms for large texts)
      expect(newResults.averageTime).toBeLessThan(1000)
    })
  })

  describe('XLarge Text Performance (~200KB)', () => {
    it('should process very large texts efficiently', async () => {
      const testData = generateTestData('xlarge')
      console.log(`\nXLarge test data size: ${(testData.length / 1024).toFixed(1)}KB`)

      const oldResults = await measurePerformance(oldRegistry, testData, 1)
      const newResults = await measurePerformance(newRegistry, testData, 1)

      console.log('\nXLarge Text Results:')
      console.log(
        `Old implementation: ${oldResults.averageTime.toFixed(2)}ms avg, ${oldResults.hitCount} hits`,
      )
      console.log(
        `New implementation: ${newResults.averageTime.toFixed(2)}ms avg, ${newResults.hitCount} hits`,
      )
      console.log(
        `Performance impact: ${((newResults.averageTime / oldResults.averageTime - 1) * 100).toFixed(1)}%`,
      )

      // Performance should be reasonable (under 5000ms for very large texts)
      expect(newResults.averageTime).toBeLessThan(5000)
    })
  })

  describe('Repetitive Processing', () => {
    it('should handle repetitive small processing efficiently', async () => {
      const testData = generateTestData('small')
      const iterations = 100

      console.log(`\nRepetitive processing: ${iterations} iterations of small text`)

      const oldResults = await measurePerformance(oldRegistry, testData, iterations)
      const newResults = await measurePerformance(newRegistry, testData, iterations)

      console.log('\nRepetitive Processing Results:')
      console.log(
        `Old implementation: ${oldResults.averageTime.toFixed(2)}ms avg, total: ${oldResults.totalTime.toFixed(2)}ms`,
      )
      console.log(
        `New implementation: ${newResults.averageTime.toFixed(2)}ms avg, total: ${newResults.totalTime.toFixed(2)}ms`,
      )
      console.log(
        `Performance impact: ${((newResults.averageTime / oldResults.averageTime - 1) * 100).toFixed(1)}%`,
      )

      // Total time for 100 iterations should be reasonable
      expect(newResults.totalTime).toBeLessThan(5000) // 5 seconds total
      expect(newResults.averageTime).toBeLessThan(50) // 50ms per iteration
    })
  })

  describe('Memory Usage', () => {
    it('should have reasonable memory overhead', async () => {
      const testData = generateTestData('medium')

      // Measure baseline memory
      const baselineMemory = process.memoryUsage().heapUsed

      // Process with new implementation
      const result = await newRegistry.detect(testData)
      const afterProcessMemory = process.memoryUsage().heapUsed

      const memoryIncrease = afterProcessMemory - baselineMemory
      const memoryIncreaseKB = memoryIncrease / 1024

      console.log(`\nMemory Usage:`)
      console.log(`Memory increase: ${memoryIncreaseKB.toFixed(1)}KB`)
      console.log(`Detected hits: ${result.hits.length}`)

      // Memory increase should be reasonable relative to input size
      const inputSizeKB = testData.length / 1024
      const memoryRatio = memoryIncreaseKB / inputSizeKB

      console.log(`Memory ratio: ${memoryRatio.toFixed(2)}x input size`)

      // Memory usage should not be excessive (less than 200x input size)
      // Note: Memory measurement can be affected by GC timing and test environment
      expect(memoryRatio).toBeLessThan(200)
    })
  })

  describe('Detection Accuracy vs Performance', () => {
    it('should maintain detection accuracy without severe performance penalty', async () => {
      const realWorldText = `
        株式会社テスト
        住所: 〒100-0001 東京都千代田区千代田1-1-1 テストビル5F
        TEL: 03-1234-5678
        FAX: 03-1234-5679
        Email: info@test.co.jp
        
        大阪支社
        〒542-0081 大阪府大阪市中央区南船場2-3-4
        電話: 06-9876-5432
        
        商品情報
        品番: ABC-123-DEF
        型番: XYZ-789-GHI
        価格: ¥10,000
        
        テスト用データ
        サンプル番号: 111-2222
        デモコード: 333-4444
      `

      const oldResults = await measurePerformance(oldRegistry, realWorldText, 10)
      const newResults = await measurePerformance(newRegistry, realWorldText, 10)

      console.log('\nReal-world Text Analysis:')
      console.log(`Text length: ${realWorldText.length} characters`)
      console.log(
        `Old implementation: ${oldResults.averageTime.toFixed(2)}ms, ${oldResults.hitCount} hits`,
      )
      console.log(
        `New implementation: ${newResults.averageTime.toFixed(2)}ms, ${newResults.hitCount} hits`,
      )

      const performanceOverhead = (newResults.averageTime / oldResults.averageTime - 1) * 100
      const accuracyImprovement = newResults.hitCount - oldResults.hitCount

      console.log(`Performance overhead: ${performanceOverhead.toFixed(1)}%`)
      console.log(
        `Detection difference: ${accuracyImprovement > 0 ? '+' : ''}${accuracyImprovement} hits`,
      )

      // Performance overhead should be reasonable (less than 300% increase)
      expect(performanceOverhead).toBeLessThan(300)

      // Processing time should still be fast for real-world sized text
      expect(newResults.averageTime).toBeLessThan(100)
    })
  })
})
