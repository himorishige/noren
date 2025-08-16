/**
 * Functional stream processing API for noren-guard
 *
 * This module provides functional stream processing utilities for handling
 * large content efficiently using WHATWG Streams.
 */

import { createGuardContext, type GuardContext, scan } from './core.js'
import type { DetectionResult, GuardConfig, TrustLevel } from './types.js'

/**
 * Stream processor configuration
 */
export interface StreamConfig extends Partial<GuardConfig> {
  chunkSize?: number
  contextBuffer?: number
  progressiveScanning?: boolean
  trustLevel?: TrustLevel
}

/**
 * Stream processing result
 */
export interface StreamResult {
  chunk: string
  result: DetectionResult
  position: number
}

/**
 * Creates a transform stream for scanning content
 */
export function createScanTransform(
  config?: StreamConfig,
): TransformStream<string, DetectionResult> {
  const context = createGuardContext(config)
  const trustLevel = config?.trustLevel || 'user'

  return new TransformStream<string, DetectionResult>({
    async transform(chunk, controller) {
      const result = await scan(context, chunk, trustLevel)
      controller.enqueue(result)
    },
  })
}

/**
 * Creates a transform stream for sanitizing content
 */
export function createSanitizeTransform(config?: StreamConfig): TransformStream<string, string> {
  const context = createGuardContext({
    ...config,
    enableSanitization: true,
  })
  const trustLevel = config?.trustLevel || 'user'

  return new TransformStream<string, string>({
    async transform(chunk, controller) {
      const result = await scan(context, chunk, trustLevel)
      controller.enqueue(result.sanitized)
    },
  })
}

/**
 * Creates a guard transform stream with buffering
 */
export function createGuardTransform(config?: StreamConfig): TransformStream<string, StreamResult> {
  const context = createGuardContext(config)
  const trustLevel = config?.trustLevel || 'user'
  const chunkSize = config?.chunkSize || 1024
  const progressiveScanning = config?.progressiveScanning ?? true

  let buffer = ''
  let position = 0

  return new TransformStream<string, StreamResult>({
    async transform(chunk, controller) {
      buffer += chunk

      if (!progressiveScanning) {
        // Accumulate without processing
        return
      }

      // Process complete chunks
      while (buffer.length >= chunkSize) {
        const processChunk = buffer.slice(0, chunkSize)
        buffer = buffer.slice(chunkSize)

        const result = await scan(context, processChunk, trustLevel)
        controller.enqueue({
          chunk: result.sanitized,
          result,
          position,
        })

        position += chunkSize
      }
    },

    async flush(controller) {
      if (buffer.length > 0) {
        const result = await scan(context, buffer, trustLevel)
        controller.enqueue({
          chunk: result.sanitized,
          result,
          position,
        })
      }
    },
  })
}

/**
 * Creates a readable stream from text
 */
export function createTextStream(text: string, chunkSize = 1024): ReadableStream<string> {
  let position = 0

  return new ReadableStream<string>({
    pull(controller) {
      if (position >= text.length) {
        controller.close()
        return
      }

      const chunk = text.slice(position, position + chunkSize)
      position += chunkSize
      controller.enqueue(chunk)
    },
  })
}

/**
 * Collects stream results into an array
 */
export async function collectStream<T>(stream: ReadableStream<T>): Promise<T[]> {
  const results: T[] = []
  const reader = stream.getReader()

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      results.push(value)
    }
  } finally {
    reader.releaseLock()
  }

  return results
}

/**
 * Converts a stream to a string
 */
export async function streamToString(stream: ReadableStream<string>): Promise<string> {
  const chunks = await collectStream(stream)
  return chunks.join('')
}

/**
 * Creates a stream processor function
 */
export function createStreamProcessor(
  config?: StreamConfig,
): (input: ReadableStream<string>) => ReadableStream<StreamResult> {
  const transform = createGuardTransform(config)

  return (input: ReadableStream<string>) => {
    return input.pipeThrough(transform)
  }
}

/**
 * Processes text as a stream
 */
export async function* processTextStream(
  text: string,
  config?: StreamConfig,
): AsyncGenerator<StreamResult> {
  const context = createGuardContext(config)
  const trustLevel = config?.trustLevel || 'user'
  const chunkSize = config?.chunkSize || 1024
  let position = 0

  for (let i = 0; i < text.length; i += chunkSize) {
    const chunk = text.slice(i, i + chunkSize)
    const result = await scan(context, chunk, trustLevel)

    yield {
      chunk: result.sanitized,
      result,
      position,
    }

    position += chunk.length
  }
}

/**
 * Creates a pipeline for stream processing
 */
export function createStreamPipeline(config?: StreamConfig) {
  return {
    /**
     * Scan stream for threats
     */
    scan: (input: ReadableStream<string>) => input.pipeThrough(createScanTransform(config)),

    /**
     * Sanitize stream content
     */
    sanitize: (input: ReadableStream<string>) => input.pipeThrough(createSanitizeTransform(config)),

    /**
     * Full processing with buffering
     */
    process: (input: ReadableStream<string>) => input.pipeThrough(createGuardTransform(config)),
  }
}

/**
 * Processes a file stream
 */
export async function processFileStream(
  file: File | Blob,
  config?: StreamConfig,
): Promise<{
  results: StreamResult[]
  summary: {
    totalChunks: number
    dangerousChunks: number
    averageRisk: number
    processingTime: number
  }
}> {
  const startTime = performance.now()

  // Create text stream from file
  const textStream = file.stream().pipeThrough(new TextDecoderStream())

  // Process with guard transform
  const processor = createStreamProcessor(config)
  const resultStream = processor(textStream)
  const results = await collectStream(resultStream)

  // Calculate summary
  const totalChunks = results.length
  const dangerousChunks = results.filter((r) => !r.result.safe).length
  const averageRisk =
    totalChunks > 0 ? results.reduce((sum, r) => sum + r.result.risk, 0) / totalChunks : 0
  const processingTime = performance.now() - startTime

  return {
    results,
    summary: {
      totalChunks,
      dangerousChunks,
      averageRisk: Math.round(averageRisk * 100) / 100,
      processingTime: Math.round(processingTime * 100) / 100,
    },
  }
}

/**
 * Real-time stream processor
 */
export function createRealTimeProcessor(config?: StreamConfig) {
  let controller: ReadableStreamDefaultController<StreamResult> | undefined
  const chunkSize = config?.chunkSize || 256

  const stream = new ReadableStream<StreamResult>({
    start(c) {
      controller = c
    },
  })

  const context = createGuardContext(config)
  const trustLevel = config?.trustLevel || 'user'
  let position = 0

  return {
    /**
     * Get the output stream
     */
    getStream: () => stream,

    /**
     * Add text for processing
     */
    addText: async (text: string) => {
      if (!controller) {
        throw new Error('Real-time processor not started')
      }

      for (let i = 0; i < text.length; i += chunkSize) {
        const chunk = text.slice(i, i + chunkSize)
        const result = await scan(context, chunk, trustLevel)

        controller.enqueue({
          chunk: result.sanitized,
          result,
          position,
        })

        position += chunk.length
      }
    },

    /**
     * End processing
     */
    end: () => {
      if (controller) {
        controller.close()
        controller = undefined
      }
    },
  }
}

/**
 * Simple streaming scan API
 */
export async function scanStream(text: string, config?: StreamConfig): Promise<DetectionResult[]> {
  const results: DetectionResult[] = []

  for await (const streamResult of processTextStream(text, config)) {
    results.push(streamResult.result)
  }

  return results
}

/**
 * Simple streaming sanitize API
 */
export async function sanitizeStream(text: string, config?: StreamConfig): Promise<string> {
  const chunks: string[] = []

  for await (const streamResult of processTextStream(text, config)) {
    chunks.push(streamResult.chunk)
  }

  return chunks.join('')
}

// Type exports
export type { GuardContext, StreamConfig as GuardStreamConfig }
