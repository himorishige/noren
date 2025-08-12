# Test Implementation Specifications

This document provides detailed specifications for implementing the identified test gaps across all Noren packages.

## Phase 1: Critical Security & Error Handling

### noren-core Error Handling Tests

#### 1. HMAC Key Validation Tests
**File**: `packages/noren-core/test/error-handling/hmac-validation.error.test.ts`

```typescript
describe('HMAC Key Validation', () => {
  it('should throw error for keys shorter than 32 characters', async () => {
    const shortKey = 'too-short-key'
    await assert.rejects(
      importHmacKey(shortKey),
      /HMAC key must be at least 32 characters long/
    )
  })

  it('should accept exactly 32 character keys', async () => {
    const validKey = 'a'.repeat(32)
    const key = await importHmacKey(validKey)
    assert.ok(key instanceof CryptoKey)
  })

  it('should accept keys longer than 32 characters', async () => {
    const longKey = 'a'.repeat(64)
    const key = await importHmacKey(longKey)
    assert.ok(key instanceof CryptoKey)
  })
})
```

#### 2. Tokenization Error Cases
**File**: `packages/noren-core/test/error-handling/tokenization.error.test.ts`

```typescript
describe('Tokenization Error Handling', () => {
  it('should throw error when hmacKey missing for tokenize action', async () => {
    const reg = new Registry({ 
      defaultAction: 'tokenize'
      // hmacKey intentionally missing
    })
    
    await assert.rejects(
      redactText(reg, 'Card: 4242 4242 4242 4242'),
      /hmacKey is required for tokenize action on type credit_card/
    )
  })

  it('should handle specific rule tokenize without global hmacKey', async () => {
    const reg = new Registry({
      defaultAction: 'mask',
      rules: {
        email: { action: 'tokenize' }
        // hmacKey missing
      }
    })
    
    await assert.rejects(
      redactText(reg, 'Email: test@example.com'),
      /hmacKey is required for tokenize action on type email/
    )
  })
})
```

#### 3. Pool Exhaustion & Resource Management
**File**: `packages/noren-core/test/error-handling/pool-management.error.test.ts`

```typescript
describe('Hit Pool Management', () => {
  it('should handle pool exhaustion gracefully', () => {
    // Test pool behavior under extreme load
    const hits = []
    for (let i = 0; i < 10000; i++) {
      hits.push(hitPool.acquire('email', 0, 10, `test${i}@example.com`, 'medium'))
    }
    
    // Verify pool can handle large allocation
    assert.equal(hits.length, 10000)
    
    // Release all hits
    hitPool.release(hits)
    
    // Verify pool state after release
    // (Implementation depends on pool internals)
  })

  it('should prevent memory leaks through proper cleanup', async () => {
    const reg = new Registry({ defaultAction: 'mask' })
    const initialMemory = process.memoryUsage()
    
    // Process large amount of data
    for (let i = 0; i < 1000; i++) {
      await redactText(reg, `Email: user${i}@example.com, Card: 4242 4242 4242 4242`)
    }
    
    // Force garbage collection if available
    if (global.gc) global.gc()
    
    const finalMemory = process.memoryUsage()
    const memoryGrowth = finalMemory.heapUsed - initialMemory.heapUsed
    
    // Memory growth should be reasonable (< 10MB for this test)
    assert.ok(memoryGrowth < 10 * 1024 * 1024)
  })
})
```

### Security Validation Tests

#### 4. Luhn Algorithm Edge Cases
**File**: `packages/noren-core/test/edge-cases/luhn-validation.edge.test.ts`

```typescript
describe('Credit Card Luhn Validation Edge Cases', () => {
  it('should reject cards failing Luhn check', async () => {
    const reg = new Registry({ defaultAction: 'mask' })
    
    // Invalid Luhn checksum
    const invalidCard = '4242 4242 4242 4243'
    const result = await redactText(reg, `Card: ${invalidCard}`)
    
    // Should not detect as credit card
    assert.ok(!result.includes('[REDACTED:credit_card]'))
    assert.ok(result.includes(invalidCard))
  })

  it('should accept valid Luhn checksums', async () => {
    const reg = new Registry({ defaultAction: 'mask' })
    
    const validCards = [
      '4242 4242 4242 4242', // Visa test
      '5555 5555 5555 4444', // Mastercard test
      '3782 8224 6310 005',  // American Express test
    ]

    for (const card of validCards) {
      const result = await redactText(reg, `Card: ${card}`)
      assert.ok(result.includes('[REDACTED:credit_card]'), `Failed for ${card}`)
    }
  })

  it('should handle non-numeric characters in potential card numbers', async () => {
    const reg = new Registry({ defaultAction: 'mask' })
    
    // Contains letters - should not be detected
    const notACard = '4242 4242 424A 4242'
    const result = await redactText(reg, `Code: ${notACard}`)
    
    assert.ok(!result.includes('[REDACTED:credit_card]'))
  })
})
```

## Phase 2: Core Logic & Edge Cases

### Pattern Detection Edge Cases

#### 5. IPv6 Complex Patterns
**File**: `packages/noren-core/test/edge-cases/ipv6-patterns.edge.test.ts`

```typescript
describe('IPv6 Pattern Detection Edge Cases', () => {
  const testCases = [
    // Compressed notation
    { input: 'Server at ::1 is localhost', expected: '::1' },
    { input: 'Connect to 2001:db8::1', expected: '2001:db8::1' },
    { input: 'Address ::ffff:192.0.2.1', expected: '::ffff:192.0.2.1' },
    
    // Full notation
    { input: 'IPv6: 2001:0db8:85a3:0000:0000:8a2e:0370:7334', expected: '2001:0db8:85a3:0000:0000:8a2e:0370:7334' },
    
    // Mixed compression
    { input: 'Host 2001:db8:85a3::8a2e:370:7334', expected: '2001:db8:85a3::8a2e:370:7334' },
  ]

  testCases.forEach(({ input, expected }) => {
    it(`should detect IPv6 in: "${input}"`, async () => {
      const reg = new Registry({ defaultAction: 'mask' })
      const result = await redactText(reg, input)
      
      assert.ok(!result.includes(expected), 'IPv6 should be masked')
      assert.ok(result.includes('[REDACTED:ipv6]'), 'Should contain IPv6 redaction marker')
    })
  })

  it('should not detect invalid IPv6 patterns', async () => {
    const reg = new Registry({ defaultAction: 'mask' })
    
    const invalidPatterns = [
      'Not IPv6: 2001:db8:85a3::8a2e::370:7334', // Double ::
      'Invalid: 2001:db8:85a3:gggg:0000:8a2e:0370:7334', // Invalid hex
      'Too long: 2001:db8:85a3:0000:0000:8a2e:0370:7334:extra', // Too many segments
    ]

    for (const pattern of invalidPatterns) {
      const result = await redactText(reg, pattern)
      assert.ok(!result.includes('[REDACTED:ipv6]'), `Should not detect: ${pattern}`)
    }
  })
})
```

#### 6. Hit Processing Complex Scenarios
**File**: `packages/noren-core/test/edge-cases/hit-processing.edge.test.ts`

```typescript
describe('Hit Processing Complex Scenarios', () => {
  it('should handle overlapping detections correctly', async () => {
    const reg = new Registry({ defaultAction: 'mask' })
    
    // This text might trigger multiple overlapping patterns
    const text = 'Contact john@192.168.1.1.example.com'
    const result = await redactText(reg, text)
    
    // Should prioritize email over IP (assuming email has higher priority)
    assert.ok(result.includes('[REDACTED:email]'))
    // Should not double-redact the same text
    assert.ok(!result.includes('[REDACTED:ipv4]') || !result.includes('[REDACTED:email]'))
  })

  it('should handle adjacent detections without gaps', async () => {
    const reg = new Registry({ defaultAction: 'mask' })
    
    const text = 'Email:test@example.com,IP:192.168.1.1'
    const result = await redactText(reg, text)
    
    // Should preserve separators
    assert.ok(result.includes('Email:'))
    assert.ok(result.includes(',IP:'))
    assert.ok(result.includes('[REDACTED:email]'))
    assert.ok(result.includes('[REDACTED:ipv4]'))
  })

  it('should handle empty context hints gracefully', async () => {
    const reg = new Registry({ 
      defaultAction: 'mask',
      contextHints: [] // Explicitly empty
    })
    
    const text = 'Phone: 123-456-7890'
    const result = await redactText(reg, text, { contextHints: [] })
    
    // Should still detect patterns that don't require context
    assert.ok(typeof result === 'string')
  })
})
```

## Phase 3: Integration & Advanced Scenarios

### Cross-Plugin Integration Tests
**File**: `packages/noren-core/test/integration/multi-plugin.integration.test.ts`

```typescript
describe('Multi-Plugin Integration', () => {
  it('should handle JP and US plugins together', async () => {
    const reg = new Registry({ defaultAction: 'mask' })
    
    // Load multiple plugins (simulated)
    reg.use(jpDetectors, jpMaskers, jpContextHints)
    reg.use(usDetectors, usMaskers, usContextHints)
    
    const mixedText = `
      US Phone: (415) 555-0123
      JP Phone: 03-1234-5678
      US ZIP: 94105
      JP Postal: 〒150-0001
    `
    
    const result = await redactText(reg, mixedText)
    
    // Should detect both US and JP patterns
    assert.ok(!result.includes('415'))  // US phone masked
    assert.ok(!result.includes('03-1234-5678'))  // JP phone masked
    assert.ok(!result.includes('94105'))  // US ZIP masked (with context)
    assert.ok(!result.includes('150-0001'))  // JP postal masked
  })

  it('should handle priority conflicts between plugins', async () => {
    // Test scenario where multiple plugins might detect the same pattern
    // but with different priorities or interpretations
  })
})
```

### Stream Processing Tests
**File**: `packages/noren-core/test/integration/stream-processing.integration.test.ts`

```typescript
describe('WHATWG Streams Integration', () => {
  it('should process data through TransformStream', async () => {
    const reg = new Registry({ defaultAction: 'mask' })
    
    // Create a transform stream for redaction
    const transformStream = new TransformStream({
      transform(chunk, controller) {
        // Process chunk through redactText
        redactText(reg, chunk.toString()).then(result => {
          controller.enqueue(result)
        })
      }
    })
    
    const input = 'Email: test@example.com, Card: 4242 4242 4242 4242'
    const readable = new ReadableStream({
      start(controller) {
        controller.enqueue(input)
        controller.close()
      }
    })
    
    const processedStream = readable.pipeThrough(transformStream)
    const reader = processedStream.getReader()
    const result = await reader.read()
    
    assert.ok(result.value.includes('[REDACTED:email]'))
    assert.ok(result.value.includes('[REDACTED:credit_card]'))
  })
})
```

## Implementation Guidelines

### Test Organization
- Each test file should focus on a single concern
- Use descriptive test names that explain the scenario
- Group related tests with `describe` blocks
- Include both positive and negative test cases

### Assertion Strategy
- Use `assert.rejects()` for expected errors
- Test both the error message and error type
- Verify state changes after operations
- Check for resource cleanup

### Performance Considerations
- Include timing assertions for critical paths
- Test memory usage patterns
- Verify no performance regression
- Use realistic data sizes

### Documentation Requirements
- Document complex test scenarios
- Include rationale for edge case selection
- Reference related issues or security concerns
- Maintain test coverage metrics

---

*This specification provides the foundation for systematic test implementation across all Noren packages.*