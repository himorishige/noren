// Network-specific regex patterns for IPv4, IPv6, and MAC address detection

// Pre-compiled regex patterns for better performance
export const NETWORK_PATTERNS = {
  // IPv4 pattern with proper boundary detection
  ipv4: /\b(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9]?[0-9])(?:\.(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9]?[0-9])){3}\b/g,

  // IPv6 pattern with comprehensive format support
  ipv6: /(?<![0-9A-Fa-f:])((?:[0-9A-Fa-f]{1,4}:){7}[0-9A-Fa-f]{1,4}|(?:[0-9A-Fa-f]{1,4}:){1,7}:|(?:[0-9A-Fa-f]{1,4}:){1,6}:[0-9A-Fa-f]{1,4}|(?:[0-9A-Fa-f]{1,4}:){1,5}(?::[0-9A-Fa-f]{1,4}){1,2}|(?:[0-9A-Fa-f]{1,4}:){1,4}(?::[0-9A-Fa-f]{1,4}){1,3}|(?:[0-9A-Fa-f]{1,4}:){1,3}(?::[0-9A-Fa-f]{1,4}){1,4}|(?:[0-9A-Fa-f]{1,4}:){1,2}(?::[0-9A-Fa-f]{1,4}){1,5}|[0-9A-Fa-f]{1,4}:(?::[0-9A-Fa-f]{1,4}){1,6}|:(?::[0-9A-Fa-f]{1,4}){1,7}|::|::ffff:(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(?:\.(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3})(?![0-9A-Fa-f:])/gi,

  // MAC address pattern (supports both : and - separators)
  mac: /\b[0-9A-F]{2}(?:[:-][0-9A-F]{2}){5}\b/gi,
}

// Unified pattern for single-pass detection (optional optimization)
export const UNIFIED_NETWORK_PATTERN = new RegExp(
  [
    // Group 1: IPv4
    '\\b((?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9]?[0-9])(?:\\.(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9]?[0-9])){3})\\b',
    // Group 2: MAC Address
    '|\\b([0-9A-F]{2}(?:[:-][0-9A-F]{2}){5})\\b',
    // Group 3: IPv6 (simplified pattern for compatibility)
    '|(?:^|[^0-9A-Fa-f:]|\\s)((?:[0-9A-Fa-f]{1,4}:){7}[0-9A-Fa-f]{1,4}|(?:[0-9A-Fa-f]{1,4}:){1,7}:|(?:[0-9A-Fa-f]{1,4}:){1,6}:[0-9A-Fa-f]{1,4}|(?:[0-9A-Fa-f]{1,4}:){1,5}(?::[0-9A-Fa-f]{1,4}){1,2}|(?:[0-9A-Fa-f]{1,4}:){1,4}(?::[0-9A-Fa-f]{1,4}){1,3}|(?:[0-9A-Fa-f]{1,4}:){1,3}(?::[0-9A-Fa-f]{1,4}){1,4}|(?:[0-9A-Fa-f]{1,4}:){1,2}(?::[0-9A-Fa-f]{1,4}){1,5}|[0-9A-Fa-f]{1,4}:(?::[0-9A-Fa-f]{1,4}){1,6}|:(?::[0-9A-Fa-f]{1,4}){1,7}|::|::ffff:(?:25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]?\\d)(?:\\.(?:25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]?\\d)){3})(?![0-9A-Fa-f:])',
  ].join(''),
  'gi',
)

// Pattern type mapping for unified detection
export const NETWORK_PATTERN_TYPES: Array<{ type: string; risk: 'low' | 'medium' | 'high' }> = [
  { type: 'ipv4', risk: 'low' },
  { type: 'mac', risk: 'low' },
  { type: 'ipv6', risk: 'low' },
]
