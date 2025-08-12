// Regex patterns module (separate for better tree-shaking)

// Pre-compiled regex patterns for better performance
export const NORMALIZE_PATTERNS = {
  dashVariants: /[\u2212\u2010-\u2015\u30FC]/g,
  ideographicSpace: /\u3000/g,
  multipleSpaces: /[ \t　]+/g,
}

export const DETECTION_PATTERNS = {
  // Individual patterns for fallback/specific use
  // Email pattern that avoids URLs and requires word boundaries
  email: /(?<![A-Z0-9._%+-/])([A-Z0-9._%+-]{1,64}@[A-Z0-9.-]{1,253}\.[A-Z]{2,63})(?![\w])/gi,
  ipv4: /\b(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9]?[0-9])(?:\.(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9]?[0-9])){3}\b/g,
  ipv6: /(?<![0-9A-Fa-f:])((?:[0-9A-Fa-f]{1,4}:){7}[0-9A-Fa-f]{1,4}|(?:[0-9A-Fa-f]{1,4}:){1,7}:|(?:[0-9A-Fa-f]{1,4}:){1,6}:[0-9A-Fa-f]{1,4}|(?:[0-9A-Fa-f]{1,4}:){1,5}(?::[0-9A-Fa-f]{1,4}){1,2}|(?:[0-9A-Fa-f]{1,4}:){1,4}(?::[0-9A-Fa-f]{1,4}){1,3}|(?:[0-9A-Fa-f]{1,4}:){1,3}(?::[0-9A-Fa-f]{1,4}){1,4}|(?:[0-9A-Fa-f]{1,4}:){1,2}(?::[0-9A-Fa-f]{1,4}){1,5}|[0-9A-Fa-f]{1,4}:(?::[0-9A-Fa-f]{1,4}){1,6}|:(?::[0-9A-Fa-f]{1,4}){1,7}|::|::ffff:(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(?:\.(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3})(?![0-9A-Fa-f:])/gi,
  mac: /\b[0-9A-F]{2}(?:[:-][0-9A-F]{2}){5}\b/gi,
  e164: /(?:^|[\s(])\+(?:[1-9]\d{6,14}|[1-9][\d\-\s()]{6,15})(?=[\s)]|$|\W)/g,
  creditCardChunk: /\b(?:\d[ -]?){12,18}\d\b/g,
}

// Unified pattern for single-pass detection (most performance-critical patterns)
export const UNIFIED_PATTERN = new RegExp(
  [
    // Group 1: Email
    '(?<![A-Z0-9._%+-/])([A-Z0-9._%+-]{1,64}@[A-Z0-9.-]{1,253}\\.[A-Z]{2,63})(?![\\w])',
    // Group 2: IPv4
    '|\\b((?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9]?[0-9])(?:\\.(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9]?[0-9])){3})\\b',
    // Group 3: MAC Address (moved before IPv6 to avoid conflicts)
    '|\\b([0-9A-F]{2}(?:[:-][0-9A-F]{2}){5})\\b',
    // Group 4: IPv6 (simplified pattern for reliable detection - uses lookaround for compatibility with test runner)
    '|(?:^|[^0-9A-Fa-f:]|\\s)((?:[0-9A-Fa-f]{1,4}:){7}[0-9A-Fa-f]{1,4}|(?:[0-9A-Fa-f]{1,4}:){1,7}:|(?:[0-9A-Fa-f]{1,4}:){1,6}:[0-9A-Fa-f]{1,4}|(?:[0-9A-Fa-f]{1,4}:){1,5}(?::[0-9A-Fa-f]{1,4}){1,2}|(?:[0-9A-Fa-f]{1,4}:){1,4}(?::[0-9A-Fa-f]{1,4}){1,3}|(?:[0-9A-Fa-f]{1,4}:){1,3}(?::[0-9A-Fa-f]{1,4}){1,4}|(?:[0-9A-Fa-f]{1,4}:){1,2}(?::[0-9A-Fa-f]{1,4}){1,5}|[0-9A-Fa-f]{1,4}:(?::[0-9A-Fa-f]{1,4}){1,6}|:(?::[0-9A-Fa-f]{1,4}){1,7}|::|::ffff:(?:25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]?\\d)(?:\\.(?:25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]?\\d)){3})(?![0-9A-Fa-f:])',
    // Group 5: Credit Card (simplified for unified pattern)
    '|\\b((?:\\d[ -]?){12,18}\\d)\\b',
  ].join(''),
  'gi',
)

// Pattern type mapping for unified detection
// IMPORTANT: Order must match the capture groups in UNIFIED_PATTERN
export const PATTERN_TYPES: Array<{ type: string; risk: 'low' | 'medium' | 'high' }> = [
  { type: 'email', risk: 'medium' }, // Group 1
  { type: 'ipv4', risk: 'low' }, // Group 2
  { type: 'mac', risk: 'low' }, // Group 3 (MAC moved before IPv6)
  { type: 'ipv6', risk: 'low' }, // Group 4 (IPv6 moved after MAC)
  { type: 'credit_card', risk: 'high' }, // Group 5
]
