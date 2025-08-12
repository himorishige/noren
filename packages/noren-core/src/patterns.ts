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
  ipv6: /(?:^|[\s(])([0-9A-F]{0,4}:){2,7}[0-9A-F]{0,4}|(?:^|[\s(])::(?:[0-9A-F]{0,4}:)*[0-9A-F]{0,4}|(?:^|[\s(])[0-9A-F]{1,4}::|(?:^|[\s(])::(?=[\s)]|$)/gi,
  mac: /\b[0-9A-F]{2}(?:[:-][0-9A-F]{2}){5}\b/gi,
  e164: /(?:^|[\s(])\+(?:[1-9]\d{6,14}|[1-9]\d[\d\-\s()]{6,13}\d)(?=[\s)]|$)/g,
  creditCardChunk: /\b(?:\d[ -]?){12,18}\d\b/g,
}

// Unified pattern for single-pass detection (most performance-critical patterns)
export const UNIFIED_PATTERN = new RegExp(
  [
    // Group 1: Email
    '(?<![A-Z0-9._%+-/])([A-Z0-9._%+-]{1,64}@[A-Z0-9.-]{1,253}\\.[A-Z]{2,63})(?![\\w])',
    // Group 2: IPv4
    '|\\b((?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9]?[0-9])(?:\\.(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9]?[0-9])){3})\\b',
    // Group 3: IPv6
    '|((?:^|[\\s(])([0-9A-F]*:+[0-9A-F:]*[0-9A-F])(?=[\\s)]|$))',
    // Group 4: MAC Address
    '|\\b([0-9A-F]{2}(?:[:-][0-9A-F]{2}){5})\\b',
    // Group 5: Credit Card (simplified for unified pattern)
    '|\\b((?:\\d[ -]?){12,18}\\d)\\b',
  ].join(''),
  'gi',
)

// Pattern type mapping for unified detection
export const PATTERN_TYPES: Array<{ type: string; risk: 'low' | 'medium' | 'high' }> = [
  { type: 'email', risk: 'medium' },
  { type: 'ipv4', risk: 'low' },
  { type: 'ipv6', risk: 'low' },
  { type: 'mac', risk: 'low' },
  { type: 'credit_card', risk: 'high' },
]
