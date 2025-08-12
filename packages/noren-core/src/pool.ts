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
    // Multiple overwrite passes with different patterns for better security
    const originalLength = hit.value.length

    if (originalLength > 0) {
      // Pass 1: Random data
      const randomBytes = new Uint8Array(originalLength)
      crypto.getRandomValues(randomBytes)
      hit.value = Array.from(randomBytes, (b) => String.fromCharCode(b & 0x7f)).join('')

      // Pass 2: Zeros
      hit.value = '\0'.repeat(originalLength)

      // Pass 3: Ones
      hit.value = '\xFF'.repeat(originalLength)

      // Pass 4: Final random overwrite
      crypto.getRandomValues(randomBytes)
      hit.value = Array.from(randomBytes, (b) => String.fromCharCode(b & 0x7f)).join('')
    }

    // Clear other potentially sensitive fields
    hit.type = 'unknown' as PiiType
    hit.start = 0
    hit.end = 0
    hit.risk = 'low'
    hit.priority = undefined
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
