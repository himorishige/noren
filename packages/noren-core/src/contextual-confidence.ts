/**
 * Contextual confidence scoring for P2 implementation
 * Combines base confidence with context-aware adjustments
 */

import type { Hit } from './types.js'
import { extractContextFeatures, type ContextFeatures } from './context-detection.js'

/**
 * Contextual confidence calculation result
 */
export interface ContextualConfidenceResult {
  baseConfidence: number
  contextualConfidence: number
  adjustmentFactor: number
  explanations: ContextualExplanation[]
  features: ContextFeatures
}

/**
 * Explanation for contextual adjustments
 */
export interface ContextualExplanation {
  ruleId: string
  effect: 'suppress' | 'boost' | 'neutral'
  weight: number
  reason: string
  snippet?: string
  distance?: number
}

/**
 * Configuration for contextual confidence adjustments
 */
export interface ContextualConfig {
  enabled: boolean
  suppressionEnabled: boolean
  boostEnabled: boolean
  minConfidenceFloor: number  // Minimum percentage of base confidence to preserve
  maxConfidenceCeiling: number  // Maximum confidence ceiling
  rules: ContextualRule[]
}

/**
 * Individual contextual rule definition
 */
export interface ContextualRule {
  id: string
  priority: number
  condition: (features: ContextFeatures, hit: Hit) => boolean
  multiplier: number
  offset?: number
  description: string
}

// Default contextual configuration
export const DEFAULT_CONTEXTUAL_CONFIG: ContextualConfig = {
  enabled: true,
  suppressionEnabled: true,
  boostEnabled: false,  // Start conservative - boost disabled initially
  minConfidenceFloor: 0.5,  // Don't drop below 50% of base confidence
  maxConfidenceCeiling: 0.98,  // Cap at 98% to preserve testing headroom
  rules: [
    // Suppression rules (ordered by priority - higher number = higher priority)
    {
      id: 'example-marker-strong',
      priority: 100,
      condition: (features) => features.markers.example_marker_nearby && features.markers.distance_to_nearest_marker <= 16,
      multiplier: 0.4,
      description: 'Strong example marker nearby (≤16 chars)'
    },
    {
      id: 'test-marker-strong', 
      priority: 95,
      condition: (features) => features.markers.test_marker_nearby && features.markers.distance_to_nearest_marker <= 16,
      multiplier: 0.5,
      description: 'Strong test marker nearby (≤16 chars)'
    },
    {
      id: 'dummy-placeholder-strong',
      priority: 90,
      condition: (features) => (features.markers.dummy_marker_nearby || features.markers.placeholder_marker_nearby) && 
                              features.markers.distance_to_nearest_marker <= 16,
      multiplier: 0.4,
      description: 'Strong dummy/placeholder marker nearby (≤16 chars)'
    },
    {
      id: 'template-section',
      priority: 85,
      condition: (features) => features.structure.template_section,
      multiplier: 0.6,
      description: 'Inside template section'
    },
    {
      id: 'code-block',
      priority: 80,
      condition: (features) => features.structure.code_block,
      multiplier: 0.7,
      description: 'Inside code block'
    },
    {
      id: 'header-row',
      priority: 75,
      condition: (features) => features.structure.header_row,
      multiplier: 0.5,
      description: 'In CSV/table header row'
    },
    {
      id: 'repetitive-context',
      priority: 70,
      condition: (features) => features.repetition_detected,
      multiplier: 0.6,
      description: 'Repetitive context detected'
    },
    {
      id: 'example-marker-weak',
      priority: 60,
      condition: (features) => features.markers.example_marker_nearby && features.markers.distance_to_nearest_marker > 16,
      multiplier: 0.7,
      description: 'Weak example marker nearby (>16 chars)'
    },
    {
      id: 'test-marker-weak',
      priority: 55,
      condition: (features) => features.markers.test_marker_nearby && features.markers.distance_to_nearest_marker > 16,
      multiplier: 0.8,
      description: 'Weak test marker nearby (>16 chars)'
    },
    // Boost rules (disabled by default, ready for future use)
    {
      id: 'high-entropy-boost',
      priority: 50,
      condition: (features) => features.high_entropy_nearby,
      multiplier: 1.2,
      description: 'High entropy pattern nearby (indicates real data)'
    },
    {
      id: 'structured-data-boost',
      priority: 45,
      condition: (features) => features.structure.json_like || features.structure.xml_like,
      multiplier: 1.1,
      offset: 0.02,
      description: 'Structured data format (slight boost for real data)'
    }
  ]
}

/**
 * Calculate contextual confidence for a hit
 */
export function calculateContextualConfidence(
  hit: Hit,
  text: string,
  baseConfidence: number,
  config: ContextualConfig = DEFAULT_CONTEXTUAL_CONFIG
): ContextualConfidenceResult {
  if (!config.enabled) {
    // Return base confidence unchanged if contextual scoring is disabled
    return {
      baseConfidence,
      contextualConfidence: baseConfidence,
      adjustmentFactor: 1.0,
      explanations: [],
      features: extractContextFeatures(text, hit.start)  // Still extract features for monitoring
    }
  }

  // Extract context features
  const features = extractContextFeatures(text, hit.start)
  
  // Apply rules in priority order (highest priority first)
  const sortedRules = config.rules.slice().sort((a, b) => b.priority - a.priority)
  const explanations: ContextualExplanation[] = []
  
  let adjustmentFactor = 1.0
  let totalOffset = 0
  
  for (const rule of sortedRules) {
    if (rule.condition(features, hit)) {
      // Check if this type of adjustment is enabled
      const isBoost = rule.multiplier > 1.0 || (rule.offset && rule.offset > 0)
      const isSuppression = rule.multiplier < 1.0 || (rule.offset && rule.offset < 0)
      
      if ((isBoost && !config.boostEnabled) || (isSuppression && !config.suppressionEnabled)) {
        continue  // Skip disabled adjustment types
      }
      
      // Apply multiplier
      adjustmentFactor *= rule.multiplier
      
      // Apply offset
      if (rule.offset) {
        totalOffset += rule.offset
      }
      
      // Record explanation
      explanations.push({
        ruleId: rule.id,
        effect: isBoost ? 'boost' : isSuppression ? 'suppress' : 'neutral',
        weight: rule.multiplier,
        reason: rule.description,
        distance: features.markers.distance_to_nearest_marker >= 0 ? features.markers.distance_to_nearest_marker : undefined
      })
    }
  }
  
  // Calculate contextual confidence with safety bounds
  const rawContextualConfidence = baseConfidence * adjustmentFactor + totalOffset
  
  // Apply safety bounds
  const minConfidence = Math.max(0.01, baseConfidence * config.minConfidenceFloor)
  const maxConfidence = Math.min(config.maxConfidenceCeiling, Math.max(baseConfidence, 0.98))
  
  const contextualConfidence = Math.max(minConfidence, Math.min(maxConfidence, rawContextualConfidence))
  
  return {
    baseConfidence,
    contextualConfidence,
    adjustmentFactor,
    explanations,
    features
  }
}

/**
 * Apply contextual confidence to a hit (modifies the hit in place)
 */
export function applyContextualConfidence(
  hit: Hit,
  text: string, 
  config: ContextualConfig = DEFAULT_CONTEXTUAL_CONFIG
): ContextualConfidenceResult {
  const baseConfidence = hit.confidence || 0.5  // Fallback if no base confidence
  const result = calculateContextualConfidence(hit, text, baseConfidence, config)
  
  // Update hit with contextual confidence
  hit.confidence = result.contextualConfidence
  
  // Add contextual explanations to reasons if they exist
  if (hit.reasons && result.explanations.length > 0) {
    const contextualReasons = result.explanations.map(exp => `contextual:${exp.ruleId}`)
    hit.reasons.push(...contextualReasons)
  }
  
  // Store contextual features if hit has features object
  if (hit.features) {
    hit.features.contextual = {
      adjustmentFactor: result.adjustmentFactor,
      explanations: result.explanations,
      contextFeatures: result.features
    }
  }
  
  return result
}

/**
 * Create a custom contextual configuration
 */
export function createContextualConfig(overrides: Partial<ContextualConfig>): ContextualConfig {
  return {
    ...DEFAULT_CONTEXTUAL_CONFIG,
    ...overrides,
    rules: overrides.rules || DEFAULT_CONTEXTUAL_CONFIG.rules
  }
}

/**
 * Disable all contextual adjustments (for A/B testing)
 */
export const DISABLED_CONTEXTUAL_CONFIG: ContextualConfig = {
  ...DEFAULT_CONTEXTUAL_CONFIG,
  enabled: false
}

/**
 * Conservative configuration (suppression only, no boost)
 */
export const CONSERVATIVE_CONTEXTUAL_CONFIG: ContextualConfig = {
  ...DEFAULT_CONTEXTUAL_CONFIG,
  suppressionEnabled: true,
  boostEnabled: false,
  minConfidenceFloor: 0.6  // Slightly higher floor for safety
}