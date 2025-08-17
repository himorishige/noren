/**
 * Functional builders for creating patterns, rules, and policies
 *
 * This module provides functional alternatives to the class-based builders,
 * offering better tree-shaking and composition capabilities.
 */

import type { InjectionPattern, SanitizeAction, SanitizeRule, Severity } from './types.js'

/**
 * Escapes special regex characters in a string
 */
export function escapeRegexChars(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Pattern builder state
 */
export interface PatternBuilderState {
  patterns: InjectionPattern[]
  idCounter: number
}

/**
 * Creates a new pattern builder state
 */
export function createPatternBuilder(): PatternBuilderState {
  return {
    patterns: [],
    idCounter: 0,
  }
}

/**
 * Adds a custom pattern
 */
export function addPattern(
  state: PatternBuilderState,
  options: {
    pattern: string | RegExp
    description?: string
    severity?: Severity
    category?: string
    weight?: number
    sanitize?: boolean
  },
): PatternBuilderState {
  let regex: RegExp

  try {
    regex =
      typeof options.pattern === 'string' ? new RegExp(options.pattern, 'gi') : options.pattern
  } catch (_error) {
    // If regex is invalid, create a pattern that never matches
    // Invalid regex patterns are handled by throwing error
    regex = /(?:)/gi
  }

  const newPattern: InjectionPattern = {
    id: `custom_${state.idCounter}`,
    description: options.description || 'Custom pattern',
    pattern: regex,
    severity: options.severity || 'medium',
    category: options.category || 'custom',
    weight: options.weight ?? 50,
    sanitize: options.sanitize ?? true,
  }

  return {
    ...state,
    patterns: [...state.patterns, newPattern],
    idCounter: state.idCounter + 1,
  }
}

/**
 * Adds multiple keywords as patterns
 */
export function addKeywords(
  state: PatternBuilderState,
  category: string,
  keywords: string[],
  severity: Severity = 'medium',
): PatternBuilderState {
  if (!keywords || keywords.length === 0) {
    // Return state with an empty pattern placeholder
    return {
      ...state,
      patterns: [
        ...state.patterns,
        {
          id: `${category}_keyword_${state.idCounter}`,
          description: 'Empty keyword list',
          pattern: /(?:)/gi, // Empty alternation
          severity,
          category,
          weight: 0,
          sanitize: false,
        },
      ],
      idCounter: state.idCounter + 1,
    }
  }

  const newPatterns = keywords.map((keyword, index) => ({
    id: `${category}_keyword_${state.idCounter + index}`,
    description: `Keyword: ${keyword}`,
    pattern: new RegExp(`\\b${escapeRegexChars(keyword)}\\b`, 'gi'),
    severity,
    category: category,
    weight: 60,
    sanitize: true,
  }))

  return {
    ...state,
    patterns: [...state.patterns, ...newPatterns],
    idCounter: state.idCounter + keywords.length,
  }
}

/**
 * Adds company-specific terms
 */
export function addCompanyTerms(
  state: PatternBuilderState,
  companyName: string,
  terms: string[],
): PatternBuilderState {
  if (!terms || terms.length === 0) {
    // Return state with an empty pattern placeholder
    return {
      ...state,
      patterns: [
        ...state.patterns,
        {
          id: `company_${companyName}_${state.idCounter}`,
          description: 'Empty company terms',
          pattern: /(?:)/gi, // Empty alternation
          severity: 'high' as Severity,
          category: 'company',
          weight: 0,
          sanitize: false,
        },
      ],
      idCounter: state.idCounter + 1,
    }
  }

  const newPatterns = terms.map((term, index) => ({
    id: `company_${companyName}_${state.idCounter + index}`,
    description: `Company term: ${term}`,
    pattern: new RegExp(`\\b${escapeRegexChars(term)}\\b`, 'gi'),
    severity: 'high' as Severity,
    category: 'company',
    weight: 75,
    sanitize: true,
  }))

  return {
    ...state,
    patterns: [...state.patterns, ...newPatterns],
    idCounter: state.idCounter + terms.length,
  }
}

/**
 * Adds regex patterns in bulk
 */
export function addRegexPatterns(
  state: PatternBuilderState,
  patterns: Array<{
    regex: string
    description: string
    severity?: Severity
    category?: string
  }>,
): PatternBuilderState {
  const newPatterns = patterns.map((p, index) => ({
    id: `regex_${state.idCounter + index}`,
    description: p.description,
    pattern: new RegExp(p.regex, 'gi'),
    severity: p.severity || 'medium',
    category: p.category || 'custom',
    weight: 50,
    sanitize: true,
  }))

  return {
    ...state,
    patterns: [...state.patterns, ...newPatterns],
    idCounter: state.idCounter + patterns.length,
  }
}

/**
 * Builds the final pattern array
 */
export function buildPatterns(state: PatternBuilderState): InjectionPattern[] {
  return [...state.patterns]
}

/**
 * Rule builder state
 */
export interface RuleBuilderState {
  rules: SanitizeRule[]
  ruleCounter: number
}

/**
 * Creates a new rule builder state
 */
export function createRuleBuilder(): RuleBuilderState {
  return {
    rules: [],
    ruleCounter: 0,
  }
}

/**
 * Adds a sanitization rule
 */
export function addRule(
  state: RuleBuilderState,
  options: {
    pattern: string | RegExp
    action: SanitizeAction
    replacement?: string
    category?: string
    priority?: number
  },
): RuleBuilderState {
  let regex: RegExp

  try {
    regex =
      typeof options.pattern === 'string' ? new RegExp(options.pattern, 'gi') : options.pattern
  } catch (_error) {
    // If regex is invalid, create a pattern that never matches
    // Invalid regex patterns are handled by throwing error
    regex = /(?:)/gi
  }

  const newRule: SanitizeRule = {
    pattern: regex,
    action: options.action,
    replacement: options.replacement,
    category: options.category || 'custom',
    priority: options.priority ?? 1,
  }

  return {
    ...state,
    rules: [...state.rules, newRule],
    ruleCounter: state.ruleCounter + 1,
  }
}

/**
 * Adds a removal rule
 */
export function addRemovalRule(
  state: RuleBuilderState,
  pattern: string | RegExp,
  category = 'custom',
): RuleBuilderState {
  return {
    ...addRule(state, {
      pattern,
      action: 'remove',
      category,
    }),
    ruleCounter: state.ruleCounter + 1,
  }
}

/**
 * Adds a replacement rule
 */
export function addReplacementRule(
  state: RuleBuilderState,
  pattern: string | RegExp,
  replacement: string,
  category = 'custom',
): RuleBuilderState {
  return {
    ...addRule(state, {
      pattern,
      action: 'replace',
      replacement,
      category,
    }),
    ruleCounter: state.ruleCounter + 1,
  }
}

/**
 * Adds a quote rule
 */
export function addQuoteRule(
  state: RuleBuilderState,
  pattern: string | RegExp,
  category = 'custom',
): RuleBuilderState {
  return {
    ...addRule(state, {
      pattern,
      action: 'quote',
      category,
    }),
    ruleCounter: state.ruleCounter + 1,
  }
}

/**
 * Builds the final rule array
 */
export function buildRules(state: RuleBuilderState): SanitizeRule[] {
  // Sort by priority (higher priority first)
  return [...state.rules].sort((a, b) => (b.priority || 0) - (a.priority || 0))
}

/**
 * Combined builder for patterns and rules
 */
export interface BuilderState {
  patterns: PatternBuilderState
  rules: RuleBuilderState
}

/**
 * Creates a combined builder state
 */
export function createBuilder(): BuilderState {
  return {
    patterns: createPatternBuilder(),
    rules: createRuleBuilder(),
  }
}

/**
 * Fluent API wrapper for pattern building
 */
export function patternBuilder() {
  let state = createPatternBuilder()

  const api = {
    add: (options: Parameters<typeof addPattern>[1]) => {
      state = addPattern(state, options)
      return api
    },
    addKeywords: (category: string, keywords: string[], severity?: Severity) => {
      state = addKeywords(state, category, keywords, severity)
      return api
    },
    addCompanyTerms: (companyName: string, terms: string[]) => {
      state = addCompanyTerms(state, companyName, terms)
      return api
    },
    addRegexPatterns: (patterns: Parameters<typeof addRegexPatterns>[1]) => {
      state = addRegexPatterns(state, patterns)
      return api
    },
    build: () => buildPatterns(state),
    getState: () => state,
  }

  return api
}

/**
 * Fluent API wrapper for rule building
 */
export function ruleBuilder() {
  let state = createRuleBuilder()

  const api = {
    add: (options: Parameters<typeof addRule>[1]) => {
      state = addRule(state, options)
      return api
    },
    addRemoval: (pattern: string | RegExp, category?: string) => {
      state = addRemovalRule(state, pattern, category)
      return api
    },
    addReplacement: (pattern: string | RegExp, replacement: string, category?: string) => {
      state = addReplacementRule(state, pattern, replacement, category)
      return api
    },
    addQuote: (pattern: string | RegExp, category?: string) => {
      state = addQuoteRule(state, pattern, category)
      return api
    },
    build: () => buildRules(state),
    getState: () => state,
  }

  return api
}

/**
 * Creates patterns for common PII types
 */
export function createPIIPatterns(
  types: Array<'email' | 'phone' | 'ssn' | 'ip' | 'creditcard'>,
): InjectionPattern[] {
  const patterns: InjectionPattern[] = []
  let id = 0

  const piiDefinitions = {
    email: {
      pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/gi,
      description: 'Email address',
      severity: 'medium' as Severity,
    },
    phone: {
      pattern: /\b(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g,
      description: 'Phone number',
      severity: 'medium' as Severity,
    },
    ssn: {
      pattern: /\b\d{3}-\d{2}-\d{4}\b/g,
      description: 'Social Security Number',
      severity: 'high' as Severity,
    },
    ip: {
      pattern: /\b(?:\d{1,3}\.){3}\d{1,3}\b/g,
      description: 'IP address',
      severity: 'low' as Severity,
    },
    creditcard: {
      pattern: /\b(?:\d[ -]?){12,18}\d\b/g,
      description: 'Credit card number',
      severity: 'critical' as Severity,
    },
  }

  for (const type of types) {
    if (piiDefinitions[type]) {
      const def = piiDefinitions[type]
      patterns.push({
        id: `pii_${type}_${id++}`,
        description: def.description,
        pattern: def.pattern,
        severity: def.severity,
        category: 'personal',
        weight: 70,
        sanitize: true,
      })
    }
  }

  return patterns
}

/**
 * Creates sanitization rules for PII
 */
export function createPIISanitizationRules(
  types: Array<'email' | 'phone' | 'ssn' | 'ip' | 'creditcard'>,
): SanitizeRule[] {
  const rules: SanitizeRule[] = []

  const ruleDefinitions = {
    email: {
      pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/gi,
      replacement: '[EMAIL_REDACTED]',
    },
    phone: {
      pattern: /\b(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g,
      replacement: '[PHONE_REDACTED]',
    },
    ssn: {
      pattern: /\b\d{3}-\d{2}-\d{4}\b/g,
      replacement: '[SSN_REDACTED]',
    },
    ip: {
      pattern: /\b(?:\d{1,3}\.){3}\d{1,3}\b/g,
      replacement: '[IP_REDACTED]',
    },
    creditcard: {
      pattern: /\b(?:\d[ -]?){12,18}\d\b/g,
      replacement: '[CREDIT_CARD_REDACTED]',
    },
  }

  for (const type of types) {
    if (ruleDefinitions[type]) {
      const def = ruleDefinitions[type]
      rules.push({
        pattern: def.pattern,
        action: 'replace',
        replacement: def.replacement,
        category: 'pii',
        priority: 2,
      })
    }
  }

  return rules
}
