/**
 * Security token patterns for individual import
 * Allows tree-shaking for specific pattern categories
 */

import type { InjectionPattern, SanitizeRule } from '../types.js'

// Security token detection patterns
export const securityPatterns: InjectionPattern[] = [
  {
    id: 'jwt_token',
    pattern: /\beyJ[A-Za-z0-9+/=._-]{10,}\.[A-Za-z0-9+/=._-]{10,}\.[A-Za-z0-9+/=._-]{8,}\b/g,
    description: 'JSON Web Tokens (JWT)',
    severity: 'critical',
    category: 'security',
    weight: 95,
    sanitize: true,
  },
  {
    id: 'api_key',
    pattern: /\b(?:sk_|pk_|api_|key_)[A-Za-z0-9_]{8,}\b/g,
    description: 'Generic API keys with common prefixes',
    severity: 'critical',
    category: 'security',
    weight: 90,
    sanitize: true,
  },
  {
    id: 'github_token',
    pattern: /\b(gh[opusa]_[A-Za-z0-9]{38})\b/g,
    description: 'GitHub Personal Access Tokens',
    severity: 'critical',
    category: 'security',
    weight: 95,
    sanitize: true,
  },
  {
    id: 'aws_access_key',
    pattern: /\b((?:AKIA|ASIA|AGPA|AIDA|ANPA|AROA|AIPA)[A-Z0-9]{16})\b/g,
    description: 'AWS Access Key IDs',
    severity: 'critical',
    category: 'security',
    weight: 95,
    sanitize: true,
  },
  {
    id: 'google_api_key',
    pattern: /\b(AIza[0-9A-Za-z_-]{35})\b/g,
    description: 'Google/Firebase API Keys',
    severity: 'critical',
    category: 'security',
    weight: 95,
    sanitize: true,
  },
  {
    id: 'stripe_api_key',
    pattern: /\b((?:sk|pk)_(?:live|test)_[A-Za-z0-9]{24,})\b/g,
    description: 'Stripe API Keys',
    severity: 'critical',
    category: 'security',
    weight: 95,
    sanitize: true,
  },
  {
    id: 'openai_api_key',
    pattern: /\b(sk-(?:proj-)?[A-Za-z0-9_-]{20,})\b/g,
    description: 'OpenAI API Keys',
    severity: 'critical',
    category: 'security',
    weight: 95,
    sanitize: true,
  },
  {
    id: 'auth_header',
    pattern: /Authorization\s*:\s*((?:Bearer|Basic)\s+[A-Za-z0-9+/=._-]{8,})/gi,
    description: 'Authorization headers',
    severity: 'critical',
    category: 'security',
    weight: 90,
    sanitize: true,
  },
  {
    id: 'session_id',
    pattern: /\b(?:session|sess|jsessionid|phpsessid)=([A-Za-z0-9+/=._-]{8,})\b/gi,
    description: 'Session IDs',
    severity: 'high',
    category: 'security',
    weight: 85,
    sanitize: true,
  },
  {
    id: 'uuid_token',
    pattern: /\b[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/gi,
    description: 'UUID v4 tokens',
    severity: 'medium',
    category: 'security',
    weight: 70,
    sanitize: true,
  },
]

// Security sanitization rules
export const securitySanitizeRules: SanitizeRule[] = [
  {
    pattern: /\beyJ[A-Za-z0-9+/=._-]{10,}\.[A-Za-z0-9+/=._-]{10,}\.[A-Za-z0-9+/=._-]{8,}\b/g,
    action: 'replace',
    replacement: '[JWT_TOKEN]',
    category: 'security',
    priority: 5,
  },
  {
    pattern: /\b(?:sk_|pk_|api_|key_)[A-Za-z0-9_]{8,}\b/g,
    action: 'replace',
    replacement: '[API_KEY]',
    category: 'security',
    priority: 5,
  },
  {
    pattern: /\b(gh[opusa]_[A-Za-z0-9]{38})\b/g,
    action: 'replace',
    replacement: '[GITHUB_TOKEN]',
    category: 'security',
    priority: 5,
  },
  {
    pattern: /Authorization\s*:\s*((?:Bearer|Basic)\s+[A-Za-z0-9+/=._-]{8,})/gi,
    action: 'replace',
    replacement: 'Authorization: [REDACTED]',
    category: 'security',
    priority: 5,
  },
]

/**
 * Create security guard configuration
 */
export function createSecurityConfig() {
  return {
    customPatterns: securityPatterns,
    customRules: securitySanitizeRules,
    riskThreshold: 40,
    enableSanitization: true,
  }
}
