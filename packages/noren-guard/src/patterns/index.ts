/**
 * Combined patterns and rules from all categories
 */

import type { InjectionPattern, SanitizeRule } from '../types.js'
import { financialPatterns, financialSanitizeRules } from './financial.js'
import { personalPatterns, personalSanitizeRules } from './personal.js'
import { securityPatterns, securitySanitizeRules } from './security.js'

/**
 * All patterns combined
 */
export const ALL_PATTERNS: InjectionPattern[] = [
  ...financialPatterns,
  ...personalPatterns,
  ...securityPatterns,
]

/**
 * All sanitize rules combined
 */
export const ALL_SANITIZE_RULES: SanitizeRule[] = [
  ...financialSanitizeRules,
  ...personalSanitizeRules,
  ...securitySanitizeRules,
]

/**
 * Preset configurations
 */
export const PRESETS = {
  strict: {
    patterns: ALL_PATTERNS,
    rules: ALL_SANITIZE_RULES,
    riskThreshold: 30,
  },
  balanced: {
    patterns: ALL_PATTERNS,
    rules: ALL_SANITIZE_RULES,
    riskThreshold: 60,
  },
  permissive: {
    patterns: ALL_PATTERNS.filter((p) => p.severity === 'critical' || p.severity === 'high'),
    rules: ALL_SANITIZE_RULES,
    riskThreshold: 80,
  },
}
