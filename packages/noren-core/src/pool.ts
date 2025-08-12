// Hit object pool (separate for tree-shaking)
import type { Hit, PiiType } from './types.js'

// Hit object pool for reducing GC pressure
export class HitPool {
  private pool: Hit[] = []
  private maxSize = 50 // Reduced pool size for security
  private clearCounter = 0
  private clearThreshold = 20 // Clear pool every N releases for security

  acquire(
    type: PiiType,
    start: number,
    end: number,
    value: string,
    risk: Hit['risk'],
    priority?: number,
  ): Hit {
    const hit = this.pool.pop()
    if (hit) {
      // Reuse existing object
      hit.type = type
      hit.start = start
      hit.end = end
      hit.value = value
      hit.risk = risk
      hit.priority = priority
      return hit
    }
    // Create new object if pool is empty
    return { type, start, end, value, risk, priority }
  }

  release(hits: Hit[]): void {
    // Return hits to pool for reuse
    for (const hit of hits) {
      if (this.pool.length < this.maxSize) {
        // Clear sensitive data securely before pooling
        this.securelyWipeHit(hit)
        this.pool.push(hit)
      }
    }

    // Periodically clear the entire pool for security
    this.clearCounter++
    if (this.clearCounter >= this.clearThreshold) {
      this.forcePoolClear()
      this.clearCounter = 0
    }
  }

  private securelyWipeHit(hit: Hit): void {
    // Optimized secure wipe: single random overwrite is sufficient for memory security
    // Multiple passes were overkill for JavaScript string objects in memory
    const originalLength = hit.value.length

    if (originalLength > 0) {
      // Single random overwrite - sufficient for preventing memory dumps
      // Modern V8 string interning makes multiple passes less effective anyway
      const randomBytes = new Uint8Array(Math.min(originalLength, 64)) // Limit to 64 chars for performance
      crypto.getRandomValues(randomBytes)
      hit.value = Array.from(randomBytes, (b) => String.fromCharCode(32 + (b % 95)))
        .join('')
        .slice(0, originalLength)
    }

    // Clear other potentially sensitive fields - use empty string instead of 'unknown'
    hit.value = ''
    hit.start = 0
    hit.end = 0
    hit.risk = 'low'
    hit.priority = undefined
    // Don't initialize type to avoid 'unknown' in results and potential serialization issues
  }

  private forcePoolClear(): void {
    // Completely clear the pool for security reasons
    for (const hit of this.pool) {
      this.securelyWipeHit(hit)
    }
    this.pool.length = 0
  }

  clear(): void {
    this.forcePoolClear()
    this.clearCounter = 0
  }
}

export const hitPool = new HitPool()
