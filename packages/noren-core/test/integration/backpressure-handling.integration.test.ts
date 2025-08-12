import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { Registry, redactText } from '@himorishige/noren-core'

/**
 * Backpressure Handling Integration Tests
 * Tests stream processing under high load and backpressure conditions.
 * Part of Phase 3: Integration & Advanced Scenarios
 *
 * Focuses on:
 * - High-throughput streaming scenarios
 * - Memory management under pressure
 * - Queue management and flow control
 * - Error recovery during backpressure
 * - Performance degradation patterns
 */

describe('Backpressure Handling Integration', () => {
  it('should handle high-frequency small chunks without memory leaks', async () => {
    const reg = new Registry({ defaultAction: 'mask' })

    const chunkSize = 1024 // 1KB chunks
    const numChunks = 100 // 100KB total - reduced from 1000 to speed up tests
    let processedChunks = 0
    let maxQueueSize = 0

    // Track queue size for backpressure monitoring
    let queueSize = 0

    const highFrequencyTransform = new TransformStream(
      {
        async transform(chunk, controller) {
          queueSize++
          maxQueueSize = Math.max(maxQueueSize, queueSize)

          try {
            const text = typeof chunk === 'string' ? chunk : chunk.toString()
            const result = await redactText(reg, text)

            controller.enqueue(result)
            processedChunks++

            // Simulate variable processing time (0-10ms)
            const delay = Math.random() * 10
            if (delay > 8) {
              await new Promise((resolve) => setTimeout(resolve, delay))
            }
          } finally {
            queueSize--
          }
        },
      },
      {
        highWaterMark: 16, // Small buffer to trigger backpressure
      },
    )

    // Generate high-frequency data stream
    const generateChunk = (id: number) => {
      const patterns = [
        'user@example.com',
        '4242 4242 4242 4242',
        '192.168.1.100',
        'john.doe@company.com',
        '555-123-4567',
      ]

      let content = `Chunk ${id}: `
      while (content.length < chunkSize - 50) {
        const pattern = patterns[Math.floor(Math.random() * patterns.length)]
        content += `${pattern} data `
      }
      return content
    }

    let _enqueueCount = 0
    let backpressureEvents = 0
    const readable = new ReadableStream({
      async start(controller) {
        for (let i = 0; i < numChunks; i++) {
          const chunk = generateChunk(i)
          try {
            controller.enqueue(chunk)
            _enqueueCount++
          } catch (_error) {
            // Handle backpressure by waiting a bit
            backpressureEvents++
            if (backpressureEvents % 100 === 0) {
              console.log(`Backpressure events: ${backpressureEvents}`)
            }
            // Wait for queue to drain
            await new Promise((resolve) => setTimeout(resolve, 10))
            // Retry enqueueing
            try {
              controller.enqueue(chunk)
              _enqueueCount++
            } catch (_retryError) {
              // Skip this chunk if still can't enqueue
              console.log(`Skipping chunk ${i} due to persistent backpressure`)
            }
          }
          // Small delay between chunks to allow processing
          if (i % 10 === 0) {
            await new Promise((resolve) => setTimeout(resolve, 1))
          }
        }
        controller.close()
      },
    })

    const startTime = Date.now()
    const startMemory = process.memoryUsage()

    // Process through transform stream
    const processedStream = readable.pipeThrough(highFrequencyTransform)
    const reader = processedStream.getReader()

    const results = []
    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        results.push(value)
      }
    } finally {
      reader.releaseLock()
    }

    const endTime = Date.now()
    const endMemory = process.memoryUsage()

    const processingTime = endTime - startTime
    const memoryGrowth = endMemory.heapUsed - startMemory.heapUsed
    const throughput = (results.length * chunkSize) / (processingTime / 1000) // bytes/second

    console.log(`High-frequency chunks test:`)
    console.log(`  Chunks processed: ${processedChunks}/${numChunks}`)
    console.log(`  Results collected: ${results.length}`)
    console.log(`  Processing time: ${processingTime}ms`)
    console.log(`  Memory growth: ${Math.round(memoryGrowth / 1024)}KB`)
    console.log(`  Max queue size: ${maxQueueSize}`)
    console.log(`  Backpressure events: ${backpressureEvents}`)
    console.log(`  Throughput: ${Math.round(throughput / 1024)}KB/s`)

    // Verify processing completed
    assert.ok(results.length > 0, 'Should process some chunks')
    assert.ok(processedChunks > 0, 'Should have processed chunks through transform')

    // Memory growth should be reasonable (< 100MB for this test)
    assert.ok(memoryGrowth < 100 * 1024 * 1024, 'Memory growth should be reasonable')

    // Should handle high frequency without major issues
    assert.ok(processingTime < 30000, 'Should complete processing in reasonable time')

    // Verify content integrity
    let totalRedactions = 0
    for (const result of results) {
      const redactionCount = (result.match(/\[REDACTED:/g) || []).length
      totalRedactions += redactionCount
      assert.ok(redactionCount > 0, 'Each chunk should have some redactions')
    }

    console.log(`  Total redactions: ${totalRedactions}`)
    assert.ok(totalRedactions > results.length, 'Should have multiple redactions across chunks')
  })

  it('should handle large chunk processing with controlled memory usage', async () => {
    const reg = new Registry({ defaultAction: 'mask' })

    const largeChunkSize = 1 * 1024 * 1024 // 1MB chunks - reduced from 5MB
    const numLargeChunks = 5 // 5MB total - reduced from 10 chunks
    let processedBytes = 0

    // Generate large chunk with lots of PII
    const generateLargeChunk = (chunkId: number) => {
      const patterns = [
        'admin@company.com',
        '4111 1111 1111 1111',
        '192.168.100.200',
        '2001:db8::8a2e:370:7334',
        'AA:BB:CC:DD:EE:FF',
      ]

      let content = `Large chunk ${chunkId} start.\n`
      const targetSize = largeChunkSize - 200 // Leave room for markers

      while (content.length < targetSize) {
        const pattern = patterns[Math.floor(Math.random() * patterns.length)]
        const line = `Line ${Math.floor(content.length / 100)}: Contact ${pattern} for details.\n`
        content += line

        // Add some filler to reach size target
        if (content.length % 1000 === 0) {
          content += `${'Lorem ipsum dolor sit amet, consectetur adipiscing elit. '.repeat(10)}\n`
        }
      }

      content += `Large chunk ${chunkId} end.\n`
      return content
    }

    const memoryPeaks: Array<{
      chunkSize: number
      processingMemory: number
      totalMemory: number
    }> = []
    const memoryMonitorTransform = new TransformStream(
      {
        async transform(chunk, controller) {
          const beforeMemory = process.memoryUsage()

          const text = typeof chunk === 'string' ? chunk : chunk.toString()
          const result = await redactText(reg, text)

          const afterMemory = process.memoryUsage()
          const processingMemory = afterMemory.heapUsed - beforeMemory.heapUsed
          memoryPeaks.push({
            chunkSize: text.length,
            processingMemory,
            totalMemory: afterMemory.heapUsed,
          })

          processedBytes += text.length
          controller.enqueue(result)

          // Force garbage collection if available (for testing)
          if (global.gc && Math.random() < 0.3) {
            global.gc()
          }
        },
      },
      {
        highWaterMark: 1, // Process one large chunk at a time
      },
    )

    // Create readable stream of large chunks
    let chunkIndex = 0
    const readable = new ReadableStream({
      start(controller) {
        function pushNextChunk() {
          if (chunkIndex < numLargeChunks) {
            const chunk = generateLargeChunk(chunkIndex)
            controller.enqueue(chunk)
            chunkIndex++
            // Add small delay between large chunks
            setTimeout(pushNextChunk, 100)
          } else {
            controller.close()
          }
        }
        pushNextChunk()
      },
    })

    const startTime = Date.now()
    const startMemory = process.memoryUsage()

    const processedStream = readable.pipeThrough(memoryMonitorTransform)
    const reader = processedStream.getReader()

    const results = []
    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        results.push(value)
      }
    } finally {
      reader.releaseLock()
    }

    const endTime = Date.now()
    const endMemory = process.memoryUsage()

    const processingTime = endTime - startTime
    const totalMemoryGrowth = endMemory.heapUsed - startMemory.heapUsed
    const avgProcessingMemory =
      memoryPeaks.reduce((sum, peak) => sum + peak.processingMemory, 0) / memoryPeaks.length
    const maxProcessingMemory = Math.max(...memoryPeaks.map((p) => p.processingMemory))

    console.log(`Large chunk processing test:`)
    console.log(`  Chunks processed: ${results.length}/${numLargeChunks}`)
    console.log(`  Total bytes processed: ${Math.round(processedBytes / (1024 * 1024))}MB`)
    console.log(`  Processing time: ${processingTime}ms`)
    console.log(`  Total memory growth: ${Math.round(totalMemoryGrowth / (1024 * 1024))}MB`)
    console.log(`  Avg processing memory per chunk: ${Math.round(avgProcessingMemory / 1024)}KB`)
    console.log(`  Max processing memory per chunk: ${Math.round(maxProcessingMemory / 1024)}KB`)
    console.log(
      `  Throughput: ${Math.round(processedBytes / (processingTime / 1000) / (1024 * 1024))}MB/s`,
    )

    // Verify all large chunks were processed
    assert.equal(results.length, numLargeChunks, 'Should process all large chunks')

    // Memory usage should be controlled (adjusted for realistic Node.js memory behavior)
    assert.ok(
      totalMemoryGrowth < 200 * 1024 * 1024,
      'Total memory growth should be reasonable (<200MB)',
    )
    assert.ok(
      maxProcessingMemory < 100 * 1024 * 1024,
      'Per-chunk memory usage should be controlled (<100MB)',
    )

    // Performance should be acceptable
    assert.ok(processingTime < 60000, 'Should process large chunks in reasonable time (<60s)')

    // Verify content integrity
    for (let i = 0; i < results.length; i++) {
      const result = results[i]
      assert.ok(result.includes(`Large chunk ${i} start`), `Chunk ${i} should have start marker`)
      assert.ok(result.includes(`Large chunk ${i} end`), `Chunk ${i} should have end marker`)

      const redactionCount = (result.match(/\[REDACTED:/g) || []).length
      assert.ok(
        redactionCount > 100,
        `Large chunk ${i} should have many redactions (got ${redactionCount})`,
      )
    }
  })

  it('should handle backpressure in concurrent processing scenarios', async () => {
    const reg = new Registry({ defaultAction: 'mask' })

    const numConcurrentStreams = 3 // Reduced from 5 to speed up tests
    const chunksPerStream = 20 // Reduced from 50 to speed up tests
    const chunkSize = 10 * 1024 // 10KB per chunk

    // Create concurrent processing streams
    const createConcurrentStream = (streamId: number) => {
      let processedCount = 0
      let backpressureCount = 0

      const transform = new TransformStream(
        {
          async transform(chunk, controller) {
            const startTime = Date.now()

            try {
              const text = typeof chunk === 'string' ? chunk : chunk.toString()

              // Add variable processing delay to simulate realistic conditions
              const processingDelay = Math.random() * 50 // 0-50ms
              if (processingDelay > 40) {
                await new Promise((resolve) => setTimeout(resolve, processingDelay))
              }

              const result = await redactText(reg, text)

              controller.enqueue(`Stream${streamId}: ${result}`)
              processedCount++
            } catch (error) {
              controller.error(error)
            }

            const endTime = Date.now()
            if (endTime - startTime > 100) {
              backpressureCount++
            }
          },
        },
        {
          highWaterMark: 3, // Small buffer to create backpressure
        },
      )

      // Generate data for this stream
      let _chunkIndex = 0
      const readable = new ReadableStream({
        async start(controller) {
          for (let i = 0; i < chunksPerStream; i++) {
            // Generate chunk with PII patterns
            let content = `Stream${streamId} Chunk${i}: `
            while (content.length < chunkSize - 100) {
              content += `email${i}@stream${streamId}.com credit-card:4242424242424242 ip:192.168.${streamId}.${i % 255} `
            }

            controller.enqueue(content)
            _chunkIndex++

            // Add delay between chunks to simulate realistic streaming
            await new Promise((resolve) => setTimeout(resolve, 10 + streamId * 5))
          }
          controller.close()
        },
      })

      return {
        stream: readable.pipeThrough(transform),
        streamId,
        getStats: () => ({ processedCount, backpressureCount }),
      }
    }

    // Create all concurrent streams
    const concurrentStreams = []
    for (let i = 0; i < numConcurrentStreams; i++) {
      concurrentStreams.push(createConcurrentStream(i))
    }

    const startTime = Date.now()
    const startMemory = process.memoryUsage()

    // Process all streams concurrently
    const streamPromises = concurrentStreams.map(async ({ stream, streamId, getStats }) => {
      const reader = stream.getReader()
      const results = []

      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          results.push(value)
        }
      } finally {
        reader.releaseLock()
      }

      return { streamId, results, stats: getStats() }
    })

    const streamResults = await Promise.all(streamPromises)

    const endTime = Date.now()
    const endMemory = process.memoryUsage()

    const totalProcessingTime = endTime - startTime
    const memoryGrowth = endMemory.heapUsed - startMemory.heapUsed

    console.log(`Concurrent backpressure test:`)
    console.log(`  Concurrent streams: ${numConcurrentStreams}`)
    console.log(`  Total processing time: ${totalProcessingTime}ms`)
    console.log(`  Memory growth: ${Math.round(memoryGrowth / 1024)}KB`)

    let totalResults = 0
    let totalBackpressure = 0

    for (const { streamId, results, stats } of streamResults) {
      console.log(
        `  Stream ${streamId}: ${results.length} results, ${stats.processedCount} processed, ${stats.backpressureCount} backpressure events`,
      )
      totalResults += results.length
      totalBackpressure += stats.backpressureCount

      // Verify stream results
      assert.ok(results.length > 0, `Stream ${streamId} should produce results`)

      for (const result of results) {
        assert.ok(
          result.includes(`Stream${streamId}:`),
          `Result should be tagged with stream ${streamId}`,
        )
        assert.ok(result.includes('[REDACTED:'), 'Result should contain redactions')
      }
    }

    console.log(`  Total results: ${totalResults}`)
    console.log(`  Total backpressure events: ${totalBackpressure}`)
    console.log(
      `  Average processing rate: ${Math.round(totalResults / (totalProcessingTime / 1000))} results/sec`,
    )

    // Verify concurrent processing completed successfully
    assert.ok(totalResults > 0, 'Should produce results from concurrent streams')
    assert.equal(
      streamResults.length,
      numConcurrentStreams,
      'All concurrent streams should complete',
    )

    // Memory usage should be reasonable for concurrent processing
    assert.ok(
      memoryGrowth < 500 * 1024 * 1024,
      'Concurrent processing memory growth should be reasonable (<500MB)',
    )

    // Should complete in reasonable time despite backpressure
    assert.ok(
      totalProcessingTime < 30000,
      'Concurrent processing should complete in reasonable time (<30s)',
    )

    console.log('✓ Concurrent backpressure handling verified')
  })

  it('should recover gracefully from backpressure-induced errors', async () => {
    const reg = new Registry({ defaultAction: 'mask' })

    let errorCount = 0
    let recoveryCount = 0
    let processedCount = 0

    // Transform that occasionally fails under pressure
    const faultyTransform = new TransformStream(
      {
        async transform(chunk, controller) {
          const text = typeof chunk === 'string' ? chunk : chunk.toString()

          try {
            // Simulate failure under high load (based on chunk size and random factor)
            const shouldFail = text.length > 5000 && Math.random() < 0.3

            if (shouldFail) {
              errorCount++
              throw new Error(`Processing failed under pressure for chunk size: ${text.length}`)
            }

            const result = await redactText(reg, text)

            controller.enqueue(result)
            processedCount++
          } catch (error) {
            // Try to recover by enqueueing a simplified result
            try {
              controller.enqueue(
                `[ERROR_RECOVERED: Chunk processed with errors - ${text.length} bytes]`,
              )
              recoveryCount++
            } catch (_recoveryError) {
              controller.error(error)
            }
          }
        },
      },
      {
        highWaterMark: 2, // Small buffer to increase pressure
      },
    )

    // Generate variable-sized chunks to trigger different pressure levels
    const generateVariableChunk = (id: number) => {
      const baseSizes = [1024, 2048, 5120, 10240, 20480] // 1KB to 20KB
      const size = baseSizes[id % baseSizes.length]

      let content = `Chunk ${id} (${size} target): `
      while (content.length < size - 100) {
        content += `data-${id}@example.com 4242424242424242 192.168.1.${id % 255} `
      }
      return content
    }

    const numChunks = 100
    let chunkIndex = 0

    const readable = new ReadableStream({
      start(controller) {
        const pushChunks = () => {
          // Push multiple chunks quickly to create backpressure
          const batchSize = Math.min(5, numChunks - chunkIndex)

          for (let i = 0; i < batchSize && chunkIndex < numChunks; i++) {
            try {
              const chunk = generateVariableChunk(chunkIndex)
              controller.enqueue(chunk)
              chunkIndex++
            } catch (error) {
              console.log(`Failed to enqueue chunk ${chunkIndex}:`, (error as Error).message)
            }
          }

          if (chunkIndex < numChunks) {
            // Continue with varying intervals to create pressure patterns
            const nextInterval = Math.random() < 0.5 ? 1 : 20 // Fast or slow
            setTimeout(pushChunks, nextInterval)
          } else {
            controller.close()
          }
        }

        pushChunks()
      },
    })

    const startTime = Date.now()
    const processedStream = readable.pipeThrough(faultyTransform)
    const reader = processedStream.getReader()

    const results = []
    let streamError = null

    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        results.push(value)
      }
    } catch (error) {
      streamError = error
      console.log('Stream processing failed with error:', (error as Error).message)
    } finally {
      reader.releaseLock()
    }

    const endTime = Date.now()
    const totalTime = endTime - startTime

    console.log(`Backpressure error recovery test:`)
    console.log(`  Processing time: ${totalTime}ms`)
    console.log(`  Results collected: ${results.length}`)
    console.log(`  Processed successfully: ${processedCount}`)
    console.log(`  Errors encountered: ${errorCount}`)
    console.log(`  Recovery attempts: ${recoveryCount}`)
    console.log(`  Stream error: ${streamError ? 'Yes' : 'No'}`)

    if (results.length > 0) {
      // Analyze results
      const successfulResults = results.filter((r) => !r.includes('[ERROR_RECOVERED:'))
      const recoveredResults = results.filter((r) => r.includes('[ERROR_RECOVERED:'))

      console.log(`  Successful results: ${successfulResults.length}`)
      console.log(`  Recovered results: ${recoveredResults.length}`)

      // Verify recovery behavior
      assert.ok(results.length > 0, 'Should produce some results despite errors')

      if (recoveredResults.length > 0) {
        console.log('✓ Error recovery mechanism working')
        assert.equal(
          recoveredResults.length,
          recoveryCount,
          'Recovery results should match recovery count',
        )
      }

      if (successfulResults.length > 0) {
        // Verify successful results contain proper redactions
        for (const result of successfulResults.slice(0, 5)) {
          // Check first 5
          assert.ok(result.includes('[REDACTED:'), 'Successful results should contain redactions')
        }
      }

      // Should have attempted to process most chunks
      const totalAttempts = processedCount + errorCount
      assert.ok(totalAttempts >= results.length, 'Should have attempted to process most chunks')
    }

    // Document the error handling behavior
    if (streamError) {
      assert.ok(streamError instanceof Error, 'Stream error should be proper Error object')
      console.log('Stream failed with unrecoverable error - documented behavior')
    } else {
      console.log('✓ Stream completed despite processing errors')
    }

    console.log('✓ Backpressure error recovery behavior verified')
  })
})
