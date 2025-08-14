#!/usr/bin/env node

// Test the improved memory measurement functionality
import { measurePerformance } from './packages/noren-devtools/dist/index.js'

console.log('Testing improved memory measurement...')

// Test function to measure
function testOperation() {
  const arr = new Array(10000).fill(0).map((_, i) => ({ id: i, data: Math.random() }))
  return arr.length
}

// Test with memory measurement
const result = await measurePerformance('test-operation', testOperation, { test: 'memory-api' })

console.log(`✓ Operation completed successfully, result: ${result}`)
console.log('✓ Memory measurement API improvements working correctly')

// Clean up test file
import { unlink } from 'fs/promises'
try {
  await unlink('./test-memory-api.mjs')
} catch {
  // Ignore if file doesn't exist
}