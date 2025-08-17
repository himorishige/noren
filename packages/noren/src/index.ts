/**
 * @himorishige/noren v0.1.0
 *
 * Lightweight prompt injection protection using functional programming
 *
 * Features:
 * - Pure functions for better tree-shaking
 * - Stream processing support
 * - Pattern builders and policy management
 * - Zero dependencies, Web Standards compatible
 */

// Pattern & Rule Builders
export {
  addCompanyTerms,
  addKeywords,
  addPattern,
  addQuoteRule,
  addRegexPatterns,
  addRemovalRule,
  addReplacementRule,
  addRule,
  buildPatterns,
  buildRules,
  createPatternBuilder,
  // PII utilities
  createPIIPatterns,
  createPIISanitizationRules,
  createRuleBuilder,
  // Pattern builder
  type PatternBuilderState,
  patternBuilder,
  // Rule builder
  type RuleBuilderState,
  ruleBuilder,
} from './builders.js'
// Core API
export {
  applyMitigation,
  calculateRisk,
  compose,
  createGuard,
  // Guard creation
  createGuardContext,
  createMetrics,
  // Pipeline utilities
  createPipeline,
  createScanner,
  // Detection functions
  detectPatterns,
  type FunctionalGuardAPI,
  // Types
  type GuardContext,
  isSafe,
  pipeline,
  processWithPipeline,
  quickScan,
  scan,
  scanBatch as scanBatchCore,
  // Convenience functions
  scanText,
  updateMetrics,
} from './core.js'
// Pre-defined Patterns (tree-shaking friendly)
export {
  createFinancialConfig,
  financialPatterns,
  financialSanitizeRules,
} from './patterns/financial.js'
export {
  ALL_PATTERNS,
  ALL_SANITIZE_RULES,
  PRESETS,
} from './patterns/index.js'
export {
  createPersonalConfig,
  personalPatterns,
  personalSanitizeRules,
} from './patterns/personal.js'
export {
  createSecurityConfig,
  securityPatterns,
  securitySanitizeRules,
} from './patterns/security.js'
// Policy Management
export {
  activatePolicy,
  addPolicy,
  createCustomPolicy,
  // Policy templates
  createFinancialPolicy,
  createGovernmentPolicy,
  createHealthcarePolicy,
  // Store management
  createPolicyStore,
  exportPolicy,
  getActivePolicy,
  importPolicy,
  mergePolicies,
  // Types
  type Policy,
  type PolicyStore,
  removePolicy,
  toGuardConfig,
  // Policy utilities
  validatePolicy,
} from './policies.js'
// Sanitizer
export {
  createSafePreview,
  DEFAULT_SANITIZE_RULES,
  escapeUnicode,
  neutralizeContextMarkers,
  normalizeEncoding,
  quoteDangerous,
  removeInstructions,
  sanitizeContent as sanitizeContentCore,
  validateSanitized,
} from './sanitizer.js'
// Stream Processing
export {
  collectStream,
  createGuardTransform,
  // Real-time processing
  createRealTimeProcessor,
  createSanitizeTransform,
  // Transform streams
  createScanTransform,
  createStreamPipeline,
  // Stream processors
  createStreamProcessor,
  // Stream utilities
  createTextStream,
  processFileStream,
  processTextStream,
  // Types
  type StreamConfig,
  type StreamResult,
  sanitizeStream,
  // Simple APIs
  scanStream,
  streamToString,
} from './stream.js'

// Trust Segments
export {
  calculateTrustAdjustedRisk,
  createTrustSegment,
  detectTrustMixing,
  mergeSegments,
  segmentText,
  validateSegments,
} from './trust-segment.js'

// Core patterns (lightweight)
export {
  CORE_PATTERNS,
  createCoreConfig,
  isCorePatternUnsafe,
} from './patterns/core.js'

// Dynamic pattern loading (lazy loading)
export {
  clearPatternCache,
  createLazyGuard,
  getCacheStatus,
  loadMultipleCategories,
  loadPatterns,
  loadSanitizeRules,
  type PatternCategory,
  preloadCategories,
} from './pattern-loader.js'

// Simple API (recommended for most users)
export {
  checkRequest,
  createExpressMiddleware,
  createGuard as createSpecializedGuard,
  detectThreats,
  fullScan,
  getSecurityLevel,
  isSafe as isContentSafe,
  preload,
  reset as resetGuard,
  sanitize as sanitizeContentSimple,
  type SecurityLevel,
  setSecurityLevel,
  type SimpleConfig,
} from './simple-api.js'

// Advanced features
export {
  AhoCorasick,
  clearAutomatonCache,
  createOptimizedDetector,
  detectMultiplePatterns,
} from './aho-corasick.js'

export {
  createStatefulProcessor,
  createStatefulStream,
  processLargeText,
  type StatefulStreamConfig,
  StatefulStreamProcessor,
} from './stream-state.js'

export {
  compilePatterns as compilePatternsToTypedArray,
  CompiledPatternMatcher,
  type CompiledPatternSet,
  deserializeCompiledPatterns,
  serializeCompiledPatterns,
} from './compiler.js'

// Type exports
export type {
  DetectionResult,
  GuardConfig,
  // Pattern types
  InjectionPattern,
  // MCP types
  MCPMessage,
  PatternMatch,
  // Performance types
  PerformanceMetrics,
  RiskScore,
  SanitizeAction,
  SanitizeRule,
  Severity,
  ToolGuardConfig,
  // Core types
  TrustLevel,
  // Trust segment types
  TrustSegment,
} from './types.js'
