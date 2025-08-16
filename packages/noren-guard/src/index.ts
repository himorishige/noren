/**
 * @himorishige/noren-guard
 *
 * Lightweight prompt injection protection for MCP servers and AI tools
 *
 * Key features:
 * - Ultra-fast rule-based detection (<3ms)
 * - Trust segment management
 * - Content sanitization
 * - Web Standards compatible
 * - Zero dependencies
 */

// Custom patterns and policies
export {
  type CustomPatternConfig,
  type CustomRuleConfig,
  createCompanyPatterns,
  createKeywordPolicy,
  PatternBuilder,
  type PolicyConfig,
  PolicyManager,
  RuleBuilder,
} from './custom.js'
// Core classes
export { createGuard, isPromptSafe, PromptGuard, scanPrompt } from './guard.js'
// MCP middleware
export {
  createHTTPMiddleware,
  createMCPMiddleware,
  MCPGuard,
  type MCPGuardOptions,
  type SecurityEvent,
} from './mcp-middleware.js'
// Pattern collections
export {
  ALL_PATTERNS,
  CODE_EXECUTION_PATTERNS,
  CONTEXT_HIJACK_PATTERNS,
  getPatternsByCategory,
  getPatternsBySeverity,
  INFO_EXTRACTION_PATTERNS,
  INSTRUCTION_OVERRIDE_PATTERNS,
  JAILBREAK_PATTERNS,
  OBFUSCATION_PATTERNS,
  PATTERN_CATEGORIES,
} from './patterns.js'

// Sanitization utilities
export {
  createSafePreview,
  DEFAULT_SANITIZE_RULES,
  escapeUnicode,
  neutralizeContextMarkers,
  normalizeEncoding,
  quoteDangerous,
  removeInstructions,
  sanitizeContent,
  validateSanitized,
} from './sanitizer.js'
// Streaming support
export {
  collectStream,
  createPipeline,
  createTextStream,
  GuardTransform,
  processFile,
  RealTimeProcessor,
  type StreamOptions,
  StreamProcessor,
  type StreamResult,
  sanitizeText,
  scanText,
  streamToString,
} from './stream.js'
// Trust segment utilities
export {
  calculateTrustAdjustedRisk,
  createTrustSegment,
  detectTrustMixing,
  mergeSegments,
  segmentText,
  validateSegments,
} from './trust-segment.js'
// Type definitions
export type {
  ContextMarker,
  DetectionResult,
  GuardConfig,
  InjectionPattern,
  MCPMessage,
  PatternMatch,
  PerformanceMetrics,
  RiskScore,
  SanitizeAction,
  SanitizeRule,
  Severity,
  ToolGuardConfig,
  TrustLevel,
  TrustSegment,
} from './types.js'

// Version info
export const VERSION = '2.0.0-alpha.1'

// Default configurations
export const DEFAULT_CONFIG = {
  riskThreshold: 60,
  enableSanitization: true,
  enableContextSeparation: true,
  maxProcessingTime: 100,
  enablePerfMonitoring: false,
}

// Preset configurations for common use cases
export const PRESETS = {
  /**
   * Strict mode - High security, low false positives
   */
  STRICT: {
    riskThreshold: 50,
    enableSanitization: true,
    enableContextSeparation: true,
    maxProcessingTime: 50,
    enablePerfMonitoring: true,
  },

  /**
   * Balanced mode - Good balance of security and usability
   */
  BALANCED: {
    riskThreshold: 60,
    enableSanitization: true,
    enableContextSeparation: true,
    maxProcessingTime: 100,
    enablePerfMonitoring: false,
  },

  /**
   * Permissive mode - Lower security, higher usability
   */
  PERMISSIVE: {
    riskThreshold: 85,
    enableSanitization: true,
    enableContextSeparation: false,
    maxProcessingTime: 200,
    enablePerfMonitoring: false,
  },

  /**
   * MCP optimized - Optimized for MCP server usage
   */
  MCP: {
    riskThreshold: 65,
    enableSanitization: true,
    enableContextSeparation: true,
    maxProcessingTime: 50,
    enablePerfMonitoring: true,
  },

  /**
   * High performance - Minimal processing for high-throughput scenarios
   */
  PERFORMANCE: {
    riskThreshold: 80,
    enableSanitization: false,
    enableContextSeparation: false,
    maxProcessingTime: 25,
    enablePerfMonitoring: false,
  },
} as const
