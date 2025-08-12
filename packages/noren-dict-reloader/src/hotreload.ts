type SourceMeta = {
  etag?: string
  lastModified?: string
  text?: string
  json?: unknown
}

export type ReloaderOptions<TCompiled> = {
  policyUrl: string
  dictManifestUrl: string // { dicts: [{id,url}] }
  headers?: Record<string, string>
  intervalMs?: number
  maxIntervalMs?: number
  jitter?: number
  onSwap?: (compiled: TCompiled, changed: string[]) => void
  onError?: (err: unknown) => void
  compile: (policy: unknown, dicts: unknown[]) => TCompiled
  /**
   * Optional custom loader. If provided, it overrides the default HTTP(S) loader.
   * This enables loading from file://, in-memory stores, or custom transports.
   */
  load?: LoaderFn
  /**
   * Request timeout in milliseconds for HTTP requests
   */
  requestTimeoutMs?: number
  /**
   * URL validation function to prevent SSRF attacks
   */
  validateUrl?: (url: URL) => boolean
  /**
   * Maximum number of concurrent dictionary downloads
   */
  maxConcurrent?: number
}

export type LoaderResult = { status: 200 | 304; meta: SourceMeta }
export type LoaderFn = (
  url: string,
  prev: SourceMeta | undefined,
  headers: Record<string, string>,
  force: boolean,
) => Promise<LoaderResult>

export class PolicyDictReloader<TCompiled> {
  private opts: Required<
    Omit<
      ReloaderOptions<TCompiled>,
      | 'onSwap'
      | 'onError'
      | 'compile'
      | 'load'
      | 'requestTimeoutMs'
      | 'validateUrl'
      | 'maxConcurrent'
    >
  > &
    Pick<
      ReloaderOptions<TCompiled>,
      'onSwap' | 'onError' | 'compile' | 'requestTimeoutMs' | 'validateUrl' | 'maxConcurrent'
    >
  private timer: ReturnType<typeof setTimeout> | null = null
  private running = false
  private backoff = 0

  private policy: SourceMeta = {}
  private manifest: SourceMeta = {}
  private dicts = new Map<string, SourceMeta>()
  private compiled: TCompiled | null = null
  private loader: LoaderFn

  constructor(opts: ReloaderOptions<TCompiled>) {
    this.opts = {
      intervalMs: opts.intervalMs ?? 30_000,
      maxIntervalMs: opts.maxIntervalMs ?? 5 * 60_000,
      jitter: opts.jitter ?? 0.2,
      headers: opts.headers ?? {},
      policyUrl: opts.policyUrl,
      dictManifestUrl: opts.dictManifestUrl,
      onSwap: opts.onSwap,
      onError: opts.onError,
      compile: opts.compile,
      requestTimeoutMs: opts.requestTimeoutMs,
      validateUrl: opts.validateUrl,
      maxConcurrent: opts.maxConcurrent,
    }

    // Create enhanced loader with timeout and validation
    this.loader =
      opts.load ??
      createEnhancedLoader({
        requestTimeoutMs: this.opts.requestTimeoutMs,
        validateUrl: this.opts.validateUrl,
      })
  }

  getCompiled() {
    if (!this.compiled) throw new Error('not compiled')
    return this.compiled
  }

  async start() {
    if (this.running) return
    this.running = true
    await this.tick(false)
  }
  stop() {
    this.running = false
    if (this.timer) clearTimeout(this.timer)
    this.timer = null
  }

  async forceReload() {
    await this.tick(true)
  }

  // Internal implementation
  private nextDelay(ok: boolean) {
    if (ok) this.backoff = 0
    else
      this.backoff = Math.min(
        (this.backoff || 1) * 2,
        Math.floor(this.opts.maxIntervalMs / this.opts.intervalMs),
      )
    const base = this.opts.intervalMs * (this.backoff || 1)
    const rnd = 1 + (Math.random() * 2 * this.opts.jitter - this.opts.jitter)
    return Math.floor(base * rnd)
  }
  private schedule(ok: boolean) {
    if (!this.running) return
    this.timer = setTimeout(() => this.tick(false).catch(() => {}), this.nextDelay(ok))
  }

  private async tick(force: boolean) {
    try {
      const changed: string[] = []

      // Load policy and manifest (keep sequential for critical config)
      try {
        const p = await this.loader(this.opts.policyUrl, this.policy, this.opts.headers, force)
        if (p.status === 200) {
          this.policy = p.meta
          changed.push('policy')
        }
      } catch (e) {
        this.opts.onError?.(
          new Error(`Failed to load policy: ${e instanceof Error ? e.message : String(e)}`),
        )
        // Continue with existing policy
      }

      try {
        const m = await this.loader(
          this.opts.dictManifestUrl,
          this.manifest,
          this.opts.headers,
          force,
        )
        if (m.status === 200) {
          this.manifest = m.meta
          changed.push('manifest')
        }
      } catch (e) {
        this.opts.onError?.(
          new Error(`Failed to load manifest: ${e instanceof Error ? e.message : String(e)}`),
        )
        // Continue with existing manifest
      }

      // Parallel dictionary loading with error resilience
      const list = parseManifestJson(this.manifest.json)
      if (list.length > 0) {
        const maxConcurrent = this.opts.maxConcurrent ?? 4
        const dictResults = await this.loadDictionariesWithConcurrency(list, force, maxConcurrent)

        // Process successful dictionary loads
        for (const result of dictResults) {
          if (result.status === 'fulfilled' && result.value) {
            const { id, meta } = result.value
            this.dicts.set(id, meta)
            changed.push(`dict:${id}`)
          } else if (result.status === 'rejected') {
            this.opts.onError?.(new Error(`Dictionary load failed: ${result.reason}`))
            // Keep existing dictionary data
          }
        }
      }

      // Remove dictionaries no longer in manifest
      for (const existingId of Array.from(this.dicts.keys())) {
        if (!list.find((x) => x.id === existingId)) {
          this.dicts.delete(existingId)
          changed.push(`dict-removed:${existingId}`)
        }
      }

      if (changed.length === 0 && this.compiled && !force) {
        this.schedule(true)
        return
      }

      // Compile with available data (may include partial failures)
      const policyRaw = this.policy.json ?? {}
      const dictsRaw = Array.from(this.dicts.values()).map((v) => v.json ?? {})
      const compiled = this.opts.compile(policyRaw, dictsRaw)

      this.compiled = compiled
      this.opts.onSwap?.(compiled, changed)
      this.schedule(true)
    } catch (e) {
      this.opts.onError?.(e)
      this.schedule(false)
    }
  }

  private async loadDictionariesWithConcurrency(
    list: Array<{ id: string; url: string }>,
    force: boolean,
    maxConcurrent: number,
  ): Promise<Array<PromiseSettledResult<{ id: string; meta: SourceMeta } | null>>> {
    const semaphore = new Semaphore(maxConcurrent)

    const tasks = list.map(async ({ id, url }) => {
      await semaphore.acquire()
      try {
        const prev = this.dicts.get(id)
        const d = await this.loader(url, prev, this.opts.headers, force)
        if (d.status === 200) {
          return { id, meta: d.meta }
        }
        return null
      } finally {
        semaphore.release()
      }
    })

    return Promise.allSettled(tasks)
  }
}

// ---- utility classes ----

/**
 * Simple semaphore for limiting concurrency
 */
class Semaphore {
  private available: number
  private waiting: Array<() => void> = []

  constructor(maxConcurrent: number) {
    this.available = maxConcurrent
  }

  async acquire(): Promise<void> {
    if (this.available > 0) {
      this.available--
      return
    }

    return new Promise<void>((resolve) => {
      this.waiting.push(resolve)
    })
  }

  release(): void {
    if (this.waiting.length > 0) {
      const next = this.waiting.shift()
      next?.()
    } else {
      this.available++
    }
  }
}

// ---- fetch helpers ----

/**
 * Create an enhanced loader with timeout and URL validation
 */
function createEnhancedLoader(opts?: {
  requestTimeoutMs?: number
  validateUrl?: (url: URL) => boolean
}): LoaderFn {
  return async (url: string, prev, headers, force) => {
    // URL validation
    if (opts?.validateUrl) {
      try {
        const parsedUrl = new URL(url)
        if (!opts.validateUrl(parsedUrl)) {
          throw new Error(`URL not allowed by validation: ${url}`)
        }
      } catch (err) {
        if (err instanceof Error && err.message.includes('not allowed')) {
          throw err
        }
        throw new Error(`Invalid URL: ${url}`)
      }
    }

    return conditionalGetWithTimeout(url, prev, headers, force, opts?.requestTimeoutMs)
  }
}

async function conditionalGetWithTimeout(
  url: string,
  prev: SourceMeta | undefined,
  headers: Record<string, string>,
  force: boolean,
  timeoutMs?: number,
): Promise<LoaderResult> {
  const h: Record<string, string> = { 'cache-control': 'no-cache', ...(headers ?? {}) }
  let reqUrl = url
  if (force) {
    const u = new URL(url)
    u.searchParams.set('_bust', String(Date.now()))
    reqUrl = u.toString()
    h.pragma = 'no-cache'
  } else {
    if (prev?.etag) h['if-none-match'] = prev.etag
    else if (prev?.lastModified) h['if-modified-since'] = prev.lastModified
  }

  let controller: AbortController | undefined
  let timeoutId: ReturnType<typeof setTimeout> | undefined

  if (timeoutMs && timeoutMs > 0) {
    controller = new AbortController()
    timeoutId = setTimeout(() => {
      controller?.abort()
    }, timeoutMs)
  }

  try {
    const res = await fetch(reqUrl, {
      method: 'GET',
      headers: h,
      signal: controller?.signal,
    })

    if (timeoutId) clearTimeout(timeoutId)

    if (res.status === 304) {
      if (!prev) {
        throw new Error(`304 Not Modified from ${reqUrl} without previous metadata`)
      }
      return { status: 304 as const, meta: prev }
    }
    if (!res.ok) throw new Error(`fetch ${reqUrl} -> ${res.status}`)

    const text = await res.text()
    let etag = res.headers.get('etag') ?? undefined
    const lastModified = res.headers.get('last-modified') ?? undefined
    if (!etag) etag = `W/"sha256:${await sha256Hex(text)}"`

    let json: unknown
    try {
      json = JSON.parse(text)
    } catch {
      json = text
    }
    return { status: 200 as const, meta: { etag, lastModified, text, json } }
  } catch (err) {
    if (timeoutId) clearTimeout(timeoutId)

    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error(`Request timeout after ${timeoutMs}ms: ${reqUrl}`)
    }
    throw err
  }
}

async function conditionalGet(
  url: string,
  prev: SourceMeta | undefined,
  headers: Record<string, string>,
  force: boolean,
) {
  const h: Record<string, string> = { 'cache-control': 'no-cache', ...(headers ?? {}) }
  let reqUrl = url
  if (force) {
    const u = new URL(url)
    u.searchParams.set('_bust', String(Date.now()))
    reqUrl = u.toString()
    h.pragma = 'no-cache'
  } else {
    if (prev?.etag) h['if-none-match'] = prev.etag
    else if (prev?.lastModified) h['if-modified-since'] = prev.lastModified
  }

  const res = await fetch(reqUrl, { method: 'GET', headers: h })
  if (res.status === 304) {
    if (!prev) {
      throw new Error(`304 Not Modified from ${reqUrl} without previous metadata`)
    }
    return { status: 304 as const, meta: prev }
  }
  if (!res.ok) throw new Error(`fetch ${reqUrl} -> ${res.status}`)

  const text = await res.text()
  let etag = res.headers.get('etag') ?? undefined
  const lastModified = res.headers.get('last-modified') ?? undefined
  if (!etag) etag = `W/"sha256:${await sha256Hex(text)}"`

  let json: unknown
  try {
    json = JSON.parse(text)
  } catch {
    json = text
  }
  return { status: 200 as const, meta: { etag, lastModified, text, json } }
}

const enc = new TextEncoder()
async function sha256Hex(s: string) {
  const buf = await crypto.subtle.digest('SHA-256', enc.encode(s))
  const u8 = new Uint8Array(buf)
  let hex = ''
  for (let i = 0; i < u8.length; i++) {
    const v = u8[i]
    hex += (v >>> 4).toString(16) + (v & 0xf).toString(16)
  }
  return hex
}

function parseManifestJson(j: unknown): Array<{ id: string; url: string }> {
  if (!j || typeof j !== 'object') return []
  const dicts = (j as { dicts?: unknown }).dicts
  if (!Array.isArray(dicts)) return []
  const out: Array<{ id: string; url: string }> = []
  for (const it of dicts) {
    if (it && typeof it === 'object') {
      const id = (it as Record<string, unknown>).id
      const url = (it as Record<string, unknown>).url
      if (typeof id === 'string' && typeof url === 'string') out.push({ id, url })
    }
  }
  return out
}

// Public alias for the built-in HTTP(S) loader
export { conditionalGet as defaultLoader }
