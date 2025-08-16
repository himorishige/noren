import type { InjectionPattern } from './types.js'

/**
 * Core injection patterns for prompt injection detection
 * Lightweight, rule-based approach optimized for speed
 */

/**
 * Instruction override patterns
 * Detect attempts to override system instructions
 */
export const INSTRUCTION_OVERRIDE_PATTERNS: InjectionPattern[] = [
  {
    id: 'ignore_previous',
    pattern:
      /ignore\s+(?:all\s+)?(?:previous|prior|above|earlier)\s+(?:instructions?|commands?|directives?|prompts?)/gi,
    description: 'Attempts to ignore previous instructions',
    severity: 'high',
    category: 'instruction_override',
    weight: 90,
    sanitize: true,
  },
  {
    id: 'disregard_above',
    pattern:
      /disregard\s+(?:all\s+)?(?:above|previous|prior|earlier)\s+(?:instructions?|commands?|content)/gi,
    description: 'Attempts to disregard previous content',
    severity: 'high',
    category: 'instruction_override',
    weight: 90,
    sanitize: true,
  },
  {
    id: 'forget_instructions',
    pattern:
      /forget\s+(?:all\s+)?(?:previous|prior|above|earlier|your)\s+(?:instructions?|commands?|training)/gi,
    description: 'Attempts to make AI forget instructions',
    severity: 'high',
    category: 'instruction_override',
    weight: 85,
    sanitize: true,
  },
  {
    id: 'new_instruction',
    pattern: /(?:new|updated?)\s+(?:instruction|command|directive|rule|prompt):/gi,
    description: 'Introducing new instructions',
    severity: 'medium',
    category: 'instruction_override',
    weight: 70,
    sanitize: true,
  },
]

/**
 * Context hijacking patterns
 * Detect attempts to hijack conversation context
 */
export const CONTEXT_HIJACK_PATTERNS: InjectionPattern[] = [
  {
    id: 'system_marker',
    pattern: /#?\s*system\s*[:\]]/gi,
    description: 'System context marker injection',
    severity: 'critical',
    category: 'context_hijack',
    weight: 95,
    sanitize: true,
  },
  {
    id: 'instruction_marker',
    pattern: /\[(?:INST|instruction|system)\]/gi,
    description: 'Instruction marker injection',
    severity: 'critical',
    category: 'context_hijack',
    weight: 95,
    sanitize: true,
  },
  {
    id: 'chat_marker',
    pattern: /<\|(?:im_start|im_end|system|user|assistant)\|>/gi,
    description: 'Chat template marker injection',
    severity: 'critical',
    category: 'context_hijack',
    weight: 95,
    sanitize: true,
  },
  {
    id: 'role_play',
    pattern:
      /(?:you\s+are\s+now|from\s+now\s+on\s+you\s+are|act\s+as\s+(?:if\s+)?you\s+are)\s+(?:a\s+)?(?:different|new|another)/gi,
    description: 'Role-playing context injection',
    severity: 'medium',
    category: 'context_hijack',
    weight: 65,
    sanitize: true,
  },
]

/**
 * Information extraction patterns
 * Detect attempts to extract sensitive information
 */
export const INFO_EXTRACTION_PATTERNS: InjectionPattern[] = [
  {
    id: 'reveal_system',
    pattern:
      /(?:reveal|show|display|tell\s+me|what\s+is)\s+(?:your\s+)?(?:system\s+prompt|instructions?|training\s+data|initial\s+prompt)/gi,
    description: 'Attempts to reveal system prompt',
    severity: 'high',
    category: 'info_extraction',
    weight: 85,
    sanitize: true,
  },
  {
    id: 'extract_secrets',
    pattern:
      /(?:what\s+are\s+your|tell\s+me\s+your|reveal\s+your)\s+(?:secrets?|hidden\s+instructions?|confidential\s+information)/gi,
    description: 'Attempts to extract secrets',
    severity: 'high',
    category: 'info_extraction',
    weight: 80,
    sanitize: true,
  },
  {
    id: 'debug_mode',
    pattern: /(?:enter|enable|activate)\s+(?:debug|developer|admin|maintenance)\s+mode/gi,
    description: 'Attempts to activate debug mode',
    severity: 'medium',
    category: 'info_extraction',
    weight: 70,
    sanitize: true,
  },
]

/**
 * Code execution patterns
 * Detect attempts to execute code or commands
 */
export const CODE_EXECUTION_PATTERNS: InjectionPattern[] = [
  {
    id: 'execute_code',
    pattern: /(?:execute|run|eval)\s+(?:this\s+)?(?:code|command|script|python|javascript)/gi,
    description: 'Attempts to execute code',
    severity: 'critical',
    category: 'code_execution',
    weight: 95,
    sanitize: true,
  },
  {
    id: 'base64_decode',
    pattern: /(?:decode|base64|atob)\s+(?:and\s+)?(?:execute|run|eval)/gi,
    description: 'Base64 decode and execute',
    severity: 'high',
    category: 'code_execution',
    weight: 85,
    sanitize: true,
  },
  {
    id: 'shell_command',
    pattern: /(?:run|execute)\s+(?:shell|bash|cmd|powershell)\s+command/gi,
    description: 'Shell command execution',
    severity: 'critical',
    category: 'code_execution',
    weight: 95,
    sanitize: true,
  },
]

/**
 * Jailbreak patterns
 * Detect common jailbreaking techniques
 */
export const JAILBREAK_PATTERNS: InjectionPattern[] = [
  {
    id: 'dan_prompt',
    pattern: /(?:do\s+anything\s+now|DAN\s+mode|jailbreak\s+mode)/gi,
    description: 'DAN (Do Anything Now) jailbreak attempt',
    severity: 'high',
    category: 'jailbreak',
    weight: 90,
    sanitize: true,
  },
  {
    id: 'hypothetical',
    pattern:
      /(?:hypothetically|in\s+a\s+hypothetical\s+scenario|imagine\s+if)\s+you\s+could\s+(?:ignore|bypass|override)/gi,
    description: 'Hypothetical scenario jailbreak',
    severity: 'medium',
    category: 'jailbreak',
    weight: 60,
    sanitize: true,
  },
  {
    id: 'character_play',
    pattern:
      /(?:pretend|roleplay|act\s+like)\s+you\s+are\s+(?:an?\s+)?(?:evil|malicious|unrestricted|uncensored)/gi,
    description: 'Character roleplay jailbreak',
    severity: 'medium',
    category: 'jailbreak',
    weight: 65,
    sanitize: true,
  },
]

/**
 * Obfuscation patterns
 * Detect attempts to obfuscate malicious content
 */
export const OBFUSCATION_PATTERNS: InjectionPattern[] = [
  {
    id: 'unicode_spoofing',
    pattern: /[\u200b-\u200f\u2060\ufeff]/g,
    description: 'Unicode invisible characters',
    severity: 'medium',
    category: 'obfuscation',
    weight: 70,
    sanitize: true,
  },
  {
    id: 'leet_speak',
    pattern: /1gn0r3|d1sr3g4rd|f0rg3t|3x3cut3|r3v34l/gi,
    description: 'Leet speak obfuscation',
    severity: 'low',
    category: 'obfuscation',
    weight: 40,
    sanitize: true,
  },
  {
    id: 'excessive_spacing',
    pattern: /\s{10,}/g,
    description: 'Excessive spacing for obfuscation',
    severity: 'low',
    category: 'obfuscation',
    weight: 30,
    sanitize: true,
  },
]

/**
 * All injection patterns combined
 */
export const ALL_PATTERNS: InjectionPattern[] = [
  ...INSTRUCTION_OVERRIDE_PATTERNS,
  ...CONTEXT_HIJACK_PATTERNS,
  ...INFO_EXTRACTION_PATTERNS,
  ...CODE_EXECUTION_PATTERNS,
  ...JAILBREAK_PATTERNS,
  ...OBFUSCATION_PATTERNS,
]

/**
 * Pattern categories for easier management
 */
export const PATTERN_CATEGORIES = {
  instruction_override: INSTRUCTION_OVERRIDE_PATTERNS,
  context_hijack: CONTEXT_HIJACK_PATTERNS,
  info_extraction: INFO_EXTRACTION_PATTERNS,
  code_execution: CODE_EXECUTION_PATTERNS,
  jailbreak: JAILBREAK_PATTERNS,
  obfuscation: OBFUSCATION_PATTERNS,
} as const

/**
 * Get patterns by severity level
 */
export function getPatternsBySeverity(
  severity: 'low' | 'medium' | 'high' | 'critical',
): InjectionPattern[] {
  return ALL_PATTERNS.filter((pattern) => pattern.severity === severity)
}

/**
 * Get patterns by category
 */
export function getPatternsByCategory(
  category: keyof typeof PATTERN_CATEGORIES,
): InjectionPattern[] {
  return PATTERN_CATEGORIES[category]
}
