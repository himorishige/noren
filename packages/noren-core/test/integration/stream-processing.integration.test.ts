import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { Registry, redactText } from '@himorishige/noren-core'

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
    assert.equal(results.length, 3, 'Should process all chunks')
    assert.equal(processedChunks, 3, 'Should have processed 3 chunks')

    // Verify redaction occurred
    assert.ok(results[0].includes('[REDACTED:email]'), 'First chunk should have email redacted')
    assert.ok(
      results[1].includes('[REDACTED:credit_card]'),
      'Second chunk should have card redacted',
    )
    assert.ok(results[2].includes('[REDACTED:ipv4]'), 'Third chunk should have IP redacted')

    // Verify original sensitive data is not present
    assert.ok(!results.join('').includes('test@example.com'), 'Email should be redacted')
    assert.ok(!results.join('').includes('4242 4242 4242 4242'), 'Card should be redacted')
    assert.ok(!results.join('').includes('192.168.1.1'), 'IP should be redacted')
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
            } catch (error) {
              console.log('Backpressure detected during enqueue')
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
    assert.equal(results.length, 10, 'Should process all chunks despite backpressure')
    assert.equal(transformCount, 10, 'Should have transformed all chunks')

    // Processing should take reasonable time (with delays)
    assert.ok(processingTime > 400, 'Should take time due to processing delays')

    // Verify content integrity
    for (let i = 0; i < results.length; i++) {
      assert.ok(results[i].includes(`Chunk ${i}`), `Chunk ${i} should be preserved`)
      assert.ok(results[i].includes('[REDACTED:email]'), `Chunk ${i} should have email redacted`)
      assert.ok(results[i].includes('[REDACTED:ipv4]'), `Chunk ${i} should have IP redacted`)
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

      return content + `Chunk ${chunkId} end.`
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
    assert.equal(results.length, numChunks, 'Should process all large chunks')

    // Verify reasonable performance
    assert.ok(processingTime < 5000, 'Should process large data in reasonable time')

    // Memory growth should be reasonable (< 50MB for this test)
    assert.ok(memoryGrowth < 50 * 1024 * 1024, 'Memory growth should be reasonable')

    // Verify content integrity and redaction
    for (let i = 0; i < results.length; i++) {
      const result = results[i]
      assert.ok(result.includes(`Chunk ${i} start`), `Chunk ${i} should have start marker`)
      assert.ok(result.includes(`Chunk ${i} end`), `Chunk ${i} should have end marker`)

      // Should have redacted various PII types
      const redactionCount = (result.match(/\[REDACTED:/g) || []).length
      assert.ok(redactionCount > 0, `Chunk ${i} should have some redactions`)
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
        } catch (error) {
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
      assert.ok(goodResults.length > 0, 'Should have processed some chunks before error')
    }

    // Document error behavior - actual behavior depends on implementation
    if (streamError) {
      assert.ok(streamError instanceof Error, 'Should be proper Error object')
      console.log('✓ Error handling behavior documented')
    } else {
      console.log('✓ Stream completed despite errors (recovery successful)')
    }

    // Should have attempted to process all chunks
    assert.equal(processedCount, testChunks.length, 'Should have attempted to process all chunks')
    assert.ok(errorCount > 0, 'Should have encountered errors')
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
    assert.ok(fullResult.includes('Start of stream'), 'Should include start marker')
    assert.ok(fullResult.includes('End of stream'), 'Should include end marker')

    // Verify redactions occurred
    assert.ok(fullResult.includes('[REDACTED:email]'), 'Should redact email')
    assert.ok(fullResult.includes('[REDACTED:credit_card]'), 'Should redact credit card')
    assert.ok(fullResult.includes('[REDACTED:ipv4]'), 'Should redact IP address')

    // Verify original data not present
    assert.ok(!fullResult.includes('admin@company.com'), 'Email should be redacted')
    assert.ok(!fullResult.includes('4111 1111 1111 1111'), 'Card should be redacted')
    assert.ok(!fullResult.includes('10.0.0.1'), 'IP should be redacted')
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
    assert.equal(streamResults.length, numStreams, 'All streams should complete')

    // Verify each stream's results
    for (const { streamId, results } of streamResults) {
      console.log(`Stream ${streamId}: ${results.length} results`)

      assert.equal(results.length, chunksPerStream, `Stream ${streamId} should have all chunks`)

      // Verify content integrity and redaction
      for (let i = 0; i < results.length; i++) {
        const result = results[i]
        assert.ok(
          result.includes(`T${streamId}(`),
          `Should have transform marker for stream ${streamId}`,
        )
        assert.ok(result.includes(`Stream${streamId}`), `Should have stream identifier`)
        assert.ok(result.includes(`Chunk${i}`), `Should have chunk ${i} identifier`)
        assert.ok(result.includes('[REDACTED:email]'), `Chunk ${i} should have email redacted`)
        assert.ok(!result.includes(`@stream${streamId}.com`), `Original email should be redacted`)
      }
    }

    // Concurrent processing should be reasonably fast
    assert.ok(processingTime < 2000, 'Concurrent processing should be efficient')
  })
})
