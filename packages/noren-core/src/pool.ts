// Hit object pool (separate for tree-shaking)
import type { Hit, PiiType } from './types.js'

// Hit object pool for reducing GC pressure
export class HitPool {
  private pool: Hit[] = []
  private maxSize = 100 // Prevent unbounded growth

  acquire(type: PiiType, start: number, end: number, value: string, risk: Hit['risk']): Hit {
    const hit = this.pool.pop()
    if (hit) {
      // Reuse existing object
      hit.type = type
      hit.start = start
      hit.end = end
      hit.value = value
      hit.risk = risk
      return hit
    }
    // Create new object if pool is empty
    return { type, start, end, value, risk }
  }

  release(hits: Hit[]): void {
    // Return hits to pool for reuse
    for (const hit of hits) {
      if (this.pool.length < this.maxSize) {
        // Clear sensitive data and return to pool
        hit.value = ''
        hit.type = '' as PiiType
        this.pool.push(hit)
      }
    }
  }

  clear(): void {
    this.pool.length = 0
  }
}

export const hitPool = new HitPool()