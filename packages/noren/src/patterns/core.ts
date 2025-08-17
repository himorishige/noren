/**
 * Core injection patterns (lightweight, essential)
 * Only the most critical patterns for maximum performance
 */

import type { InjectionPattern } from '../types.js'

/**
 * Critical instruction override patterns (core)
 * High-impact, low false-positive patterns only
 */
export const CORE_INSTRUCTION_PATTERNS: InjectionPattern[] = [
  {
    id: 'ignore_previous_core',
    pattern: /ignore\s+(?:all\s+)?(?:previous|above)\s+(?:instructions?|commands?)/gi,
    description: 'Core instruction override attempts',
    severity: 'critical',
    category: 'instruction_override',
    weight: 95,
    sanitize: true,
  },
  {
    id: 'override_safety_core',
    pattern: /override\s+(?:all\s+)?(?:safety|restrictions?|guidelines?)/gi,
    description: 'Safety override attempts',
    severity: 'critical',
    category: 'instruction_override',
    weight: 95,
    sanitize: true,
  },
  {
    id: 'disregard_core',
    pattern: /disregard\s+(?:all\s+|everything\s+)?(?:above|previous)/gi,
    description: 'Disregard previous content',
    severity: 'critical',
    category: 'instruction_override',
    weight: 95,
    sanitize: true,
  },
]

/**
 * Critical context hijacking patterns (core)
 */
export const CORE_CONTEXT_PATTERNS: InjectionPattern[] = [
  {
    id: 'system_marker_core',
    pattern: /#?\s*system\s*[:\]]/gi,
    description: 'System context injection',
    severity: 'critical',
    category: 'context_hijack',
    weight: 95,
    sanitize: true,
  },
  {
    id: 'instruction_marker_core',
    pattern: /\[(?:INST|instruction|system)\]/gi,
    description: 'Instruction marker injection',
    severity: 'critical',
    category: 'context_hijack',
    weight: 95,
    sanitize: true,
  },
  {
    id: 'chat_marker_core',
    pattern: /<\|(?:im_start|im_end|system|user|assistant)\|>/gi,
    description: 'Chat template injection',
    severity: 'critical',
    category: 'context_hijack',
    weight: 95,
    sanitize: true,
  },
]

/**
 * Critical code execution patterns (core)
 */
export const CORE_EXECUTION_PATTERNS: InjectionPattern[] = [
  {
    id: 'execute_code_core',
    pattern: /(?:execute|run|eval)\s+(?:code|command|script)/gi,
    description: 'Code execution attempts',
    severity: 'critical',
    category: 'code_execution',
    weight: 95,
    sanitize: true,
  },
  {
    id: 'eval_function_core',
    pattern: /eval\s*\(/gi,
    description: 'Direct eval() calls',
    severity: 'critical',
    category: 'code_execution',
    weight: 95,
    sanitize: true,
  },
  {
    id: 'dangerous_commands_core',
    pattern: /(?:sudo\s+)?rm\s+-rf|exec\(|system\(/gi,
    description: 'Dangerous system commands',
    severity: 'critical',
    category: 'code_execution',
    weight: 95,
    sanitize: true,
  },
]

/**
 * Core patterns combined (minimal set for maximum speed)
 */
export const CORE_PATTERNS: InjectionPattern[] = [
  ...CORE_INSTRUCTION_PATTERNS,
  ...CORE_CONTEXT_PATTERNS,
  ...CORE_EXECUTION_PATTERNS,
]

/**
 * Lightweight core configuration
 */
export function createCoreConfig() {
  return {
    customPatterns: CORE_PATTERNS,
    riskThreshold: 70,
    enableSanitization: false, // Minimal for speed
    enableContextSeparation: false,
    maxProcessingTime: 50,
    enablePerfMonitoring: false,
  }
}

/**
 * Ultra-fast safety check using only core patterns
 */
export function isCorePatternUnsafe(content: string): boolean {
  // Pre-compile for reuse
  const coreRegexes = CORE_PATTERNS.map((p) => p.pattern)

  for (const regex of coreRegexes) {
    regex.lastIndex = 0 // Reset state
    if (regex.test(content)) {
      return true
    }
  }

  return false
}
