# Noren (暖簾)

[English](./README.md) | [日本語](./docs/ja/README.md)

A **fast**, **lightweight** PII (Personally Identifiable Information) masking and tokenization library built on **Web Standards**.

Noren (暖簾) protects sensitive data at your application's "edge". Like the Japanese "noren" (shop curtain) that provides privacy, Noren instantly masks PII and sensitive information before they reach your core system.

**🚀 Three Core Principles:**
- **⚡ FAST**: Pre-compiled patterns, optimized algorithms, sub-millisecond detection
- **🪶 LIGHTWEIGHT**: 124KB bundle (77% code reduction), zero dependencies
- **✨ SIMPLE**: One-line setup, sensible defaults, minimal configuration needed

**Plus Modern Features:**
- **🌐 Universal**: Works everywhere (Node.js, Cloudflare Workers, Deno, Bun)
- **🎯 Smart**: Confidence scoring and JSON/NDJSON support
- **🔌 Extensible**: Plugin architecture for regional/custom needs
- **🔒 Enhanced Security**: 70%+ detection rate for security tokens

> **Status: v0.6.0 Release**
> This release introduces plugin architecture modularity: Network PII detection (IPv4/IPv6/MAC) has been moved to a dedicated plugin for better maintainability and customization.

## ✨ Key Features

### 🚀 **Ultra-Fast & Lightweight**
- **124KB** bundled size - perfect for edge deployments
- **Pre-compiled patterns** for maximum performance
- **Optimized algorithms** handle large texts efficiently
- **Memory-safe** with object pooling and backpressure handling
- **102K+ operations/second** with optimized single-pass detection

### 🎯 **Smart Detection**
- **Email addresses** with TLD validation
- **Credit cards** with Luhn algorithm validation
- **Phone numbers** (E164 format)
- **JSON/NDJSON data** with key-based context detection
- **Security tokens** (GitHub, AWS, Stripe, Slack, OpenAI, etc.)
- **IP addresses** (IPv4 & IPv6) via network plugin
- **Custom patterns** via plugin system

### 🌐 **Web Standards Only**
- **WHATWG Streams** for efficient data processing
- **Web Crypto API** for secure tokenization
- **Works everywhere**: Node.js, Cloudflare Workers, Deno, Bun
- **No dependencies** on specific runtimes

### 🔌 **Plugin Architecture**
- **Region-specific plugins**: Japan, US, more coming
- **Security plugins**: 11 new token types with 70%+ detection rate
- **JSON detection**: Structured data with path tracking
- **Custom dictionaries** with hot-reloading support
- **Development tools** for testing and benchmarking

## 🔌 Package Structure

| Package Name                             | Description                                                               |
| :--------------------------------------- | :----------------------------------------------------------------- |
| [`@himorishige/noren-core`](./packages/noren-core/README.md)                | 🎯 **Core library** - Fast PII detection, masking, and tokenization |
| [`@himorishige/noren-plugin-jp`](./packages/noren-plugin-jp/README.md)           | 🇯🇵 **Japan plugin** - Phone numbers, postal codes, My Number |
| [`@himorishige/noren-plugin-us`](./packages/noren-plugin-us/README.md)           | 🇺🇸 **US plugin** - Phone numbers, ZIP codes, SSNs |
| [`@himorishige/noren-plugin-network`](./packages/noren-plugin-network/README.md)     | 🌐 **Network plugin** - IPv4, IPv6, MAC addresses |
| [`@himorishige/noren-plugin-security`](./packages/noren-plugin-security/README.md)     | 🛡️ **Security plugin** - HTTP headers, API tokens, cookies |
| [`@himorishige/noren-dict-reloader`](./packages/noren-dict-reloader/README.md)       | 🔄 **Dynamic reload** - ETag-based policy hot-reloading |
| [`@himorishige/noren-devtools`](./packages/noren-devtools/README.md)            | 🔧 **Development tools** - Benchmarking, evaluation, metrics |

## Requirements

*   Node.js **20.10+**

## 🚀 Quick Start

### 1. **Installation**
```bash
npm install @himorishige/noren-core
# Or with additional plugins
npm install @himorishige/noren-core @himorishige/noren-plugin-jp @himorishige/noren-plugin-security @himorishige/noren-plugin-network
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
const input = 'Email: john@example.com, Card: 4242-4242-4242-4242, Phone: 090-1234-5678'
const result = await redactText(registry, input)

console.log(result)
// Output: Email: [REDACTED:email], Card: [REDACTED:credit_card], Phone: [REDACTED:phone_e164]
```

### 3. **With Regional Plugins**
```typescript
import { Registry, redactText } from '@himorishige/noren-core'
import * as jpPlugin from '@himorishige/noren-plugin-jp'
import * as securityPlugin from '@himorishige/noren-plugin-security'
import * as networkPlugin from '@himorishige/noren-plugin-network'

const registry = new Registry({
  defaultAction: 'mask',
  enableConfidenceScoring: true, // Enhanced accuracy
  enableJsonDetection: true,      // New in v0.5.0+
  rules: {
    credit_card: { action: 'mask', preserveLast4: true },
    mynumber_jp: { action: 'remove' } // v0.5.0: Updated PII type naming
  }
})

// Add plugins
registry.use(jpPlugin.detectors, jpPlugin.maskers)
registry.use(securityPlugin.detectors, securityPlugin.maskers)
registry.use(networkPlugin.detectors, networkPlugin.maskers)

const input = '〒150-0001 カード: 4242-4242-4242-4242 IP: 192.168.1.1 GitHub: ghp_1234567890abcdef'
const result = await redactText(registry, input)
// Output: 〒•••-•••• カード: **** **** **** 4242 IP: [REDACTED:ipv4] GitHub: ghp_********
```

### 4. **Tokenization** (Advanced)

```typescript
const registry = new Registry({
  defaultAction: 'tokenize',
  hmacKey: 'your-secure-32-character-key-here-123456' // Min 32 chars required
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

### Data Types & Object Processing

Noren processes **text strings only**. Objects and arrays must be converted to strings before processing:

```typescript
import { Registry, redactText } from '@himorishige/noren-core'

const registry = new Registry({ defaultAction: 'mask' })

// ❌ This will fail - objects not supported
const badExample = { email: 'user@example.com' }
// await redactText(registry, badExample) // Error: s.normalize is not a function

// ✅ Convert to JSON string first (v0.5.0+ includes native JSON detection)
const registry = new Registry({ 
  defaultAction: 'mask',
  enableJsonDetection: true // Enhanced JSON processing
})

const jsonString = JSON.stringify({ email: 'user@example.com', phone: '090-1234-5678' })
const result = await redactText(registry, jsonString)
// Output: {"email":"[REDACTED:email]","phone":"•••-••••-••••"}
// With JSON detection: enhanced accuracy using key names as context

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
const fullWidthInput = 'メール: ｕｓｅｒ@ｅｘａｍｐｌｅ.ｃｏｍ 電話: ０９０-１２３４-５６７８'
const result = await redactText(registry, fullWidthInput)
// Output: メ-ル: [REDACTED:email] 電話: •••-••••-••••

// Detection works the same as half-width equivalents
const halfWidthInput = 'メール: user@example.com 電話: 090-1234-5678'  
const sameResult = await redactText(registry, halfWidthInput)
// Both inputs produce equivalent masking results
```

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

### 📊 **Benchmarks** (v0.5.0)
- **Bundle Size**: 124KB optimized distribution
- **Processing Speed**: 102,229 operations/second (0.0098ms per iteration)
- **Memory Efficiency**: Object pooling with automatic cleanup
- **Code Reduction**: 77% smaller codebase (1,782 lines)
- **API Surface**: 65% fewer exports for better tree-shaking

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

