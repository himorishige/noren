import { createHash } from 'node:crypto'
import { readFile, realpath, stat } from 'node:fs/promises'
import { resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { LoaderFn, LoaderResult } from './hotreload.js'
import { defaultLoader } from './hotreload.js'

function sha256Hex(s: string): string {
  const h = createHash('sha256')
  h.update(s)
  return h.digest('hex')
}

function toLastModifiedString(ms: number): string {
  return new Date(ms).toUTCString()
}

/**
 * Create a LoaderFn that supports file:// URLs in Node.js.
 * Non-file schemes are delegated to the provided fallback (default: HTTP loader).
 */
export function createFileLoader(
  fallback: LoaderFn = defaultLoader,
  opts?: {
    baseDir?: string
    maxBytes?: number
    allowRemoteFileHosts?: string[]
  },
): LoaderFn {
  return async (url: string, prev, headers, force): Promise<LoaderResult> => {
    if (!url.startsWith('file://')) {
      return fallback(url, prev, headers, force)
    }

    let parsedUrl: URL
    try {
      parsedUrl = new URL(url)
    } catch {
      throw new Error(`Invalid file URL: ${url}`)
    }

    // Validate URL format and security constraints
    if (parsedUrl.search || parsedUrl.hash) {
      throw new Error(`Invalid file URL (query/hash not allowed): ${url}`)
    }

    if (
      parsedUrl.hostname &&
      parsedUrl.hostname !== 'localhost' &&
      !opts?.allowRemoteFileHosts?.includes(parsedUrl.hostname)
    ) {
      throw new Error(`Remote file host not allowed: ${parsedUrl.hostname}`)
    }

    let text: string
    let etag: string
    let lastModified: string
    try {
      const p = fileURLToPath(parsedUrl)
      // Resolve symlinks and normalize to mitigate path traversal via symlinks
      const real = await realpath(p)
      // Security: Ensure path is within baseDir if specified
      if (opts?.baseDir) {
        const base = resolve(opts.baseDir)
        const normalizedBase = base.endsWith(sep) ? base : base + sep
        const normalizedReal = real.endsWith(sep) ? real : real + sep
        if (!normalizedReal.startsWith(normalizedBase)) {
          throw new Error(`Access outside of baseDir is not allowed: ${real}`)
        }
      }
      const st = await stat(real)

      // Security: Validate file type and size
      if (!st.isFile()) {
        throw new Error(`Access to non-regular file denied: ${real}`)
      }

      if (opts?.maxBytes && st.size > opts.maxBytes) {
        throw new Error(`File size ${st.size} exceeds limit ${opts.maxBytes}: ${real}`)
      }

      text = await readFile(real, 'utf8')
      etag = `W/"sha256:${sha256Hex(text)}"`
      lastModified = toLastModifiedString(st.mtimeMs)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      throw new Error(`File access failed for ${url}: ${msg}`)
    }

    if (!force && prev && (prev.etag === etag || prev.lastModified === lastModified)) {
      return { status: 304, meta: prev }
    }

    let json: unknown
    try {
      json = JSON.parse(text)
    } catch {
      json = text
    }
    return { status: 200, meta: { etag, lastModified, text, json } }
  }
}

/**
 * A ready-to-use loader that handles file:// and falls back to HTTP(S).
 */
export const fileLoader: LoaderFn = createFileLoader()
