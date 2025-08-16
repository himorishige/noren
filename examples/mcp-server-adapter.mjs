#!/usr/bin/env node

/**
 * MCP Server Adapter Example - PII Redaction for stdio communication
 *
 * This example demonstrates how to use Noren for PII redaction in MCP (Model Context Protocol)
 * servers that communicate via JSON-RPC over stdio.
 *
 * Usage:
 *   node examples/mcp-server-adapter.mjs
 *   echo '{"jsonrpc":"2.0","method":"getUser","params":{"email":"user@example.com"},"id":1}' | node examples/mcp-server-adapter.mjs
 */

import { Readable, Writable } from 'node:stream'
import {
  createMCPRedactionTransform,
  Registry,
  redactJsonRpcMessage,
} from '../packages/noren-core/dist/index.js'
import * as jpPlugin from '../packages/noren-plugin-jp/dist/index.js'
import * as securityPlugin from '../packages/noren-plugin-security/dist/index.js'
import * as usPlugin from '../packages/noren-plugin-us/dist/index.js'

// Create registry with comprehensive PII detection
const registry = new Registry({
  defaultAction: 'mask',
  validationStrictness: 'fast', // Optimized for real-time processing
  detectSensitivity: 'balanced',
  enableJsonDetection: true, // Important for JSON-RPC content
  rules: {
    email: { action: 'mask' },
    phone_jp: { action: 'mask' },
    phone_e164: { action: 'mask' },
    mynumber_jp: { action: 'remove' }, // Sensitive Japanese ID
    credit_card: { action: 'mask', preserveLast4: true },
    api_key: { action: 'remove' }, // Remove API keys completely
    jwt_token: { action: 'tokenize' }, // Tokenize JWTs for tracking
  },
  hmacKey: 'mcp-server-redaction-key-32-chars-minimum-length-required',
  contextHints: [
    // English hints
    'user',
    'customer',
    'client',
    'person',
    'contact',
    'profile',
    'email',
    'phone',
    'address',
    'card',
    'payment',
    'account',
    // Japanese hints
    'ユーザー',
    '顧客',
    '連絡先',
    'メール',
    '電話',
    '住所',
    'カード',
    // Technical hints
    'token',
    'key',
    'secret',
    'credential',
    'auth',
    'session',
  ],
})

// Load plugins for comprehensive detection
registry.use(jpPlugin.detectors, jpPlugin.maskers, jpPlugin.contextHints || [])
registry.use(usPlugin.detectors, usPlugin.maskers, usPlugin.contextHints || [])
registry.use(securityPlugin.detectors, securityPlugin.maskers, securityPlugin.contextHints || [])

/**
 * MCP Server Proxy with PII Redaction
 *
 * This class wraps an existing MCP server and intercepts stdio communication
 * to redact PII from both requests and responses.
 */
class MCPRedactionProxy {
  constructor(options = {}) {
    this.options = {
      logRedactions: false,
      preserveJsonStructure: true,
      lineBufferSize: 64 * 1024,
      ...options,
    }

    this.stats = {
      messagesProcessed: 0,
      piiFindingsTotal: 0,
      jsonRpcMessages: 0,
      plainTextLines: 0,
      errors: 0,
    }
  }

  /**
   * Start the proxy server
   */
  async start() {
    const inputStream = Readable.toWeb(process.stdin)
    const outputStream = Writable.toWeb(process.stdout)

    // Create MCP-optimized transform stream
    const transform = createMCPRedactionTransform({
      registry,
      policy: {
        defaultAction: 'mask',
        rules: registry.getPolicy().rules,
        hmacKey: registry.getPolicy().hmacKey,
        contextHints: registry.getPolicy().contextHints,
      },
      preserveStructure: this.options.preserveJsonStructure,
      lineBufferSize: this.options.lineBufferSize,
    })

    // Add monitoring if logging is enabled
    if (this.options.logRedactions) {
      const monitoringTransform = this.createMonitoringTransform()
      await inputStream.pipeThrough(transform).pipeThrough(monitoringTransform).pipeTo(outputStream)
    } else {
      await inputStream.pipeThrough(transform).pipeTo(outputStream)
    }

    this.logStats()
  }

  /**
   * Create a monitoring transform for logging redaction activity
   */
  createMonitoringTransform() {
    const decoder = new TextDecoder()
    const _encoder = new TextEncoder()

    return new TransformStream({
      transform: (chunk, controller) => {
        const text = decoder.decode(chunk, { stream: true })

        // Log redaction activity
        if (text.includes('[REDACTED:') || text.includes('TKN_')) {
          this.stats.piiFindingsTotal++
          if (this.options.logRedactions) {
            console.error(`[REDACTION] Found PII in message: ${text.substring(0, 100)}...`)
          }
        }

        // Check message type
        if (text.includes('"jsonrpc":"2.0"')) {
          this.stats.jsonRpcMessages++
        } else {
          this.stats.plainTextLines++
        }

        this.stats.messagesProcessed++
        controller.enqueue(chunk)
      },
    })
  }

  /**
   * Log statistics about processed messages
   */
  logStats() {
    if (this.options.logRedactions) {
      console.error('\n=== MCP Redaction Proxy Statistics ===')
      console.error(`Messages processed: ${this.stats.messagesProcessed}`)
      console.error(`JSON-RPC messages: ${this.stats.jsonRpcMessages}`)
      console.error(`Plain text lines: ${this.stats.plainTextLines}`)
      console.error(`PII findings: ${this.stats.piiFindingsTotal}`)
      console.error(`Errors: ${this.stats.errors}`)
    }
  }
}

/**
 * Test function to demonstrate JSON-RPC message redaction
 */
async function testJsonRpcRedaction() {
  const testMessages = [
    {
      jsonrpc: '2.0',
      method: 'getUserProfile',
      params: {
        email: 'john.doe@company.com',
        phone: '+1-555-123-4567',
        creditCard: '4242 4242 4242 4242',
      },
      id: 1,
    },
    {
      jsonrpc: '2.0',
      result: {
        user: {
          name: 'John Doe',
          email: 'jane.smith@example.com',
          phone: '090-1234-5678',
          address: '〒150-0001 東京都渋谷区神宮前1-1-1',
        },
        sessionToken:
          'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c',
      },
      id: 1,
    },
    {
      jsonrpc: '2.0',
      error: {
        code: -32603,
        message: 'Internal error',
        data: {
          details: 'Database connection failed for user admin@internal.com',
          apiKey: 'sk-1234567890abcdef',
        },
      },
      id: 2,
    },
  ]

  console.error('\n=== Testing JSON-RPC Message Redaction ===')

  for (const [index, message] of testMessages.entries()) {
    console.error(`\nTest ${index + 1}: ${message.method || 'response/error'}`)
    console.error('Original:', JSON.stringify(message, null, 2))

    const redacted = await redactJsonRpcMessage(message, { registry })
    console.error('Redacted:', JSON.stringify(redacted, null, 2))
  }
}

/**
 * Main execution
 */
async function main() {
  const args = process.argv.slice(2)

  if (args.includes('--test')) {
    await testJsonRpcRedaction()
    return
  }

  if (args.includes('--help')) {
    console.error(`
MCP Server Adapter - PII Redaction for stdio communication

Usage:
  node examples/mcp-server-adapter.mjs [options]

Options:
  --test          Run test cases instead of proxy mode
  --log           Enable redaction logging to stderr
  --help          Show this help message

Examples:
  # Proxy mode (default)
  echo '{"jsonrpc":"2.0","method":"test","params":{"email":"user@example.com"}}' | node examples/mcp-server-adapter.mjs
  
  # Test mode
  node examples/mcp-server-adapter.mjs --test
  
  # With logging
  node examples/mcp-server-adapter.mjs --log
`)
    return
  }

  // Start the proxy server
  const proxy = new MCPRedactionProxy({
    logRedactions: args.includes('--log'),
    preserveJsonStructure: true,
  })

  try {
    await proxy.start()
  } catch (error) {
    console.error('Error in MCP redaction proxy:', error)
    process.exit(1)
  }
}

// Handle process termination gracefully
process.on('SIGINT', () => {
  console.error('\nShutting down MCP redaction proxy...')
  process.exit(0)
})

process.on('SIGTERM', () => {
  console.error('\nReceived SIGTERM, shutting down...')
  process.exit(0)
})

// Run the main function
main().catch((error) => {
  console.error('Fatal error:', error)
  process.exit(1)
})
