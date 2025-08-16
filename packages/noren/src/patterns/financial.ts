/**
 * Financial PII patterns for individual import
 * Allows tree-shaking for specific pattern categories
 */

import type { InjectionPattern, SanitizeRule } from '../types.js'

// Financial PII detection patterns
export const financialPatterns: InjectionPattern[] = [
  {
    id: 'credit_card',
    pattern: /\b(?:\d[ -]?){12,18}\d\b/g,
    description: 'Credit card numbers (Visa, MasterCard, Amex, etc.)',
    severity: 'high',
    category: 'financial',
    weight: 95,
    sanitize: true,
  },
  {
    id: 'bank_account',
    pattern: /\b(?:account|acct)\s*[#:]?\s*(\d{8,17})\b/gi,
    description: 'Bank account numbers',
    severity: 'high',
    category: 'financial',
    weight: 90,
    sanitize: true,
  },
  {
    id: 'routing_number',
    pattern: /\b(?:routing|aba)\s*[#:]?\s*(\d{9})\b/gi,
    description: 'US bank routing numbers (9 digits)',
    severity: 'high',
    category: 'financial',
    weight: 90,
    sanitize: true,
  },
  {
    id: 'iban',
    pattern: /\b[A-Z]{2}\d{2}[A-Z0-9]{4,28}\b/g,
    description: 'International Bank Account Number',
    severity: 'high',
    category: 'financial',
    weight: 90,
    sanitize: true,
  },
  {
    id: 'swift_code',
    pattern: /\b[A-Z]{4}[A-Z]{2}[A-Z0-9]{2}(?:[A-Z0-9]{3})?\b/g,
    description: 'SWIFT/BIC codes',
    severity: 'medium',
    category: 'financial',
    weight: 70,
    sanitize: true,
  },
]

// Financial sanitization rules
export const financialSanitizeRules: SanitizeRule[] = [
  {
    pattern: /\b(?:\d[ -]?){12,18}\d\b/g,
    action: 'replace',
    replacement: '[CARD_NUMBER]',
    category: 'financial',
    priority: 3,
  },
  {
    pattern: /\b(?:account|acct)\s*[#:]?\s*(\d{8,17})\b/gi,
    action: 'replace',
    replacement: 'account [ACCOUNT_NUMBER]',
    category: 'financial',
    priority: 3,
  },
  {
    pattern: /\b(?:routing|aba)\s*[#:]?\s*(\d{9})\b/gi,
    action: 'replace',
    replacement: 'routing [ROUTING_NUMBER]',
    category: 'financial',
    priority: 3,
  },
]

/**
 * Create financial guard configuration
 */
export function createFinancialConfig() {
  return {
    customPatterns: financialPatterns,
    customRules: financialSanitizeRules,
    riskThreshold: 60,
    enableSanitization: true,
  }
}
