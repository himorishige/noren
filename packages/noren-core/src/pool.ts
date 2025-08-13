// Lightweight hit object pool for v0.5.0
import type { Hit, PiiType } from './types.js'

// Optimized hit pool with minimal overhead
export class HitPool {
  private pool: Hit[] = []
  private maxSize = 20 // Smaller pool for better performance
  private clearCounter = 0

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
    this.release([hit])
  }

  release(hits: Hit[]): void {
    // Return hits to pool for reuse
    for (const hit of hits) {
      if (this.pool.length < this.maxSize) {
        // Simple cleanup - let JS GC handle the rest
        hit.value = ''
        hit.priority = undefined
        this.pool.push(hit)
      }
    }

    // Periodic cleanup every 100 releases
    if (++this.clearCounter >= 100) {
      this.pool.length = 0
      this.clearCounter = 0
    }
  }

  releaseRange(hits: Hit[], count: number): void {
    const toRelease = hits.slice(0, Math.min(count, hits.length))
    this.release(toRelease)
  }

  clear(): void {
    this.pool.length = 0
    this.clearCounter = 0
  }
}

export const hitPool = new HitPool()
