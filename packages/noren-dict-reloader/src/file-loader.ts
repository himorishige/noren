import { readFile, stat } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { createHash } from 'node:crypto'
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
export function createFileLoader(fallback: LoaderFn = defaultLoader): LoaderFn {
  return async (url: string, prev, headers, force): Promise<LoaderResult> => {
    if (!url.startsWith('file://')) {
      return fallback(url, prev, headers, force)
    }

    const p = fileURLToPath(new URL(url))
    const st = await stat(p)

    const text = await readFile(p, 'utf8')
    const etag = `W/"sha256:${sha256Hex(text)}"`
    const lastModified = toLastModifiedString(st.mtimeMs)

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
