/**
 * Functional policy management for noren-guard
 *
 * This module provides functional alternatives to the PolicyManager class,
 * enabling policy creation and management without class instantiation.
 */

import { createPIIPatterns, createPIISanitizationRules } from './builders.js'
import type { GuardConfig, InjectionPattern, SanitizeRule } from './types.js'

/**
 * Policy definition
 */
export interface Policy {
  name: string
  description: string
  patterns: InjectionPattern[]
  rules: SanitizeRule[]
  config: Partial<GuardConfig>
  metadata?: {
    version?: string
    author?: string
    tags?: string[]
    createdAt?: Date
    updatedAt?: Date
  }
}

/**
 * Policy store state
 */
export interface PolicyStore {
  policies: Map<string, Policy>
  activePolicy: string | null
}

/**
 * Creates a new policy store
 */
export function createPolicyStore(): PolicyStore {
  return {
    policies: new Map(),
    activePolicy: null,
  }
}

/**
 * Adds a policy to the store
 */
export function addPolicy(store: PolicyStore, policy: Policy): PolicyStore {
  const newPolicies = new Map(store.policies)
  newPolicies.set(policy.name, policy)

  return {
    ...store,
    policies: newPolicies,
  }
}

/**
 * Removes a policy from the store
 */
export function removePolicy(store: PolicyStore, name: string): PolicyStore {
  const newPolicies = new Map(store.policies)
  newPolicies.delete(name)

  return {
    ...store,
    policies: newPolicies,
    activePolicy: store.activePolicy === name ? null : store.activePolicy,
  }
}

/**
 * Activates a policy
 */
export function activatePolicy(store: PolicyStore, name: string): PolicyStore {
  if (!store.policies.has(name)) {
    throw new Error(`Policy "${name}" not found`)
  }

  return {
    ...store,
    activePolicy: name,
  }
}

/**
 * Gets the active policy
 */
export function getActivePolicy(store: PolicyStore): Policy | null {
  if (!store.activePolicy) return null
  return store.policies.get(store.activePolicy) || null
}

/**
 * Converts store to guard configuration
 */
export function toGuardConfig(store: PolicyStore): Partial<GuardConfig> {
  const activePolicy = getActivePolicy(store)

  if (!activePolicy) {
    return {}
  }

  return {
    ...activePolicy.config,
    customPatterns: activePolicy.patterns,
    customRules: activePolicy.rules,
  }
}

/**
 * Creates a financial services policy
 */
export function createFinancialPolicy(): Policy {
  const patterns = [
    ...createPIIPatterns(['creditcard', 'ssn']),
    {
      id: 'bank_account',
      description: 'Bank account number',
      pattern: /\b\d{8,17}\b/g,
      severity: 'high' as const,
      category: 'financial' as const,
      weight: 75,
      sanitize: true,
    },
    {
      id: 'routing_number',
      description: 'Bank routing number',
      pattern: /\b\d{9}\b/g,
      severity: 'high' as const,
      category: 'financial' as const,
      weight: 70,
      sanitize: true,
    },
  ]

  const rules = [
    ...createPIISanitizationRules(['creditcard', 'ssn']),
    {
      pattern: /\b\d{8,17}\b/g,
      action: 'replace' as const,
      replacement: '[ACCOUNT_NUMBER]',
      category: 'financial',
      priority: 2,
    },
  ]

  return {
    name: 'financial',
    description: 'Financial services security policy',
    patterns,
    rules,
    config: {
      riskThreshold: 40,
      enableSanitization: true,
      enableContextSeparation: true,
    },
    metadata: {
      tags: ['finance', 'pci', 'sensitive'],
      createdAt: new Date(),
    },
  }
}

/**
 * Creates a healthcare policy (HIPAA-compliant)
 */
export function createHealthcarePolicy(): Policy {
  const patterns = [
    ...createPIIPatterns(['ssn', 'phone', 'email']),
    {
      id: 'medical_record',
      description: 'Medical record number',
      pattern: /\bMRN[-\s]?\d{6,10}\b/gi,
      severity: 'critical' as const,
      category: 'healthcare' as const,
      weight: 90,
      sanitize: true,
    },
    {
      id: 'patient_id',
      description: 'Patient identifier',
      pattern: /\bPID[-\s]?\d{8}\b/gi,
      severity: 'critical' as const,
      category: 'healthcare' as const,
      weight: 90,
      sanitize: true,
    },
  ]

  const rules = [
    ...createPIISanitizationRules(['ssn', 'phone', 'email']),
    {
      pattern: /\bMRN[-\s]?\d{6,10}\b/gi,
      action: 'replace' as const,
      replacement: '[MEDICAL_RECORD]',
      category: 'healthcare',
      priority: 3,
    },
    {
      pattern: /\bPID[-\s]?\d{8}\b/gi,
      action: 'replace' as const,
      replacement: '[PATIENT_ID]',
      category: 'healthcare',
      priority: 3,
    },
  ]

  return {
    name: 'healthcare',
    description: 'HIPAA-compliant healthcare security policy',
    patterns,
    rules,
    config: {
      riskThreshold: 30,
      enableSanitization: true,
      enableContextSeparation: true,
    },
    metadata: {
      tags: ['healthcare', 'hipaa', 'phi', 'sensitive'],
      createdAt: new Date(),
    },
  }
}

/**
 * Creates a government/defense policy
 */
export function createGovernmentPolicy(): Policy {
  const patterns = [
    ...createPIIPatterns(['ssn', 'email']),
    {
      id: 'classified_marker',
      description: 'Classification markers',
      pattern: /\b(TOP SECRET|SECRET|CONFIDENTIAL|CLASSIFIED)\b/gi,
      severity: 'critical' as const,
      category: 'security' as const,
      weight: 100,
      sanitize: true,
    },
    {
      id: 'security_clearance',
      description: 'Security clearance references',
      pattern: /\b(TS\/SCI|SECRET|CONFIDENTIAL)\s+CLEARANCE\b/gi,
      severity: 'high' as const,
      category: 'security' as const,
      weight: 85,
      sanitize: true,
    },
  ]

  const rules = [
    ...createPIISanitizationRules(['ssn', 'email']),
    {
      pattern: /\b(TOP SECRET|SECRET|CONFIDENTIAL|CLASSIFIED)\b/gi,
      action: 'replace' as const,
      replacement: '[CLASSIFICATION_REDACTED]',
      category: 'security',
      priority: 5,
    },
  ]

  return {
    name: 'government',
    description: 'Government/Defense security policy',
    patterns,
    rules,
    config: {
      riskThreshold: 20,
      enableSanitization: true,
      enableContextSeparation: true,
    },
    metadata: {
      tags: ['government', 'defense', 'classified', 'sensitive'],
      createdAt: new Date(),
    },
  }
}

/**
 * Creates a custom policy from templates
 */
export function createCustomPolicy(
  name: string,
  options: {
    description?: string
    basePolicy?: 'financial' | 'healthcare' | 'government'
    additionalPatterns?: InjectionPattern[]
    additionalRules?: SanitizeRule[]
    config?: Partial<GuardConfig>
    metadata?: Policy['metadata']
  } = {},
): Policy {
  // Start with base policy if specified
  let basePatterns: InjectionPattern[] = []
  let baseRules: SanitizeRule[] = []
  let baseConfig: Partial<GuardConfig> = {}

  if (options.basePolicy) {
    const baseFunc = {
      financial: createFinancialPolicy,
      healthcare: createHealthcarePolicy,
      government: createGovernmentPolicy,
    }[options.basePolicy]

    const base = baseFunc()
    basePatterns = base.patterns
    baseRules = base.rules
    baseConfig = base.config
  }

  return {
    name,
    description: options.description || `Custom policy: ${name}`,
    patterns: [...basePatterns, ...(options.additionalPatterns || [])],
    rules: [...baseRules, ...(options.additionalRules || [])],
    config: { ...baseConfig, ...(options.config || {}) },
    metadata: {
      ...options.metadata,
      createdAt: new Date(),
    },
  }
}

/**
 * Merges multiple policies
 */
export function mergePolicies(
  name: string,
  policies: Policy[],
  options: {
    description?: string
    config?: Partial<GuardConfig>
    metadata?: Policy['metadata']
  } = {},
): Policy {
  const patterns: InjectionPattern[] = []
  const rules: SanitizeRule[] = []
  const configs: Partial<GuardConfig>[] = []

  // Collect unique patterns and rules
  const patternIds = new Set<string>()
  const rulePatterns = new Set<string>()

  for (const policy of policies) {
    for (const pattern of policy.patterns) {
      if (!patternIds.has(pattern.id)) {
        patternIds.add(pattern.id)
        patterns.push(pattern)
      }
    }

    for (const rule of policy.rules) {
      const key = `${rule.pattern.source}_${rule.action}`
      if (!rulePatterns.has(key)) {
        rulePatterns.add(key)
        rules.push(rule)
      }
    }

    configs.push(policy.config)
  }

  // Merge configs (take most restrictive values)
  const mergedConfig: Partial<GuardConfig> = {}

  // Take lowest risk threshold
  const riskThresholds = configs
    .map((c) => c.riskThreshold)
    .filter((t) => t !== undefined) as number[]
  if (riskThresholds.length > 0) {
    mergedConfig.riskThreshold = Math.min(...riskThresholds)
  }

  // Enable features if any policy enables them
  mergedConfig.enableSanitization = configs.some((c) => c.enableSanitization)
  mergedConfig.enableContextSeparation = configs.some((c) => c.enableContextSeparation)
  mergedConfig.enablePerfMonitoring = configs.some((c) => c.enablePerfMonitoring)

  return {
    name,
    description: options.description || `Merged policy: ${policies.map((p) => p.name).join(', ')}`,
    patterns,
    rules,
    config: { ...mergedConfig, ...(options.config || {}) },
    metadata: {
      ...options.metadata,
      createdAt: new Date(),
    },
  }
}

/**
 * Validates a policy
 */
export function validatePolicy(policy: Policy): {
  valid: boolean
  errors: string[]
  warnings: string[]
} {
  const errors: string[] = []
  const warnings: string[] = []

  // Check required fields
  if (!policy.name) {
    errors.push('Policy name is required')
  }

  if (!policy.patterns || policy.patterns.length === 0) {
    warnings.push('Policy has no patterns defined')
  }

  // Check pattern validity
  for (const pattern of policy.patterns) {
    if (!pattern.id) {
      errors.push('Pattern missing ID')
    }
    if (!pattern.pattern) {
      errors.push(`Pattern ${pattern.id} missing regex`)
    }
    try {
      // Test pattern compilation
      'test'.match(pattern.pattern)
    } catch (_error) {
      errors.push(`Pattern ${pattern.id} has invalid regex`)
    }
  }

  // Check rule validity
  for (const rule of policy.rules || []) {
    if (!rule.pattern) {
      errors.push('Rule missing pattern')
    }
    if (!rule.action) {
      errors.push('Rule missing action')
    }
    if (rule.action === 'replace' && !rule.replacement) {
      warnings.push('Replace rule missing replacement text')
    }
  }

  // Check config
  if (policy.config.riskThreshold !== undefined) {
    if (policy.config.riskThreshold < 0 || policy.config.riskThreshold > 100) {
      errors.push('Risk threshold must be between 0 and 100')
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  }
}

/**
 * Exports a policy to JSON
 */
export function exportPolicy(policy: Policy): string {
  const exportable = {
    ...policy,
    patterns: policy.patterns.map((p) => ({
      ...p,
      pattern: p.pattern.source,
      flags: p.pattern.flags,
    })),
    rules: policy.rules.map((r) => ({
      ...r,
      pattern: r.pattern.source,
      flags: r.pattern.flags,
    })),
  }

  return JSON.stringify(exportable, null, 2)
}

/**
 * Imports a policy from JSON
 */
export function importPolicy(json: string): Policy {
  const data = JSON.parse(json)

  // Reconstruct regex patterns
  const patterns = data.patterns.map((p: { pattern: string; flags?: string }) => ({
    ...p,
    pattern: new RegExp(p.pattern, p.flags || 'gi'),
  }))

  const rules = data.rules.map((r: { pattern: string; flags?: string }) => ({
    ...r,
    pattern: new RegExp(r.pattern, r.flags || 'gi'),
  }))

  return {
    ...data,
    patterns,
    rules,
    metadata: {
      ...data.metadata,
      createdAt: data.metadata?.createdAt ? new Date(data.metadata.createdAt) : undefined,
      updatedAt: data.metadata?.updatedAt ? new Date(data.metadata.updatedAt) : undefined,
    },
  }
}
