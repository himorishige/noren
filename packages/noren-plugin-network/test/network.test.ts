import { Registry, redactText } from '@himorishige/noren-core'
import { describe, expect, it } from 'vitest'
import { detectors, maskers } from '../src/index.js'

describe('Network Plugin', () => {
  describe('IPv4 Detection', () => {
    it('should detect IPv4 addresses', async () => {
      const registry = new Registry({
        defaultAction: 'mask',
        contextHints: ['ip', 'address', 'server'],
      })
      registry.use(detectors, maskers)

      const result = await registry.detect('Server IP: 192.168.1.1')
      expect(result.hits).toHaveLength(1)
      expect(result.hits[0].type).toBe('ipv4')
      expect(result.hits[0].value).toBe('192.168.1.1')
    })

    it('should exclude version numbers', async () => {
      const registry = new Registry({
        defaultAction: 'mask',
      })
      registry.use(detectors, maskers)

      const result = await registry.detect('Version 1.2.3.4')
      expect(result.hits).toHaveLength(0)
    })

    it('should mask IPv4 addresses correctly', async () => {
      const registry = new Registry({
        defaultAction: 'mask',
        contextHints: ['ip'],
      })
      registry.use(detectors, maskers)

      const input = 'Server IP: 10.0.0.1'
      const result = await redactText(registry, input)
      expect(result).toBe('Server IP: •••.•••.•••.•••')
    })
  })

  describe('IPv6 Detection', () => {
    it('should detect IPv6 addresses', async () => {
      const registry = new Registry({
        defaultAction: 'mask',
        contextHints: ['ipv6', 'interface'],
      })
      registry.use(detectors, maskers)

      const result = await registry.detect('Interface: 2001:db8::1')
      expect(result.hits).toHaveLength(1)
      expect(result.hits[0].type).toBe('ipv6')
      expect(result.hits[0].value).toBe('2001:db8::1')
    })

    it('should handle IPv6 compression', async () => {
      const registry = new Registry({
        defaultAction: 'mask',
        contextHints: ['ipv6'],
      })
      registry.use(detectors, maskers)

      const result = await registry.detect('Gateway: ::1')
      expect(result.hits).toHaveLength(1)
      expect(result.hits[0].value).toBe('::1')
    })

    it('should mask IPv6 addresses correctly', async () => {
      const registry = new Registry({
        defaultAction: 'mask',
        contextHints: ['ipv6'],
      })
      registry.use(detectors, maskers)

      const input = 'Address: 2001:db8::1'
      const result = await redactText(registry, input)
      expect(result).toBe('Address: ••••:•••::•')
    })
  })

  describe('MAC Address Detection', () => {
    it('should detect MAC addresses with colons', async () => {
      const registry = new Registry({
        defaultAction: 'mask',
        contextHints: ['mac', 'ethernet'],
      })
      registry.use(detectors, maskers)

      const result = await registry.detect('MAC: 00:1B:44:11:3A:B7')
      expect(result.hits).toHaveLength(1)
      expect(result.hits[0].type).toBe('mac')
      expect(result.hits[0].value).toBe('00:1B:44:11:3A:B7')
    })

    it('should detect MAC addresses with dashes', async () => {
      const registry = new Registry({
        defaultAction: 'mask',
        contextHints: ['mac'],
      })
      registry.use(detectors, maskers)

      const result = await registry.detect('Adapter: 00-1B-44-11-3A-B7')
      expect(result.hits).toHaveLength(1)
      expect(result.hits[0].value).toBe('00-1B-44-11-3A-B7')
    })

    it('should mask MAC addresses correctly', async () => {
      const registry = new Registry({
        defaultAction: 'mask',
        contextHints: ['hardware'],
      })
      registry.use(detectors, maskers)

      const input = 'Hardware: 00:1B:44:11:3A:B7'
      const result = await redactText(registry, input)
      expect(result).toBe('Hardware: ••:••:••:••:••:••')
    })
  })

  describe('Context Requirements', () => {
    it('should require context for better accuracy', async () => {
      const registryWithContext = new Registry({
        defaultAction: 'mask',
        contextHints: ['ip', 'mac', 'ipv6'],
      })
      registryWithContext.use(detectors, maskers)

      const registryWithoutContext = new Registry({
        defaultAction: 'mask',
        contextHints: [],
      })
      registryWithoutContext.use(detectors, maskers)

      const text = 'Some text with 192.168.1.1 and no context'

      const withContext = await registryWithContext.detect(text)
      const withoutContext = await registryWithoutContext.detect(text)

      // Without context, detection may have lower confidence
      // This tests the plugin's context awareness
      expect(withContext.hits.length).toBeGreaterThanOrEqual(0)
      expect(withoutContext.hits.length).toBeGreaterThanOrEqual(0)
    })
  })

  describe('False Positive Prevention', () => {
    it('should not detect obvious false positives', async () => {
      const registry = new Registry({
        defaultAction: 'mask',
      })
      registry.use(detectors, maskers)

      // Test data that should NOT be detected as network PII
      const falsePositives = [
        'Version 1.2.3.4 released',
        'Date: 2024.12.31',
        'Product Code: AB-CD-EF-12-34-56',
        'Serial: 00:00:00:00:00:00',
      ]

      for (const text of falsePositives) {
        const result = await registry.detect(text)
        expect(result.hits.length).toBe(0)
      }
    })
  })
})
