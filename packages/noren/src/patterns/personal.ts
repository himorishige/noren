/**
 * Personal PII patterns for individual import
 * Allows tree-shaking for specific pattern categories
 */

import type { InjectionPattern, SanitizeRule } from '../types.js'

// Personal PII detection patterns
export const personalPatterns: InjectionPattern[] = [
  {
    id: 'email',
    pattern: /(?<![A-Z0-9._%+-/])([A-Z0-9._%+-]{1,64}@[A-Z0-9.-]{1,253}\.[A-Z]{2,63})(?![\w])/gi,
    description: 'Email addresses',
    severity: 'medium',
    category: 'personal',
    weight: 75,
    sanitize: true,
  },
  {
    id: 'us_phone',
    pattern: /\b(?:\+?1[-\s]?)?\(?([2-9]\d{2})\)?[-\s]?([2-9]\d{2})[-\s]?(\d{4})\b/g,
    description: 'US phone numbers',
    severity: 'medium',
    category: 'personal',
    weight: 70,
    sanitize: true,
  },
  {
    id: 'jp_phone',
    pattern: /\b(?:0[6-9]0)-?\d{4}-?\d{4}\b/g,
    description: 'Japanese phone numbers',
    severity: 'medium',
    category: 'personal',
    weight: 70,
    sanitize: true,
  },
  {
    id: 'us_ssn',
    pattern: /\b\d{3}-\d{2}-\d{4}\b/g,
    description: 'US Social Security Numbers',
    severity: 'critical',
    category: 'personal',
    weight: 95,
    sanitize: true,
  },
  {
    id: 'jp_mynumber',
    pattern: /\b\d{4}\s*\d{4}\s*\d{4}\b/g,
    description: 'Japanese MyNumber',
    severity: 'critical',
    category: 'personal',
    weight: 95,
    sanitize: true,
  },
  {
    id: 'ip_address',
    pattern:
      /\b(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\b/g,
    description: 'IP addresses (IPv4)',
    severity: 'low',
    category: 'personal',
    weight: 50,
    sanitize: true,
  },
  {
    id: 'us_zip',
    pattern: /\b\d{5}(?:-\d{4})?\b/g,
    description: 'US ZIP codes',
    severity: 'low',
    category: 'personal',
    weight: 40,
    sanitize: false,
  },
  {
    id: 'jp_postal',
    pattern: /\b\d{3}-\d{4}\b/g,
    description: 'Japanese postal codes',
    severity: 'low',
    category: 'personal',
    weight: 40,
    sanitize: false,
  },
]

// Personal data sanitization rules
export const personalSanitizeRules: SanitizeRule[] = [
  {
    pattern: /(?<![A-Z0-9._%+-/])([A-Z0-9._%+-]{1,64}@[A-Z0-9.-]{1,253}\.[A-Z]{2,63})(?![\w])/gi,
    action: 'replace',
    replacement: '[EMAIL]',
    category: 'personal',
    priority: 3,
  },
  {
    pattern: /\b(?:\+?1[-\s]?)?\(?([2-9]\d{2})\)?[-\s]?([2-9]\d{2})[-\s]?(\d{4})\b/g,
    action: 'replace',
    replacement: '[PHONE_NUMBER]',
    category: 'personal',
    priority: 3,
  },
  {
    pattern: /\b\d{3}-\d{2}-\d{4}\b/g,
    action: 'replace',
    replacement: '[SSN]',
    category: 'personal',
    priority: 5,
  },
  {
    pattern: /\b\d{4}\s*\d{4}\s*\d{4}\b/g,
    action: 'replace',
    replacement: '[MYNUMBER]',
    category: 'personal',
    priority: 5,
  },
]

/**
 * Create personal data guard configuration
 */
export function createPersonalConfig() {
  return {
    customPatterns: personalPatterns,
    customRules: personalSanitizeRules,
    riskThreshold: 70,
    enableSanitization: true,
  }
}
