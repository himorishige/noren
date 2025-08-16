import { PromptGuard } from './guard.js'
import type { DetectionResult, GuardConfig, MCPMessage } from './types.js'

// Type definitions for dynamic MCP content
interface MCPParams {
  prompt?: unknown
  content?: unknown
  text?: unknown
  message?: unknown
  input?: unknown
  query?: unknown
  args?: Record<string, unknown>
  arguments?: Record<string, unknown>
  [key: string]: unknown
}

interface MCPResult {
  content?: unknown
  text?: unknown
}

// HTTP middleware types
interface HTTPRequest {
  body: unknown
}

interface HTTPResponse {
  status(code: number): HTTPResponse
  json(data: unknown): void
}

type NextFunction = () => void

/**
 * MCP (Model Context Protocol) middleware for prompt injection protection
 * Lightweight integration for MCP servers and clients
 */

export interface MCPGuardOptions extends Partial<GuardConfig> {
  /**
   * Block dangerous messages completely (default: false)
   * If false, sanitize and log instead
   */
  blockDangerous?: boolean

  /**
   * Log all security events (default: true)
   */
  enableLogging?: boolean

  /**
   * Custom logger function
   */
  logger?: (event: SecurityEvent) => void
}

export interface SecurityEvent {
  timestamp: Date
  messageId?: string
  messageType: string
  content: string
  risk: number
  safe: boolean
  action: 'allowed' | 'sanitized' | 'blocked'
  matches: Array<{
    pattern: string
    category: string
    severity: string
  }>
}

/**
 * MCP Guard middleware for protecting message flows
 */
export class MCPGuard {
  private guard: PromptGuard
  private options: MCPGuardOptions
  private events: SecurityEvent[] = []

  constructor(options: MCPGuardOptions = {}) {
    this.options = {
      blockDangerous: false,
      enableLogging: true,
      riskThreshold: 65, // Slightly higher for MCP
      enableSanitization: true,
      enableContextSeparation: true,
      maxProcessingTime: 50,
      ...options,
    }

    this.guard = new PromptGuard(this.options)
  }

  /**
   * Process incoming MCP message for security threats
   */
  async processMessage(message: MCPMessage): Promise<{
    message: MCPMessage
    result: DetectionResult
    action: 'allowed' | 'sanitized' | 'blocked'
  }> {
    let processedMessage = { ...message }
    let action: 'allowed' | 'sanitized' | 'blocked' = 'allowed'

    // Extract content for scanning
    const content = this.extractContent(message)

    if (!content) {
      return {
        message: processedMessage,
        result: {
          input: '',
          sanitized: '',
          risk: 0,
          safe: true,
          matches: [],
          segments: [],
          processingTime: 0,
        },
        action: 'allowed',
      }
    }

    // Scan for threats
    const result = await this.guard.scan(content, 'user')

    // Apply protection policy
    if (!result.safe) {
      if (this.options.blockDangerous) {
        action = 'blocked'
        processedMessage = this.createBlockedMessage(message, result)
      } else {
        action = 'sanitized'
        processedMessage = this.sanitizeMessage(message, result)
      }
    }

    // Log security event
    if (this.options.enableLogging) {
      const event: SecurityEvent = {
        timestamp: new Date(),
        messageId: message.id?.toString(),
        messageType: message.method || 'unknown',
        content: content.slice(0, 200), // Truncate for logging
        risk: result.risk,
        safe: result.safe,
        action,
        matches: result.matches.map((m) => ({
          pattern: m.pattern,
          category: m.category,
          severity: m.severity,
        })),
      }

      this.logEvent(event)
    }

    return {
      message: processedMessage,
      result,
      action,
    }
  }

  /**
   * Quick safety check without full processing
   */
  isMessageSafe(message: MCPMessage): boolean {
    const content = this.extractContent(message)
    if (!content) return true

    return this.guard.quickScan(content).safe
  }

  /**
   * Extract scannable content from MCP message
   */
  private extractContent(message: MCPMessage): string {
    let content = ''

    // Extract from various message fields
    if (message.params) {
      if (typeof message.params === 'string') {
        content += message.params
      } else if (typeof message.params === 'object') {
        // Extract text from common parameter fields
        const params = message.params as MCPParams
        if (params.prompt) content += ` ${String(params.prompt)}`
        if (params.content) content += ` ${String(params.content)}`
        if (params.text) content += ` ${String(params.text)}`
        if (params.message) content += ` ${String(params.message)}`
        if (params.input) content += ` ${String(params.input)}`
        if (params.query) content += ` ${String(params.query)}`

        // Extract from nested arguments
        if (params.args) {
          const args = params.args
          Object.values(args).forEach((value) => {
            if (typeof value === 'string') {
              content += ` ${value}`
            }
          })
        }
      }
    }

    // Extract from result field
    if (message.result && typeof message.result === 'object') {
      const result = message.result as MCPResult
      if (result.content) content += ` ${String(result.content)}`
      if (result.text) content += ` ${String(result.text)}`
    }

    return content.trim()
  }

  /**
   * Create a blocked message response
   */
  private createBlockedMessage(original: MCPMessage, result: DetectionResult): MCPMessage {
    return {
      ...original,
      error: {
        code: -32603, // Internal error
        message: 'Request blocked due to security policy',
        data: {
          reason: 'Prompt injection detected',
          riskScore: result.risk,
          patterns: result.matches.map((m) => m.pattern),
        },
      },
    }
  }

  /**
   * Sanitize message content
   */
  private sanitizeMessage(original: MCPMessage, result: DetectionResult): MCPMessage {
    if (!original.params || typeof original.params !== 'object') {
      return original
    }

    const sanitized = { ...original }
    const params = { ...(original.params as MCPParams) }

    // Sanitize common text fields
    const textFields = ['prompt', 'content', 'text', 'message', 'input', 'query']
    textFields.forEach((field) => {
      if (params[field] && typeof params[field] === 'string') {
        params[field] = result.sanitized
      }
    })

    // Sanitize nested arguments
    if (params.arguments) {
      const args = { ...params.arguments }
      Object.keys(args).forEach((key) => {
        if (typeof args[key] === 'string') {
          // Apply basic sanitization to argument values
          args[key] = result.sanitized
        }
      })
      params.arguments = args
    }

    sanitized.params = params
    return sanitized
  }

  /**
   * Log security event
   */
  private logEvent(event: SecurityEvent): void {
    this.events.push(event)

    // Keep only last 1000 events
    if (this.events.length > 1000) {
      this.events = this.events.slice(-1000)
    }

    if (this.options.logger) {
      this.options.logger(event)
    } else {
      // Default console logging for development
      const level = event.safe ? 'info' : 'warn'
      console[level](
        `[NorenGuard] ${event.action.toUpperCase()}: ${event.messageType} (risk: ${event.risk})`,
      )

      if (!event.safe) {
        console.warn(`  Patterns: ${event.matches.map((m) => m.pattern).join(', ')}`)
      }
    }
  }

  /**
   * Get security events history
   */
  getEvents(limit = 100): SecurityEvent[] {
    return this.events.slice(-limit)
  }

  /**
   * Get security metrics
   */
  getMetrics(): {
    totalMessages: number
    blockedMessages: number
    sanitizedMessages: number
    averageRisk: number
    topPatterns: Array<{ pattern: string; count: number }>
  } {
    const total = this.events.length
    const blocked = this.events.filter((e) => e.action === 'blocked').length
    const sanitized = this.events.filter((e) => e.action === 'sanitized').length
    const avgRisk = total > 0 ? this.events.reduce((sum, e) => sum + e.risk, 0) / total : 0

    // Count pattern occurrences
    const patternCounts = new Map<string, number>()
    this.events.forEach((event) => {
      event.matches.forEach((match) => {
        const count = patternCounts.get(match.pattern) || 0
        patternCounts.set(match.pattern, count + 1)
      })
    })

    const topPatterns = Array.from(patternCounts.entries())
      .map(([pattern, count]) => ({ pattern, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)

    return {
      totalMessages: total,
      blockedMessages: blocked,
      sanitizedMessages: sanitized,
      averageRisk: Math.round(avgRisk * 100) / 100,
      topPatterns,
    }
  }

  /**
   * Update configuration
   */
  updateConfig(newOptions: Partial<MCPGuardOptions>): void {
    this.options = { ...this.options, ...newOptions }
    this.guard.updateConfig(newOptions)
  }

  /**
   * Clear events history
   */
  clearEvents(): void {
    this.events = []
  }
}

/**
 * Create MCP middleware function
 */
export function createMCPMiddleware(options: MCPGuardOptions = {}) {
  const mcpGuard = new MCPGuard(options)

  return {
    guard: mcpGuard,

    /**
     * Middleware function for processing messages
     */
    async process(message: MCPMessage) {
      return mcpGuard.processMessage(message)
    },

    /**
     * Quick safety check
     */
    isSafe(message: MCPMessage) {
      return mcpGuard.isMessageSafe(message)
    },
  }
}

/**
 * Express-style middleware for HTTP-based MCP
 */
export function createHTTPMiddleware(options: MCPGuardOptions = {}) {
  const mcpGuard = new MCPGuard(options)

  return async (req: HTTPRequest, res: HTTPResponse, next: NextFunction) => {
    try {
      // Assume request body contains MCP message
      const message = req.body as MCPMessage

      const { message: processedMessage, action } = await mcpGuard.processMessage(message)

      if (action === 'blocked') {
        return res.status(403).json({
          error: {
            code: -32603,
            message: 'Request blocked due to security policy',
          },
        })
      }

      // Replace request body with sanitized version
      req.body = processedMessage
      next()
    } catch (error) {
      console.error('[NorenGuard] Middleware error:', error)
      next() // Continue on error (fail-open)
    }
  }
}
