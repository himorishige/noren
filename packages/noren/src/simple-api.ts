/**
 * Simplified API for common use cases
 * Provides the most essential functions with optimal defaults
 */

import { createLazyGuard, type PatternCategory } from './pattern-loader.js'
import type { DetectionResult, TrustLevel } from './types.js'

/**
 * Security level presets
 */
export type SecurityLevel = 'strict' | 'balanced' | 'permissive'

/**
 * Simple configuration options
 */
export interface SimpleConfig {
  level?: SecurityLevel
  categories?: PatternCategory[]
  sanitize?: boolean
  trustLevel?: TrustLevel
}

/**
 * Security level configurations
 */
const SECURITY_LEVELS: Record<
  SecurityLevel,
  {
    riskThreshold: number
    categories: PatternCategory[]
    enableSanitization: boolean
  }
> = {
  strict: {
    riskThreshold: 30,
    categories: ['core', 'security', 'financial', 'personal'],
    enableSanitization: true,
  },
  balanced: {
    riskThreshold: 60,
    categories: ['core', 'security'],
    enableSanitization: true,
  },
  permissive: {
    riskThreshold: 80,
    categories: ['core'],
    enableSanitization: false,
  },
}

/**
 * Global guard instance for optimal performance
 */
let globalGuard: Awaited<ReturnType<typeof createLazyGuard>> | null = null
let currentLevel: SecurityLevel = 'balanced'

/**
 * Initialize the guard with specified security level
 */
async function ensureGuard(
  config?: SimpleConfig,
): Promise<Awaited<ReturnType<typeof createLazyGuard>>> {
  const level = config?.level ?? 'balanced'
  const categories = config?.categories ?? SECURITY_LEVELS[level].categories

  // Reuse global guard if configuration matches
  if (globalGuard && level === currentLevel && !config?.categories) {
    return globalGuard
  }

  const levelConfig = SECURITY_LEVELS[level]
  globalGuard = await createLazyGuard(categories, {
    preload: true, // Preload for better performance
    riskThreshold: levelConfig.riskThreshold,
    enableSanitization: config?.sanitize ?? levelConfig.enableSanitization,
  })

  currentLevel = level
  return globalGuard
}

/**
 * Quick safety check - returns true if content is safe
 */
export async function isSafe(content: string, config?: SimpleConfig): Promise<boolean> {
  const guard = await ensureGuard(config)
  const result = await guard.quickScan(content)
  return result.safe
}

/**
 * Detect threats in content - returns risk score (0-100)
 */
export async function detectThreats(
  content: string,
  config?: SimpleConfig,
): Promise<{
  safe: boolean
  risk: number
  level: 'none' | 'low' | 'medium' | 'high' | 'critical'
}> {
  const guard = await ensureGuard(config)
  const result = await guard.quickScan(content)

  let level: 'none' | 'low' | 'medium' | 'high' | 'critical' = 'none'
  if (result.risk > 80) level = 'critical'
  else if (result.risk > 60) level = 'high'
  else if (result.risk > 40) level = 'medium'
  else if (result.risk > 20) level = 'low'

  return {
    safe: result.safe,
    risk: result.risk,
    level,
  }
}

/**
 * Sanitize content - returns cleaned version
 */
export async function sanitize(content: string, config?: SimpleConfig): Promise<string> {
  const guard = await ensureGuard({ ...config, sanitize: true })
  const result = await guard.scan(content)
  return result.sanitized
}

/**
 * Full scan with detailed results
 */
export async function fullScan(content: string, config?: SimpleConfig): Promise<DetectionResult> {
  const guard = await ensureGuard(config)
  return guard.scan(content)
}

/**
 * Batch processing for multiple texts
 */
export async function scanBatch(
  texts: string[],
  config?: SimpleConfig,
): Promise<
  Array<{
    text: string
    safe: boolean
    risk: number
    sanitized?: string
  }>
> {
  const guard = await ensureGuard(config)
  const results: Array<{
    text: string
    safe: boolean
    risk: number
    sanitized?: string
  }> = []

  for (const text of texts) {
    const result = await guard.scan(text)
    results.push({
      text,
      safe: result.safe,
      risk: result.risk,
      sanitized: config?.sanitize !== false ? result.sanitized : undefined,
    })
  }

  return results
}

/**
 * Configure security level globally
 */
export async function setSecurityLevel(level: SecurityLevel): Promise<void> {
  currentLevel = level
  globalGuard = null // Force recreation with new level
  await ensureGuard({ level })
}

/**
 * Get current security configuration
 */
export function getSecurityLevel(): SecurityLevel {
  return currentLevel
}

/**
 * Preload patterns for better performance
 */
export async function preload(level: SecurityLevel = 'balanced'): Promise<void> {
  await ensureGuard({ level })
}

/**
 * Express.js middleware factory
 */
export function createExpressMiddleware(config?: SimpleConfig) {
  return async (req: unknown, res: unknown, next: unknown) => {
    try {
      const reqTyped = req as { body?: { message?: string; content?: string } }
      const body = reqTyped.body?.message || reqTyped.body?.content || reqTyped.body
      if (typeof body === 'string') {
        const result = await detectThreats(body, config)

        if (!result.safe) {
          const resTyped = res as { status: (code: number) => { json: (obj: unknown) => void } }
          return resTyped.status(400).json({
            error: 'Content blocked for security',
            risk: result.risk,
            level: result.level,
          })
        }

        // Optionally sanitize the content
        if (config?.sanitize !== false) {
          const reqBodyTyped = reqTyped.body as { sanitized?: string }
          reqBodyTyped.sanitized = await sanitize(body, config)
        }
      }

      const nextTyped = next as () => void
      nextTyped()
    } catch (_error) {
      const resTyped = res as { status: (code: number) => { json: (obj: unknown) => void } }
      resTyped.status(500).json({ error: 'Security check failed' })
    }
  }
}

/**
 * Cloudflare Workers helper
 */
export async function checkRequest(
  request: Request,
  config?: SimpleConfig,
): Promise<{
  allowed: boolean
  risk?: number
  sanitized?: string
}> {
  try {
    const body = await request.text()
    const result = await detectThreats(body, config)

    if (!result.safe) {
      return { allowed: false, risk: result.risk }
    }

    const sanitized = config?.sanitize !== false ? await sanitize(body, config) : undefined

    return { allowed: true, sanitized }
  } catch {
    return { allowed: false }
  }
}

/**
 * Utility: Create a guard for specific use case
 */
export async function createGuard(type: 'financial' | 'healthcare' | 'general' | 'security') {
  const configs = {
    financial: {
      level: 'strict' as SecurityLevel,
      categories: ['core', 'financial', 'security'] as PatternCategory[],
    },
    healthcare: {
      level: 'strict' as SecurityLevel,
      categories: ['core', 'personal', 'security'] as PatternCategory[],
    },
    security: {
      level: 'strict' as SecurityLevel,
      categories: ['core', 'security'] as PatternCategory[],
    },
    general: { level: 'balanced' as SecurityLevel },
  }

  return ensureGuard(configs[type])
}

/**
 * Reset global state (useful for testing)
 */
export function reset(): void {
  globalGuard = null
  currentLevel = 'balanced'
}
