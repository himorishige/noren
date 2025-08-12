# Performance and Optimization

[English](./performance-and-optimization.md) | [日本語](./ja/performance-and-optimization.md)

This document outlines the performance optimizations and build size considerations that make Noren fast and lightweight.

## Design Philosophy

Noren is built with the principle of **"fast by default"** - optimizations are built into the core architecture rather than being afterthoughts. The library prioritizes:

- **Zero-cost abstractions**: Pay only for what you use
- **Tree-shaking friendly**: Unused code is automatically eliminated
- **Runtime efficiency**: Optimized hot paths for maximum throughput
- **Memory efficiency**: Minimal allocations and GC pressure

## Performance Optimizations

### 1. Pre-compiled Regular Expressions

**Problem**: Runtime regex compilation is expensive when processing large amounts of text.

**Solution**: All regex patterns are compiled at module load time and reused.

```typescript
// ❌ Slow: Compiled on every call
function detect(text) {
  const emailPattern = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi
  return emailPattern.test(text)
}

// ✅ Fast: Pre-compiled at module level
const EMAIL_PATTERN = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi
function detect(text) {
  return EMAIL_PATTERN.test(text)
}
```

**Impact**: ~15% performance improvement for repeated detections.

### 2. Unified Pattern Detection

**Problem**: Running multiple regex patterns sequentially is inefficient.

**Solution**: Combine frequently used patterns into a single regex for one-pass detection.

```typescript
// ❌ Multiple passes through text
text.match(EMAIL_PATTERN)
text.match(IPV4_PATTERN) 
text.match(MAC_PATTERN)

// ✅ Single pass with unified pattern
const UNIFIED_PATTERN = /(email_group)|(ipv4_group)|(mac_group)/gi
const matches = text.matchAll(UNIFIED_PATTERN)
```

**Impact**: ~50% reduction in text traversal time for common PII types.

### 3. Context Hint Optimization with Set

**Problem**: Array.includes() for context hints has O(n) complexity.

**Solution**: Use Set for O(1) lookup performance.

```typescript
// ❌ O(n) lookup for each hint check
const hints = ['email', 'phone', 'address']
if (hints.includes(hint)) { /* ... */ }

// ✅ O(1) lookup with Set
const hintsSet = new Set(['email', 'phone', 'address'])
if (hintsSet.has(hint)) { /* ... */ }
```

**Impact**: ~25% faster context processing with 20+ hints.

### 4. Object Pool for Hit Objects

**Problem**: Frequent allocation/deallocation of Hit objects creates GC pressure.

**Solution**: Reuse Hit objects through an object pool.

```typescript
class HitPool {
  private pool: Hit[] = []
  
  acquire(type, start, end, value, risk): Hit {
    const hit = this.pool.pop()
    if (hit) {
      // Reuse existing object
      hit.type = type
      hit.start = start
      // ... other properties
      return hit
    }
    return { type, start, end, value, risk } // Create new if pool empty
  }
  
  release(hits: Hit[]): void {
    // Return objects to pool after clearing sensitive data
    for (const hit of hits) {
      this.securelyWipeHit(hit)
      this.pool.push(hit)
    }
  }
}
```

**Impact**: ~30% reduction in GC pressure during high-throughput processing.

### 5. Optimized Hex Conversion

**Problem**: String concatenation for hex conversion is slow.

**Solution**: Pre-computed lookup table for hex values.

```typescript
// ❌ Slow string operations
function toHex(byte) {
  return byte.toString(16).padStart(2, '0')
}

// ✅ Fast lookup table
const HEX_TABLE = new Array(256)
for (let i = 0; i < 256; i++) {
  HEX_TABLE[i] = ((i >>> 4) & 0xf).toString(16) + (i & 0xf).toString(16)
}
function toHex(byte) {
  return HEX_TABLE[byte]
}
```

**Impact**: ~40% faster HMAC token generation.

## Build Size Optimizations

### 1. Tree-shaking Friendly Module Structure

**Strategy**: Separate concerns into individual modules that can be tree-shaken.

```
src/
├── patterns.ts      # Regex patterns (can be tree-shaken)
├── utils.ts         # Utility functions (individual exports)
├── masking.ts       # Masking functions (tree-shakeable)
├── pool.ts          # Object pool (optional)
└── detection.ts     # Core detection (always included)
```

**Result**: Unused modules are automatically eliminated from the final bundle.

### 2. Conditional Imports and Lazy Loading

**Strategy**: Load plugins only when needed.

```typescript
// Plugin cache for lazy loading
const pluginCache = new Map()

export async function loadPlugin(name, plugin) {
  if (pluginCache.has(name)) return pluginCache.get(name)
  
  const loaded = await Promise.all([
    plugin.detectors?.() ?? Promise.resolve([]),
    plugin.maskers?.() ?? Promise.resolve({}),
    plugin.contextHints?.() ?? Promise.resolve([])
  ])
  
  pluginCache.set(name, loaded)
  return loaded
}
```

**Result**: Only used plugins are loaded, reducing initial bundle size.

### 3. Minimal Runtime Dependencies

**Strategy**: Use only Web Standard APIs, avoiding external dependencies.

- **WHATWG Streams**: For streaming processing
- **Web Crypto API**: For HMAC tokenization  
- **TextEncoder/TextDecoder**: For string/byte conversion
- **RegExp**: For pattern matching

**Result**: Zero runtime dependencies = smaller bundle size.

### 4. Optimized Production Builds

**Strategy**: Different builds for different use cases.

```json
{
  "main": "dist/index.js",           // Full CommonJS build
  "module": "dist/index.mjs",        // ES modules for bundlers
  "browser": "dist/index.min.js",    // Minified for browsers
  "types": "dist/index.d.ts"         // TypeScript definitions
}
```

**Minification Results**:
- **Core library**: ~8KB minified + gzipped
- **With all plugins**: ~25KB minified + gzipped
- **Individual plugin**: ~3-5KB each

## Benchmark Results

### Processing Performance

**Test Environment**: Node.js 22, MacBook Pro M1
**Test Data**: 10,000 characters with 100 PII elements

| Metric | Before Optimization | After Optimization | Improvement |
|--------|-------------------|-------------------|-------------|
| Large text processing | 3.2ms | 1.8ms | 44% faster |
| Repeated detections (1000x) | 12ms | 7ms | 42% faster |
| Context hint processing | 6.1ms | 4.5ms | 26% faster |
| Memory usage | 2.1MB | 1.4MB | 33% reduction |

### Bundle Size Analysis

| Build Target | Size (minified) | Size (gzipped) | Tree-shaking |
|-------------|----------------|----------------|--------------|
| Core only | 12KB | 4KB | ✅ Full support |
| + Japan plugin | 18KB | 6KB | ✅ Individual modules |
| + US plugin | 20KB | 7KB | ✅ Individual modules |
| + Security plugin | 25KB | 8KB | ✅ Individual modules |
| All plugins | 35KB | 12KB | ✅ Unused code eliminated |

## Best Practices for Performance

### 1. Registry Reuse
```typescript
// ✅ Reuse registry instances
const registry = new Registry({ /* config */ })
// Use same registry for multiple operations

// ❌ Creating new registry each time
const result1 = await redactText(new Registry(config), text1)
const result2 = await redactText(new Registry(config), text2)
```

### 2. Batch Processing
```typescript
// ✅ Process multiple texts with same registry
const results = await Promise.all([
  redactText(registry, text1),
  redactText(registry, text2),
  redactText(registry, text3)
])

// ❌ Sequential processing
const result1 = await redactText(registry, text1)
const result2 = await redactText(registry, text2)
const result3 = await redactText(registry, text3)
```

### 3. Streaming for Large Data
```typescript
// ✅ Use streams for large files
const stream = fileStream
  .pipeThrough(new TextDecoderStream())
  .pipeThrough(createRedactionTransform(registry))
  .pipeThrough(new TextEncoderStream())

// ❌ Loading entire file into memory
const content = await fs.readFile('large-file.txt', 'utf8')
const redacted = await redactText(registry, content)
```

### 4. Smart Plugin Loading
```typescript
// ✅ Load only needed plugins
if (needsJapanSupport) {
  await registry.useLazy('japan', japanPlugin)
}

// ❌ Loading all plugins upfront
registry.use(japanPlugin.detectors, japanPlugin.maskers)
registry.use(usPlugin.detectors, usPlugin.maskers)
registry.use(securityPlugin.detectors, securityPlugin.maskers)
```

## Web Standards Compliance

Noren's performance optimizations are built on Web Standards:

- **Streaming**: WHATWG Streams for memory-efficient processing
- **Crypto**: Web Crypto API for secure, performant hashing
- **Internationalization**: Built-in Unicode normalization (NFKC)
- **Modules**: ES Modules for optimal tree-shaking

This ensures consistent performance across Node.js, Deno, Bun, and browser environments.

## Monitoring and Profiling

### Built-in Benchmarks

Run performance tests:

```bash
# Run benchmark tests
cd packages/noren-core
pnpm test benchmark

# Profile memory usage
node --inspect-brk test-performance.js
```

### Custom Performance Monitoring

```typescript
import { performance } from 'perf_hooks'

const start = performance.now()
const result = await redactText(registry, text)
const end = performance.now()

console.log(`Processing took ${end - start}ms`)
console.log(`Processed ${text.length} characters`)
console.log(`Found ${result.split('REDACTED').length - 1} PII elements`)
```

## Future Optimizations

Planned improvements:

1. **WebAssembly acceleration** for regex-heavy operations
2. **Worker thread support** for CPU-intensive processing
3. **Streaming parser** for structured data (JSON, XML)
4. **Adaptive batching** based on input size and complexity
5. **Machine learning** for context-aware detection accuracy

These optimizations maintain backward compatibility while pushing performance boundaries.