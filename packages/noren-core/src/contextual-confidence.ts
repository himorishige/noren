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
    
    // P2-Sprint2: Format-specific rules
    {
      id: 'json-key-value',
      priority: 72,
      condition: (features) => features.structure.json_like && isInJsonKeyOrValuePosition(features),
      multiplier: 0.3,
      description: 'JSON key/value context with example-like patterns'
    },
    {
      id: 'json-schema-field',
      priority: 68,
      condition: (features) => features.structure.json_like && hasSchemaKeywords(features),
      multiplier: 0.2,
      description: 'JSON schema definition fields'
    },
    {
      id: 'csv-example-data',
      priority: 65,
      condition: (features) => features.structure.csv_like && !features.structure.header_row && hasExampleDataPatterns(features),
      multiplier: 0.4,
      description: 'CSV example data row'
    },
    {
      id: 'markdown-code-fence',
      priority: 78,
      condition: (features) => features.structure.md_like && features.structure.code_block,
      multiplier: 0.6,
      description: 'Markdown code fence block'
    },
    {
      id: 'xml-example-content',
      priority: 67,
      condition: (features) => features.structure.xml_like && hasXmlExamplePatterns(features),
      multiplier: 0.5,
      description: 'XML example content'
    },
    {
      id: 'log-example-entry',
      priority: 63,
      condition: (features) => features.structure.log_like && hasLogExamplePatterns(features),
      multiplier: 0.6,
      description: 'Log example entry'
    },

    // P2-Sprint2: Locale-specific placeholder rules
    {
      id: 'date-placeholder',
      priority: 66,
      condition: (features) => features.markers.date_placeholder_nearby,
      multiplier: 0.3,
      description: 'Date/time placeholder context'
    },
    
    // P2-Sprint2: Format validation recovery rules
    {
      id: 'invalid-json-recovery',
      priority: 74,
      condition: (features) => features.structure.json_like && hasLowFormatConfidence(features, 'json'),
      multiplier: 0.8,  // Less aggressive suppression for potentially invalid JSON
      description: 'Detected JSON format with validation issues'
    },
    {
      id: 'invalid-xml-recovery',
      priority: 73,
      condition: (features) => features.structure.xml_like && hasLowFormatConfidence(features, 'xml'),
      multiplier: 0.8,
      description: 'Detected XML format with validation issues'
    },
    {
      id: 'invalid-csv-recovery',
      priority: 71,
      condition: (features) => features.structure.csv_like && hasLowFormatConfidence(features, 'csv'),
      multiplier: 0.9,  // Even lighter suppression for CSV as it's more forgiving
      description: 'Detected CSV format with validation issues'
    },
    {
      id: 'currency-placeholder',
      priority: 64,
      condition: (features) => features.markers.currency_placeholder_nearby,
      multiplier: 0.4,
      description: 'Currency/amount placeholder context'
    },
    {
      id: 'address-placeholder',
      priority: 62,
      condition: (features) => features.markers.address_placeholder_nearby,
      multiplier: 0.3,
      description: 'Address placeholder context'
    },
    {
      id: 'phone-placeholder',
      priority: 61,
      condition: (features) => features.markers.phone_placeholder_nearby,
      multiplier: 0.4,
      description: 'Phone number placeholder context'
    },
    {
      id: 'name-placeholder',
      priority: 59,
      condition: (features) => features.markers.name_placeholder_nearby,
      multiplier: 0.3,
      description: 'Name placeholder context'
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
  
  // Apply rules with priority-based conflict resolution
  const applicableRules = config.rules.filter(rule => rule.condition(features, hit))
  const resolvedRules = resolveRuleConflicts(applicableRules, features)
  const explanations: ContextualExplanation[] = []
  
  let adjustmentFactor = 1.0
  let totalOffset = 0
  
  for (const rule of resolvedRules) {
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
  
  // Calculate contextual confidence with safety bounds
  const rawContextualConfidence = baseConfidence * adjustmentFactor + totalOffset
  
  // Apply safety bounds
  const minConfidence = Math.max(0.01, baseConfidence * config.minConfidenceFloor)
  const maxConfidence = config.maxConfidenceCeiling
  
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

// P2-Sprint2: Rule conflict resolution system

/**
 * Resolve conflicts between applicable rules
 * Priority: Format-specific > Locale-specific > Marker-based > Structural
 */
function resolveRuleConflicts(applicableRules: ContextualRule[], features: ContextFeatures): ContextualRule[] {
  if (applicableRules.length <= 1) {
    return applicableRules
  }
  
  // Group rules by priority level
  const rulesByPriority = new Map<number, ContextualRule[]>()
  for (const rule of applicableRules) {
    const priority = rule.priority
    if (!rulesByPriority.has(priority)) {
      rulesByPriority.set(priority, [])
    }
    rulesByPriority.get(priority)!.push(rule)
  }
  
  // Sort priority groups (highest first)
  const sortedPriorities = Array.from(rulesByPriority.keys()).sort((a, b) => b - a)
  const resolvedRules: ContextualRule[] = []
  
  for (const priority of sortedPriorities) {
    const rulesInGroup = rulesByPriority.get(priority)!
    
    if (rulesInGroup.length === 1) {
      resolvedRules.push(rulesInGroup[0])
      continue
    }
    
    // Resolve conflicts within the same priority level
    const resolved = resolveSamePriorityConflicts(rulesInGroup, features)
    resolvedRules.push(...resolved)
  }
  
  return resolvedRules
}

/**
 * Resolve conflicts between rules with the same priority
 */
function resolveSamePriorityConflicts(rules: ContextualRule[], features: ContextFeatures): ContextualRule[] {
  // Rule categories for conflict resolution (higher number = higher precedence)
  const categoryPrecedence = {
    'format-specific': 4,    // JSON, XML, CSV, etc.
    'locale-specific': 3,    // Date, currency, address, etc.
    'marker-based': 2,       // Example, test, dummy, etc.
    'structural': 1          // General structure patterns
  }
  
  // Classify rules by category
  const categorizeRule = (rule: ContextualRule): keyof typeof categoryPrecedence => {
    if (rule.id.includes('json') || rule.id.includes('csv') || rule.id.includes('xml') || 
        rule.id.includes('markdown') || rule.id.includes('log')) {
      return 'format-specific'
    }
    if (rule.id.includes('placeholder') && (rule.id.includes('date') || rule.id.includes('currency') || 
        rule.id.includes('address') || rule.id.includes('phone') || rule.id.includes('name'))) {
      return 'locale-specific'
    }
    if (rule.id.includes('marker') || rule.id.includes('example') || rule.id.includes('test') || 
        rule.id.includes('dummy') || rule.id.includes('sample')) {
      return 'marker-based'
    }
    return 'structural'
  }
  
  // Group by category
  const rulesByCategory = new Map<string, ContextualRule[]>()
  for (const rule of rules) {
    const category = categorizeRule(rule)
    if (!rulesByCategory.has(category)) {
      rulesByCategory.set(category, [])
    }
    rulesByCategory.get(category)!.push(rule)
  }
  
  // Select one rule from each category, starting with highest precedence
  const resolvedRules: ContextualRule[] = []
  
  const sortedCategories = Array.from(rulesByCategory.keys())
    .sort((a, b) => categoryPrecedence[b as keyof typeof categoryPrecedence] - categoryPrecedence[a as keyof typeof categoryPrecedence])
  
  for (const category of sortedCategories) {
    const categoryRules = rulesByCategory.get(category)!
    
    if (categoryRules.length === 1) {
      resolvedRules.push(categoryRules[0])
      continue
    }
    
    // Apply tiebreakers within this category
    // Tiebreaker 1: Prefer rules with stronger suppression (lower multiplier)
    const suppressionRules = categoryRules.filter(rule => rule.multiplier < 1.0)
    if (suppressionRules.length > 0) {
      suppressionRules.sort((a, b) => a.multiplier - b.multiplier) // Lower multiplier first
      resolvedRules.push(suppressionRules[0])
      continue
    }
    
    // Tiebreaker 2: Prefer rules with boost (higher multiplier)
    const boostRules = categoryRules.filter(rule => rule.multiplier > 1.0)
    if (boostRules.length > 0) {
      boostRules.sort((a, b) => b.multiplier - a.multiplier) // Higher multiplier first
      resolvedRules.push(boostRules[0])
      continue
    }
    
    // Fallback: Use first rule (deterministic)
    resolvedRules.push(categoryRules[0])
  }
  
  return resolvedRules
}

// P2-Sprint2: Format-specific helper functions

/**
 * Check if PII is in JSON key or value position with example-like patterns
 */
function isInJsonKeyOrValuePosition(features: ContextFeatures): boolean {
  // This is a simplified heuristic - in a real implementation you'd parse JSON context
  // For now, just check if we're in JSON context, since the structure detection already confirmed it
  return true  // If we reached here, structure.json_like is already true
}

/**
 * Detect JSON Schema keywords that indicate example/template content
 */
function hasSchemaKeywords(features: ContextFeatures): boolean {
  // Look for JSON Schema keywords in the surrounding context
  // This would need access to the actual text context to implement properly
  return features.markers.example_marker_nearby && features.structure.json_like
}

/**
 * Detect CSV example data patterns
 */
function hasExampleDataPatterns(features: ContextFeatures): boolean {
  return features.markers.example_marker_nearby || 
         features.markers.dummy_marker_nearby ||
         features.markers.sample_marker_nearby
}

/**
 * Detect XML example content patterns  
 */
function hasXmlExamplePatterns(features: ContextFeatures): boolean {
  return features.markers.example_marker_nearby ||
         features.markers.dummy_marker_nearby ||
         features.markers.placeholder_marker_nearby
}

/**
 * Detect log example entry patterns
 */
function hasLogExamplePatterns(features: ContextFeatures): boolean {
  return features.markers.example_marker_nearby ||
         features.markers.test_marker_nearby ||
         features.markers.dummy_marker_nearby
}

/**
 * P2-Sprint2: Check if format has low validation confidence
 */
function hasLowFormatConfidence(features: ContextFeatures, format: 'json' | 'xml' | 'csv'): boolean {
  // This is a placeholder - in real implementation, we'd need access to ValidatedDocumentStructure
  // For now, we'll use some heuristics to detect potentially problematic formats
  
  switch (format) {
    case 'json':
      // Look for common JSON issues that our basic detector might miss
      return features.markers.example_marker_nearby || 
             features.markers.dummy_marker_nearby // These often indicate malformed JSON samples
    
    case 'xml':
      // Look for potential XML issues
      return features.markers.example_marker_nearby || 
             features.structure.template_section // Templates often have malformed XML
    
    case 'csv':
      // CSV is generally more forgiving, but check for structural issues
      return !features.structure.header_row && features.markers.example_marker_nearby
    
    default:
      return false
  }
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