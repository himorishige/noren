import type {
  GuardConfig,
  InjectionPattern,
  SanitizeAction,
  SanitizeRule,
  Severity,
} from './types.js'

/**
 * Custom pattern and rule management
 * Allows users to define organization-specific protection rules
 */

export interface CustomPatternConfig {
  id: string
  pattern: string | RegExp
  description: string
  severity: Severity
  category: string
  weight: number
  sanitize?: boolean
}

export interface CustomRuleConfig {
  pattern: string | RegExp
  action: SanitizeAction
  replacement?: string
  category: string
  priority?: number
}

export interface PolicyConfig {
  name: string
  description: string
  patterns: CustomPatternConfig[]
  rules: CustomRuleConfig[]
  config: Partial<GuardConfig>
}

/**
 * Pattern builder for creating custom detection patterns
 */
export class PatternBuilder {
  private patterns: InjectionPattern[] = []

  /**
   * Add instruction override pattern
   */
  addInstructionOverride(
    id: string,
    triggers: string[],
    targets: string[],
    options: {
      severity?: Severity
      weight?: number
      description?: string
    } = {},
  ): this {
    const triggerPattern = triggers.join('|')
    const targetPattern = targets.join('|')
    const pattern = new RegExp(`(?:${triggerPattern})\\s+(?:all\\s+)?(?:${targetPattern})`, 'gi')

    this.patterns.push({
      id,
      pattern,
      description: options.description || `Custom instruction override: ${id}`,
      severity: options.severity || 'high',
      category: 'instruction_override',
      weight: options.weight || 80,
      sanitize: true,
    })

    return this
  }

  /**
   * Add keyword detection pattern
   */
  addKeywords(
    id: string,
    keywords: string[],
    options: {
      severity?: Severity
      weight?: number
      category?: string
      description?: string
      caseSensitive?: boolean
      wordBoundary?: boolean
    } = {},
  ): this {
    const flags = options.caseSensitive ? 'g' : 'gi'
    const boundary = options.wordBoundary !== false ? '\\b' : ''
    const keywordPattern = keywords.join('|')
    const pattern = new RegExp(`${boundary}(?:${keywordPattern})${boundary}`, flags)

    this.patterns.push({
      id,
      pattern,
      description: options.description || `Custom keywords: ${keywords.slice(0, 3).join(', ')}`,
      severity: options.severity || 'medium',
      category: options.category || 'custom',
      weight: options.weight || 60,
      sanitize: true,
    })

    return this
  }

  /**
   * Add regex pattern
   */
  addRegex(
    id: string,
    regex: RegExp,
    options: {
      severity?: Severity
      weight?: number
      category?: string
      description?: string
    } = {},
  ): this {
    this.patterns.push({
      id,
      pattern: regex,
      description: options.description || `Custom regex: ${id}`,
      severity: options.severity || 'medium',
      category: options.category || 'custom',
      weight: options.weight || 60,
      sanitize: true,
    })

    return this
  }

  /**
   * Add context marker pattern
   */
  addContextMarker(
    id: string,
    markers: string[],
    options: {
      severity?: Severity
      weight?: number
      description?: string
    } = {},
  ): this {
    const markerPattern = markers.map((m) => m.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')
    const pattern = new RegExp(`(?:${markerPattern})`, 'gi')

    this.patterns.push({
      id,
      pattern,
      description: options.description || `Custom context markers: ${id}`,
      severity: options.severity || 'critical',
      category: 'context_hijack',
      weight: options.weight || 90,
      sanitize: true,
    })

    return this
  }

  /**
   * Add company-specific terms
   */
  addCompanyTerms(
    companyName: string,
    sensitiveTerms: string[],
    options: {
      severity?: Severity
      weight?: number
      description?: string
    } = {},
  ): this {
    return this.addKeywords(
      `company_${companyName.toLowerCase().replace(/\s+/g, '_')}`,
      sensitiveTerms,
      {
        severity: options.severity || 'high',
        weight: options.weight || 85,
        category: 'company_sensitive',
        description: options.description || `${companyName} sensitive terms`,
        wordBoundary: true,
      },
    )
  }

  /**
   * Build patterns array
   */
  build(): InjectionPattern[] {
    return [...this.patterns]
  }

  /**
   * Clear all patterns
   */
  clear(): this {
    this.patterns = []
    return this
  }
}

/**
 * Rule builder for creating custom sanitization rules
 */
export class RuleBuilder {
  private rules: SanitizeRule[] = []

  /**
   * Add removal rule
   */
  addRemoval(pattern: RegExp, category: string, priority = 1): this {
    this.rules.push({
      pattern,
      action: 'remove',
      category,
      priority,
    })
    return this
  }

  /**
   * Add replacement rule
   */
  addReplacement(pattern: RegExp, replacement: string, category: string, priority = 1): this {
    this.rules.push({
      pattern,
      action: 'replace',
      replacement,
      category,
      priority,
    })
    return this
  }

  /**
   * Add neutralization rule
   */
  addNeutralization(pattern: RegExp, category: string, priority = 1): this {
    this.rules.push({
      pattern,
      action: 'neutralize',
      category,
      priority,
    })
    return this
  }

  /**
   * Add quoting rule
   */
  addQuoting(pattern: RegExp, category: string, priority = 1): this {
    this.rules.push({
      pattern,
      action: 'quote',
      category,
      priority,
    })
    return this
  }

  /**
   * Build rules array
   */
  build(): SanitizeRule[] {
    return [...this.rules].sort((a, b) => (b.priority || 1) - (a.priority || 1))
  }

  /**
   * Clear all rules
   */
  clear(): this {
    this.rules = []
    return this
  }
}

/**
 * Policy manager for handling multiple security policies
 */
export class PolicyManager {
  private policies = new Map<string, PolicyConfig>()
  private activePolicyName?: string

  /**
   * Add a security policy
   */
  addPolicy(policy: PolicyConfig): this {
    this.policies.set(policy.name, policy)
    return this
  }

  /**
   * Load policy from configuration object
   */
  loadPolicy(config: {
    name: string
    description?: string
    patterns?: CustomPatternConfig[]
    rules?: CustomRuleConfig[]
    guardConfig?: Partial<GuardConfig>
  }): this {
    const policy: PolicyConfig = {
      name: config.name,
      description: config.description || '',
      patterns: config.patterns || [],
      rules: config.rules || [],
      config: config.guardConfig || {},
    }

    this.addPolicy(policy)
    return this
  }

  /**
   * Create financial services policy
   */
  createFinancialPolicy(): this {
    const patternBuilder = new PatternBuilder()
    const ruleBuilder = new RuleBuilder()

    // Financial-specific patterns
    patternBuilder
      .addKeywords(
        'financial_data',
        [
          'account number',
          'routing number',
          'credit card',
          'social security',
          'ssn',
          'tax id',
          'ein',
        ],
        { severity: 'critical', weight: 95, category: 'financial' },
      )
      .addKeywords(
        'trading_terms',
        ['insider information', 'material nonpublic', 'front running'],
        { severity: 'high', weight: 85, category: 'compliance' },
      )

    // Financial-specific rules
    ruleBuilder
      .addReplacement(
        /\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/g,
        '[CARD_NUMBER]',
        'financial',
        3,
      )
      .addReplacement(/\b\d{3}-\d{2}-\d{4}\b/g, '[SSN]', 'financial', 3)

    return this.addPolicy({
      name: 'financial',
      description: 'Financial services security policy',
      patterns: patternBuilder.build().map((p) => ({
        id: p.id,
        pattern: p.pattern,
        description: p.description,
        severity: p.severity,
        category: p.category,
        weight: p.weight,
        sanitize: p.sanitize,
      })),
      rules: ruleBuilder.build().map((r) => ({
        pattern: r.pattern,
        action: r.action,
        replacement: r.replacement,
        category: r.category || 'custom',
        priority: r.priority,
      })),
      config: {
        riskThreshold: 50, // Stricter for financial
        enableSanitization: true,
        enableContextSeparation: true,
      },
    })
  }

  /**
   * Create healthcare policy
   */
  createHealthcarePolicy(): this {
    const patternBuilder = new PatternBuilder()
    const ruleBuilder = new RuleBuilder()

    // Healthcare-specific patterns
    patternBuilder
      .addKeywords(
        'phi_data',
        [
          'patient id',
          'medical record',
          'diagnosis',
          'prescription',
          'treatment plan',
          'health information',
        ],
        { severity: 'critical', weight: 95, category: 'healthcare' },
      )
      .addRegex('mrn', /\bMRN[-:\s]*\d+/gi, {
        severity: 'critical',
        weight: 95,
        category: 'healthcare',
        description: 'Medical Record Number',
      })

    // Healthcare-specific rules
    ruleBuilder
      .addReplacement(/\bMRN[-:\s]*\d+/gi, '[MEDICAL_RECORD_NUMBER]', 'healthcare', 3)
      .addNeutralization(/\bpatient\s+\w+\s+diagnosed\s+with/gi, 'healthcare', 2)

    return this.addPolicy({
      name: 'healthcare',
      description: 'HIPAA-compliant healthcare policy',
      patterns: patternBuilder.build().map((p) => ({
        id: p.id,
        pattern: p.pattern,
        description: p.description,
        severity: p.severity,
        category: p.category,
        weight: p.weight,
        sanitize: p.sanitize,
      })),
      rules: ruleBuilder.build().map((r) => ({
        pattern: r.pattern,
        action: r.action,
        replacement: r.replacement,
        category: r.category || 'custom',
        priority: r.priority,
      })),
      config: {
        riskThreshold: 45, // Very strict for healthcare
        enableSanitization: true,
        enableContextSeparation: true,
      },
    })
  }

  /**
   * Create education policy
   */
  createEducationPolicy(): this {
    const patternBuilder = new PatternBuilder()

    // Education-specific patterns
    patternBuilder
      .addKeywords(
        'ferpa_data',
        [
          'student id',
          'grade',
          'transcript',
          'academic record',
          'disciplinary action',
          'special education',
        ],
        { severity: 'high', weight: 80, category: 'education' },
      )
      .addInstructionOverride(
        'homework_bypass',
        ['skip', 'ignore', 'bypass'],
        ['homework', 'assignment', 'quiz', 'test'],
        { severity: 'medium', weight: 60 },
      )

    return this.addPolicy({
      name: 'education',
      description: 'FERPA-compliant education policy',
      patterns: patternBuilder.build().map((p) => ({
        id: p.id,
        pattern: p.pattern,
        description: p.description,
        severity: p.severity,
        category: p.category,
        weight: p.weight,
        sanitize: p.sanitize,
      })),
      rules: [],
      config: {
        riskThreshold: 65, // Moderate for education
        enableSanitization: true,
        enableContextSeparation: false,
      },
    })
  }

  /**
   * Get policy by name
   */
  getPolicy(name: string): PolicyConfig | undefined {
    return this.policies.get(name)
  }

  /**
   * List all policies
   */
  listPolicies(): string[] {
    return Array.from(this.policies.keys())
  }

  /**
   * Activate a policy
   */
  activatePolicy(name: string): this {
    if (!this.policies.has(name)) {
      throw new Error(`Policy '${name}' not found`)
    }
    this.activePolicyName = name
    return this
  }

  /**
   * Get active policy
   */
  getActivePolicy(): PolicyConfig | undefined {
    if (!this.activePolicyName) return undefined
    return this.policies.get(this.activePolicyName)
  }

  /**
   * Convert policy to guard configuration
   */
  toGuardConfig(policyName?: string): Partial<GuardConfig> {
    const policy = policyName ? this.getPolicy(policyName) : this.getActivePolicy()
    if (!policy) throw new Error('No policy specified or active')

    // Convert custom patterns to injection patterns
    const customPatterns: InjectionPattern[] = policy.patterns.map((p) => ({
      id: p.id,
      pattern: typeof p.pattern === 'string' ? new RegExp(p.pattern, 'gi') : p.pattern,
      description: p.description,
      severity: p.severity,
      category: p.category,
      weight: p.weight,
      sanitize: p.sanitize || true,
    }))

    // Convert custom rules to sanitize rules
    const customRules: SanitizeRule[] = policy.rules.map((r) => ({
      pattern: typeof r.pattern === 'string' ? new RegExp(r.pattern, 'gi') : r.pattern,
      action: r.action,
      replacement: r.replacement,
      category: r.category,
      priority: r.priority,
    }))

    return {
      ...policy.config,
      customPatterns,
      customRules,
    }
  }

  /**
   * Remove policy
   */
  removePolicy(name: string): this {
    this.policies.delete(name)
    if (this.activePolicyName === name) {
      this.activePolicyName = undefined
    }
    return this
  }

  /**
   * Clear all policies
   */
  clearPolicies(): this {
    this.policies.clear()
    this.activePolicyName = undefined
    return this
  }
}

/**
 * Convenience functions for quick custom configuration
 */

/**
 * Create patterns for specific company
 */
export function createCompanyPatterns(
  companyName: string,
  sensitiveTerms: string[],
  internalCodes: string[] = [],
  projectNames: string[] = [],
): InjectionPattern[] {
  const builder = new PatternBuilder()

  builder.addCompanyTerms(companyName, sensitiveTerms, {
    severity: 'high',
    weight: 85,
  })

  if (internalCodes.length > 0) {
    builder.addKeywords(`${companyName}_codes`, internalCodes, {
      severity: 'medium',
      weight: 70,
      category: 'internal_code',
      description: `${companyName} internal codes`,
    })
  }

  if (projectNames.length > 0) {
    builder.addKeywords(`${companyName}_projects`, projectNames, {
      severity: 'medium',
      weight: 65,
      category: 'project_name',
      description: `${companyName} project names`,
    })
  }

  return builder.build()
}

/**
 * Create simple keyword-based policy
 */
export function createKeywordPolicy(
  name: string,
  keywords: string[],
  severity: Severity = 'medium',
): PolicyConfig {
  const patterns = new PatternBuilder()
    .addKeywords(`${name}_keywords`, keywords, { severity })
    .build()

  return {
    name,
    description: `Keyword-based policy for ${name}`,
    patterns: patterns.map((p) => ({
      id: p.id,
      pattern: p.pattern,
      description: p.description,
      severity: p.severity,
      category: p.category,
      weight: p.weight,
      sanitize: p.sanitize,
    })),
    rules: [],
    config: {},
  }
}
