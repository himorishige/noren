/**
 * Contextual confidence scoring for PII detection
 * Streamlined implementation with unified rule evaluation and context analysis
 */

import type { Hit } from '@himorishige/noren-core'
import { type ContextFeatures, extractContextFeatures } from './context-detection.js'

// ===== Core Interfaces =====

export interface ContextualConfidenceResult {
  baseConfidence: number
  contextualConfidence: number
  adjustmentFactor: number
  explanations: ContextualExplanation[]
  features: ContextFeatures
}

export interface ContextualExplanation {
  ruleId: string
  effect: 'suppress' | 'boost' | 'neutral'
  weight: number
  reason: string
  distance?: number
}

export interface ContextualRule {
  id: string
  priority: number
  condition: (features: ContextFeatures, hit: Hit) => boolean
  multiplier: number
  offset?: number
  description: string
}

export interface ContextualConfig {
  enabled: boolean
  suppressionEnabled: boolean
  boostEnabled: boolean
  minConfidenceFloor: number
  maxConfidenceCeiling: number
  rules: ContextualRule[]
}

// ===== Rule Definitions =====

const CONTEXTUAL_RULES: ContextualRule[] = [
  // High priority suppression rules
  {
    id: 'example-marker-strong',
    priority: 100,
    condition: (features) =>
      features.markers.exampleNearby && features.markers.distanceToNearestMarker <= 16,
    multiplier: 0.4,
    description: 'Strong example marker nearby',
  },
  {
    id: 'test-marker-strong',
    priority: 95,
    condition: (features) =>
      features.markers.testNearby && features.markers.distanceToNearestMarker <= 16,
    multiplier: 0.5,
    description: 'Strong test marker nearby',
  },
  {
    id: 'dummy-placeholder-strong',
    priority: 90,
    condition: (features) =>
      (features.markers.dummyNearby || features.markers.placeholderNearby) &&
      features.markers.distanceToNearestMarker <= 16,
    multiplier: 0.4,
    description: 'Strong dummy/placeholder marker nearby',
  },

  // Structure-based rules
  {
    id: 'template-section',
    priority: 85,
    condition: (features) => features.structure.templateSection,
    multiplier: 0.6,
    description: 'Inside template section',
  },
  {
    id: 'code-block',
    priority: 80,
    condition: (features) => features.structure.codeBlock,
    multiplier: 0.7,
    description: 'Inside code block',
  },
  {
    id: 'header-row',
    priority: 75,
    condition: (features) => features.structure.headerRow,
    multiplier: 0.5,
    description: 'In CSV/table header row',
  },

  // Format-specific rules
  {
    id: 'json-structure',
    priority: 72,
    condition: (features) => features.structure.jsonLike && hasExampleContext(features),
    multiplier: 0.3,
    description: 'JSON with example-like patterns',
  },
  {
    id: 'csv-example-data',
    priority: 65,
    condition: (features) =>
      features.structure.csvLike && !features.structure.headerRow && hasExampleContext(features),
    multiplier: 0.4,
    description: 'CSV example data row',
  },

  // Weaker suppression rules
  {
    id: 'repetitive-context',
    priority: 70,
    condition: (features) => features.repetitionDetected,
    multiplier: 0.6,
    description: 'Repetitive context detected',
  },
  {
    id: 'example-marker-weak',
    priority: 60,
    condition: (features) =>
      features.markers.exampleNearby && features.markers.distanceToNearestMarker > 16,
    multiplier: 0.7,
    description: 'Weak example marker nearby',
  },

  // Boost rules (disabled by default)
  {
    id: 'high-entropy-boost',
    priority: 50,
    condition: (features) => features.highEntropyNearby,
    multiplier: 1.2,
    description: 'High entropy pattern nearby (indicates real data)',
  },
  {
    id: 'structured-data-boost',
    priority: 45,
    condition: (features) => features.structure.jsonLike || features.structure.xmlLike,
    multiplier: 1.1,
    offset: 0.02,
    description: 'Structured data format (slight boost for real data)',
  },
]

// ===== Default Configurations =====

export const DEFAULT_CONTEXTUAL_CONFIG: ContextualConfig = {
  enabled: true,
  suppressionEnabled: true,
  boostEnabled: false,
  minConfidenceFloor: 0.5,
  maxConfidenceCeiling: 0.98,
  rules: CONTEXTUAL_RULES,
}

export const CONSERVATIVE_CONTEXTUAL_CONFIG: ContextualConfig = {
  ...DEFAULT_CONTEXTUAL_CONFIG,
  minConfidenceFloor: 0.6,
  rules: CONTEXTUAL_RULES.filter((rule) => rule.multiplier <= 1.0), // Suppression only
}

export const DISABLED_CONTEXTUAL_CONFIG: ContextualConfig = {
  ...DEFAULT_CONTEXTUAL_CONFIG,
  enabled: false,
}

// ===== Main Functions =====

export function calculateContextualConfidence(
  hit: Hit,
  text: string,
  baseConfidence: number,
  config: ContextualConfig = DEFAULT_CONTEXTUAL_CONFIG,
): ContextualConfidenceResult {
  if (!config.enabled) {
    return {
      baseConfidence,
      contextualConfidence: baseConfidence,
      adjustmentFactor: 1.0,
      explanations: [],
      features: extractContextFeatures(text, hit.start),
    }
  }

  // Extract context features
  const features = extractContextFeatures(text, hit.start)

  // Find applicable rules
  const applicableRules = config.rules
    .filter((rule) => rule.condition(features, hit))
    .sort((a, b) => b.priority - a.priority) // Sort by priority (highest first)

  // Resolve conflicts (take highest priority rule from each category)
  const resolvedRules = resolveRuleConflicts(applicableRules)

  // Apply rules
  let adjustmentFactor = 1.0
  let totalOffset = 0
  const explanations: ContextualExplanation[] = []

  for (const rule of resolvedRules) {
    const isBoost = rule.multiplier > 1.0 || (rule.offset && rule.offset > 0)
    const isSuppression = rule.multiplier < 1.0 || (rule.offset && rule.offset < 0)

    // Skip disabled adjustment types
    if ((isBoost && !config.boostEnabled) || (isSuppression && !config.suppressionEnabled)) {
      continue
    }

    adjustmentFactor *= rule.multiplier
    if (rule.offset) {
      totalOffset += rule.offset
    }

    explanations.push({
      ruleId: rule.id,
      effect: isBoost ? 'boost' : isSuppression ? 'suppress' : 'neutral',
      weight: rule.multiplier,
      reason: rule.description,
      distance:
        features.markers.distanceToNearestMarker >= 0
          ? features.markers.distanceToNearestMarker
          : undefined,
    })
  }

  // Calculate final confidence with safety bounds
  const rawContextualConfidence = baseConfidence * adjustmentFactor + totalOffset
  const minConfidence = Math.max(0.01, baseConfidence * config.minConfidenceFloor)
  const maxConfidence = config.maxConfidenceCeiling

  const contextualConfidence = Math.max(
    minConfidence,
    Math.min(maxConfidence, rawContextualConfidence),
  )

  return {
    baseConfidence,
    contextualConfidence,
    adjustmentFactor,
    explanations,
    features,
  }
}

export function applyContextualConfidence(
  hit: Hit,
  text: string,
  config: ContextualConfig = DEFAULT_CONTEXTUAL_CONFIG,
): ContextualConfidenceResult {
  const baseConfidence = hit.confidence || 0.5
  const result = calculateContextualConfidence(hit, text, baseConfidence, config)

  // Update hit with contextual confidence
  hit.confidence = result.contextualConfidence

  // Add contextual explanations to reasons if available
  if (hit.reasons && result.explanations.length > 0) {
    const contextualReasons = result.explanations.map((exp) => `contextual:${exp.ruleId}`)
    hit.reasons.push(...contextualReasons)
  }

  // Store contextual features in hit
  if (!hit.features) {
    hit.features = {}
  }
  hit.features.contextual = {
    adjustmentFactor: result.adjustmentFactor,
    explanations: result.explanations,
    contextFeatures: result.features,
  }

  return result
}

export function calculateContextualConfidenceWithDebug(
  hit: Hit,
  text: string,
  baseConfidence: number,
  config: ContextualConfig = DEFAULT_CONTEXTUAL_CONFIG,
): ContextualConfidenceResult & {
  debug: {
    rulesEvaluated: number
    rulesApplied: number
    executionTimeMs: number
  }
} {
  const startTime = performance.now()
  const result = calculateContextualConfidence(hit, text, baseConfidence, config)
  const executionTime = performance.now() - startTime

  const _applicableRules = config.rules.filter((rule) => rule.condition(result.features, hit))

  return {
    ...result,
    debug: {
      rulesEvaluated: config.rules.length,
      rulesApplied: result.explanations.length,
      executionTimeMs: executionTime,
    },
  }
}

// ===== Helper Functions =====

function resolveRuleConflicts(rules: ContextualRule[]): ContextualRule[] {
  if (rules.length <= 1) return rules

  // Group rules by category for conflict resolution
  const categories = new Map<string, ContextualRule[]>()

  for (const rule of rules) {
    const category = getRuleCategory(rule)
    if (!categories.has(category)) {
      categories.set(category, [])
    }
    categories.get(category)?.push(rule)
  }

  // Take the highest priority rule from each category
  const resolved: ContextualRule[] = []
  for (const categoryRules of categories.values()) {
    if (categoryRules.length === 1) {
      resolved.push(categoryRules[0])
    } else {
      // Sort by priority and take the first (highest priority)
      categoryRules.sort((a, b) => b.priority - a.priority)
      resolved.push(categoryRules[0])
    }
  }

  return resolved
}

function getRuleCategory(rule: ContextualRule): string {
  if (rule.id.includes('json') || rule.id.includes('xml') || rule.id.includes('csv')) {
    return 'format-specific'
  }
  if (rule.id.includes('example')) {
    return 'example-marker'
  }
  if (rule.id.includes('test')) {
    return 'test-marker'
  }
  if (rule.id.includes('dummy') || rule.id.includes('placeholder')) {
    return 'placeholder-marker'
  }
  if (rule.id.includes('template')) {
    return 'template-based'
  }
  if (rule.id.includes('code')) {
    return 'code-based'
  }
  if (rule.id.includes('header')) {
    return 'header-based'
  }
  if (rule.multiplier > 1.0) {
    return 'boost'
  }
  return 'general'
}

function hasExampleContext(features: ContextFeatures): boolean {
  return (
    features.markers.exampleNearby || features.markers.dummyNearby || features.markers.sampleNearby
  )
}

export function createContextualConfig(overrides: Partial<ContextualConfig>): ContextualConfig {
  return {
    ...DEFAULT_CONTEXTUAL_CONFIG,
    ...overrides,
    rules: overrides.rules || DEFAULT_CONTEXTUAL_CONFIG.rules,
  }
}

// ===== Rule Visualization (Simplified) =====

export interface RuleVisualization {
  ruleId: string
  category: string
  priority: number
  effect: 'suppress' | 'boost' | 'neutral'
  strength: 'weak' | 'medium' | 'strong'
  description: string
}

export function visualizeRules(config: ContextualConfig): RuleVisualization[] {
  return config.rules.map((rule) => ({
    ruleId: rule.id,
    category: getRuleCategory(rule),
    priority: rule.priority,
    effect: rule.multiplier > 1.0 ? 'boost' : rule.multiplier < 1.0 ? 'suppress' : 'neutral',
    strength: getEffectStrength(rule.multiplier, rule.offset),
    description: rule.description,
  }))
}

function getEffectStrength(multiplier: number, offset?: number): 'weak' | 'medium' | 'strong' {
  const effectMagnitude = Math.abs(multiplier - 1.0) + Math.abs(offset || 0)
  if (effectMagnitude < 0.2) return 'weak'
  if (effectMagnitude < 0.5) return 'medium'
  return 'strong'
}
