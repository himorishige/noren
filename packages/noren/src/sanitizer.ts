import type { PatternMatch, SanitizeRule } from './types.js'

/**
 * Content sanitizer for neutralizing prompt injection patterns
 * Lightweight approach using string replacement and pattern masking
 */

/**
 * Default sanitization rules
 */
export const DEFAULT_SANITIZE_RULES: SanitizeRule[] = [
  // Remove context markers
  {
    pattern: /#\s*system\s*[:\]]/gi,
    action: 'remove',
    category: 'context_marker',
  },
  {
    pattern: /\[(?:INST|instruction|system)\]/gi,
    action: 'remove',
    category: 'context_marker',
  },
  {
    pattern: /<\|(?:im_start|im_end|system|user|assistant)\|>/gi,
    action: 'remove',
    category: 'context_marker',
  },

  // Neutralize instruction overrides
  {
    pattern:
      /ignore\s+(?:all\s+)?(?:previous|prior|above|earlier)\s+(?:instructions?|commands?|directives?|prompts?)/gi,
    action: 'replace',
    replacement: '[REQUEST_TO_IGNORE_INSTRUCTIONS]',
    category: 'instruction_override',
  },
  {
    pattern:
      /disregard\s+(?:all\s+)?(?:above|previous|prior|earlier)\s+(?:instructions?|commands?|content)/gi,
    action: 'replace',
    replacement: '[REQUEST_TO_DISREGARD_CONTENT]',
    category: 'instruction_override',
  },
  {
    pattern:
      /forget\s+(?:all\s+)?(?:previous|prior|above|earlier|your)\s+(?:instructions?|commands?|training)/gi,
    action: 'replace',
    replacement: '[REQUEST_TO_FORGET_INSTRUCTIONS]',
    category: 'instruction_override',
  },

  // Quote dangerous code execution requests
  {
    pattern: /(?:execute|run|eval)\s+(?:this\s+)?(?:code|command|script|python|javascript)/gi,
    action: 'quote',
    category: 'code_execution',
  },
  {
    pattern: /(?:decode|base64|atob)\s+(?:and\s+)?(?:execute|run|eval)/gi,
    action: 'quote',
    category: 'code_execution',
  },

  // Remove invisible characters
  {
    pattern: /[\u200b-\u200f\u2060\ufeff]/g,
    action: 'remove',
    category: 'obfuscation',
  },

  // Normalize excessive spacing
  {
    pattern: /\s{3,}/g,
    action: 'replace',
    replacement: ' ',
    category: 'obfuscation',
  },
]

/**
 * Sanitizes content based on detected patterns and rules
 */
export function sanitizeContent(
  content: string,
  matches: PatternMatch[],
  rules: SanitizeRule[] = DEFAULT_SANITIZE_RULES,
): string {
  let sanitized = content

  // Apply pattern-specific sanitization first
  for (const match of matches) {
    const rule = rules.find((r) => r.category === match.category)
    if (rule) {
      sanitized = applySanitizeRule(sanitized, rule)
    }
  }

  // Apply all default rules
  for (const rule of rules) {
    sanitized = applySanitizeRule(sanitized, rule)
  }

  // Final cleanup
  sanitized = finalCleanup(sanitized)

  return sanitized
}

/**
 * Applies a single sanitization rule
 */
function applySanitizeRule(content: string, rule: SanitizeRule): string {
  switch (rule.action) {
    case 'remove':
      return content.replace(rule.pattern, '')

    case 'replace':
      return content.replace(rule.pattern, rule.replacement ?? '[REDACTED]')

    case 'quote':
      return content.replace(rule.pattern, (match) => `"${match}"`)

    case 'neutralize':
      return content.replace(
        rule.pattern,
        (match) => `[NEUTRALIZED: ${match.slice(0, 20)}${match.length > 20 ? '...' : ''}]`,
      )

    default:
      return content
  }
}

/**
 * Creates safe quoted version of dangerous content
 */
export function quoteDangerous(content: string): string {
  // Wrap in quotes and escape internal quotes
  const escaped = content.replace(/"/g, '\\"')
  return `"${escaped}"`
}

/**
 * Neutralizes context markers by making them visible but harmless
 */
export function neutralizeContextMarkers(content: string): string {
  const markers = [
    { pattern: /#\s*system\s*[:\]]/gi, replacement: '[SYSTEM_MARKER]' },
    { pattern: /\[(?:INST|instruction|system)\]/gi, replacement: '[INSTRUCTION_MARKER]' },
    { pattern: /<\|(?:im_start|im_end|system|user|assistant)\|>/gi, replacement: '[CHAT_MARKER]' },
  ]

  let neutralized = content
  for (const marker of markers) {
    neutralized = neutralized.replace(marker.pattern, marker.replacement)
  }

  return neutralized
}

/**
 * Removes dangerous instruction sequences
 */
export function removeInstructions(content: string): string {
  const instructionPatterns = [
    /ignore\s+(?:all\s+)?(?:previous|prior|above|earlier)\s+(?:instructions?|commands?|directives?|prompts?)/gi,
    /disregard\s+(?:all\s+)?(?:above|previous|prior|earlier)\s+(?:instructions?|commands?|content)/gi,
    /forget\s+(?:all\s+)?(?:previous|prior|above|earlier|your)\s+(?:instructions?|commands?|training)/gi,
    /(?:new|updated?)\s+(?:instruction|command|directive|rule|prompt):/gi,
  ]

  let cleaned = content
  for (const pattern of instructionPatterns) {
    cleaned = cleaned.replace(pattern, '[INSTRUCTION_REMOVED]')
  }

  return cleaned
}

/**
 * Escapes potentially dangerous Unicode characters
 */
export function escapeUnicode(content: string): string {
  return (
    content
      // Remove invisible characters
      .replace(/[\u200b-\u200f\u2060\ufeff]/g, '')
      // Replace zero-width characters
      .replace(/[\u200c\u200d]/g, '')
      // Normalize whitespace
      .replace(/[\u00a0\u1680\u2000-\u200a\u202f\u205f\u3000]/g, ' ')
  )
}

/**
 * Normalizes text encoding to prevent obfuscation
 */
export function normalizeEncoding(content: string): string {
  try {
    // Normalize Unicode
    let normalized = content.normalize('NFKC')

    // Decode common encoding attempts
    normalized = decodeHtmlEntities(normalized)
    normalized = decodeUrlEncoding(normalized)

    // Fix common obfuscation
    normalized = normalized
      .replace(/[１２３４５６７８９０]/g, (match) =>
        String.fromCharCode(match.charCodeAt(0) - 0xfee0),
      )
      .replace(/[ａ-ｚＡ-Ｚ]/g, (match) => String.fromCharCode(match.charCodeAt(0) - 0xfee0))

    return normalized
  } catch {
    // Fallback to original content if normalization fails
    return content
  }
}

/**
 * Decodes HTML entities
 */
function decodeHtmlEntities(content: string): string {
  const entities: Record<string, string> = {
    '&amp;': '&',
    '&lt;': '<',
    '&gt;': '>',
    '&quot;': '"',
    '&#x27;': "'",
    '&#x2F;': '/',
    '&#39;': "'",
    '&#47;': '/',
  }

  return content.replace(/&[#\w]+;/g, (match) => entities[match] || match)
}

/**
 * Decodes URL encoding
 */
function decodeUrlEncoding(content: string): string {
  try {
    return decodeURIComponent(content)
  } catch {
    return content
  }
}

/**
 * Final cleanup pass
 */
function finalCleanup(content: string): string {
  return (
    content
      // Remove multiple spaces
      .replace(/\s+/g, ' ')
      // Remove leading/trailing whitespace
      .trim()
      // Remove empty brackets
      .replace(/\[\s*\]/g, '')
      // Remove multiple consecutive redaction markers
      .replace(/(\[(?:REDACTED|NEUTRALIZED|REMOVED)[^\]]*\]\s*){2,}/g, '[MULTIPLE_REDACTIONS]')
  )
}

/**
 * Creates a safe version of content for display/logging
 */
export function createSafePreview(content: string, maxLength = 100): string {
  const sanitized = sanitizeContent(content, [])
  const preview = sanitized.slice(0, maxLength)
  return preview.length < sanitized.length ? `${preview}...` : preview
}

/**
 * Validates that sanitized content is safe
 */
export function validateSanitized(content: string): {
  safe: boolean
  issues: string[]
} {
  const issues: string[] = []

  // Check for remaining context markers
  const contextMarkers = [
    /#\s*system\s*[:\]]/gi,
    /\[(?:INST|instruction|system)\]/gi,
    /<\|(?:im_start|im_end|system|user|assistant)\|>/gi,
  ]

  for (const pattern of contextMarkers) {
    if (pattern.test(content)) {
      issues.push('Context markers still present')
      break
    }
  }

  // Check for dangerous instruction patterns
  const instructionPatterns = [
    /ignore\s+(?:all\s+)?(?:previous|prior|above|earlier)\s+(?:instructions?|commands?)/gi,
    /execute\s+(?:code|command|script)/gi,
  ]

  for (const pattern of instructionPatterns) {
    if (pattern.test(content)) {
      issues.push('Dangerous instructions still present')
      break
    }
  }

  // Check for invisible characters
  if (/[\u200b-\u200f\u2060\ufeff]/.test(content)) {
    issues.push('Invisible characters detected')
  }

  return {
    safe: issues.length === 0,
    issues,
  }
}
