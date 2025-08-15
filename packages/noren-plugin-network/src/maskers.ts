import type { Masker } from '@himorishige/noren-core'

/**
 * Network PII maskers for IPv4, IPv6, and MAC addresses
 */

export const maskers: Record<string, Masker> = {
  /**
   * IPv4 address masker
   * Masks each octet while preserving structure
   */
  ipv4: (hit) => {
    const value = hit.value
    const octets = value.split('.')
    return octets.map(() => '•••').join('.')
  },

  /**
   * IPv6 address masker
   * Masks groups while preserving :: compression notation
   */
  ipv6: (hit) => {
    const value = hit.value

    // Handle special cases
    if (value === '::') return '::'
    if (value === '::1') return '::1'

    // Simple masking - replace hex digits with •
    return value.replace(/[0-9a-fA-F]/g, '•')
  },

  /**
   * MAC address masker
   * Masks address while preserving separator style
   */
  mac: (hit) => {
    const value = hit.value
    const separator = value.includes(':') ? ':' : '-'
    return `••${separator}••${separator}••${separator}••${separator}••${separator}••`
  },
}
