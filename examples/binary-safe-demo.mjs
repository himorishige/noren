import { Registry, createRedactionTransform } from '../packages/noren-core/dist/index.js'
import * as jp from '../packages/noren-plugin-jp/dist/noren-plugin-jp/src/index.js'
import * as us from '../packages/noren-plugin-us/dist/noren-plugin-us/src/index.js'

// Create registry
const reg = new Registry({
  defaultAction: 'mask',
  rules: {
    credit_card: { action: 'mask', preserveLast4: true },
    jp_my_number: { action: 'remove' },
  },
  contextHints: ['TEL', '電話', '〒', '住所', 'Zip', 'Address', 'SSN', 'Social Security'],
})
reg.use(jp.detectors, jp.maskers, ['〒', '住所', 'TEL', 'Phone'])
reg.use(us.detectors, us.maskers, ['Zip', 'Address', 'SSN', 'Phone'])

console.log('🧪 Noren Binary-Safe Stream Demo')
console.log('Testing mixed text and binary data processing...\n')

// Create test data with binary and text mixed
const testData = [
  // Text chunk with PII
  new TextEncoder().encode('Customer: John Doe\nSSN: 123-45-6789\nCard: 4242 4242 4242 4242\n'),
  
  // Binary chunk (fake PNG header + some binary data)
  new Uint8Array([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D]),
  
  // More text with PII
  new TextEncoder().encode('〒150-0001 東京都渋谷区神南 TEL: 090-1234-5678\n'),
  
  // Another binary chunk (with null bytes)
  new Uint8Array([0x00, 0xFF, 0x00, 0xFF, 0xDE, 0xAD, 0xBE, 0xEF]),
  
  // Final text chunk
  new TextEncoder().encode('Email: test@example.com\n'),
]

// Create readable stream from test data
const readable = new ReadableStream({
  start(controller) {
    for (const chunk of testData) {
      controller.enqueue(chunk)
    }
    controller.close()
  }
})

// Create transform with binary safety
const transform = createRedactionTransform(reg, {
  window: 64,
  policy: {
    hmacKey: 'development-secret-key-for-binary-demo-test',
  }
})

// Process through transform and collect output
const chunks = []
const writable = new WritableStream({
  write(chunk) {
    chunks.push(chunk)
  }
})

try {
  await readable.pipeThrough(transform).pipeTo(writable)
  
  console.log('✅ Processing completed successfully!\n')
  
  // Display results
  console.log('📤 Output chunks:')
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i]
    console.log(`Chunk ${i + 1}: ${chunk.length} bytes`)
    
    // Try to decode as text, but handle binary gracefully
    try {
      const text = new TextDecoder().decode(chunk)
      // Check if it contains null bytes (likely binary)
      if (text.includes('\0') || /[\x00-\x08\x0E-\x1F\x7F-\x9F]/.test(text)) {
        console.log(`  Type: Binary (hex: ${Array.from(chunk).map(b => b.toString(16).padStart(2, '0')).join(' ')})`)
      } else {
        console.log(`  Type: Text`)
        console.log(`  Content: ${JSON.stringify(text)}`)
      }
    } catch (e) {
      console.log(`  Type: Binary (hex: ${Array.from(chunk).map(b => b.toString(16).padStart(2, '0')).join(' ')})`)
    }
    console.log()
  }
  
  // Reconstruct and verify integrity
  const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0)
  const result = new Uint8Array(totalLength)
  let offset = 0
  for (const chunk of chunks) {
    result.set(chunk, offset)
    offset += chunk.length
  }
  
  console.log(`📊 Total output: ${totalLength} bytes`)
  console.log('🔍 Binary chunks should be preserved exactly, text chunks should have PII redacted')
  
} catch (error) {
  console.error('❌ Processing failed:', error)
}