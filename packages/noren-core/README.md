# @himorishige/noren-core

[![npm version](https://img.shields.io/npm/v/@himorishige/noren-core.svg)](https://www.npmjs.com/package/@himorishige/noren-core)
[![Bundle Size](https://img.shields.io/bundlephobia/minzip/@himorishige/noren-core.svg)](https://bundlephobia.com/package/@himorishige/noren-core)

**Fast, lightweight PII detection and masking library built on Web Standards**

The core library of the Noren PII protection suite - designed for **simplicity**, **performance**, and **universal compatibility**.

## ✨ Key Features

- 🚀 **Ultra-lightweight**: < 125KB bundled size (65% smaller than v0.3.x)
- ⚡ **High performance**: Pre-compiled patterns and optimized algorithms
- 🌐 **Web Standards**: Works everywhere (Node.js, Edge, Browsers)
- 🎯 **Smart detection**: Built-in patterns with confidence scoring
- 🔒 **Enhanced security**: HMAC-based tokenization with 32-char key requirement
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
  enableConfidenceScoring: true, // New in v0.4.0
  environment: 'production',       // Automatic smart defaults
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
  hmacKey: 'your-secure-32-character-key-here-123456' // Min 32 chars in v0.4.0
})

const input = 'User: alice@company.com'
const result = await redactText(registry, input)
// Output: User: TKN_EMAIL_AbC123XyZ...

// Same input always produces same token
const sameResult = await redactText(registry, input)
// Tokens will be identical
```

## 🎯 Supported PII Types

| Type | Pattern | Example |
|------|---------|---------|
| `email` | Email addresses | `john@example.com` |
| `credit_card` | Credit card numbers (with Luhn validation) | `4242-4242-4242-4242` |
| `ipv4` | IPv4 addresses | `192.168.1.1` |
| `ipv6` | IPv6 addresses | `2001:db8::1` |
| `phone_e164` | International phone numbers | `+1-555-123-4567` |

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

### Benchmarks (v0.4.0)

- **Bundle Size**: 95KB minified + gzipped
- **Memory Usage**: ~8MB for processing 1M characters
- **Throughput**: >1MB/s on typical hardware
- **Startup**: <5ms initialization time

### Best Practices

1. **Reuse Registry instances** - avoid creating new ones frequently
2. **Use streams** for large data processing
3. **Disable confidence scoring** for maximum performance
4. **Pre-compile patterns** by loading plugins at startup

## 🔒 Security Considerations

### HMAC Keys

- Use **minimum 16 characters** (32+ recommended)
- Store in environment variables, never in code
- Use different keys per environment
- Rotate keys regularly

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

## 📄 License

MIT License - see [LICENSE](../../LICENSE) for details.

---

**Part of the [Noren](../../README.md) PII protection suite**
