// MCP (Model Context Protocol) specific utilities for stdio communication

import type { Registry } from './index.js'
import { redactText } from './index.js'
import type { Policy } from './types.js'

/**
 * JSON-RPC message structure for MCP
 */
export interface JsonRpcMessage {
  jsonrpc: '2.0'
  id?: string | number | null
  method?: string
  params?: unknown
  result?: unknown
  error?: {
    code: number
    message: string
    data?: unknown
  }
}

/**
 * Options for MCP redaction processing
 */
export interface MCPRedactionOptions {
  /** Registry for PII detection */
  registry: Registry
  /** Policy overrides for redaction */
  policy?: Policy
  /** Whether to preserve JSON-RPC structure integrity */
  preserveStructure?: boolean
  /** Whether to redact only specific JSON paths */
  targetPaths?: string[]
  /** Buffer size for line-based processing */
  lineBufferSize?: number
}

/**
 * Parse line-delimited JSON messages commonly used in MCP
 */
export function parseJsonLines(text: string): JsonRpcMessage[] {
  const messages: JsonRpcMessage[] = []
  const lines = text.split('\n').filter((line) => line.trim())

  for (const line of lines) {
    try {
      const parsed = JSON.parse(line.trim())
      if (isValidJsonRpcMessage(parsed)) {
        messages.push(parsed)
      }
    } catch {}
  }

  return messages
}

/**
 * Validate JSON-RPC message structure
 */
export function isValidJsonRpcMessage(obj: unknown): obj is JsonRpcMessage {
  if (!obj || typeof obj !== 'object') return false

  const msg = obj as Record<string, unknown>

  // Must have jsonrpc field with value "2.0"
  if (msg.jsonrpc !== '2.0') return false

  // Must have either method (request) or result/error (response)
  const hasMethod = typeof msg.method === 'string'
  const hasResult = 'result' in msg
  const hasError = 'error' in msg

  return hasMethod || hasResult || hasError
}

/**
 * Extract potentially sensitive content from JSON-RPC message
 */
export function extractSensitiveContent(message: JsonRpcMessage): string[] {
  const content: string[] = []

  // Extract from params (requests)
  if (message.params) {
    const paramsStr = JSON.stringify(message.params)
    content.push(paramsStr)
  }

  // Extract from result (successful responses)
  if (message.result) {
    const resultStr = JSON.stringify(message.result)
    content.push(resultStr)
  }

  // Extract from error data (error responses)
  if (message.error?.data) {
    const errorStr = JSON.stringify(message.error.data)
    content.push(errorStr)
  }

  return content
}

/**
 * Redact PII from JSON-RPC message while preserving structure
 */
export async function redactJsonRpcMessage(
  message: JsonRpcMessage,
  options: Pick<MCPRedactionOptions, 'registry' | 'policy'>,
): Promise<JsonRpcMessage> {
  const { registry, policy = {} } = options

  // Create a deep copy to avoid mutating original
  const redacted = JSON.parse(JSON.stringify(message)) as JsonRpcMessage

  // Redact params if present
  if (redacted.params) {
    const paramsText = JSON.stringify(redacted.params)
    const redactedParams = await redactText(registry, paramsText, policy)
    try {
      redacted.params = JSON.parse(redactedParams)
    } catch {
      // If redaction broke JSON structure, use string representation
      redacted.params = redactedParams
    }
  }

  // Redact result if present
  if (redacted.result) {
    const resultText = JSON.stringify(redacted.result)
    const redactedResult = await redactText(registry, resultText, policy)
    try {
      redacted.result = JSON.parse(redactedResult)
    } catch {
      redacted.result = redactedResult
    }
  }

  // Redact error data if present
  if (redacted.error?.data) {
    const errorText = JSON.stringify(redacted.error.data)
    const redactedError = await redactText(registry, errorText, policy)
    try {
      redacted.error.data = JSON.parse(redactedError)
    } catch {
      redacted.error.data = redactedError
    }
  }

  return redacted
}

/**
 * Create a transform stream for MCP line-delimited JSON processing
 */
export function createMCPRedactionTransform(options: MCPRedactionOptions) {
  const { registry, policy = {}, lineBufferSize = 64 * 1024 } = options

  let buffer = ''
  const decoder = new TextDecoder()
  const encoder = new TextEncoder()

  return new TransformStream<Uint8Array, Uint8Array>({
    async transform(chunk, controller) {
      // Decode chunk and add to buffer
      const text = decoder.decode(chunk, { stream: true })
      buffer += text

      // Process complete lines
      const lines = buffer.split('\n')
      buffer = lines.pop() || '' // Keep incomplete line in buffer

      for (const line of lines) {
        if (line.trim()) {
          await processLine(line.trim(), controller)
        } else {
          // Preserve empty lines
          controller.enqueue(encoder.encode('\n'))
        }
      }

      // Prevent buffer from growing too large
      if (buffer.length > lineBufferSize) {
        await processLine(buffer, controller)
        buffer = ''
      }
    },

    async flush(controller) {
      // Process any remaining buffer content
      if (buffer.trim()) {
        await processLine(buffer.trim(), controller)
      }
    },
  })

  async function processLine(
    line: string,
    controller: TransformStreamDefaultController<Uint8Array>,
  ) {
    try {
      const message = JSON.parse(line)

      if (isValidJsonRpcMessage(message)) {
        // Process as JSON-RPC message
        const redacted = await redactJsonRpcMessage(message, { registry, policy })
        const output = `${JSON.stringify(redacted)}\n`
        controller.enqueue(encoder.encode(output))
      } else {
        // Process as plain text
        const redacted = await redactText(registry, line, policy)
        controller.enqueue(encoder.encode(`${redacted}\n`))
      }
    } catch {
      // If JSON parsing fails, process as plain text
      const redacted = await redactText(registry, line, policy)
      controller.enqueue(encoder.encode(`${redacted}\n`))
    }
  }
}

/**
 * Utility to check if text contains JSON-RPC patterns
 */
export function containsJsonRpcPattern(text: string): boolean {
  return text.includes('"jsonrpc":"2.0"') || text.includes('"jsonrpc": "2.0"')
}

/**
 * Extract method names from JSON-RPC requests for logging/monitoring
 */
export function extractMethodName(message: JsonRpcMessage): string | null {
  return message.method || null
}

/**
 * Check if message is a request, response, or notification
 */
export function getMessageType(
  message: JsonRpcMessage,
): 'request' | 'response' | 'notification' | 'error' {
  if (message.error) return 'error'
  if (message.method && message.id !== undefined) return 'request'
  if (message.method && message.id === undefined) return 'notification'
  if ('result' in message || 'error' in message) return 'response'
  return 'request' // fallback
}
