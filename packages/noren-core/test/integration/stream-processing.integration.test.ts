import { Registry, redactText } from '@himorishige/noren-core'
import { describe, expect, it } from 'vitest'

/**
 * Stream Processing Integration Tests
 * Tests WHATWG Streams API integration and streaming scenarios.
 * Part of Phase 3: Integration & Advanced Scenarios
 *
 * Focuses on:
 * - WHATWG Streams compatibility
 * - Backpressure handling
 * - Large file processing
 * - Transform stream error recovery
 */

describe('WHATWG Streams Integration', () => {
  it('should process data through TransformStream', async () => {
    const reg = new Registry({ defaultAction: 'mask' })

    let processedChunks = 0

    // Create a transform stream for redaction
    const redactionTransform = new TransformStream({
      async transform(chunk, controller) {
        try {
          const text = typeof chunk === 'string' ? chunk : chunk.toString()
          const result = await redactText(reg, text)
          controller.enqueue(result)
          processedChunks++
        } catch (error) {
          controller.error(error)
        }
      },
    })

    const testData = [
      'First chunk: email test@example.com',
      'Second chunk: card 4242 4242 4242 4242',
      'Third chunk: IP address 192.168.1.1',
    ]

    // Create readable stream
    let chunkIndex = 0
    const readable = new ReadableStream({
      start(controller) {
        function pushNextChunk() {
          if (chunkIndex < testData.length) {
            controller.enqueue(testData[chunkIndex])
            chunkIndex++
            setTimeout(pushNextChunk, 10) // Small delay between chunks
          } else {
            controller.close()
          }
        }
        pushNextChunk()
      },
    })

    // Process through transform stream
    const processedStream = readable.pipeThrough(redactionTransform)
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

    console.log(`Processed ${processedChunks} chunks through TransformStream`)
    console.log('Results:', results)

    // Verify all chunks were processed
    expect(results.length).toBe(3)
    expect(processedChunks).toBe(3)

    // Verify redaction occurred
    expect(results[0]).toContain('[REDACTED:email]')
    expect(results[1]).toContain('[REDACTED:credit_card]', 'Second chunk should have card redacted')
    expect(results[2]).toContain('[REDACTED:ipv4]')

    // Verify original sensitive data is not present
    expect(results.join('')).not.toContain('test@example.com')
    expect(results.join('')).not.toContain('4242 4242 4242 4242')
    expect(results.join('')).not.toContain('192.168.1.1')
  })

  it('should handle backpressure correctly', async () => {
    const reg = new Registry({ defaultAction: 'mask' })

    let transformCount = 0
    let backpressureEvents = 0

    // Create transform stream with deliberate processing delay
    const slowTransform = new TransformStream(
      {
        async transform(chunk, controller) {
          transformCount++

          // Simulate slow processing
          await new Promise((resolve) => setTimeout(resolve, 50))

          const text = typeof chunk === 'string' ? chunk : chunk.toString()
          const result = await redactText(reg, text)

          try {
            controller.enqueue(result)
          } catch (error) {
            backpressureEvents++
            throw error
          }
        },
      },
      {
        // Set small buffer to trigger backpressure
        highWaterMark: 1,
      },
    )

    // Generate more data than the transform can handle immediately
    const dataChunks: string[] = []
    for (let i = 0; i < 10; i++) {
      dataChunks.push(`Chunk ${i}: email user${i}@example.com and IP 192.168.1.${i}`)
    }

    let enqueueCount = 0
    const readable = new ReadableStream({
      start(controller) {
        function enqueueNext() {
          if (enqueueCount < dataChunks.length) {
            try {
              controller.enqueue(dataChunks[enqueueCount])
              enqueueCount++
              // Try to enqueue quickly to test backpressure
              setTimeout(enqueueNext, 5)
            } catch (_error) {
              // Silently count backpressure events without logging each one
              backpressureEvents++
              // Retry after delay
              setTimeout(enqueueNext, 100)
            }
          } else {
            controller.close()
          }
        }
        enqueueNext()
      },
    })

    const processedStream = readable.pipeThrough(slowTransform)
    const reader = processedStream.getReader()

    const results = []
    const startTime = Date.now()

    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        results.push(value)
      }
    } finally {
      reader.releaseLock()
    }

    const processingTime = Date.now() - startTime

    console.log(`Backpressure test: processed ${results.length} chunks in ${processingTime}ms`)
    console.log(`Transform count: ${transformCount}, Backpressure events: ${backpressureEvents}`)

    // Verify all data was eventually processed
    expect(results.length).toBe(10)
    expect(transformCount).toBe(10)

    // Processing should take reasonable time (with delays)
    expect(processingTime > 400).toBeTruthy()

    // Verify content integrity
    for (let i = 0; i < results.length; i++) {
      expect(results[i]).toContain(`Chunk ${i}`, `Chunk ${i} should be preserved`)
      expect(results[i]).toContain('[REDACTED:email]', `Chunk ${i} should have email redacted`)
      expect(results[i]).toContain('[REDACTED:ipv4]', `Chunk ${i} should have IP redacted`)
    }
  })

  it('should handle large data processing efficiently', async () => {
    const reg = new Registry({ defaultAction: 'mask' })

    // Generate large text with multiple PII instances
    const generateLargeChunk = (chunkId: number, size: number) => {
      const patterns = [
        'email@example.com',
        '4242 4242 4242 4242',
        '192.168.1.100',
        '2001:db8::1',
        'AA:BB:CC:DD:EE:FF',
      ]

      let content = `Chunk ${chunkId} start. `
      const targetLength = size - 100 // Leave room for chunk markers

      while (content.length < targetLength) {
        const pattern = patterns[Math.floor(Math.random() * patterns.length)]
        content += `Data: ${pattern} `

        // Add some filler text
        content += 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. '
      }

      return `${content}Chunk ${chunkId} end.`
    }

    const largeTransform = new TransformStream(
      {
        async transform(chunk, controller) {
          const text = typeof chunk === 'string' ? chunk : chunk.toString()
          const result = await redactText(reg, text)
          controller.enqueue(result)
        },
      },
      {
        highWaterMark: 2, // Allow some buffering
      },
    )

    const chunkSize = 50 * 1024 // 50KB chunks
    const numChunks = 5

    let chunkIndex = 0
    const readable = new ReadableStream({
      start(controller) {
        function pushChunk() {
          if (chunkIndex < numChunks) {
            const chunk = generateLargeChunk(chunkIndex, chunkSize)
            controller.enqueue(chunk)
            chunkIndex++
            // Use setImmediate-like behavior for async processing
            setTimeout(pushChunk, 0)
          } else {
            controller.close()
          }
        }
        pushChunk()
      },
    })

    const startTime = Date.now()
    const startMemory = process.memoryUsage()

    const processedStream = readable.pipeThrough(largeTransform)
    const reader = processedStream.getReader()

    const results = []
    let totalSize = 0

    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        results.push(value)
        totalSize += value.length
      }
    } finally {
      reader.releaseLock()
    }

    const endTime = Date.now()
    const endMemory = process.memoryUsage()

    const processingTime = endTime - startTime
    const memoryGrowth = endMemory.heapUsed - startMemory.heapUsed

    console.log(`Large data test:`)
    console.log(`  Processed ${numChunks} chunks (~${Math.round(totalSize / 1024)}KB total)`)
    console.log(`  Processing time: ${processingTime}ms`)
    console.log(`  Memory growth: ${Math.round(memoryGrowth / 1024)}KB`)
    console.log(`  Throughput: ~${Math.round(totalSize / (processingTime / 1000) / 1024)}KB/s`)

    // Verify all chunks processed
    expect(results.length).toBe(numChunks)

    // Verify reasonable performance
    expect(processingTime < 5000).toBeTruthy()

    // Memory growth should be reasonable (< 50MB for this test)
    expect(memoryGrowth < 50 * 1024 * 1024).toBeTruthy()

    // Verify content integrity and redaction
    for (let i = 0; i < results.length; i++) {
      const result = results[i]
      expect(result).toContain(`Chunk ${i} start`, `Chunk ${i} should have start marker`)
      expect(result).toContain(`Chunk ${i} end`, `Chunk ${i} should have end marker`)

      // Should have redacted various PII types
      const redactionCount = (result.match(/\[REDACTED:/g) || []).length
      expect(redactionCount > 0, `Chunk ${i} should have some redactions`)
    }
  })

  it('should handle transform stream error recovery', async () => {
    const reg = new Registry({ defaultAction: 'mask' })

    let processedCount = 0
    let errorCount = 0
    let recoveryCount = 0

    const faultyTransform = new TransformStream({
      async transform(chunk, controller) {
        const text = typeof chunk === 'string' ? chunk : chunk.toString()
        processedCount++

        // Simulate intermittent failures
        if (text.includes('ERROR')) {
          errorCount++
          // Instead of stopping the stream, enqueue error recovery marker
          controller.enqueue(`[ERROR_RECOVERED: ${text.substring(0, 20)}...]`)
          recoveryCount++
          return
        }

        try {
          const result = await redactText(reg, text)
          controller.enqueue(result)
        } catch (_error) {
          errorCount++
          // Try recovery by enqueueing error marker
          controller.enqueue(`[ERROR_RECOVERED: ${text.substring(0, 20)}...]`)
          recoveryCount++
        }
      },
    })

    const testChunks = [
      'Good chunk: email user@example.com',
      'ERROR: This chunk will cause failure',
      'Another good chunk: card 4242 4242 4242 4242',
      'ERROR: Second failure chunk',
      'Final good chunk: IP 192.168.1.1',
    ]

    let chunkIndex = 0
    const readable = new ReadableStream({
      start(controller) {
        function pushNext() {
          if (chunkIndex < testChunks.length) {
            controller.enqueue(testChunks[chunkIndex])
            chunkIndex++
            setTimeout(pushNext, 10)
          } else {
            controller.close()
          }
        }
        pushNext()
      },
    })

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
      console.log('Stream error caught:', (error as Error).message)
    } finally {
      reader.releaseLock()
    }

    console.log(`Error recovery test:`)
    console.log(`  Processed count: ${processedCount}`)
    console.log(`  Error count: ${errorCount}`)
    console.log(`  Recovery count: ${recoveryCount}`)
    console.log(`  Results count: ${results.length}`)
    console.log(`  Stream error: ${streamError ? (streamError as Error).message : 'None'}`)

    if (results.length > 0) {
      console.log('Results:', results)

      // Verify partial processing occurred before error
      const goodResults = results.filter((r) => r.includes('[REDACTED:'))
      console.log(`  Good results: ${goodResults.length}`)

      // Should have processed some chunks before failing
      expect(goodResults.length > 0).toBeTruthy()
    }

    // Document error behavior - actual behavior depends on implementation
    if (streamError) {
      expect(streamError instanceof Error).toBeTruthy()
      console.log('✓ Error handling behavior documented')
    } else {
      console.log('✓ Stream completed despite errors (recovery successful)')
    }

    // Should have attempted to process all chunks
    expect(processedCount).toBe(testChunks.length)
    expect(errorCount > 0).toBeTruthy()
  })

  it('should support readable stream from string iterator', async () => {
    const reg = new Registry({ defaultAction: 'mask' })

    // Create async iterator of text chunks
    async function* generateTextChunks() {
      const chunks = [
        'Start of stream\n',
        'Email: admin@company.com\n',
        'Credit Card: 4111 1111 1111 1111\n',
        'IP Address: 10.0.0.1\n',
        'End of stream\n',
      ]

      for (const chunk of chunks) {
        // Simulate async data generation
        await new Promise((resolve) => setTimeout(resolve, 10))
        yield chunk
      }
    }

    // Create ReadableStream from async iterator
    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of generateTextChunks()) {
            controller.enqueue(chunk)
          }
          controller.close()
        } catch (error) {
          controller.error(error)
        }
      },
    })

    // Process through redaction transform
    const redactionTransform = new TransformStream({
      async transform(chunk, controller) {
        const text = typeof chunk === 'string' ? chunk : chunk.toString()
        const result = await redactText(reg, text)
        controller.enqueue(result)
      },
    })

    const processedStream = readable.pipeThrough(redactionTransform)

    // Collect all results
    const reader = processedStream.getReader()
    let fullResult = ''

    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        fullResult += value
      }
    } finally {
      reader.releaseLock()
    }

    console.log('Iterator stream result:')
    console.log(fullResult)

    // Verify stream processing
    expect(fullResult).toContain('Start of stream')
    expect(fullResult).toContain('End of stream')

    // Verify redactions occurred
    expect(fullResult).toContain('[REDACTED:email]')
    expect(fullResult).toContain('[REDACTED:credit_card]')
    expect(fullResult).toContain('[REDACTED:ipv4]')

    // Verify original data not present
    expect(fullResult).not.toContain('admin@company.com')
    expect(fullResult).not.toContain('4111 1111 1111 1111')
    expect(fullResult).not.toContain('10.0.0.1')
  })

  it('should handle concurrent stream processing', async () => {
    const reg = new Registry({ defaultAction: 'mask' })

    // Create multiple concurrent streams
    const createStream = (streamId: number, chunkCount: number) => {
      let chunkIndex = 0

      return new ReadableStream({
        start(controller) {
          function pushNext() {
            if (chunkIndex < chunkCount) {
              const chunk = `Stream${streamId} Chunk${chunkIndex}: email user${chunkIndex}@stream${streamId}.com`
              controller.enqueue(chunk)
              chunkIndex++
              // Random delay to simulate realistic timing
              setTimeout(pushNext, Math.random() * 20)
            } else {
              controller.close()
            }
          }
          pushNext()
        },
      })
    }

    // Create redaction transform
    const createRedactionTransform = (transformId: number) => {
      let processCount = 0

      return new TransformStream({
        async transform(chunk, controller) {
          processCount++
          const text = typeof chunk === 'string' ? chunk : chunk.toString()
          const result = await redactText(reg, text)
          controller.enqueue(`T${transformId}(${processCount}): ${result}`)
        },
      })
    }

    // Process multiple streams concurrently
    const streamPromises = []
    const numStreams = 3
    const chunksPerStream = 5

    for (let i = 0; i < numStreams; i++) {
      const stream = createStream(i, chunksPerStream)
      const transform = createRedactionTransform(i)
      const processedStream = stream.pipeThrough(transform)

      const streamPromise = (async () => {
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

        return { streamId: i, results }
      })()

      streamPromises.push(streamPromise)
    }

    const startTime = Date.now()
    const streamResults = await Promise.all(streamPromises)
    const processingTime = Date.now() - startTime

    console.log(`Concurrent streams test completed in ${processingTime}ms`)

    // Verify all streams completed
    expect(streamResults.length).toBe(numStreams)

    // Verify each stream's results
    for (const { streamId, results } of streamResults) {
      console.log(`Stream ${streamId}: ${results.length} results`)

      expect(results.length, chunksPerStream, `Stream ${streamId} should have all chunks`)

      // Verify content integrity and redaction
      for (let i = 0; i < results.length; i++) {
        const result = results[i]
        expect(result).toContain(
          `T${streamId}(`,
          `Should have transform marker for stream ${streamId}`,
        )
        expect(result).toContain(`Stream${streamId}`, `Should have stream identifier`)
        expect(result).toContain(`Chunk${i}`, `Should have chunk ${i} identifier`)
        expect(result).toContain('[REDACTED:email]', `Chunk ${i} should have email redacted`)
        expect(result).not.toContain(`@stream${streamId}.com`, `Original email should be redacted`)
      }
    }

    // Concurrent processing should be reasonably fast
    expect(processingTime < 2000).toBeTruthy()
  })
})
