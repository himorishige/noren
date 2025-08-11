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
        // Clear sensitive data securely
        this.securelyWipeHit(hit)
        this.pool.push(hit)
      }
    }
  }

  private securelyWipeHit(hit: Hit): void {
    // Overwrite sensitive data with random values before clearing
    if (hit.value.length > 0) {
      const randomBytes = new Uint8Array(hit.value.length)
      crypto.getRandomValues(randomBytes)
      // Convert to string and overwrite original
      const randomString = Array.from(randomBytes, (b) => String.fromCharCode(b)).join('')
      hit.value = randomString
    }
    // Clear to empty values
    hit.value = ''
    hit.type = '' as PiiType
  }

  clear(): void {
    this.pool.length = 0
  }
}

export const hitPool = new HitPool()
