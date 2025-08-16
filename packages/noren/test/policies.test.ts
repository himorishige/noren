import { describe, expect, test } from 'vitest'
import type { PolicyStore } from '../src/policies.js'
import {
  activatePolicy,
  addPolicy,
  createCustomPolicy,
  createFinancialPolicy,
  createGovernmentPolicy,
  createHealthcarePolicy,
  createPolicyStore,
  exportPolicy,
  getActivePolicy,
  importPolicy,
  mergePolicies,
  removePolicy,
  toGuardConfig,
  validatePolicy,
} from '../src/policies.js'

/**
 * Tests for policy management functionality
 * Covers policy store operations, predefined policies, custom policies, and validation
 */

describe('createPolicyStore', () => {
  test('Creates empty policy store', () => {
    const store = createPolicyStore()

    expect(store.policies.size).toBe(0)
    expect(store.activePolicy).toBeNull()
  })
})

describe('addPolicy', () => {
  test('Adds policy to store', () => {
    const store = createPolicyStore()
    const policy = createFinancialPolicy()

    const newStore = addPolicy(store, policy)

    expect(newStore.policies.size).toBe(1)
    expect(newStore.policies.has('financial')).toBe(true)
    expect(newStore.policies.get('financial')).toBe(policy)

    // Original store should be unchanged
    expect(store.policies.size).toBe(0)
  })

  test('Overwrites existing policy with same name', () => {
    let store = createPolicyStore()
    const policy1 = createFinancialPolicy()
    const policy2 = { ...policy1, description: 'Updated description' }

    store = addPolicy(store, policy1)
    store = addPolicy(store, policy2)

    expect(store.policies.size).toBe(1)
    expect(store.policies.get('financial')?.description).toBe('Updated description')
  })
})

describe('removePolicy', () => {
  test('Removes policy from store', () => {
    let store = createPolicyStore()
    const policy = createFinancialPolicy()

    store = addPolicy(store, policy)
    store = removePolicy(store, 'financial')

    expect(store.policies.size).toBe(0)
    expect(store.policies.has('financial')).toBe(false)
  })

  test('Deactivates policy if it was active', () => {
    let store = createPolicyStore()
    const policy = createFinancialPolicy()

    store = addPolicy(store, policy)
    store = activatePolicy(store, 'financial')
    store = removePolicy(store, 'financial')

    expect(store.activePolicy).toBeNull()
  })

  test('Keeps other active policy if removing different policy', () => {
    let store = createPolicyStore()
    const financial = createFinancialPolicy()
    const healthcare = createHealthcarePolicy()

    store = addPolicy(store, financial)
    store = addPolicy(store, healthcare)
    store = activatePolicy(store, 'financial')
    store = removePolicy(store, 'healthcare')

    expect(store.activePolicy).toBe('financial')
  })

  test('Does nothing if policy does not exist', () => {
    const store = createPolicyStore()
    const newStore = removePolicy(store, 'nonexistent')

    expect(newStore).toEqual(store)
  })
})

describe('activatePolicy', () => {
  test('Activates existing policy', () => {
    let store = createPolicyStore()
    const policy = createFinancialPolicy()

    store = addPolicy(store, policy)
    store = activatePolicy(store, 'financial')

    expect(store.activePolicy).toBe('financial')
  })

  test('Throws error for non-existent policy', () => {
    const store = createPolicyStore()

    expect(() => activatePolicy(store, 'nonexistent')).toThrow('Policy "nonexistent" not found')
  })

  test('Changes active policy', () => {
    let store = createPolicyStore()
    const financial = createFinancialPolicy()
    const healthcare = createHealthcarePolicy()

    store = addPolicy(store, financial)
    store = addPolicy(store, healthcare)
    store = activatePolicy(store, 'financial')
    store = activatePolicy(store, 'healthcare')

    expect(store.activePolicy).toBe('healthcare')
  })
})

describe('getActivePolicy', () => {
  test('Returns active policy', () => {
    let store = createPolicyStore()
    const policy = createFinancialPolicy()

    store = addPolicy(store, policy)
    store = activatePolicy(store, 'financial')

    const activePolicy = getActivePolicy(store)
    expect(activePolicy).toBe(policy)
  })

  test('Returns null when no active policy', () => {
    const store = createPolicyStore()

    const activePolicy = getActivePolicy(store)
    expect(activePolicy).toBeNull()
  })

  test('Returns null when active policy does not exist', () => {
    const store: PolicyStore = {
      policies: new Map(),
      activePolicy: 'nonexistent',
    }

    const activePolicy = getActivePolicy(store)
    expect(activePolicy).toBeNull()
  })
})

describe('toGuardConfig', () => {
  test('Returns empty config when no active policy', () => {
    const store = createPolicyStore()

    const config = toGuardConfig(store)
    expect(config).toEqual({})
  })

  test('Returns config from active policy', () => {
    let store = createPolicyStore()
    const policy = createFinancialPolicy()

    store = addPolicy(store, policy)
    store = activatePolicy(store, 'financial')

    const config = toGuardConfig(store)

    expect(config.riskThreshold).toBe(40)
    expect(config.enableSanitization).toBe(true)
    expect(config.enableContextSeparation).toBe(true)
    expect(config.customPatterns).toBe(policy.patterns)
    expect(config.customRules).toBe(policy.rules)
  })
})

describe('createFinancialPolicy', () => {
  test('Creates financial policy with correct structure', () => {
    const policy = createFinancialPolicy()

    expect(policy.name).toBe('financial')
    expect(policy.description).toBe('Financial services security policy')
    expect(policy.patterns.length).toBeGreaterThan(0)
    expect(policy.rules.length).toBeGreaterThan(0)
    expect(policy.config.riskThreshold).toBe(40)
    expect(policy.metadata?.tags).toContain('finance')
    expect(policy.metadata?.tags).toContain('pci')
  })

  test('Has credit card and SSN patterns', () => {
    const policy = createFinancialPolicy()

    const creditCardPattern = policy.patterns.find((p) => p.id.includes('creditcard'))
    const ssnPattern = policy.patterns.find((p) => p.id.includes('ssn'))

    expect(creditCardPattern).toBeDefined()
    expect(ssnPattern).toBeDefined()
  })

  test('Has bank account patterns', () => {
    const policy = createFinancialPolicy()

    const bankAccountPattern = policy.patterns.find((p) => p.id === 'bank_account')
    const routingPattern = policy.patterns.find((p) => p.id === 'routing_number')

    expect(bankAccountPattern).toBeDefined()
    expect(bankAccountPattern?.severity).toBe('high')
    expect(routingPattern).toBeDefined()
    expect(routingPattern?.category).toBe('financial')
  })

  test('Has appropriate sanitization rules', () => {
    const policy = createFinancialPolicy()

    const accountRule = policy.rules.find((r) => r.replacement === '[ACCOUNT_NUMBER]')
    expect(accountRule).toBeDefined()
    expect(accountRule?.action).toBe('replace')
  })
})

describe('createHealthcarePolicy', () => {
  test('Creates healthcare policy with HIPAA compliance', () => {
    const policy = createHealthcarePolicy()

    expect(policy.name).toBe('healthcare')
    expect(policy.description).toContain('HIPAA')
    expect(policy.config.riskThreshold).toBe(30) // Stricter than financial
    expect(policy.metadata?.tags).toContain('hipaa')
    expect(policy.metadata?.tags).toContain('phi')
  })

  test('Has medical record patterns', () => {
    const policy = createHealthcarePolicy()

    const mrnPattern = policy.patterns.find((p) => p.id === 'medical_record')
    const pidPattern = policy.patterns.find((p) => p.id === 'patient_id')

    expect(mrnPattern).toBeDefined()
    expect(mrnPattern?.severity).toBe('critical')
    expect(pidPattern).toBeDefined()
    expect(pidPattern?.category).toBe('healthcare')
  })

  test('Has medical data sanitization rules', () => {
    const policy = createHealthcarePolicy()

    const mrnRule = policy.rules.find((r) => r.replacement === '[MEDICAL_RECORD]')
    const pidRule = policy.rules.find((r) => r.replacement === '[PATIENT_ID]')

    expect(mrnRule).toBeDefined()
    expect(pidRule).toBeDefined()
    expect(mrnRule?.priority).toBe(3)
  })
})

describe('createGovernmentPolicy', () => {
  test('Creates government policy with highest security', () => {
    const policy = createGovernmentPolicy()

    expect(policy.name).toBe('government')
    expect(policy.description).toContain('Government/Defense')
    expect(policy.config.riskThreshold).toBe(20) // Most strict
    expect(policy.metadata?.tags).toContain('classified')
    expect(policy.metadata?.tags).toContain('defense')
  })

  test('Has classification markers', () => {
    const policy = createGovernmentPolicy()

    const classifiedPattern = policy.patterns.find((p) => p.id === 'classified_marker')
    const clearancePattern = policy.patterns.find((p) => p.id === 'security_clearance')

    expect(classifiedPattern).toBeDefined()
    expect(classifiedPattern?.severity).toBe('critical')
    expect(classifiedPattern?.weight).toBe(100)
    expect(clearancePattern).toBeDefined()
  })

  test('Has classification sanitization rules', () => {
    const policy = createGovernmentPolicy()

    const classRule = policy.rules.find((r) => r.replacement === '[CLASSIFICATION_REDACTED]')
    expect(classRule).toBeDefined()
    expect(classRule?.priority).toBe(5)
  })
})

describe('createCustomPolicy', () => {
  test('Creates basic custom policy', () => {
    const policy = createCustomPolicy('my-policy', {
      description: 'My custom policy',
    })

    expect(policy.name).toBe('my-policy')
    expect(policy.description).toBe('My custom policy')
    expect(policy.patterns).toEqual([])
    expect(policy.rules).toEqual([])
    expect(policy.metadata?.createdAt).toBeInstanceOf(Date)
  })

  test('Creates custom policy based on existing policy', () => {
    const policy = createCustomPolicy('custom-financial', {
      description: 'Enhanced financial policy',
      basePolicy: 'financial',
    })

    expect(policy.name).toBe('custom-financial')
    expect(policy.patterns.length).toBeGreaterThan(0)
    expect(policy.rules.length).toBeGreaterThan(0)
    expect(policy.config.riskThreshold).toBe(40) // From financial base
  })

  test('Adds additional patterns and rules', () => {
    const additionalPattern = {
      id: 'custom_pattern',
      description: 'Custom pattern',
      pattern: /custom/gi,
      severity: 'medium' as const,
      category: 'custom' as const,
      weight: 50,
      sanitize: true,
    }

    const additionalRule = {
      pattern: /custom/gi,
      action: 'replace' as const,
      replacement: '[CUSTOM]',
      category: 'custom',
      priority: 1,
    }

    const policy = createCustomPolicy('enhanced', {
      basePolicy: 'financial',
      additionalPatterns: [additionalPattern],
      additionalRules: [additionalRule],
    })

    expect(policy.patterns).toContain(additionalPattern)
    expect(policy.rules).toContain(additionalRule)
  })

  test('Overrides base config', () => {
    const policy = createCustomPolicy('strict-financial', {
      basePolicy: 'financial',
      config: {
        riskThreshold: 20,
        enablePerfMonitoring: true,
      },
    })

    expect(policy.config.riskThreshold).toBe(20) // Overridden
    expect(policy.config.enableSanitization).toBe(true) // From base
    expect(policy.config.enablePerfMonitoring).toBe(true) // Added
  })
})

describe('mergePolicies', () => {
  test('Merges multiple policies', () => {
    const financial = createFinancialPolicy()
    const healthcare = createHealthcarePolicy()

    const merged = mergePolicies('combined', [financial, healthcare])

    expect(merged.name).toBe('combined')
    expect(merged.patterns.length).toBeGreaterThan(financial.patterns.length)
    expect(merged.patterns.length).toBeGreaterThan(healthcare.patterns.length)
    expect(merged.rules.length).toBeGreaterThan(financial.rules.length)
  })

  test('Takes most restrictive risk threshold', () => {
    const financial = createFinancialPolicy() // threshold: 40
    const healthcare = createHealthcarePolicy() // threshold: 30
    const government = createGovernmentPolicy() // threshold: 20

    const merged = mergePolicies('strict', [financial, healthcare, government])

    expect(merged.config.riskThreshold).toBe(20) // Lowest/most restrictive
  })

  test('Enables features if any policy enables them', () => {
    const policy1 = createCustomPolicy('p1', {
      config: { enableSanitization: false, enableContextSeparation: true },
    })
    const policy2 = createCustomPolicy('p2', {
      config: { enableSanitization: true, enableContextSeparation: false },
    })

    const merged = mergePolicies('combined', [policy1, policy2])

    expect(merged.config.enableSanitization).toBe(true)
    expect(merged.config.enableContextSeparation).toBe(true)
  })

  test('Removes duplicate patterns by ID', () => {
    const pattern = {
      id: 'duplicate',
      description: 'Test pattern',
      pattern: /test/gi,
      severity: 'medium' as const,
      category: 'test' as const,
      weight: 50,
      sanitize: true,
    }

    const policy1 = createCustomPolicy('p1', { additionalPatterns: [pattern] })
    const policy2 = createCustomPolicy('p2', { additionalPatterns: [pattern] })

    const merged = mergePolicies('deduped', [policy1, policy2])

    expect(merged.patterns.filter((p) => p.id === 'duplicate').length).toBe(1)
  })

  test('Removes duplicate rules by pattern and action', () => {
    const rule = {
      pattern: /test/gi,
      action: 'replace' as const,
      replacement: '[TEST]',
      category: 'test',
      priority: 1,
    }

    const policy1 = createCustomPolicy('p1', { additionalRules: [rule] })
    const policy2 = createCustomPolicy('p2', { additionalRules: [rule] })

    const merged = mergePolicies('deduped', [policy1, policy2])

    const duplicateRules = merged.rules.filter(
      (r) => r.pattern.source === 'test' && r.action === 'replace',
    )
    expect(duplicateRules.length).toBe(1)
  })
})

describe('validatePolicy', () => {
  test('Validates correct policy', () => {
    const policy = createFinancialPolicy()

    const result = validatePolicy(policy)

    expect(result.valid).toBe(true)
    expect(result.errors.length).toBe(0)
  })

  test('Detects missing policy name', () => {
    const policy = { ...createFinancialPolicy(), name: '' }

    const result = validatePolicy(policy)

    expect(result.valid).toBe(false)
    expect(result.errors).toContain('Policy name is required')
  })

  test('Warns about missing patterns', () => {
    const policy = { ...createFinancialPolicy(), patterns: [] }

    const result = validatePolicy(policy)

    expect(result.warnings).toContain('Policy has no patterns defined')
  })

  test('Detects invalid pattern ID', () => {
    const policy = createFinancialPolicy()
    policy.patterns[0].id = ''

    const result = validatePolicy(policy)

    expect(result.valid).toBe(false)
    expect(result.errors).toContain('Pattern missing ID')
  })

  test('Detects invalid regex pattern', () => {
    const policy = createFinancialPolicy()
    // @ts-expect-error - intentionally invalid for testing
    policy.patterns[0].pattern = null

    const result = validatePolicy(policy)

    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.includes('missing regex'))).toBe(true)
  })

  test('Detects invalid risk threshold', () => {
    const policy = createFinancialPolicy()
    policy.config.riskThreshold = 150

    const result = validatePolicy(policy)

    expect(result.valid).toBe(false)
    expect(result.errors).toContain('Risk threshold must be between 0 and 100')
  })

  test('Detects rule validation issues', () => {
    const policy = createFinancialPolicy()
    // @ts-expect-error - intentionally invalid for testing
    policy.rules[0].action = null

    const result = validatePolicy(policy)

    expect(result.valid).toBe(false)
    expect(result.errors).toContain('Rule missing action')
  })

  test('Warns about replace rule without replacement', () => {
    const policy = createFinancialPolicy()
    policy.rules[0] = {
      pattern: /test/gi,
      action: 'replace',
      replacement: '',
      category: 'test',
      priority: 1,
    }

    const result = validatePolicy(policy)

    expect(result.warnings).toContain('Replace rule missing replacement text')
  })
})

describe('exportPolicy and importPolicy', () => {
  test('Exports and imports policy correctly', () => {
    const original = createFinancialPolicy()

    const exported = exportPolicy(original)
    const imported = importPolicy(exported)

    expect(imported.name).toBe(original.name)
    expect(imported.description).toBe(original.description)
    expect(imported.patterns.length).toBe(original.patterns.length)
    expect(imported.rules.length).toBe(original.rules.length)
    expect(imported.config).toEqual(original.config)
  })

  test('Exports regex patterns as strings', () => {
    const policy = createFinancialPolicy()

    const exported = exportPolicy(policy)
    const data = JSON.parse(exported)

    // Should have pattern as string and flags separately
    expect(typeof data.patterns[0].pattern).toBe('string')
    expect(typeof data.patterns[0].flags).toBe('string')
  })

  test('Reconstructs regex patterns on import', () => {
    const original = createFinancialPolicy()

    const exported = exportPolicy(original)
    const imported = importPolicy(exported)

    // Regex patterns should be RegExp objects
    expect(imported.patterns[0].pattern).toBeInstanceOf(RegExp)
    expect(imported.rules[0].pattern).toBeInstanceOf(RegExp)

    // Pattern behavior should be preserved
    expect(imported.patterns[0].pattern.source).toBe(original.patterns[0].pattern.source)
    expect(imported.patterns[0].pattern.flags).toBe(original.patterns[0].pattern.flags)
  })

  test('Handles dates in metadata', () => {
    const policy = createFinancialPolicy()
    if (policy.metadata) {
      policy.metadata.updatedAt = new Date('2023-01-01')
    }

    const exported = exportPolicy(policy)
    const imported = importPolicy(exported)

    expect(imported.metadata?.createdAt).toBeInstanceOf(Date)
    expect(imported.metadata?.updatedAt).toBeInstanceOf(Date)
  })

  test('Export is valid JSON', () => {
    const policy = createFinancialPolicy()

    const exported = exportPolicy(policy)

    expect(() => JSON.parse(exported)).not.toThrow()

    const parsed = JSON.parse(exported)
    expect(parsed.name).toBe(policy.name)
  })
})

describe('Integration scenarios', () => {
  test('Complete policy workflow', () => {
    // Create store and add policies
    let store = createPolicyStore()
    const financial = createFinancialPolicy()
    const healthcare = createHealthcarePolicy()

    store = addPolicy(store, financial)
    store = addPolicy(store, healthcare)

    // Activate and configure
    store = activatePolicy(store, 'financial')
    const config = toGuardConfig(store)

    expect(config.riskThreshold).toBe(40)
    expect(config.customPatterns?.length).toBeGreaterThan(0)

    // Switch policies
    store = activatePolicy(store, 'healthcare')
    const healthcareConfig = toGuardConfig(store)

    expect(healthcareConfig.riskThreshold).toBe(30) // More strict
  })

  test('Custom policy based on multiple bases', () => {
    const financial = createFinancialPolicy()
    const healthcare = createHealthcarePolicy()

    // Merge existing policies
    const combined = mergePolicies('multi-sector', [financial, healthcare], {
      description: 'Policy for organizations handling both financial and health data',
    })

    // Create custom policy with additional rules
    const custom = createCustomPolicy('enhanced-multi', {
      description: 'Enhanced multi-sector policy',
      additionalPatterns: [
        {
          id: 'custom_id',
          description: 'Custom ID pattern',
          pattern: /ID-\d{8}/gi,
          severity: 'medium',
          category: 'custom',
          weight: 60,
          sanitize: true,
        },
      ],
      config: {
        riskThreshold: 25, // Between financial and healthcare
        enablePerfMonitoring: true,
      },
    })

    // Validate the results
    const validation = validatePolicy(combined)
    expect(validation.valid).toBe(true)

    const customValidation = validatePolicy(custom)
    expect(customValidation.valid).toBe(true)

    expect(combined.config.riskThreshold).toBe(30) // Most restrictive from merged
    expect(custom.config.riskThreshold).toBe(25) // Custom override
  })

  test('Policy store management', () => {
    let store = createPolicyStore()

    // Add multiple policies
    const policies = [createFinancialPolicy(), createHealthcarePolicy(), createGovernmentPolicy()]

    policies.forEach((policy) => {
      store = addPolicy(store, policy)
    })

    expect(store.policies.size).toBe(3)

    // Activate government (most restrictive)
    store = activatePolicy(store, 'government')
    let config = toGuardConfig(store)
    expect(config.riskThreshold).toBe(20)

    // Remove active policy
    store = removePolicy(store, 'government')
    expect(store.activePolicy).toBeNull()
    expect(store.policies.size).toBe(2)

    // Activate remaining policy
    store = activatePolicy(store, 'healthcare')
    config = toGuardConfig(store)
    expect(config.riskThreshold).toBe(30)
  })

  test('Export/import preserves functionality', () => {
    const original = createCustomPolicy('test-policy', {
      basePolicy: 'financial',
      additionalPatterns: [
        {
          id: 'test_pattern',
          description: 'Test pattern for export',
          pattern: /test-\d{4}/gi,
          severity: 'high',
          category: 'test',
          weight: 80,
          sanitize: true,
        },
      ],
    })

    // Export and import
    const exported = exportPolicy(original)
    const imported = importPolicy(exported)

    // Validate imported policy works
    const validation = validatePolicy(imported)
    expect(validation.valid).toBe(true)

    // Test regex functionality
    const testText = 'This contains test-1234 pattern'
    const pattern = imported.patterns.find((p) => p.id === 'test_pattern')
    expect(pattern).toBeDefined()
    expect(pattern?.pattern.test(testText)).toBe(true)

    // Store operations should work
    let store = createPolicyStore()
    store = addPolicy(store, imported)
    store = activatePolicy(store, imported.name)

    const config = toGuardConfig(store)
    expect(config.customPatterns).toContain(pattern)
  })
})
