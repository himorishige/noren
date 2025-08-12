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

  releaseOne(hit: Hit): void {
    if (this.pool.length < this.maxSize) {
      this.securelyWipeHit(hit)
      this.pool.push(hit)
    }

    this.clearCounter++
    if (this.clearCounter >= this.clearThreshold) {
      this.forcePoolClear()
      this.clearCounter = 0
    }
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

  releaseRange(hits: Hit[], count: number): void {
    // Return first N hits to pool for reuse without allocating a new array
    const n = Math.min(count, hits.length)
    for (let i = 0; i < n; i++) {
      if (this.pool.length < this.maxSize) {
        const hit = hits[i]
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
    // Clear fields to allow GC to reclaim memory. Random overwrites are unnecessary in JS runtime.
    hit.value = ''
    hit.start = 0
    hit.end = 0
    hit.risk = 'low'
    hit.priority = undefined
    // Do not modify type to avoid unintended serialization issues
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
