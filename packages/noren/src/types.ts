/**
 * Trust levels for content segments
 */
export type TrustLevel = 'system' | 'user' | 'untrusted' | 'tool-output'

/**
 * Risk score from 0 (safe) to 100 (high risk)
 */
export type RiskScore = number

/**
 * Detection result severity
 */
export type Severity = 'low' | 'medium' | 'high' | 'critical'

/**
 * Content segment with trust and risk information
 */
export interface TrustSegment {
  /** The text content */
  content: string
  /** Trust level of this content */
  trust: TrustLevel
  /** Risk score (0-100) */
  risk: RiskScore
  /** Source identifier */
  source?: string
  /** Detection metadata */
  metadata?: Record<string, unknown>
}

/**
 * Pattern match result
 */
export interface PatternMatch {
  /** Pattern that matched */
  pattern: string
  /** Match position */
  index: number
  /** Matched text */
  match: string
  /** Pattern severity */
  severity: Severity
  /** Pattern category */
  category: string
  /** Confidence score (0-100) */
  confidence: number
}

/**
 * Detection result
 */
export interface DetectionResult {
  /** Original input */
  input: string
  /** Sanitized output */
  sanitized: string
  /** Overall risk score */
  risk: RiskScore
  /** Whether content is safe */
  safe: boolean
  /** Pattern matches found */
  matches: PatternMatch[]
  /** Trust segments */
  segments: TrustSegment[]
  /** Processing time in milliseconds */
  processingTime: number
}

/**
 * Guard configuration options
 */
export interface GuardConfig {
  /** Risk threshold (0-100) - content above this is considered unsafe */
  riskThreshold: number
  /** Whether to enable sanitization */
  enableSanitization: boolean
  /** Whether to enable context separation */
  enableContextSeparation: boolean
  /** Custom patterns to include */
  customPatterns?: InjectionPattern[]
  /** Custom sanitization rules */
  customRules?: SanitizeRule[]
  /** Patterns to exclude/allowlist */
  excludePatterns?: string[]
  /** Maximum processing time in milliseconds */
  maxProcessingTime: number
  /** Whether to enable performance monitoring */
  enablePerfMonitoring: boolean
}

/**
 * Injection pattern definition
 */
export interface InjectionPattern {
  /** Pattern identifier */
  id: string
  /** Regular expression pattern */
  pattern: RegExp
  /** Pattern description */
  description: string
  /** Severity level */
  severity: Severity
  /** Category (e.g., 'instruction_override', 'context_hijack') */
  category: string
  /** Confidence weight (0-100) */
  weight: number
  /** Whether this pattern should be sanitized */
  sanitize: boolean
}

/**
 * Sanitization action
 */
export type SanitizeAction = 'remove' | 'replace' | 'quote' | 'neutralize'

/**
 * Sanitization rule
 */
export interface SanitizeRule {
  /** Pattern to match */
  pattern: RegExp
  /** Action to take */
  action: SanitizeAction
  /** Replacement text (for 'replace' action) */
  replacement?: string
  /** Category this rule applies to */
  category?: string
  /** Rule priority (higher = applied first) */
  priority?: number
}

/**
 * Context marker types for prompt structure
 */
export type ContextMarker =
  | 'system_start'
  | 'system_end'
  | 'user_start'
  | 'user_end'
  | 'assistant_start'
  | 'assistant_end'
  | 'instruction_start'
  | 'instruction_end'

/**
 * MCP-specific types
 */
export interface MCPMessage {
  jsonrpc: '2.0'
  id?: string | number | null
  method?: string
  params?: unknown
  result?: unknown
  error?: {
    code: number
    message: string
    data?: unknown
  }
}

/**
 * Tool execution guard options
 */
export interface ToolGuardConfig {
  /** Allowed tool names */
  allowedTools?: string[]
  /** Blocked tool names */
  blockedTools?: string[]
  /** Allowed domains for network tools */
  allowedDomains?: string[]
  /** Allowed file paths for filesystem tools */
  allowedPaths?: string[]
  /** Whether to validate tool arguments */
  validateArguments: boolean
  /** Maximum argument size in bytes */
  maxArgumentSize: number
}

/**
 * Performance metrics
 */
export interface PerformanceMetrics {
  /** Total processing time */
  totalTime: number
  /** Pattern matching time */
  patternTime: number
  /** Sanitization time */
  sanitizeTime: number
  /** Number of patterns checked */
  patternsChecked: number
  /** Number of matches found */
  matchesFound: number
  /** Memory usage in bytes */
  memoryUsage?: number
}
