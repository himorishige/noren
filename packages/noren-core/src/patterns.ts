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
  creditCardChunk: /\b(?:\d[ -]?){12,18}\d\b/g,
}

// Unified pattern for single-pass detection (core PII only)
export const UNIFIED_PATTERN = new RegExp(
  [
    // Group 1: Email
    '(?<![A-Z0-9._%+-/])([A-Z0-9._%+-]{1,64}@[A-Z0-9.-]{1,253}\\.[A-Z]{2,63})(?![\\w])',
    // Group 2: Credit Card (simplified for unified pattern)
    '|(?<![\\d])\\b((?:\\d[ -]?){12,18}\\d)\\b(?![\\d])',
  ].join(''),
  'gi',
)

// Pattern type mapping for unified detection
// IMPORTANT: Order must match the capture groups in UNIFIED_PATTERN
export const PATTERN_TYPES: Array<{ type: string; risk: 'low' | 'medium' | 'high' }> = [
  { type: 'email', risk: 'medium' }, // Group 1
  { type: 'credit_card', risk: 'high' }, // Group 2
]
