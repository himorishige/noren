/**
 * Context-based scoring system for PII detection accuracy improvement
 * Analyzes surrounding text to determine likelihood of genuine PII
 */

import { CONTEXT_KEYWORDS, NEGATIVE_CONTEXT_KEYWORDS } from './constants.js'
import type { PiiType } from './types.js'

export interface ContextAnalysis {
  score: number // Base score with adjustments
  positiveMatches: string[]
  negativeMatches: string[]
  confidence: number // 0.0-1.0
  reasoning: string[]
}

/**
 * Calculate context score for a PII candidate
 */
export function calculateContextScore(
  surroundingText: string,
  piiType: PiiType,
  _windowSize = 24,
): ContextAnalysis {
  const baseScore = 1.0
  let score = baseScore
  const positiveMatches: string[] = []
  const negativeMatches: string[] = []
  const reasoning: string[] = []

  // Normalize text for analysis
  const normalizedText = surroundingText.toLowerCase()

  // Get type-specific positive keywords
  const positiveKeywords = CONTEXT_KEYWORDS[piiType as keyof typeof CONTEXT_KEYWORDS] || new Set()

  // Check for positive indicators
  for (const keyword of positiveKeywords) {
    // For Japanese keywords, use simple includes; for others, use word boundaries
    const isJapanese = /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/.test(keyword)

    let matches = false
    if (isJapanese) {
      matches = normalizedText.includes(keyword.toLowerCase())
    } else {
      const wordBoundaryRegex = new RegExp(
        `\\b${keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`,
        'i',
      )
      matches = wordBoundaryRegex.test(normalizedText)
    }

    if (matches) {
      score += 0.2
      positiveMatches.push(keyword)
      reasoning.push(`positive_keyword:${keyword}`)
    }
  }

  // Check for negative indicators
  for (const keyword of NEGATIVE_CONTEXT_KEYWORDS) {
    // For Japanese keywords, use simple includes; for others, use word boundaries
    const isJapanese = /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/.test(keyword)

    let matches = false
    if (isJapanese) {
      matches = normalizedText.includes(keyword.toLowerCase())
    } else {
      const wordBoundaryRegex = new RegExp(
        `\\b${keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`,
        'i',
      )
      matches = wordBoundaryRegex.test(normalizedText)
    }

    if (matches) {
      score -= 0.4 // Increased penalty for negative keywords
      negativeMatches.push(keyword)
      reasoning.push(`negative_keyword:${keyword}`)
    }
  }

  // Type-specific context analysis
  score = adjustScoreByTypeSpecificContext(score, normalizedText, piiType, reasoning)

  // Confidence calculation based on evidence strength
  const evidenceStrength = positiveMatches.length + negativeMatches.length
  const confidence = Math.min(0.95, 0.5 + evidenceStrength * 0.1)

  return {
    score: Math.max(0.0, score),
    positiveMatches,
    negativeMatches,
    confidence,
    reasoning,
  }
}

/**
 * Type-specific context adjustments
 */
function adjustScoreByTypeSpecificContext(
  score: number,
  normalizedText: string,
  piiType: PiiType,
  reasoning: string[],
): number {
  switch (piiType) {
    case 'credit_card':
      return adjustCreditCardContext(score, normalizedText, reasoning)
    case 'ipv4':
    case 'ipv6':
      return adjustIPContext(score, normalizedText, reasoning)
    case 'email':
      return adjustEmailContext(score, normalizedText, reasoning)
    case 'phone_e164':
      return adjustPhoneContext(score, normalizedText, reasoning)
    case 'mac':
      return adjustMACContext(score, normalizedText, reasoning)
    default:
      return score
  }
}

/**
 * Credit card specific context analysis
 */
function adjustCreditCardContext(score: number, text: string, reasoning: string[]): number {
  // Strong positive indicators
  if (/\b(payment|transaction|purchase|billing|checkout|order)\b/.test(text)) {
    score += 0.3
    reasoning.push('payment_context')
  }

  if (/\b(exp|expir|cvv|cvc|security\s+code)\b/.test(text)) {
    score += 0.4
    reasoning.push('card_details_context')
  }

  // Strong negative indicators
  if (/\b(example|sample|demo|test|dummy)\b/.test(text)) {
    score -= 0.5
    reasoning.push('test_context')
  }

  if (/\b(id|identifier|user|customer|account)\s*:?\s*\d+/.test(text)) {
    score -= 0.2
    reasoning.push('identifier_context')
  }

  // Database/log context (less likely to be real card data)
  if (/\b(insert|update|select|database|log|debug)\b/.test(text)) {
    score -= 0.3
    reasoning.push('database_context')
  }

  // Generic number context (reduces confidence for non-specific contexts)
  if (/\b(random|number|digits?|value|data|string)\b/.test(text)) {
    score -= 0.15 // Reduced penalty to avoid false negatives
    reasoning.push('generic_number_context')
  }

  return score
}

/**
 * IP address specific context analysis
 */
function adjustIPContext(score: number, text: string, reasoning: string[]): number {
  // Strong positive indicators
  if (/\b(connect|connection|server|client|endpoint|gateway|router)\b/.test(text)) {
    score += 0.3
    reasoning.push('network_context')
  }

  if (/\b(from|to|src|dst|source|destination)\b/.test(text)) {
    score += 0.2
    reasoning.push('direction_context')
  }

  if (/\b(ping|traceroute|nslookup|dig|curl|wget|ssh|telnet|ftp)\b/.test(text)) {
    score += 0.4
    reasoning.push('network_tool_context')
  }

  // Negative indicators
  if (/\b(version|release|build|package)\b/.test(text)) {
    score -= 0.4
    reasoning.push('version_context')
  }

  if (/\b(date|time|timestamp|year|month|day)\b/.test(text)) {
    score -= 0.3
    reasoning.push('date_context')
  }

  // Configuration file context
  if (/\b(config|conf|settings|properties|ini|yaml|json|xml)\b/.test(text)) {
    score += 0.2
    reasoning.push('config_context')
  }

  return score
}

/**
 * Email specific context analysis
 */
function adjustEmailContext(score: number, text: string, reasoning: string[]): number {
  // Strong positive indicators
  if (/\b(send|sent|receive|forward|reply|contact|reach)\b/.test(text)) {
    score += 0.3
    reasoning.push('communication_context')
  }

  if (/\b(from|to|cc|bcc|subject|message|mail)\b/.test(text)) {
    score += 0.4
    reasoning.push('email_headers_context')
  }

  // Negative indicators
  if (/\b(noreply|no-reply|donotreply|system|daemon|automated)\b/.test(text)) {
    score -= 0.5 // Stronger penalty for automated emails
    reasoning.push('automated_email_context')
  }

  if (/\b(example|test|demo|placeholder)\b/.test(text)) {
    score -= 0.4
    reasoning.push('example_context')
  }

  // Domain validation context
  if (/\b(domain|dns|mx|record|zone)\b/.test(text)) {
    score -= 0.2
    reasoning.push('dns_context')
  }

  return score
}

/**
 * Phone number specific context analysis
 */
function adjustPhoneContext(score: number, text: string, reasoning: string[]): number {
  // Strong positive indicators
  if (/\b(call|dial|ring|mobile|cell|landline|extension|ext)\b/.test(text)) {
    score += 0.3
    reasoning.push('phone_action_context')
  }

  if (/\b(contact|reach|emergency|support|help|service)\b/.test(text)) {
    score += 0.2
    reasoning.push('contact_context')
  }

  // Negative indicators
  if (/\b(test|example|dummy|sample|fake)\b/.test(text)) {
    score -= 0.4
    reasoning.push('test_number_context')
  }

  if (/\b(id|identifier|code|reference|serial)\b/.test(text)) {
    score -= 0.2
    reasoning.push('identifier_context')
  }

  return score
}

/**
 * MAC address specific context analysis
 */
function adjustMACContext(score: number, text: string, reasoning: string[]): number {
  // Strong positive indicators
  if (/\b(ethernet|ether|nic|interface|adapter|card)\b/.test(text)) {
    score += 0.4
    reasoning.push('network_hardware_context')
  }

  if (/\b(ifconfig|arp|bridge|switch|router|gateway)\b/.test(text)) {
    score += 0.3
    reasoning.push('network_config_context')
  }

  // Negative indicators
  if (/\b(uuid|guid|hash|checksum|signature|key)\b/.test(text)) {
    score -= 0.5
    reasoning.push('identifier_hash_context')
  }

  if (/\b(bluetooth|bt|wireless|wifi)\b/.test(text)) {
    score += 0.2
    reasoning.push('wireless_context')
  }

  return score
}

/**
 * Extract surrounding text for context analysis
 */
export function extractSurroundingText(
  fullText: string,
  matchStart: number,
  matchEnd: number,
  windowSize = 24,
): string {
  const beforeStart = Math.max(0, matchStart - windowSize)
  const afterEnd = Math.min(fullText.length, matchEnd + windowSize)

  const before = fullText.slice(beforeStart, matchStart)
  const after = fullText.slice(matchEnd, afterEnd)

  return before + after
}

/**
 * Determine if context score meets threshold for acceptance
 */
export function meetsContextThreshold(
  analysis: ContextAnalysis,
  piiType: PiiType,
  strictness: 'fast' | 'balanced' | 'strict' = 'balanced',
): boolean {
  const thresholds = {
    fast: {
      credit_card: 0.5,
      email: 0.3,
      ipv4: 0.3,
      ipv6: 0.3,
      phone_e164: 0.5,
      mac: 0.4,
      default: 0.3,
    },
    balanced: {
      credit_card: 1.1, // Slightly stricter for credit cards
      email: 0.8, // More stricter for emails to catch auto-emails
      ipv4: 0.5,
      ipv6: 0.5,
      phone_e164: 0.8,
      mac: 0.6,
      default: 0.5,
    },
    strict: {
      credit_card: 1.5,
      email: 1.0,
      ipv4: 1.0,
      ipv6: 1.0,
      phone_e164: 1.2,
      mac: 1.0,
      default: 1.0,
    },
  }

  const threshold =
    thresholds[strictness][piiType as keyof (typeof thresholds)[typeof strictness]] ||
    thresholds[strictness].default

  return analysis.score >= threshold
}

/**
 * Enhanced context analysis that includes pattern-based scoring
 */
export function analyzeContextWithPatterns(
  surroundingText: string,
  candidate: string,
  piiType: PiiType,
): ContextAnalysis {
  const baseAnalysis = calculateContextScore(surroundingText, piiType)

  // Add pattern-specific adjustments
  let patternScore = 0
  const additionalReasoning: string[] = []

  // Check for structured data patterns
  if (isInStructuredData(surroundingText, candidate)) {
    patternScore += 0.2
    additionalReasoning.push('structured_data_context')
  }

  // Check for form field context
  if (isInFormField(surroundingText, candidate)) {
    patternScore += 0.3
    additionalReasoning.push('form_field_context')
  }

  // Check for log/debug context
  if (isInLogContext(surroundingText)) {
    patternScore -= 0.2
    additionalReasoning.push('log_debug_context')
  }

  return {
    ...baseAnalysis,
    score: baseAnalysis.score + patternScore,
    reasoning: [...baseAnalysis.reasoning, ...additionalReasoning],
  }
}

/**
 * Detect if candidate is in structured data (JSON, XML, etc.)
 */
function isInStructuredData(text: string, _candidate: string): boolean {
  // JSON context
  if (text.includes('"') && text.includes(':')) {
    return true
  }

  // XML context
  if (text.includes('<') && text.includes('>')) {
    return true
  }

  // CSV context
  if (text.includes(',') && text.split(',').length > 2) {
    return true
  }

  return false
}

/**
 * Detect if candidate is in a form field context
 */
function isInFormField(text: string, _candidate: string): boolean {
  const formPatterns = [
    /\b(input|field|form|label|placeholder|value)\b/i,
    /\b(name|email|phone|address|card|number)\s*[:=]/i,
    /<input[^>]*>/i,
    /\btype\s*=\s*["']?(text|email|tel|number)/i,
  ]

  return formPatterns.some((pattern) => pattern.test(text))
}

/**
 * Detect if context suggests log/debug output
 */
function isInLogContext(text: string): boolean {
  const logPatterns = [
    /\b(log|debug|trace|info|warn|error|fatal)\b/i,
    /\b(console|print|echo|output)\b/i,
    /\d{4}-\d{2}-\d{2}|\d{2}:\d{2}:\d{2}/, // timestamp patterns
    /\[(DEBUG|INFO|WARN|ERROR|TRACE)\]/i,
  ]

  return logPatterns.some((pattern) => pattern.test(text))
}
