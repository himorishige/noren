# Noren (暖簾)

[English](./README.md) | [日本語](./docs/ja/README.md)

A **fast**, **lightweight** PII (Personally Identifiable Information) masking and tokenization library built on **Web Standards**.

Noren (暖簾) protects sensitive data at your application's "edge". Like the Japanese "noren" (shop curtain) that provides privacy, Noren instantly masks PII and sensitive information before they reach your core system.

**🚀 Three Core Principles:**
- **⚡ FAST**: Pre-compiled patterns, optimized algorithms, sub-millisecond detection
- **🪶 LIGHTWEIGHT**: < 125KB bundle (65% smaller than v0.3.x), zero dependencies
- **✨ SIMPLE**: One-line setup, sensible defaults, minimal configuration needed

**Plus Modern Features:**
- **🌐 Universal**: Works everywhere (Node.js, Cloudflare Workers, Deno, Bun)
- **🎯 Smart**: Confidence scoring for precision control
- **🔌 Extensible**: Plugin architecture for regional/custom needs

> **Status: v0.4.0 Release**
> This release focuses on simplicity and performance. Advanced features are available in `@himorishige/noren-devtools`.

## ✨ Key Features

### 🚀 **Ultra-Fast & Lightweight**
- **< 125KB** bundled size - perfect for edge deployments
- **Pre-compiled patterns** for maximum performance
- **Optimized algorithms** handle large texts efficiently
- **Memory-safe** with object pooling and backpressure handling
- **77% code reduction** from v0.3.x for better maintainability

### 🎯 **Smart Detection**
- **Email addresses** with TLD validation
- **Credit cards** with Luhn algorithm validation
- **IP addresses** (IPv4 & IPv6) with proper parsing
- **Phone numbers** (E164 format)
- **Custom patterns** via plugin system

### 🌐 **Web Standards Only**
- **WHATWG Streams** for efficient data processing
- **Web Crypto API** for secure tokenization
- **Works everywhere**: Node.js, Cloudflare Workers, Deno, Bun
- **No dependencies** on specific runtimes

### 🔌 **Plugin Architecture**
- **Region-specific plugins**: Japan, US, more coming
- **Security plugins**: HTTP headers, API tokens, cookies
- **Custom dictionaries** with hot-reloading support
- **Development tools** for testing and benchmarking

## 🔌 Package Structure

| Package Name                             | Description                                                               |
| :--------------------------------------- | :----------------------------------------------------------------- |
| [`@himorishige/noren-core`](./packages/noren-core/README.md)                | 🎯 **Core library** - Fast PII detection, masking, and tokenization |
| [`@himorishige/noren-plugin-jp`](./packages/noren-plugin-jp/README.md)           | 🇯🇵 **Japan plugin** - Phone numbers, postal codes, My Number |
| [`@himorishige/noren-plugin-us`](./packages/noren-plugin-us/README.md)           | 🇺🇸 **US plugin** - Phone numbers, ZIP codes, SSNs |
| [`@himorishige/noren-plugin-security`](./packages/noren-plugin-security/README.md)     | 🛡️ **Security plugin** - HTTP headers, API tokens, cookies |
| [`@himorishige/noren-dict-reloader`](./packages/noren-dict-reloader/README.md)       | 🔄 **Dynamic reload** - ETag-based policy hot-reloading |
| [`@himorishige/noren-devtools`](./packages/noren-devtools/README.md)            | 🔧 **Development tools** - Benchmarking, A/B testing, evaluation |

## Requirements

*   Node.js **20.10+**

## 🚀 Quick Start

### 1. **Installation**
```bash
npm install @himorishige/noren-core
# Or with additional plugins
npm install @himorishige/noren-core @himorishige/noren-plugin-jp @himorishige/noren-plugin-security
```

### 2. **Basic Usage** (1-minute setup)
```typescript
import { Registry, redactText } from '@himorishige/noren-core'

// Create registry with simple configuration
const registry = new Registry({
  defaultAction: 'mask', // mask, remove, or tokenize
  environment: 'production' // handles test data exclusions automatically
})

// Process your text
const input = 'Email: john@example.com, Card: 4242-4242-4242-4242, IP: 192.168.1.1'
const result = await redactText(registry, input)

console.log(result)
// Output: Email: [REDACTED:email], Card: [REDACTED:credit_card], IP: [REDACTED:ipv4]
```

### 3. **With Regional Plugins**
```typescript
import { Registry, redactText } from '@himorishige/noren-core'
import * as jpPlugin from '@himorishige/noren-plugin-jp'
import * as securityPlugin from '@himorishige/noren-plugin-security'

const registry = new Registry({
  defaultAction: 'mask',
  enableConfidenceScoring: true, // Enhanced accuracy
  rules: {
    credit_card: { action: 'mask', preserveLast4: true },
    jp_my_number: { action: 'remove' }
  }
})

// Add plugins
registry.use(jpPlugin.detectors, jpPlugin.maskers)
registry.use(securityPlugin.detectors, securityPlugin.maskers)

const input = '〒150-0001 カード: 4242-4242-4242-4242 Bearer: eyJ0eXAiOiJKV1Q...'
const result = await redactText(registry, input)
// Output: 〒•••-•••• カード: **** **** **** 4242 Bearer: [REDACTED:AUTH]
```

### 4. **Tokenization** (Advanced)

```typescript
const registry = new Registry({
  defaultAction: 'tokenize',
  hmacKey: 'your-secure-32-character-key-here-123456' // Min 32 chars in v0.4.0
})

const input = 'User email: alice@company.com'
const result = await redactText(registry, input)
// Output: User email: TKN_EMAIL_AbC123XyZ...

// Tokens are consistent - same input produces same token
const sameResult = await redactText(registry, input)
// Both results will have identical tokens
```

### 5. **Stream Processing** (Large Data)
```typescript
import { createRedactionTransform } from '@himorishige/noren-core'

const registry = new Registry({ defaultAction: 'mask' })
const transform = createRedactionTransform(registry)

// Use with any ReadableStream
const stream = new ReadableStream({
  start(controller) {
    controller.enqueue('Data with email@example.com and more...')
    controller.close()
  }
})

const redactedStream = stream.pipeThrough(transform)
```

## 💡 Use Cases

### 🎯 **Common Scenarios**
- **API Logs**: Remove PII from API request/response logs
- **Customer Support**: Mask sensitive data in support tickets
- **Data Analysis**: Anonymize datasets while preserving structure
- **Compliance**: Meet GDPR, CCPA, and other privacy regulations

### 🚀 **Edge Deployments**
Perfect for serverless and edge computing:
- **Cloudflare Workers**: Process data at the edge
- **Vercel Functions**: Serverless PII protection
- **AWS Lambda**: Lightweight runtime footprint
- **Deno Deploy**: Native Web Standards support

## 🔧 Advanced Configuration

### Environment-Aware Processing
```typescript
const registry = new Registry({
  environment: 'development', // Excludes test patterns automatically
  allowDenyConfig: {
    allowList: ['test@company.com'], // Custom exclusions
    denyList: []  // Force detection
  }
})
```

### Plugin Development
```typescript
// Create custom detectors
const myDetector: Detector = {
  id: 'custom.ssn',
  match: ({ src, push }) => {
    // Your detection logic
  }
}

registry.use([myDetector], { ssn: (hit) => '***-**-****' })
```

## 📚 Documentation & Examples

### 📖 **Package Documentation**
- **[@himorishige/noren-core](./packages/noren-core/README.md)**: Core library documentation
- **[@himorishige/noren-devtools](./packages/noren-devtools/README.md)**: Development tools and advanced features
- **Plugin packages**: See individual package READMEs for specific plugin documentation

### 🎯 **Examples**
- **[Basic Usage](./examples/basic-redact.mjs)**: Simple PII redaction
- **[Tokenization](./examples/tokenize.mjs)**: HMAC-based tokenization
- **[Stream Processing](./examples/stream-redact.mjs)**: Large file processing
- **[Security Plugin](./examples/security-demo.mjs)**: HTTP headers and tokens
- **[Web Server](./examples/hono-server.mjs)**: Integration with Hono framework

## ⚡ Performance & Benchmarks

### 📊 **Benchmarks** (v0.4.0)
- **Bundle Size**: < 125KB (65% reduction from v0.3.0)
- **Memory Usage**: < 10MB for 1M characters
- **Processing Speed**: > 1MB/s on typical hardware
- **Startup Time**: < 5ms cold start

### 🔬 **Testing & Development**
```bash
# Run benchmarks (requires @himorishige/noren-devtools)
npm install @himorishige/noren-devtools
node examples/benchmark-demo.mjs
```

## 🤝 Contributing & Support

### 🐛 **Issues & Questions**
- **GitHub Issues**: [Report bugs or request features](https://github.com/himorishige/noren/issues)
- **Discussions**: [Ask questions and share ideas](https://github.com/himorishige/noren/discussions)

### 🔄 **Upgrade Guide**
Migrating from v0.3.x? See our **[Migration Guide](./docs/migration-guide-ja.md)** for breaking changes and update instructions.

## Disclaimer

This software is provided "AS IS", without warranty of any kind. There is a possibility of missed detections or false positives. Users are responsible for verifying the final output and ensuring compliance with all applicable laws and regulations. No information in this repository constitutes legal advice.

## 📄 **License**
MIT License - see [LICENSE](./LICENSE) for details.

---

**Made with ❤️ for privacy-first development**

