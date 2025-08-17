/**
 * Dynamic pattern loader for lazy loading
 * Enables loading only required pattern categories
 */

import type { InjectionPattern, SanitizeRule } from './types.js'

// Pattern category type
export type PatternCategory = 
  | 'core'
  | 'financial' 
  | 'personal'
  | 'security'
  | 'all'

// Loaded patterns cache
const loadedPatterns = new Map<PatternCategory, InjectionPattern[]>()
const loadedRules = new Map<PatternCategory, SanitizeRule[]>()

/**
 * Dynamically load patterns by category
 */
export async function loadPatterns(
  category: PatternCategory
): Promise<InjectionPattern[]> {
  // Return cached if already loaded
  if (loadedPatterns.has(category)) {
    return loadedPatterns.get(category)!
  }

  let patterns: InjectionPattern[]

  switch (category) {
    case 'core': {
      const { CORE_PATTERNS } = await import('./patterns/core.js')
      patterns = CORE_PATTERNS
      break
    }
    case 'financial': {
      const { financialPatterns } = await import('./patterns/financial.js')
      patterns = financialPatterns
      break
    }
    case 'personal': {
      const { personalPatterns } = await import('./patterns/personal.js')
      patterns = personalPatterns
      break
    }
    case 'security': {
      const { securityPatterns } = await import('./patterns/security.js')
      patterns = securityPatterns
      break
    }
    case 'all': {
      // Load all categories
      const [core, financial, personal, security] = await Promise.all([
        loadPatterns('core'),
        loadPatterns('financial'),
        loadPatterns('personal'),
        loadPatterns('security')
      ])
      patterns = [...core, ...financial, ...personal, ...security]
      break
    }
    default:
      throw new Error(`Unknown pattern category: ${category}`)
  }

  // Cache and return
  loadedPatterns.set(category, patterns)
  return patterns
}

/**
 * Dynamically load sanitization rules by category
 */
export async function loadSanitizeRules(
  category: PatternCategory
): Promise<SanitizeRule[]> {
  // Return cached if already loaded
  if (loadedRules.has(category)) {
    return loadedRules.get(category)!
  }

  let rules: SanitizeRule[]

  switch (category) {
    case 'core': {
      // Core has no sanitization rules (performance focused)
      rules = []
      break
    }
    case 'financial': {
      const { financialSanitizeRules } = await import('./patterns/financial.js')
      rules = financialSanitizeRules
      break
    }
    case 'personal': {
      const { personalSanitizeRules } = await import('./patterns/personal.js')
      rules = personalSanitizeRules
      break
    }
    case 'security': {
      const { securitySanitizeRules } = await import('./patterns/security.js')
      rules = securitySanitizeRules
      break
    }
    case 'all': {
      // Load all categories
      const [financial, personal, security] = await Promise.all([
        loadSanitizeRules('financial'),
        loadSanitizeRules('personal'),
        loadSanitizeRules('security')
      ])
      rules = [...financial, ...personal, ...security]
      break
    }
    default:
      throw new Error(`Unknown rule category: ${category}`)
  }

  // Cache and return
  loadedRules.set(category, rules)
  return rules
}

/**
 * Load multiple categories at once
 */
export async function loadMultipleCategories(
  categories: PatternCategory[]
): Promise<{
  patterns: InjectionPattern[]
  rules: SanitizeRule[]
}> {
  const [patternsResults, rulesResults] = await Promise.all([
    Promise.all(categories.map(cat => loadPatterns(cat))),
    Promise.all(categories.map(cat => loadSanitizeRules(cat)))
  ])

  const patterns = patternsResults.flat()
  const rules = rulesResults.flat()

  return { patterns, rules }
}

/**
 * Preload categories for better performance
 */
export async function preloadCategories(
  categories: PatternCategory[]
): Promise<void> {
  await Promise.all([
    ...categories.map(cat => loadPatterns(cat)),
    ...categories.map(cat => loadSanitizeRules(cat))
  ])
}

/**
 * Clear cache (useful for testing)
 */
export function clearPatternCache(): void {
  loadedPatterns.clear()
  loadedRules.clear()
}

/**
 * Get cache status
 */
export function getCacheStatus(): {
  loadedPatterns: PatternCategory[]
  loadedRules: PatternCategory[]
} {
  return {
    loadedPatterns: Array.from(loadedPatterns.keys()),
    loadedRules: Array.from(loadedRules.keys())
  }
}

/**
 * Create optimized guard with lazy loading
 */
export async function createLazyGuard(
  categories: PatternCategory[] = ['core'],
  options?: {
    preload?: boolean
    riskThreshold?: number
    enableSanitization?: boolean
  }
) {
  const { preload = false, riskThreshold = 60, enableSanitization = true } = options || {}

  if (preload) {
    await preloadCategories(categories)
  }

  return {
    async scan(content: string) {
      const { patterns, rules } = await loadMultipleCategories(categories)
      
      // Use lightweight core detection for initial scan
      const { createGuardContext, scan } = await import('./core.js')
      
      const context = createGuardContext({
        customPatterns: patterns,
        customRules: enableSanitization ? rules : undefined,
        riskThreshold,
        enableSanitization
      })

      return scan(context, content)
    },

    async quickScan(content: string) {
      // Use only core patterns for quick scan
      const corePatterns = await loadPatterns('core')
      const { createGuardContext, quickScan } = await import('./core.js')
      
      const context = createGuardContext({
        customPatterns: corePatterns,
        riskThreshold,
        enableSanitization: false // Quick scan doesn't sanitize
      })

      return quickScan(context, content)
    },

    async addCategory(category: PatternCategory) {
      if (!categories.includes(category)) {
        categories.push(category)
        if (preload) {
          await preloadCategories([category])
        }
      }
    },

    getLoadedCategories: () => [...categories],
    getCacheStatus
  }
}