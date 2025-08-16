import { describe, expect, test } from 'vitest'
import {
  addCompanyTerms,
  addKeywords,
  addPattern,
  addQuoteRule,
  addRemovalRule,
  addReplacementRule,
  buildPatterns,
  buildRules,
  createPatternBuilder,
  createRuleBuilder,
  patternBuilder,
  ruleBuilder,
} from '../src/builders.js'

/**
 * Tests for functional pattern and rule builders
 */

describe('Pattern Builder - Functional API', () => {
  test('createPatternBuilder creates empty state', () => {
    const state = createPatternBuilder()

    expect(state.patterns).toEqual([])
    expect(state.idCounter).toBe(0)
  })

  test('addPattern adds custom pattern with string', () => {
    let state = createPatternBuilder()

    state = addPattern(state, {
      pattern: 'test pattern',
      description: 'Test description',
      severity: 'high',
      category: 'test',
      weight: 85,
      sanitize: true,
    })

    expect(state.patterns.length).toBe(1)
    expect(state.idCounter).toBe(1)

    const pattern = state.patterns[0]
    expect(pattern.id).toBe('custom_0')
    expect(pattern.description).toBe('Test description')
    expect(pattern.pattern).toBeInstanceOf(RegExp)
    expect(pattern.pattern.source).toBe('test pattern')
    expect(pattern.pattern.flags).toBe('gi')
    expect(pattern.severity).toBe('high')
    expect(pattern.category).toBe('test')
    expect(pattern.weight).toBe(85)
    expect(pattern.sanitize).toBe(true)
  })

  test('addPattern adds custom pattern with RegExp', () => {
    let state = createPatternBuilder()
    const regex = /test.*pattern/gim

    state = addPattern(state, {
      pattern: regex,
      severity: 'critical',
    })

    expect(state.patterns.length).toBe(1)

    const pattern = state.patterns[0]
    expect(pattern.pattern).toBe(regex)
    expect(pattern.severity).toBe('critical')
    expect(pattern.description).toBe('Custom pattern') // default
    expect(pattern.category).toBe('custom') // default
  })

  test('addPattern uses default values', () => {
    let state = createPatternBuilder()

    state = addPattern(state, {
      pattern: 'minimal pattern',
    })

    const pattern = state.patterns[0]
    expect(pattern.severity).toBe('medium')
    expect(pattern.category).toBe('custom')
    expect(pattern.weight).toBe(50) // Default weight is 50
    expect(pattern.sanitize).toBe(true)
  })

  test('addKeywords creates keyword patterns', () => {
    let state = createPatternBuilder()

    state = addKeywords(state, 'sensitive', ['secret', 'password', 'token'], 'high')

    expect(state.patterns.length).toBe(3) // One pattern per keyword

    const pattern = state.patterns[0]
    expect(pattern.id).toContain('sensitive_keyword')
    expect(pattern.category).toBe('sensitive')
    expect(pattern.severity).toBe('high')
    expect(pattern.pattern.source).toContain('secret')
  })

  test('addCompanyTerms creates company-specific patterns', () => {
    let state = createPatternBuilder()

    state = addCompanyTerms(state, 'AcmeCorp', ['project-x', 'internal-api', 'confidential'])

    expect(state.patterns.length).toBe(3) // One pattern per term

    const pattern = state.patterns[0]
    expect(pattern.id).toContain('company_AcmeCorp')
    expect(pattern.category).toBe('company')
    expect(pattern.severity).toBe('high')
    expect(pattern.pattern.source).toContain('project-x')
  })

  test('buildPatterns returns immutable array', () => {
    let state = createPatternBuilder()

    state = addPattern(state, { pattern: 'test1' })
    state = addPattern(state, { pattern: 'test2' })

    const patterns = buildPatterns(state)

    expect(patterns.length).toBe(2)
    expect(patterns[0].id).toBe('custom_0')
    expect(patterns[1].id).toBe('custom_1')

    // Should be immutable
    expect(patterns).not.toBe(state.patterns)
  })

  test('Multiple operations on same state', () => {
    let state = createPatternBuilder()

    state = addPattern(state, { pattern: 'custom.*test', severity: 'critical' })
    state = addKeywords(state, 'security', ['hack', 'exploit'], 'high')
    state = addCompanyTerms(state, 'TestCorp', ['secret-project'])

    const patterns = buildPatterns(state)

    expect(patterns.length).toBe(4) // 1 custom + 2 keywords + 1 company term
    expect(patterns.find((p) => p.id === 'custom_0')).toBeDefined()
    expect(patterns.find((p) => p.id.includes('security_keyword'))).toBeDefined()
    expect(patterns.find((p) => p.id.includes('company_TestCorp'))).toBeDefined()
  })
})

describe('Rule Builder - Functional API', () => {
  test('createRuleBuilder creates empty state', () => {
    const state = createRuleBuilder()

    expect(state.rules).toEqual([])
    expect(state.ruleCounter).toBe(0)
  })

  test('addRemovalRule adds removal rule', () => {
    let state = createRuleBuilder()

    state = addRemovalRule(state, 'dangerous.*pattern', 'dangerous')

    expect(state.rules.length).toBe(1)
    expect(state.ruleCounter).toBe(1)

    const rule = state.rules[0]
    expect(rule.pattern).toBeInstanceOf(RegExp)
    expect(rule.pattern.source).toBe('dangerous.*pattern')
    expect(rule.action).toBe('remove')
    expect(rule.priority).toBe(1) // Default priority
    expect(rule.category).toBe('dangerous')
  })

  test('addReplacementRule adds replacement rule', () => {
    let state = createRuleBuilder()

    state = addReplacementRule(state, 'api[_-]?key\\s*[:=]\\s*\\S+', '[API_KEY_REDACTED]', 'security')

    expect(state.rules.length).toBe(1)

    const rule = state.rules[0]
    expect(rule.action).toBe('replace')
    expect(rule.replacement).toBe('[API_KEY_REDACTED]')
    expect(rule.priority).toBe(1) // Default priority
    expect(rule.category).toBe('security')
  })

  test('addQuoteRule adds quote rule', () => {
    let state = createRuleBuilder()

    state = addQuoteRule(state, 'execute.*code', 'code_execution')

    expect(state.rules.length).toBe(1)

    const rule = state.rules[0]
    expect(rule.action).toBe('quote')
    expect(rule.priority).toBe(1) // Default priority
    expect(rule.category).toBe('code_execution')
  })

  test('Rule builder uses default values', () => {
    let state = createRuleBuilder()

    state = addRemovalRule(state, 'test pattern')

    const rule = state.rules[0]
    expect(rule.priority).toBe(1) // default
    expect(rule.category).toBe('custom') // default is 'custom'
  })

  test('buildRules returns immutable array', () => {
    let state = createRuleBuilder()

    state = addRemovalRule(state, 'pattern1')
    state = addReplacementRule(state, 'pattern2', '[REDACTED]')

    const rules = buildRules(state)

    expect(rules.length).toBe(2)
    expect(rules[0].action).toBe('remove')
    expect(rules[1].action).toBe('replace')

    // Should be immutable
    expect(rules).not.toBe(state.rules)
  })

  test('Multiple rule operations', () => {
    let state = createRuleBuilder()

    state = addRemovalRule(state, 'remove.*this', { priority: 5 })
    state = addReplacementRule(state, 'replace.*this', '[REPLACED]', { priority: 3 })
    state = addQuoteRule(state, 'quote.*this', { priority: 4 })

    const rules = buildRules(state)

    expect(rules.length).toBe(3)
    expect(rules.find((r) => r.action === 'remove')).toBeDefined()
    expect(rules.find((r) => r.action === 'replace')).toBeDefined()
    expect(rules.find((r) => r.action === 'quote')).toBeDefined()
  })
})

describe('Pattern Builder - Fluent API', () => {
  test('Fluent API creates patterns', () => {
    const patterns = patternBuilder()
      .add({
        pattern: 'test pattern',
        severity: 'high',
        category: 'test',
      })
      .addKeywords('security', ['hack', 'exploit'], 'critical')
      .addCompanyTerms('TestCorp', ['confidential', 'secret'])
      .build()

    expect(patterns.length).toBeGreaterThan(3) // Multiple patterns from keywords and terms

    const customPattern = patterns.find((p) => p.id === 'custom_0')
    expect(customPattern).toBeDefined()
    expect(customPattern?.severity).toBe('high')

    const keywordPattern = patterns.find((p) => p.id.includes('security_keyword'))
    expect(keywordPattern).toBeDefined()
    expect(keywordPattern?.severity).toBe('critical')

    const companyPattern = patterns.find((p) => p.id.includes('company_TestCorp'))
    expect(companyPattern).toBeDefined()
  })

  test('Fluent API is chainable', () => {
    const builder = patternBuilder()

    expect(typeof builder.add).toBe('function')
    expect(typeof builder.addKeywords).toBe('function')
    expect(typeof builder.addCompanyTerms).toBe('function')
    expect(typeof builder.build).toBe('function')

    // Each method should return a builder
    const builder2 = builder.add({ pattern: 'test' })
    expect(typeof builder2.add).toBe('function')
    expect(typeof builder2.build).toBe('function')
  })

  test('Empty fluent builder', () => {
    const patterns = patternBuilder().build()

    expect(patterns).toEqual([])
  })
})

describe('Rule Builder - Fluent API', () => {
  test('Fluent API creates rules', () => {
    const rules = ruleBuilder()
      .addRemoval('remove.*pattern')
      .addReplacement('replace.*pattern', '[REPLACED]')
      .addQuote('quote.*pattern')
      .build()

    expect(rules.length).toBe(3)

    const removeRule = rules.find((r) => r.action === 'remove')
    expect(removeRule).toBeDefined()

    const replaceRule = rules.find((r) => r.action === 'replace')
    expect(replaceRule).toBeDefined()
    expect(replaceRule?.replacement).toBe('[REPLACED]')

    const quoteRule = rules.find((r) => r.action === 'quote')
    expect(quoteRule).toBeDefined()
  })

  test('Fluent API is chainable', () => {
    const builder = ruleBuilder()

    expect(typeof builder.addRemoval).toBe('function')
    expect(typeof builder.addReplacement).toBe('function')
    expect(typeof builder.addQuote).toBe('function')
    expect(typeof builder.build).toBe('function')

    // Each method should return a builder
    const builder2 = builder.addRemoval('test')
    expect(typeof builder2.addRemoval).toBe('function')
    expect(typeof builder2.build).toBe('function')
  })

  test('Empty fluent rule builder', () => {
    const rules = ruleBuilder().build()

    expect(rules).toEqual([])
  })
})

describe('Pattern validation', () => {
  test('Invalid regex patterns are handled', () => {
    let state = createPatternBuilder()

    // This should not throw, but may create an invalid pattern
    expect(() => {
      state = addPattern(state, {
        pattern: '[invalid regex',
        severity: 'high',
      })
    }).not.toThrow()

    // The pattern should still be added (validation happens elsewhere)
    expect(state.patterns.length).toBe(1)
  })

  test('Empty keywords array', () => {
    let state = createPatternBuilder()

    state = addKeywords(state, 'empty', [], 'low')

    expect(state.patterns.length).toBe(1)
    const pattern = state.patterns[0]
    expect(pattern.pattern.source).toBe('(?:)') // Empty alternation
  })

  test('Empty company terms array', () => {
    let state = createPatternBuilder()

    state = addCompanyTerms(state, 'EmptyCorp', [])

    expect(state.patterns.length).toBe(1)
    const pattern = state.patterns[0]
    expect(pattern.pattern.source).toBe('(?:)') // Empty alternation
  })

  test('Special characters in keywords are escaped', () => {
    let state = createPatternBuilder()

    state = addKeywords(state, 'special', ['[brackets]', '(parens)', '.dots'], 'medium')

    expect(state.patterns.length).toBe(3)
    
    // Check each pattern for escaped characters
    const bracketsPattern = state.patterns.find(p => p.description.includes('[brackets]'))
    const parensPattern = state.patterns.find(p => p.description.includes('(parens)'))
    const dotsPattern = state.patterns.find(p => p.description.includes('.dots'))
    
    // Special regex characters should be escaped
    expect(bracketsPattern?.pattern.source).toContain('\\[brackets\\]')
    expect(parensPattern?.pattern.source).toContain('\\(parens\\)')
    expect(dotsPattern?.pattern.source).toContain('\\.dots')
  })
})

describe('Rule validation', () => {
  test('Invalid regex in rules are handled', () => {
    let state = createRuleBuilder()

    // This should not throw
    expect(() => {
      state = addRemovalRule(state, '[invalid regex')
    }).not.toThrow()

    expect(state.rules.length).toBe(1)
  })

  test('Empty replacement string', () => {
    let state = createRuleBuilder()

    state = addReplacementRule(state, 'pattern', '')

    const rule = state.rules[0]
    expect(rule.replacement).toBe('')
  })
})

describe('Builder composition', () => {
  test('Patterns and rules work together', () => {
    const patterns = patternBuilder()
      .add({ pattern: 'secret.*info', severity: 'high' })
      .addKeywords('sensitive', ['password', 'token'], 'critical')
      .build()

    const rules = ruleBuilder()
      .addReplacement('password\\s*[:=]\\s*\\S+', '[PASSWORD_REDACTED]')
      .addQuote('secret.*info')
      .build()

    expect(patterns.length).toBe(3) // 1 custom + 2 keywords
    expect(rules.length).toBe(2)

    // Patterns should detect, rules should sanitize
    const secretPattern = patterns.find((p) => p.pattern.source.includes('secret'))
    const passwordRule = rules.find((r) => r.pattern.source.includes('password'))

    expect(secretPattern).toBeDefined()
    expect(passwordRule).toBeDefined()
    expect(passwordRule?.replacement).toBe('[PASSWORD_REDACTED]')
  })

  test('Builder state immutability', () => {
    const initialState = createPatternBuilder()
    const state1 = addPattern(initialState, { pattern: 'test1' })
    const state2 = addPattern(state1, { pattern: 'test2' })

    // Original state should be unchanged
    expect(initialState.patterns.length).toBe(0)
    expect(state1.patterns.length).toBe(1)
    expect(state2.patterns.length).toBe(2)

    // States should be different objects
    expect(state1).not.toBe(initialState)
    expect(state2).not.toBe(state1)
  })

  test('Complex pattern building scenario', () => {
    const patterns = patternBuilder()
      .add({
        pattern: 'execute\\s+(?:code|script|command)',
        description: 'Code execution attempts',
        severity: 'critical',
        category: 'code_execution',
        weight: 95,
      })
      .addKeywords(
        'financial',
        ['credit.?card', 'bank.?account', 'ssn', 'social.?security'],
        'high',
      )
      .addCompanyTerms('AcmeCorp', [
        'project.?alpha',
        'confidential.?data',
        'internal.?api',
        'admin.?panel',
      ])
      .add({
        pattern: '#system:\\s*',
        description: 'System directive injection',
        severity: 'critical',
        category: 'context_hijack',
        weight: 90,
      })
      .build()

    expect(patterns.length).toBe(4)

    // Verify each pattern type
    const codePattern = patterns.find((p) => p.category === 'code_execution')
    const financialPattern = patterns.find((p) => p.category === 'financial')
    const companyPattern = patterns.find((p) => p.category === 'company_acmecorp')
    const systemPattern = patterns.find((p) => p.category === 'context_hijack')

    expect(codePattern).toBeDefined()
    expect(codePattern?.severity).toBe('critical')
    expect(codePattern?.weight).toBe(95)

    expect(financialPattern).toBeDefined()
    expect(financialPattern?.severity).toBe('high')

    expect(companyPattern).toBeDefined()
    expect(companyPattern?.severity).toBe('high') // default for company terms

    expect(systemPattern).toBeDefined()
    expect(systemPattern?.severity).toBe('critical')
    expect(systemPattern?.weight).toBe(90)
  })
})
