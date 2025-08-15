# @himorishige/noren-plugin-network

[![npm version](https://img.shields.io/npm/v/@himorishige/noren-plugin-network.svg)](https://www.npmjs.com/package/@himorishige/noren-plugin-network)

**Network PII detection plugin for Noren**

Specialized detectors and maskers for network-related Personally Identifiable Information including IPv4 addresses, IPv6 addresses, and MAC addresses.

> **Note**: As of Noren v0.6.0, network PII detection has been moved from Core to this dedicated plugin for better performance and reduced false positives in web applications.

## ✨ Features

### 🌐 **IPv4 Addresses**
- **Standard format**: `192.168.1.1`, `10.0.0.1`
- **Context-aware validation**: Excludes version numbers and dates
- **Private/public classification**: Automatic detection
- **False positive filtering**: Smart exclusion of obvious non-IPs

### 🌐 **IPv6 Addresses** 
- **Full format**: `2001:db8:85a3::8a2e:370:7334`
- **Compressed notation**: `::1`, `2001:db8::`
- **Link-local addresses**: `fe80::` range
- **Proper parsing**: Comprehensive validation with boundary detection

### 🔗 **MAC Addresses**
- **Colon format**: `00:1B:44:11:3A:B7`
- **Dash format**: `00-1B-44-11-3A-B7`
- **Context validation**: Hardware/network context required
- **Reserved pattern exclusion**: Filters broadcast and null addresses

## 🚀 Installation

```bash
npm install @himorishige/noren-plugin-network @himorishige/noren-core
```

## Basic Usage

```typescript
import { Registry, redactText } from '@himorishige/noren-core'
import * as networkPlugin from '@himorishige/noren-plugin-network'

// Create registry with network context hints
const registry = new Registry({
  defaultAction: 'mask',
  contextHints: ['ip', 'address', 'server', 'interface', 'mac', 'ethernet']
})

// Register the network plugin
registry.use(networkPlugin.detectors, networkPlugin.maskers)

const logData = `
Server startup log:
Primary interface: 192.168.1.100
Gateway: 192.168.1.1
IPv6 address: 2001:db8::1
MAC address: 00:1B:44:11:3A:B7
`

const result = await redactText(registry, logData)
console.log(result)
// Output:
// Server startup log:
// Primary interface: •••.•••.•••.•••
// Gateway: •••.•••.•••.•••
// IPv6 address: ••••:•••::•
// MAC address: ••:••:••:••:••:••
```

## Detected Types

| PII Type | Description | Masking Example (`mask`) | Context Required |
|:---------|:------------|:-------------------------|:-----------------|
| `ipv4` | IPv4 address | `•••.•••.•••.•••` | Recommended |
| `ipv6` | IPv6 address | `••••:•••::•` | Recommended |
| `mac` | MAC address | `••:••:••:••:••:••` | Recommended |

## Context Hints for Better Accuracy

For optimal detection accuracy, provide relevant context hints:

```typescript
const registry = new Registry({
  defaultAction: 'mask',
  contextHints: [
    // IPv4/IPv6 contexts
    'ip', 'address', 'server', 'host', 'endpoint', 'gateway', 'dns',
    // IPv6 specific
    'ipv6', 'ip6', 'interface', 'link-local',
    // MAC address contexts  
    'mac', 'ethernet', 'wifi', 'interface', 'adapter', 'nic', 'hardware'
  ]
})
```

## Advanced Usage

### Individual Detectors

Use specific detectors for targeted detection:

```typescript
import { Registry } from '@himorishige/noren-core'
import { detectors, maskers } from '@himorishige/noren-plugin-network'

const registry = new Registry({ defaultAction: 'mask' })

// Use only IPv4 detection (example)
const ipv4Detector = detectors.find(d => d.id === 'network.ipv4')
if (ipv4Detector) {
  registry.use([ipv4Detector], maskers)
}
```

### Custom Validation

Access validation functions for custom logic:

```typescript
import { validateIPv4, validateIPv6, validateMAC } from '@himorishige/noren-plugin-network'

const ipResult = validateIPv4('192.168.1.1', {
  surroundingText: 'Server IP: 192.168.1.1',
  strictness: 'balanced',
  originalIndex: 0
})

console.log(ipResult.valid) // true
console.log(ipResult.confidence) // 0.8
console.log(ipResult.reason) // 'private_ip'
```

### IPv6 Parsing

Use the built-in IPv6 parser:

```typescript
import { parseIPv6 } from '@himorishige/noren-plugin-network'

const result = parseIPv6('2001:db8::1')
console.log(result.valid) // true
console.log(result.normalized) // Normalized form
console.log(result.isPrivate) // false
```

## Performance Characteristics

- **IPv4 Detection**: ~0.1ms per candidate
- **IPv6 Detection**: ~0.3ms per candidate (complex parsing)
- **MAC Detection**: ~0.05ms per candidate
- **Memory Usage**: Minimal overhead with pre-compiled patterns
- **False Positive Rate**: <5% with proper context hints

## Configuration Examples

### Network Infrastructure Monitoring

```typescript
const registry = new Registry({
  defaultAction: 'mask',
  contextHints: [
    'interface', 'gateway', 'dns', 'dhcp', 'route',
    'firewall', 'switch', 'router', 'ethernet'
  ]
})
registry.use(networkPlugin.detectors, networkPlugin.maskers)
```

### Application Log Processing

```typescript
const registry = new Registry({
  defaultAction: 'mask',
  contextHints: ['ip', 'address', 'server', 'api', 'endpoint']
})
registry.use(networkPlugin.detectors, networkPlugin.maskers)
```

### Security/Audit Logs

```typescript
const registry = new Registry({
  defaultAction: 'mask',
  validationStrictness: 'strict', // Higher accuracy
  contextHints: ['source', 'destination', 'client', 'remote', 'peer']
})
registry.use(networkPlugin.detectors, networkPlugin.maskers)
```

## False Positive Prevention

The plugin includes sophisticated false positive filtering:

### Automatically Excluded

- **Version numbers**: `1.2.3.4` in "Version 1.2.3.4"
- **Date formats**: `2024.12.31` 
- **Product codes**: `AB-CD-EF-12-34-56` (for MAC)
- **Reserved addresses**: `127.0.0.1`, `0.0.0.0`, broadcast MACs

### Context-Based Filtering

- **IPv4**: Requires network-related context or explicit hints
- **IPv6**: Benefits from IPv6-specific context
- **MAC**: Requires hardware/network context for accuracy

## Migration from Core v0.5.x

If upgrading from Noren Core v0.5.x where network detection was built-in:

```typescript
// Before (v0.5.x) - automatic network detection
const registry = new Registry()

// After (v0.6.0+) - explicit plugin
import * as networkPlugin from '@himorishige/noren-plugin-network'

const registry = new Registry({
  contextHints: ['ip', 'address'] // Recommended for accuracy
})
registry.use(networkPlugin.detectors, networkPlugin.maskers)
```

See [Migration Guide](../../MIGRATION_v0.6.0.md) for complete details.

## Contributing

Issues and contributions welcome at [noren repository](https://github.com/himorishige/noren).

## License

MIT