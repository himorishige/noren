import { PromptGuard } from './guard.js'
import type { DetectionResult, GuardConfig, TrustLevel } from './types.js'

/**
 * Streaming prompt injection protection using WHATWG Streams
 * Efficient processing for large content and real-time data
 */

export interface StreamOptions extends Partial<GuardConfig> {
  /**
   * Chunk size for processing (default: 1024)
   */
  chunkSize?: number

  /**
   * Buffer size for context (default: 512)
   */
  contextBuffer?: number

  /**
   * Trust level for stream content
   */
  trustLevel?: TrustLevel

  /**
   * Enable progressive scanning (default: true)
   */
  progressiveScanning?: boolean
}

export interface StreamResult {
  chunk: string
  result: DetectionResult
  position: number
}

/**
 * Transform stream for prompt injection protection
 */
export class GuardTransform {
  private guard: PromptGuard
  private options: StreamOptions
  private buffer = ''
  private position = 0

  constructor(options: StreamOptions = {}) {
    this.options = {
      chunkSize: 1024,
      contextBuffer: 512,
      trustLevel: 'user',
      progressiveScanning: true,
      riskThreshold: 60,
      enableSanitization: true,
      ...options,
    }

    this.guard = new PromptGuard(this.options)
  }

  /**
   * Create transform stream
   */
  createStream(): TransformStream<string, StreamResult> {
    return new TransformStream({
      transform: async (chunk: string, controller) => {
        const results = await this.processChunk(chunk)
        for (const result of results) {
          controller.enqueue(result)
        }
      },
      flush: async (controller) => {
        if (this.buffer.length > 0) {
          const finalResults = await this.processBuffer()
          for (const result of finalResults) {
            controller.enqueue(result)
          }
        }
      },
    })
  }

  /**
   * Process incoming chunk
   */
  private async processChunk(chunk: string): Promise<StreamResult[]> {
    this.buffer += chunk
    const results: StreamResult[] = []

    if (!this.options.progressiveScanning) {
      // Simple mode: just accumulate
      return []
    }

    // Process complete chunks
    while (this.buffer.length >= (this.options.chunkSize || 1000)) {
      const processChunk = this.buffer.slice(0, this.options.chunkSize || 1000)
      this.buffer = this.buffer.slice(this.options.chunkSize || 1000)

      const result = await this.guard.scan(processChunk, this.options.trustLevel || 'user')

      results.push({
        chunk: result.sanitized,
        result,
        position: this.position,
      })

      this.position += this.options.chunkSize || 1000
    }

    return results
  }

  /**
   * Process remaining buffer
   */
  private async processBuffer(): Promise<StreamResult[]> {
    if (this.buffer.length === 0) return []

    const result = await this.guard.scan(this.buffer, this.options.trustLevel || 'user')

    return [
      {
        chunk: result.sanitized,
        result,
        position: this.position,
      },
    ]
  }
}

/**
 * Streaming processor for large text content
 */
export class StreamProcessor {
  private guard: PromptGuard
  private options: StreamOptions

  constructor(options: StreamOptions = {}) {
    this.options = {
      chunkSize: 2048,
      contextBuffer: 1024,
      trustLevel: 'user',
      ...options,
    }

    this.guard = new PromptGuard(this.options)
  }

  /**
   * Process readable stream
   */
  async processStream(inputStream: ReadableStream<string>): Promise<ReadableStream<StreamResult>> {
    const transform = new GuardTransform(this.options)
    return inputStream.pipeThrough(transform.createStream())
  }

  /**
   * Process string in streaming fashion
   */
  async *processText(text: string): AsyncGenerator<StreamResult, void, unknown> {
    const chunkSize = this.options.chunkSize || 1000
    let position = 0

    for (let i = 0; i < text.length; i += chunkSize) {
      const chunk = text.slice(i, i + chunkSize)
      const result = await this.guard.scan(chunk, this.options.trustLevel || 'user')

      yield {
        chunk: result.sanitized,
        result,
        position,
      }

      position += chunk.length
    }
  }

  /**
   * Create scanning transform for any stream
   */
  createScanTransform(): TransformStream<string, DetectionResult> {
    const guard = this.guard
    const trustLevel = this.options.trustLevel || 'user'

    return new TransformStream({
      transform: async (chunk: string, controller) => {
        const result = await guard.scan(chunk, trustLevel)
        controller.enqueue(result)
      },
    })
  }

  /**
   * Create sanitizing transform
   */
  createSanitizeTransform(): TransformStream<string, string> {
    const guard = this.guard
    const trustLevel = this.options.trustLevel || 'user'

    return new TransformStream({
      transform: async (chunk: string, controller) => {
        const result = await guard.scan(chunk, trustLevel)
        controller.enqueue(result.sanitized)
      },
    })
  }
}

/**
 * Utility functions for streaming operations
 */

/**
 * Create a readable stream from text
 */
export function createTextStream(text: string, chunkSize = 1024): ReadableStream<string> {
  let position = 0

  return new ReadableStream({
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
 * Collect stream results into array
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
 * Transform stream to string
 */
export async function streamToString(stream: ReadableStream<string>): Promise<string> {
  const chunks = await collectStream(stream)
  return chunks.join('')
}

/**
 * Create stream processing pipeline
 */
export function createPipeline(options: StreamOptions = {}) {
  const processor = new StreamProcessor(options)

  return {
    /**
     * Scan text stream for threats
     */
    scan: (input: ReadableStream<string>) => input.pipeThrough(processor.createScanTransform()),

    /**
     * Sanitize text stream
     */
    sanitize: (input: ReadableStream<string>) =>
      input.pipeThrough(processor.createSanitizeTransform()),

    /**
     * Full processing pipeline
     */
    process: (input: ReadableStream<string>) => processor.processStream(input),
  }
}

/**
 * Stream-based file processing
 */
export async function processFile(
  file: File | Blob,
  options: StreamOptions = {},
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

  // Process with guard
  const processor = new StreamProcessor(options)
  const resultStream = await processor.processStream(textStream)
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
 * Real-time text processing
 */
export class RealTimeProcessor {
  private processor: StreamProcessor
  private controller?: ReadableStreamDefaultController<StreamResult>
  private stream?: ReadableStream<StreamResult>

  constructor(options: StreamOptions = {}) {
    this.processor = new StreamProcessor({
      ...options,
      progressiveScanning: true,
      chunkSize: 256, // Smaller chunks for real-time
    })
  }

  /**
   * Start real-time processing
   */
  start(): ReadableStream<StreamResult> {
    this.stream = new ReadableStream({
      start: (controller) => {
        this.controller = controller
      },
    })

    return this.stream
  }

  /**
   * Add text for processing
   */
  async addText(text: string): Promise<void> {
    if (!this.controller) {
      throw new Error('Real-time processor not started')
    }

    for await (const result of this.processor.processText(text)) {
      this.controller.enqueue(result)
    }
  }

  /**
   * End processing
   */
  end(): void {
    if (this.controller) {
      this.controller.close()
      this.controller = undefined
    }
  }
}

/**
 * Simple streaming API
 */
export async function scanText(
  text: string,
  options: StreamOptions = {},
): Promise<DetectionResult[]> {
  const processor = new StreamProcessor(options)
  const results: DetectionResult[] = []

  for await (const streamResult of processor.processText(text)) {
    results.push(streamResult.result)
  }

  return results
}

/**
 * Simple sanitization API
 */
export async function sanitizeText(text: string, options: StreamOptions = {}): Promise<string> {
  const processor = new StreamProcessor(options)
  const chunks: string[] = []

  for await (const streamResult of processor.processText(text)) {
    chunks.push(streamResult.chunk)
  }

  return chunks.join('')
}
