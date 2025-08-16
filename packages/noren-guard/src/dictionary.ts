/**
 * PII Dictionary System
 *
 * TypeScript-based pattern configuration system
 * Supports custom dictionary creation and extension
 */

import type { GuardConfig, InjectionPattern, SanitizeRule, Severity } from './types.js'

// Dictionary type definitions
export interface PIIPattern {
  id: string
  description: string
  pattern: string
  severity: Severity
  weight: number
  category: string
  sanitize: boolean
  contexts?: string[]
}

export interface PIISanitizeRule {
  pattern: string
  action: 'remove' | 'replace' | 'neutralize' | 'quote'
  replacement?: string
  category: string
  priority: number
}

export interface PIIDictionary {
  name: string
  description: string
  version: string
  patterns: PIIPattern[]
  sanitizeRules: PIISanitizeRule[]
}

// Dictionary management functions
const customDictionaries = new Map<string, PIIDictionary>()

/**
 * Register a custom dictionary
 */
export function registerCustomDictionary(name: string, dictionary: PIIDictionary): void {
  customDictionaries.set(name, dictionary)
}

/**
 * Create a custom dictionary from user patterns
 */
export function createCustomDictionary(
  name: string,
  config: {
    description?: string
    patterns: PIIPattern[]
    sanitizeRules?: PIISanitizeRule[]
  },
): void {
  const dictionary: PIIDictionary = {
    name,
    description: config.description || `Custom dictionary: ${name}`,
    version: '1.0.0',
    patterns: config.patterns,
    sanitizeRules: config.sanitizeRules || [],
  }
  customDictionaries.set(name, dictionary)
}

/**
 * Convert PII patterns to injection patterns
 */
export function convertToInjectionPatterns(piiPatterns: PIIPattern[]): InjectionPattern[] {
  return piiPatterns.map((pattern) => ({
    id: pattern.id,
    pattern: new RegExp(pattern.pattern, 'gi'),
    description: pattern.description,
    severity: pattern.severity,
    category: pattern.category,
    weight: pattern.weight,
    sanitize: pattern.sanitize,
  }))
}

/**
 * Convert PII sanitize rules to guard sanitize rules
 */
export function convertToSanitizeRules(piiRules: PIISanitizeRule[]): SanitizeRule[] {
  return piiRules.map((rule) => ({
    pattern: new RegExp(rule.pattern, 'gi'),
    action: rule.action,
    replacement: rule.replacement,
    category: rule.category,
    priority: rule.priority,
  }))
}

/**
 * Create guard configuration from custom dictionary
 */
export function createConfigFromCustomDictionary(dictionaryName: string): Partial<GuardConfig> {
  const dictionary = customDictionaries.get(dictionaryName)
  if (!dictionary) {
    throw new Error(`Custom dictionary '${dictionaryName}' not found`)
  }

  return {
    customPatterns: convertToInjectionPatterns(dictionary.patterns),
    customRules: convertToSanitizeRules(dictionary.sanitizeRules),
  }
}

/**
 * Get available custom dictionaries
 */
export function getCustomDictionaries(): string[] {
  return Array.from(customDictionaries.keys())
}

/**
 * Check if a custom dictionary exists
 */
export function hasCustomDictionary(name: string): boolean {
  return customDictionaries.has(name)
}

/**
 * Clear custom dictionaries
 */
export function clearCustomDictionaries(): void {
  customDictionaries.clear()
}

/**
 * Quick PII detection setup functions
 */

/**
 * Create a custom guard from patterns
 */
export function createCustomGuard(config: {
  patterns: PIIPattern[]
  sanitizeRules?: PIISanitizeRule[]
  riskThreshold?: number
  enableSanitization?: boolean
}): Partial<GuardConfig> {
  return {
    customPatterns: convertToInjectionPatterns(config.patterns),
    customRules: convertToSanitizeRules(config.sanitizeRules || []),
    riskThreshold: config.riskThreshold,
    enableSanitization: config.enableSanitization,
  }
}

/**
 * Create guard from custom dictionary
 */
export function createGuardFromCustomDictionary(name: string): Partial<GuardConfig> {
  return createConfigFromCustomDictionary(name)
}

/**
 * List available custom dictionaries
 */
export function listCustomDictionaries(): string[] {
  return getCustomDictionaries()
}

// Legacy class exports for backward compatibility
// biome-ignore lint/complexity/noStaticOnlyClass: Backward compatibility
export class DictionaryLoader {
  static registerCustomDictionary = registerCustomDictionary
  static createCustomDictionary = createCustomDictionary
  static convertToInjectionPatterns = convertToInjectionPatterns
  static convertToSanitizeRules = convertToSanitizeRules
  static createConfigFromCustomDictionary = createConfigFromCustomDictionary
  static getCustomDictionaries = getCustomDictionaries
  static hasCustomDictionary = hasCustomDictionary
  static clearCustomDictionaries = clearCustomDictionaries
}

// biome-ignore lint/complexity/noStaticOnlyClass: Backward compatibility
export class PIIGuard {
  static createCustom = createCustomGuard
  static fromCustomDictionary = createGuardFromCustomDictionary
  static listCustomDictionaries = listCustomDictionaries
}
