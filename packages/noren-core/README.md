# @himorishige/noren-core

[![npm version](https://img.shields.io/npm/v/@himorishige/noren-core.svg)](https://www.npmjs.com/package/@himorishige/noren-core)
[![Bundle Size](https://img.shields.io/bundlephobia/minzip/@himorishige/noren-core.svg)](https://bundlephobia.com/package/@himorishige/noren-core)

**Fast, lightweight PII detection and masking library built on Web Standards**

The core library of the Noren PII protection suite - designed for **simplicity**, **performance**, and **universal compatibility**.

## ✨ Key Features

- 🚀 **Ultra-lightweight**: 124KB bundled size (77% code reduction)
- ⚡ **High performance**: 102K+ ops/sec with pre-compiled patterns
- 🌐 **Web Standards**: Works everywhere (Node.js, Edge, Browsers)
- 🎯 **Smart detection**: Built-in patterns with confidence scoring
- 📊 **JSON/NDJSON Support**: Native structured data detection with key-based matching
- ⚡ **Prefilter optimization**: Fast screening before expensive regex operations
- 🔒 **Enhanced security**: HMAC-based tokenization with 32-char minimum key
- 📦 **Zero dependencies**: Pure JavaScript, no external deps
- 🎚️ **Confidence scoring**: Rule-based detection accuracy control

## 🚀 Installation

```bash
npm install @himorishige/noren-core
```

## 📖 Quick Start

### Basic Usage

```typescript
import { Registry, redactText } from '@himorishige/noren-core'

// Create registry with default settings
const registry = new Registry({
  defaultAction: 'mask'
})

// Detect and mask PII
const input = 'Contact: john@example.com, Card: 4242-4242-4242-4242'
const result = await redactText(registry, input)

console.log(result)
// Output: Contact: [REDACTED:email], Card: [REDACTED:credit_card]
```

### With Custom Rules

```typescript
const registry = new Registry({
  defaultAction: 'mask',
  enableConfidenceScoring: true, // New in v0.4.0+
  enableJsonDetection: true,      // New in v0.5.0+ for structured data
  environment: 'production',       // Smart defaults for production
  rules: {
    email: { action: 'mask' },
    credit_card: { action: 'mask', preserveLast4: true },
    ipv4: { action: 'remove' }
  }
})

const input = 'Email: user@company.com, Card: 4242-4242-4242-4242, IP: 192.168.1.1'
const result = await redactText(registry, input)
// Output: Email: [REDACTED:email], Card: **** **** **** 4242, IP:
```

### Tokenization

```typescript
const registry = new Registry({
  defaultAction: 'tokenize',
  hmacKey: 'your-secure-32-character-key-here-123456' // Min 32 chars required
})

const input = 'User: alice@company.com'
const result = await redactText(registry, input)
// Output: User: TKN_EMAIL_AbC123XyZ...

// Same input always produces same token
const sameResult = await redactText(registry, input)
// Tokens will be identical
```

## 🎯 Supported PII Types

| Type | Pattern | Example | Enhanced in v0.5.0 |
|------|---------|---------|--------------------|
| `mac` | MAC addresses | `00:11:22:33:44:55` | ✓ Boundary detection |
| `email` | Email addresses | `john@example.com` | ✓ Unicode support |
| `credit_card` | Credit card numbers (Luhn validated) | `4242-4242-4242-4242` | ✓ Stricter boundaries |
| `ipv4` | IPv4 addresses | `192.168.1.1` | - |
| `ipv6` | IPv6 addresses | `2001:db8::1` | ✓ Enhanced parser |
| `phone_e164` | International phone numbers | `+1-555-123-4567` | - |

## 📊 Stream Processing

For large data processing:

```typescript
import { createRedactionTransform } from '@himorishige/noren-core'

const registry = new Registry({ defaultAction: 'mask' })
const transform = createRedactionTransform(registry)

// Process any ReadableStream
const inputStream = new ReadableStream({
  start(controller) {
    controller.enqueue('Data with john@example.com...')
    controller.enqueue('More data with 4242-4242-4242-4242...')
    controller.close()
  }
})

const outputStream = inputStream.pipeThrough(transform)

// Collect results
const reader = outputStream.getReader()
const chunks = []
let done = false

while (!done) {
  const { value, done: readerDone } = await reader.read()
  done = readerDone
  if (value) chunks.push(value)
}

console.log(chunks.join(''))
// Output: Data with [REDACTED:email]...More data with [REDACTED:credit_card]...
```

## 🔧 Advanced Configuration

### Data Types & Object Processing

Noren processes **text strings only**. Objects and arrays must be converted to strings before processing:

```typescript
import { Registry, redactText } from '@himorishige/noren-core'

const registry = new Registry({ defaultAction: 'mask' })

// ❌ This will fail - objects not supported
const badExample = { email: 'user@example.com' }
// await redactText(registry, badExample) // Error: s.normalize is not a function

// ✅ Convert to JSON string first  
const jsonString = JSON.stringify({ email: 'user@example.com', phone: '090-1234-5678' })
const result = await redactText(registry, jsonString)
// Output: {"email":"[REDACTED:email]","phone":"•••-••••-••••"}

// ✅ Custom object processing helper
async function redactObject(registry, obj, options = {}) {
  if (typeof obj === 'string') {
    return await redactText(registry, obj, options)
  }
  
  if (Array.isArray(obj)) {
    const results = []
    for (const item of obj) {
      results.push(await redactObject(registry, item, options))
    }
    return results
  }
  
  if (obj && typeof obj === 'object') {
    const result = {}
    for (const [key, value] of Object.entries(obj)) {
      result[key] = await redactObject(registry, value, options)
    }
    return result
  }
  
  return obj // numbers, booleans, etc. returned as-is
}

// Process complex nested structures
const complexData = {
  user: { email: 'user@example.com', phones: ['090-1111-2222', '03-3333-4444'] },
  messages: ['Contact: admin@company.com', 'Phone: 080-5555-6666']
}

const redacted = await redactObject(registry, complexData, {
  hmacKey: 'your-secure-32-character-key-here-123456'
})
// Output: Nested objects with PII properly masked in string values only
```

### Full-Width Character Support

Noren automatically handles full-width (zenkaku) characters through Unicode NFKC normalization:

```typescript
const registry = new Registry({ defaultAction: 'mask' })

// Full-width characters are automatically normalized before processing
const fullWidthInput = 'Email: ｕｓｅｒ@ｅｘａｍｐｌｅ.ｃｏｍ Phone: ０９０-１２３４-５６７８'
const result = await redactText(registry, fullWidthInput)
// Output: Email: [REDACTED:email] Phone: •••-••••-••••

// Detection works the same as half-width equivalents
const halfWidthInput = 'Email: user@example.com Phone: 090-1234-5678'  
const sameResult = await redactText(registry, halfWidthInput)
// Both inputs produce equivalent masking results
```

### Environment-Aware Processing

```typescript
const registry = new Registry({
  environment: 'development', // Automatically excludes test patterns
  allowDenyConfig: {
    allowList: ['test@company.com'], // Never treat as PII
    denyList: ['admin@'] // Always treat as PII
  }
})
```

### Performance Tuning

```typescript
const registry = new Registry({
  enableConfidenceScoring: false, // Disable for maximum performance
  sensitivity: 'relaxed' // Less aggressive detection
})
```

## 🌐 Plugin System

Extend functionality with plugins:

```typescript
// Use region-specific plugins
import * as jpPlugin from '@himorishige/noren-plugin-jp'
import * as securityPlugin from '@himorishige/noren-plugin-security'

const registry = new Registry({ defaultAction: 'mask' })

// Add Japanese PII detection
registry.use(jpPlugin.detectors, jpPlugin.maskers)

// Add security token detection
registry.use(securityPlugin.detectors, securityPlugin.maskers)
```

### Available Plugins

- **[@himorishige/noren-plugin-jp](../noren-plugin-jp)**: Japanese phone numbers, postal codes, My Number
- **[@himorishige/noren-plugin-us](../noren-plugin-us)**: US phone numbers, ZIP codes, SSNs
- **[@himorishige/noren-plugin-security](../noren-plugin-security)**: HTTP headers, API tokens, cookies
- **[@himorishige/noren-dict-reloader](../noren-dict-reloader)**: Dynamic policy reloading

## 📊 JSON/Structured Data Processing

Noren v0.5.0+ includes native support for JSON and NDJSON (newline-delimited JSON) processing:

```typescript
const registry = new Registry({
  defaultAction: 'mask',
  enableJsonDetection: true // Enable structured data processing
})

// JSON object detection
const jsonInput = JSON.stringify({
  user: {
    email: 'admin@company.com',
    phone: '+1-555-123-4567',
    address: {
      ip: '192.168.1.100'
    }
  }
})

const result = await redactText(registry, jsonInput)
// Detects PII within JSON structure and provides path information

// NDJSON processing
const ndjsonInput = [
  JSON.stringify({ id: 1, email: 'user1@example.com' }),
  JSON.stringify({ id: 2, email: 'user2@example.com' })
].join('\n')

const ndjsonResult = await redactText(registry, ndjsonInput)
// Processes each JSON line independently
```

### JSON Detection Features

- **Key-based detection**: Enhanced accuracy using JSON key names as context
- **Path tracking**: Provides full JSON path for detected PII (e.g., `$.user.email`)
- **Nested objects**: Recursive detection in deeply nested structures
- **NDJSON support**: Line-by-line processing for streaming data
- **Type safety**: Validates JSON structure before processing

## 📚 API Reference

### `Registry`

Main class for PII detection and configuration.

#### Constructor Options

```typescript
interface RegistryOptions {
  defaultAction?: 'mask' | 'remove' | 'tokenize'
  rules?: Record<string, { action: Action, preserveLast4?: boolean }>
  hmacKey?: string // Required for tokenization
  environment?: 'production' | 'development' | 'test'
  allowDenyConfig?: AllowDenyConfig
  enableConfidenceScoring?: boolean
  enableJsonDetection?: boolean // New: Enable JSON/NDJSON processing
  sensitivity?: 'strict' | 'balanced' | 'relaxed'
  contextHints?: string[] // Keywords to improve detection
}
```

#### Methods

- `use(detectors, maskers, contextHints?)`: Add plugins
- `detect(text, contextHints?)`: Detect PII (returns hits)
- `maskerFor(type)`: Get masker for PII type

### `redactText(registry, input, overrides?)`

Process text and apply redaction rules.

### `createRedactionTransform(registry, overrides?)`

Create transform stream for large data processing.

## ⚡ Performance

### Benchmarks (v0.5.0)

- **Bundle Size**: 124KB optimized distribution
- **Processing Speed**: 102,229 operations/second (0.0098ms per iteration)
- **Memory Efficiency**: Object pooling with automatic cleanup
- **TypeScript Codebase**: 1,782 lines (40%+ reduction from v0.4.x)
- **API Surface**: 14 exports (65% reduction for better tree-shaking)

### Best Practices

1. **Reuse Registry instances** - avoid creating new ones frequently
2. **Use streams** for large data processing
3. **Disable confidence scoring** for maximum performance
4. **Pre-compile patterns** by loading plugins at startup

## 🔒 Security Considerations

### HMAC Keys

- **Minimum 32 characters** required (enforced in v0.5.0)
- Store in environment variables, never in code
- Use different keys per environment
- Rotate keys regularly
- Base64URL token format for better security

### Memory Safety

- Automatic object pooling reduces GC pressure
- Sensitive data is cleared from memory after processing
- Configurable limits prevent DoS attacks

## 🛠 Development Tools

For advanced features like benchmarking and A/B testing:

```bash
npm install @himorishige/noren-devtools
```

See [@himorishige/noren-devtools](../noren-devtools) for development and testing tools.

## 🔄 Version History

### v0.5.0 (Latest) - Performance & Structured Data Support
- **JSON/NDJSON detection**: Native support for structured data with key-based matching
- **Prefilter optimization**: Fast screening reduces processing time for non-PII text
- **77% code reduction**: Streamlined from 8,153 to 1,782 lines
- **Single-pass detection**: Unified pattern matching for better performance
- **Optimized IPv6 parser**: 31% size reduction with enhanced validation
- **Streamlined Hit Pool**: 47% size reduction with object pooling
- **Reduced API surface**: 65% fewer exports for better tree-shaking
- **Enhanced security**: Stricter boundaries and improved validation
- **Code quality improvements**: Full TypeScript strict mode compliance

### v0.4.0 - Confidence Scoring & Advanced Features
- Added confidence scoring system
- Environment-aware processing
- Enhanced HMAC security with 32-character minimum
- Development tools package separation

## 📄 License

MIT License - see [LICENSE](../../LICENSE) for details.

---

**Part of the [Noren](../../README.md) PII protection suite**
