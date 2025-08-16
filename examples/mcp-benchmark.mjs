#!/usr/bin/env node

/**
 * MCP (Model Context Protocol) Performance Benchmark
 *
 * Simple benchmark to measure JSON-RPC processing performance and detection accuracy.
 * Used to generate real performance metrics for DETECTION_RATES.md documentation.
 *
 * Usage:
 *   node examples/mcp-benchmark.mjs
 */

import {
  isValidJsonRpcMessage,
  parseJsonLines,
  Registry,
  redactJsonRpcMessage,
} from '../packages/noren-core/dist/index.js'
import * as securityPlugin from '../packages/noren-plugin-security/dist/index.js'

// Performance measurement utilities
function measureMemory() {
  if (global.gc) {
    global.gc()
  }
  return process.memoryUsage()
}

function formatTime(ms) {
  if (ms < 1) {
    return `${(ms * 1000).toFixed(2)}μs`
  }
  return `${ms.toFixed(3)}ms`
}

function formatThroughput(count, timeMs) {
  const throughput = (count / timeMs) * 1000
  if (throughput > 1000) {
    return `${(throughput / 1000).toFixed(1)}K/sec`
  }
  return `${throughput.toFixed(0)}/sec`
}

// Test datasets
const createTestMessages = (count) => {
  const messages = []
  const templates = [
    {
      jsonrpc: '2.0',
      method: 'getUserProfile',
      params: { email: 'user@example.com', phone: '+1-555-123-4567' },
      id: 1,
    },
    {
      jsonrpc: '2.0',
      method: 'processPayment',
      params: { card: '4242 4242 4242 4242', amount: 100 },
      id: 2,
    },
    {
      jsonrpc: '2.0',
      result: {
        token:
          'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c',
      },
      id: 1,
    },
    {
      jsonrpc: '2.0',
      error: { code: -32603, message: 'Internal error', data: { email: 'admin@internal.com' } },
      id: 3,
    },
    { jsonrpc: '2.0', method: 'notification', params: { message: 'Status update' } },
  ]

  for (let i = 0; i < count; i++) {
    const template = templates[i % templates.length]
    messages.push({ ...template, id: template.id || i })
  }

  return messages
}

const createNDJSONStream = (messages) => {
  return messages.map((msg) => JSON.stringify(msg)).join('\n')
}

// Registry setup
const registry = new Registry({
  defaultAction: 'mask',
  validationStrictness: 'fast',
  enableJsonDetection: true,
  rules: {
    email: { action: 'mask' },
    credit_card: { action: 'mask', preserveLast4: true },
    jwt_token: { action: 'tokenize' },
    api_key: { action: 'mask' },
  },
  hmacKey: 'mcp-benchmark-key-32-characters-minimum-length-required',
})

// Add security plugin for better API key detection
registry.use(securityPlugin.detectors, securityPlugin.maskers, securityPlugin.contextHints || [])

// Test cases for detection accuracy
const detectionTestCases = [
  {
    input: '{"jsonrpc":"2.0","method":"test","params":{"email":"user@example.com"},"id":1}',
    expectPII: true,
    type: 'email',
  },
  {
    input: '{"jsonrpc":"2.0","method":"test","params":{"card":"4242 4242 4242 4242"},"id":2}',
    expectPII: true,
    type: 'credit_card',
  },
  {
    input:
      '{"jsonrpc":"2.0","method":"test","params":{"token":"ghp_1234567890abcdef1234567890abcdef12345678"},"id":3}',
    expectPII: true,
    type: 'api_key',
  },
  {
    input: '{"jsonrpc":"2.0","method":"test","params":{"phone":"+1-555-123-4567"},"id":4}',
    expectPII: true,
    type: 'phone',
  },
  {
    input: '{"jsonrpc":"2.0","method":"test","params":{"message":"hello world"},"id":5}',
    expectPII: false,
    type: 'none',
  },
  { input: '{"jsonrpc":"2.0","result":{"status":"ok"},"id":1}', expectPII: false, type: 'none' },
  {
    input: '{"jsonrpc":"2.0","result":{"user_email":"admin@company.com"},"id":2}',
    expectPII: true,
    type: 'email',
  },
  {
    input:
      '{"jsonrpc":"2.0","error":{"code":-32603,"message":"error","data":{"email":"error@internal.com"}},"id":3}',
    expectPII: true,
    type: 'email',
  },
]

async function main() {
  console.log('🚀 MCP Performance Benchmark\n')
  console.log('Environment:')
  console.log(`  Node.js: ${process.version}`)
  console.log(`  Platform: ${process.platform}`)
  console.log(`  Memory: ${Math.round(process.memoryUsage().heapTotal / 1024 / 1024)}MB\n`)

  // 1. JSON-RPC Message Processing Speed
  console.log('📊 1. JSON-RPC Message Processing Speed')
  const testMessages = createTestMessages(100)
  const memBefore = measureMemory()

  const startTime = performance.now()
  for (const message of testMessages) {
    await redactJsonRpcMessage(message, { registry })
  }
  const endTime = performance.now()

  const totalTime = endTime - startTime
  const avgTime = totalTime / testMessages.length
  const memAfter = measureMemory()
  const memUsed = memAfter.heapUsed - memBefore.heapUsed

  console.log(`  Messages processed: ${testMessages.length}`)
  console.log(`  Total time: ${formatTime(totalTime)}`)
  console.log(`  Average per message: ${formatTime(avgTime)}`)
  console.log(`  Throughput: ${formatThroughput(testMessages.length, totalTime)}`)
  console.log(`  Memory delta: ${(memUsed / 1024).toFixed(1)}KB\n`)

  // 2. NDJSON Stream Processing
  console.log('📊 2. NDJSON Stream Processing')
  const streamMessages = createTestMessages(1000)
  const ndjsonInput = createNDJSONStream(streamMessages)

  const streamStartTime = performance.now()
  const parsedMessages = parseJsonLines(ndjsonInput)
  let processedCount = 0

  for (const message of parsedMessages) {
    if (isValidJsonRpcMessage(message)) {
      await redactJsonRpcMessage(message, { registry })
      processedCount++
    }
  }
  const streamEndTime = performance.now()

  const streamTotalTime = streamEndTime - streamStartTime
  const streamAvgTime = streamTotalTime / processedCount

  console.log(`  Input size: ${(ndjsonInput.length / 1024).toFixed(1)}KB`)
  console.log(`  Messages parsed: ${parsedMessages.length}`)
  console.log(`  Messages processed: ${processedCount}`)
  console.log(`  Total time: ${formatTime(streamTotalTime)}`)
  console.log(`  Average per message: ${formatTime(streamAvgTime)}`)
  console.log(`  Throughput: ${formatThroughput(processedCount, streamTotalTime)}\n`)

  // 3. PII Detection Accuracy
  console.log('📊 3. PII Detection Accuracy')
  let correctDetections = 0
  const totalCases = detectionTestCases.length

  for (const testCase of detectionTestCases) {
    const message = JSON.parse(testCase.input)
    const redacted = await redactJsonRpcMessage(message, { registry })
    const redactedStr = JSON.stringify(redacted)

    const hasPIIMarkers = redactedStr.includes('[REDACTED:') || redactedStr.includes('TKN_')
    const detectedPII = hasPIIMarkers

    if (detectedPII === testCase.expectPII) {
      correctDetections++
    }

    console.log(
      `  ${testCase.expectPII ? '✓' : '○'} ${testCase.type}: ${detectedPII === testCase.expectPII ? 'PASS' : 'FAIL'}`,
    )
  }

  const accuracy = (correctDetections / totalCases) * 100
  console.log(`  Accuracy: ${correctDetections}/${totalCases} (${accuracy.toFixed(1)}%)\n`)

  // 4. Structure Preservation Test
  console.log('📊 4. Structure Preservation Test')
  let structurePreserved = 0
  const structureTestMessages = createTestMessages(20)

  for (const message of structureTestMessages) {
    try {
      const redacted = await redactJsonRpcMessage(message, { registry })

      // Check if basic JSON-RPC structure is preserved
      if (
        redacted.jsonrpc === '2.0' &&
        (redacted.method || redacted.result || redacted.error) &&
        redacted.id !== undefined
      ) {
        structurePreserved++
      }
    } catch (error) {
      console.log(`  ✗ Structure preservation failed: ${error.message}`)
    }
  }

  const preservationRate = (structurePreserved / structureTestMessages.length) * 100
  console.log(
    `  Structure preserved: ${structurePreserved}/${structureTestMessages.length} (${preservationRate.toFixed(1)}%)\n`,
  )

  // Summary
  console.log('📋 Summary Results:')
  console.log(`  • Processing Speed: ${formatTime(avgTime)} per message`)
  console.log(`  • Stream Throughput: ${formatThroughput(processedCount, streamTotalTime)}`)
  console.log(`  • PII Detection Accuracy: ${accuracy.toFixed(1)}%`)
  console.log(`  • Structure Preservation: ${preservationRate.toFixed(1)}%`)
  console.log(
    `  • Memory Efficiency: ${(memUsed / testMessages.length).toFixed(0)} bytes per message`,
  )

  console.log('\n✨ Benchmark completed successfully!')

  // Export results for documentation update
  return {
    processingSpeed: avgTime,
    throughput: (processedCount / streamTotalTime) * 1000,
    detectionAccuracy: accuracy,
    structurePreservation: preservationRate,
    memoryPerMessage: memUsed / testMessages.length,
  }
}

// Run benchmark
main().catch((error) => {
  console.error('❌ Benchmark failed:', error)
  process.exit(1)
})
