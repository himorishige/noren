/**
 * Stateful stream processing with Aho-Corasick state preservation
 * Enables continuous pattern detection across chunk boundaries
 */

import { AhoCorasick, createOptimizedDetector } from './aho-corasick.js'
import { createGuardContext, type GuardContext } from './core.js'
import type { DetectionResult, InjectionPattern, PatternMatch, TrustLevel } from './types.js'

/**
 * Stateful stream configuration
 */
export interface StatefulStreamConfig {
  chunkSize?: number
  overlapSize?: number
  riskThreshold?: number
  enableSanitization?: boolean
  trustLevel?: TrustLevel
  patterns?: InjectionPattern[]
}

/**
 * Stream state for cross-chunk pattern detection
 */
interface StreamState {
  buffer: string
  position: number
  automaton: AhoCorasick | null
  context: GuardContext
  totalMatches: PatternMatch[]
  chunkCount: number
}

/**
 * Stateful stream processor for continuous detection
 */
export class StatefulStreamProcessor {
  private state: StreamState
  private config: Required<StatefulStreamConfig>

  constructor(config: StatefulStreamConfig = {}) {
    this.config = {
      chunkSize: config.chunkSize ?? 1024,
      overlapSize: config.overlapSize ?? 128,
      riskThreshold: config.riskThreshold ?? 60,
      enableSanitization: config.enableSanitization ?? true,
      trustLevel: config.trustLevel ?? 'user',
      patterns: config.patterns ?? []
    }

    this.state = {
      buffer: '',
      position: 0,
      automaton: null,
      context: createGuardContext({
        riskThreshold: this.config.riskThreshold,
        enableSanitization: this.config.enableSanitization,
        customPatterns: this.config.patterns
      }),
      totalMatches: [],
      chunkCount: 0
    }

    // Initialize automaton if patterns provided
    if (this.config.patterns.length > 0) {
      this.state.automaton = createOptimizedDetector(this.config.patterns)
    }
  }

  /**
   * Process a chunk of text with state preservation
   */
  async processChunk(chunk: string): Promise<{
    result: DetectionResult
    matches: PatternMatch[]
    position: number
    isComplete: boolean
  }> {
    this.state.buffer += chunk
    this.state.chunkCount++

    // Determine processing window
    const shouldProcess = this.state.buffer.length >= this.config.chunkSize
    const isLastChunk = chunk.length === 0 // Empty chunk signals end

    if (!shouldProcess && !isLastChunk) {
      // Not enough data to process yet
      return {
        result: {
          input: chunk,
          sanitized: chunk,
          risk: 0,
          safe: true,
          matches: [],
          segments: [],
          processingTime: 0
        },
        matches: [],
        position: this.state.position,
        isComplete: false
      }
    }

    // Calculate processing window with overlap
    const processSize = isLastChunk ? this.state.buffer.length : this.config.chunkSize
    const contentToProcess = this.state.buffer.slice(0, processSize)
    
    // Use Aho-Corasick for stateful detection if available
    let matches: PatternMatch[] = []
    if (this.state.automaton) {
      matches = this.state.automaton.search(contentToProcess)
    } else {
      // Fallback to context-based detection
      const { detectPatterns } = await import('./core.js')
      matches = detectPatterns(this.state.context, contentToProcess)
    }

    // Adjust match positions for global stream position
    const adjustedMatches = matches.map(match => ({
      ...match,
      index: match.index + this.state.position
    }))

    this.state.totalMatches.push(...adjustedMatches)

    // Create detection result
    const { scan } = await import('./core.js')
    const result = await scan(this.state.context, contentToProcess, this.config.trustLevel)

    // Update buffer for next iteration
    if (!isLastChunk) {
      // Keep overlap for boundary detection
      const advanceSize = Math.max(1, processSize - this.config.overlapSize)
      this.state.buffer = this.state.buffer.slice(advanceSize)
      this.state.position += advanceSize
    } else {
      // Final chunk processed
      this.state.buffer = ''
      this.state.position += processSize
    }

    return {
      result: {
        ...result,
        matches: adjustedMatches
      },
      matches: adjustedMatches,
      position: this.state.position,
      isComplete: isLastChunk
    }
  }

  /**
   * Process entire text stream
   */
  async processStream(text: string): Promise<{
    results: DetectionResult[]
    totalMatches: PatternMatch[]
    summary: {
      totalChunks: number
      totalMatches: number
      highestRisk: number
      averageRisk: number
      processingTime: number
    }
  }> {
    const startTime = performance.now()
    const results: DetectionResult[] = []
    
    // Reset state
    this.resetState()

    // Process in chunks
    let position = 0
    while (position < text.length) {
      const chunkEnd = Math.min(position + this.config.chunkSize, text.length)
      const chunk = text.slice(position, chunkEnd)
      
      const chunkResult = await this.processChunk(chunk)
      results.push(chunkResult.result)
      
      position = chunkEnd
    }

    // Final processing
    await this.processChunk('') // Signal end

    const processingTime = performance.now() - startTime
    const risks = results.map(r => r.risk)
    const averageRisk = risks.length > 0 ? risks.reduce((a, b) => a + b, 0) / risks.length : 0
    const highestRisk = risks.length > 0 ? Math.max(...risks) : 0

    return {
      results,
      totalMatches: this.state.totalMatches,
      summary: {
        totalChunks: this.state.chunkCount,
        totalMatches: this.state.totalMatches.length,
        highestRisk,
        averageRisk,
        processingTime
      }
    }
  }

  /**
   * Create transform stream with state preservation
   */
  createTransformStream(): TransformStream<string, DetectionResult> {
    return new TransformStream<string, DetectionResult>({
      transform: async (chunk, controller) => {
        const result = await this.processChunk(chunk)
        if (result.isComplete || result.result.matches.length > 0) {
          controller.enqueue(result.result)
        }
      },
      
      flush: async (controller) => {
        // Process any remaining buffer
        const finalResult = await this.processChunk('')
        if (finalResult.result.input.length > 0) {
          controller.enqueue(finalResult.result)
        }
      }
    })
  }

  /**
   * Reset internal state
   */
  resetState(): void {
    this.state.buffer = ''
    this.state.position = 0
    this.state.totalMatches = []
    this.state.chunkCount = 0
  }

  /**
   * Get current state information
   */
  getState(): {
    bufferSize: number
    position: number
    totalMatches: number
    chunkCount: number
  } {
    return {
      bufferSize: this.state.buffer.length,
      position: this.state.position,
      totalMatches: this.state.totalMatches.length,
      chunkCount: this.state.chunkCount
    }
  }

  /**
   * Update patterns dynamically
   */
  updatePatterns(patterns: InjectionPattern[]): void {
    this.config.patterns = patterns
    this.state.context = createGuardContext({
      riskThreshold: this.config.riskThreshold,
      enableSanitization: this.config.enableSanitization,
      customPatterns: patterns
    })
    
    if (patterns.length > 0) {
      this.state.automaton = createOptimizedDetector(patterns)
    } else {
      this.state.automaton = null
    }
  }
}

/**
 * Create a stateful stream processor
 */
export function createStatefulProcessor(config?: StatefulStreamConfig): StatefulStreamProcessor {
  return new StatefulStreamProcessor(config)
}

/**
 * Process large text with automatic chunking and state preservation
 */
export async function processLargeText(
  text: string,
  config?: StatefulStreamConfig
): Promise<{
  safe: boolean
  risk: number
  matches: PatternMatch[]
  chunks: number
  processingTime: number
}> {
  const processor = createStatefulProcessor(config)
  const result = await processor.processStream(text)
  
  const overallRisk = result.summary.averageRisk
  const safe = overallRisk < (config?.riskThreshold ?? 60)
  
  return {
    safe,
    risk: overallRisk,
    matches: result.totalMatches,
    chunks: result.summary.totalChunks,
    processingTime: result.summary.processingTime
  }
}

/**
 * Create readable stream with stateful processing
 */
export function createStatefulStream(
  text: string,
  config?: StatefulStreamConfig
): ReadableStream<DetectionResult> {
  const processor = createStatefulProcessor(config)
  const chunkSize = config?.chunkSize ?? 1024
  let position = 0

  return new ReadableStream<DetectionResult>({
    async pull(controller) {
      if (position >= text.length) {
        // Signal end and close
        await processor.processChunk('')
        controller.close()
        return
      }

      const chunk = text.slice(position, position + chunkSize)
      const result = await processor.processChunk(chunk)
      
      if (result.isComplete || result.result.matches.length > 0) {
        controller.enqueue(result.result)
      }
      
      position += chunk.length
    }
  })
}