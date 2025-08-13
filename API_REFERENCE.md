# API Reference

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
| `defaultAction` | `'mask' \| 'remove' \| 'tokenize'` | Default action for detected PII |
| `environment` | `'production' \| 'test' \| 'development'` | **New in v0.3.0** - Environment-specific behavior |
| `allowDenyConfig` | `AllowDenyConfig` | **New in v0.3.0** - Allowlist/denylist configuration |
| `rules` | `Record<PiiType, Rule>` | Type-specific detection rules |
| `contextHints` | `string[]` | Keywords for context-aware detection |
| `hmacKey` | `string` | HMAC key for tokenization (min 16 chars) |

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
}
```

### Detector

Interface for PII detectors.

```typescript
interface Detector {
  match(utils: DetectUtils): Promise<void>
  priority?: number
}
```

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

## Migration from v0.2.x

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

## Performance Characteristics

### Detection Performance
- Simple text (< 1KB): < 1ms per detection
- Complex text with multiple PII: < 0.2ms per detection (average)
- IPv6 parsing: ~0.1ms per candidate address

### Memory Usage
- Base memory footprint: ~2MB
- Memory growth: < 5MB for 1000 operations
- IPv6 parser: Minimal overhead with candidate pre-filtering

### Scaling Characteristics
- Linear scaling with input size
- 20x input → 5-30x processing time (depends on optimization)
- Backpressure handling for large streams