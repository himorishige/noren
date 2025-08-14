# API Reference

*v0.5.0 - Lightweight optimized edition*

## Core Classes

### Registry

The main class for PII detection and redaction configuration.

#### Constructor

```typescript
new Registry(options: RegistryOptions)
```

**RegistryOptions** (extends Policy):

| Property | Type | Description |
|----------|------|-------------|
| `defaultAction` | `'mask' \| 'remove' \| 'tokenize' \| 'ignore'` | Default action for detected PII |
| `environment` | `'production' \| 'test' \| 'development'` | Environment-specific behavior |
| `allowDenyConfig` | `AllowDenyConfig` | Allowlist/denylist configuration |
| `enableConfidenceScoring` | `boolean` | Enable confidence-based filtering (default: true) |
| `sensitivity` | `'strict' \| 'balanced' \| 'relaxed'` | **New in v0.5.0** - Detection sensitivity level |
| `confidenceThreshold` | `number` | **New in v0.5.0** - Minimum confidence for detection (0.0-1.0) |
| `rules` | `Record<PiiType, Rule>` | Type-specific detection rules |
| `contextHints` | `string[]` | Keywords for context-aware detection |
| `hmacKey` | `string \| CryptoKey` | HMAC key for tokenization (min 32 chars) |

**AllowDenyConfig**:

| Property | Type | Description |
|----------|------|-------------|
| `environment` | `Environment` | Environment setting |
| `customAllowlist` | `Map<PiiType, Set<string>>` | Custom patterns to exclude |
| `customDenylist` | `Map<PiiType, Set<string>>` | Custom patterns to force detection |
| `allowPrivateIPs` | `boolean` | Whether to allow private IP addresses |
| `allowTestPatterns` | `boolean` | Whether to allow common test patterns |

#### Methods

##### use(detectors, maskers, contextHints)
Register detectors and maskers from plugins.

```typescript
use(
  detectors?: Detector[], 
  maskers?: Record<string, Masker>, 
  contextHints?: string[]
): void
```

##### detect(text, contextHints)
Detect PII in text and return hits.

```typescript
detect(text: string, contextHints?: string[]): Promise<{
  src: string
  hits: Hit[]
}>
```

##### useLazy(pluginName, plugin)
**New in v0.5.0** - Load plugin lazily for better performance.

```typescript
useLazy(pluginName: string, plugin: LazyPlugin): Promise<void>
```

##### maskerFor(type)
Get masker function for specific PII type.

```typescript
maskerFor(type: PiiType): Masker | undefined
```

##### getPolicy()
Get current policy configuration.

```typescript
getPolicy(): Policy
```

### AllowDenyManager

**New in v0.3.0** - Manages allowlist and denylist patterns.

#### Constructor

```typescript
new AllowDenyManager(config?: AllowDenyConfig)
```

#### Methods

##### isAllowed(value, type)
Check if a value should be allowed (not treated as PII).

```typescript
isAllowed(value: string, type: PiiType): boolean
```

##### addToAllowlist(type, patterns)
Add patterns to allowlist at runtime.

```typescript
addToAllowlist(type: PiiType, patterns: string[]): void
```

##### addToDenylist(type, patterns)
Add patterns to denylist at runtime.

```typescript
addToDenylist(type: PiiType, patterns: string[]): void
```

##### getConfig()
Get current configuration for debugging.

```typescript
getConfig(): {
  environment: Environment
  allowPrivateIPs: boolean
  allowTestPatterns: boolean
  allowlist: Record<string, string[]>
  denylist: Record<string, string[]>
}
```

## IPv6 Functions

### parseIPv6(address)

**New in v0.3.0** - Parse and validate IPv6 address.

```typescript
parseIPv6(address: string): IPv6ParseResult
```

**IPv6ParseResult**:

| Property | Type | Description |
|----------|------|-------------|
| `valid` | `boolean` | Whether the address is valid |
| `normalized` | `string?` | Canonical form of the address |
| `isPrivate` | `boolean?` | Whether it's a private address |
| `isLoopback` | `boolean?` | Whether it's a loopback address |
| `isDocumentation` | `boolean?` | Whether it's a documentation address |
| `isLinkLocal` | `boolean?` | Whether it's a link-local address |
| `isUniqueLocal` | `boolean?` | Whether it's a unique local address |
| `error` | `string?` | Error message if invalid |

**Example**:
```typescript
import { parseIPv6 } from '@himorishige/noren-core'

const result = parseIPv6('2001:db8::1')
console.log(result)
// {
//   valid: true,
//   normalized: '2001:0db8:0000:0000:0000:0000:0000:0001',
//   isDocumentation: true,
//   isPrivate: false
// }
```

## Utility Functions

### redactText(registry, text, overrides)

Convenience function to redact PII from text.

```typescript
redactText(
  registry: Registry, 
  text: string, 
  overrides?: Partial<Policy>
): Promise<string>
```

## Types

### Environment

**New in v0.3.0**:

```typescript
type Environment = 'production' | 'test' | 'development'
```

### Hit

Represents a detected PII match.

```typescript
interface Hit {
  type: PiiType
  start: number
  end: number
  value: string
  risk: 'low' | 'medium' | 'high'
  priority?: number
  confidence?: number    // 0.0-1.0, added in v0.3.0
  reasons?: string[]     // Detection reasoning, added in v0.3.0  
  features?: Record<string, unknown> // Additional metadata, added in v0.3.0
}
```

### Detector

Interface for PII detectors.

```typescript
interface Detector {
  id: string             // Unique detector identifier
  match(utils: DetectUtils): void | Promise<void>
  priority?: number      // Lower number = higher priority
}
```

### DetectionSensitivity

**New in v0.5.0** - Predefined sensitivity levels:

```typescript
type DetectionSensitivity = 'strict' | 'balanced' | 'relaxed'
```

- **strict**: High precision, lower recall (confidence ≥ 0.8)
- **balanced**: Balanced precision and recall (confidence ≥ 0.5) 
- **relaxed**: High recall, lower precision (confidence ≥ 0.3)

## Environment-Specific Behavior

### Default Allowlists by Environment

#### Production Environment
- Only allows safe patterns:
  - `noreply@`, `no-reply@`, `donotreply@`, `do-not-reply@`

#### Test/Development Environment
- **Email domains**: `example.com`, `example.org`, `localhost`, `invalid`
- **IPv4 addresses**: Loopback (`127.0.0.1`), documentation ranges, private networks
- **IPv6 addresses**: Loopback (`::1`), link-local, unique local, documentation
- **Phone numbers**: Test ranges (`555-0100` to `555-0199`), repeated digits
- **Credit cards**: Common test card numbers

### Custom Configuration Examples

#### Allow Corporate Domains in Production
```typescript
const registry = new Registry({
  defaultAction: 'mask',
  environment: 'production',
  allowDenyConfig: {
    customAllowlist: new Map([
      ['email', new Set([
        'noreply@mycompany.com',
        'support@mycompany.com',
        'admin@mycompany.com'
      ])]
    ])
  }
})
```

#### Force Detection of Test Patterns
```typescript
const registry = new Registry({
  defaultAction: 'mask',
  environment: 'test',
  allowDenyConfig: {
    customDenylist: new Map([
      ['email', new Set(['test@'])] // Force detection of test@ emails
    ])
  }
})
```

#### Development with Strict IP Detection
```typescript
const registry = new Registry({
  defaultAction: 'mask',
  environment: 'development',
  allowDenyConfig: {
    allowPrivateIPs: false // Detect private IPs even in development
  }
})
```

## Migration Guide

### From v0.4.x to v0.5.0

**Breaking Changes:**
- Removed complex devtools features (A/B testing, contextual detection)
- Simplified confidence scoring system
- Updated plugin loading mechanism

```typescript
// Before v0.5.0
import { BenchmarkRunner, ImprovementCycle } from '@himorishige/noren-devtools'

// After v0.5.0 - Simplified devtools
import { BenchmarkRunner, EvaluationEngine } from '@himorishige/noren-devtools'
// ImprovementCycle and complex features removed
```

### From v0.2.x to v0.5.0

### Registry Constructor
```typescript
// Before v0.3.0
const registry = new Registry({
  defaultAction: 'mask',
  rules: { email: { action: 'remove' } }
})

// After v0.3.0 (Required changes marked with // NEW)
const registry = new Registry({
  defaultAction: 'mask',
  environment: 'production', // NEW: Required field
  rules: { email: { action: 'remove' } },
  allowDenyConfig: { // NEW: Optional configuration
    allowTestPatterns: false
  }
})
```

### IPv6 Detection Changes
- Private IPv6 addresses are no longer detected by default
- Use custom denylist to force detection if needed:

```typescript
const registry = new Registry({
  defaultAction: 'mask',
  environment: 'production',
  allowDenyConfig: {
    customDenylist: new Map([
      ['ipv6', new Set(['::1', 'fe80::', 'fd00::'])]
    ])
  }
})
```

## New Features in v0.5.0

### Confidence Scoring System

```typescript
import { CONFIDENCE_THRESHOLDS, filterByConfidence } from '@himorishige/noren-core'

// Predefined thresholds
CONFIDENCE_THRESHOLDS.strict    // 0.8
CONFIDENCE_THRESHOLDS.balanced  // 0.5  
CONFIDENCE_THRESHOLDS.relaxed   // 0.3

// Filter hits by confidence
const highConfidenceHits = filterByConfidence(hits, 0.8)
```

### Lazy Plugin Loading

```typescript
import { clearPluginCache } from '@himorishige/noren-core'

// Load plugin on-demand
await registry.useLazy('jp-plugin', () => import('@himorishige/noren-plugin-jp'))

// Clear cache if needed
clearPluginCache('jp-plugin')
```

### Enhanced Stream Processing

```typescript
import { createRedactionTransform } from '@himorishige/noren-core'

const transform = createRedactionTransform(registry, {
  // Enhanced options in v0.5.0
  confidenceThreshold: 0.7,
  enableBackpressure: true
})
```

## Performance Characteristics (v0.5.0)

### Detection Performance
- Simple text (< 1KB): < 0.5ms per detection (2x faster)
- Complex text with multiple PII: < 0.1ms per detection (2x faster)
- IPv6 parsing: ~0.05ms per candidate address (2x faster)
- Processing speed: 102,229 operations/second

### Memory Usage
- Base memory footprint: ~1MB (50% reduction)
- Memory growth: < 2.5MB for 1000 operations (50% reduction)
- Object pooling: Automatic cleanup and reuse

### Bundle Size Optimization
- Core bundle: 124KB (77% code reduction)
- Plugin bundles: < 150KB each
- Tree-shaking friendly: 65% fewer exports

### Scaling Characteristics
- Linear scaling with input size
- 20x input → 2-5x processing time (optimized algorithms)
- Enhanced backpressure handling for large streams