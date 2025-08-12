# Security and Performance Recommendations

Scope: `@himorishige/noren-dict-reloader`

This document summarizes current safeguards, identified risks, and prioritized recommendations for the file and HTTP loaders used by the reloader.

## Threat and Performance Model

- File loader (`file://`)
  - Path traversal via symlinks
  - Access to non-regular files (devices, fifos), potential hangs or undefined behavior
  - Remote/UNC hosts in `file://host/...`
  - Unbounded file size leading to excessive memory usage
- HTTP(S) loader
  - No request timeout/abort → hangs on stalled networks
  - Sequential dictionary downloads → longer refresh cycles
  - Locally-computed ETag fallback cannot yield 304 on the server (bandwidth unchanged)
  - Potential SSRF if manifest URLs are not constrained by the integrator
- Reloader orchestration
  - Any single fetch error aborts the entire tick and delays updates

## Existing Safeguards (as of now)

- `file-loader.ts`
  - URL parsing with `new URL(url)` and rejection of query/hash
  - `fileURLToPath()` + `realpath()` and optional `baseDir` prefix check to mitigate symlink traversal
  - Weak ETag derived from SHA-256 of content
  - `Last-Modified` from `stat.mtimeMs`
  - JSON auto-parse with fallback to raw text
- `hotreload.ts`
  - Conditional GET (`If-None-Match` / `If-Modified-Since`)
  - Force reload by adding cache-busting query
  - Exponential backoff with jitter

## Recommendations (prioritized)

1) High priority
- Reject non-regular files in the file loader
  - After `stat(real)`, enforce `st.isFile()`; otherwise throw a descriptive error
- Add size limit to the file loader
  - New option `maxBytes?: number` (suggested default for a safe release: 5MB)
- Add request timeout to HTTP loader
  - New option `requestTimeoutMs?: number` (suggested default: 10_000ms) using `AbortController`
- Make dictionary fetch resilient to partial failures
  - Keep previous metadata/content for failing dicts and continue compiling with the last known good set

2) Medium priority
- Parallelize dictionary downloads with a small concurrency limit
  - New option `maxConcurrent?: number` (suggested default: 4)
- Add URL validation hook or allowlist
  - New option `validateUrl?: (url: URL) => boolean` (or `allowedProtocols/hosts`), applied to manifest and dict URLs to mitigate SSRF
- Harden `file://` host handling
  - New option `allowRemoteFileHosts?: string[]` and reject `file://host/...` unless host is explicitly allowed

3) Low priority
- Local 304 optimization for HTTP is not effective for bandwidth (server still sends body); no change recommended

## Proposed API additions

- `createFileLoader(fallback = defaultLoader, opts?: {
    baseDir?: string
    maxBytes?: number
    allowRemoteFileHosts?: string[]
  }): LoaderFn`

- `type ReloaderOptions<TCompiled> = {
    policyUrl: string
    dictManifestUrl: string
    headers?: Record<string, string>
    intervalMs?: number
    maxIntervalMs?: number
    jitter?: number
    onSwap?: (compiled: TCompiled, changed: string[]) => void
    onError?: (err: unknown) => void
    compile: (policy: unknown, dicts: unknown[]) => TCompiled
    load?: LoaderFn

    // New options
    requestTimeoutMs?: number
    validateUrl?: (url: URL) => boolean
    maxConcurrent?: number
  }`

## Example usage

```ts
import { PolicyDictReloader, fileLoader, createFileLoader } from '@himorishige/noren-dict-reloader'

const load = createFileLoader(fileLoader, {
  baseDir: '/app/config',
  maxBytes: 5 * 1024 * 1024, // 5MB
  allowRemoteFileHosts: [],   // reject file://host/... by default
})

const reloader = new PolicyDictReloader({
  policyUrl: 'https://example.com/policy.json',
  dictManifestUrl: 'https://example.com/manifest.json',
  load,
  requestTimeoutMs: 10_000,
  maxConcurrent: 4,
  validateUrl: (u) => u.protocol === 'https:' && u.hostname.endsWith('.example.com'),
  compile: (policy, dicts) => compilePolicy(policy, dicts),
  onSwap: (compiled, changed) => console.info('reloaded:', changed),
  onError: (err) => console.warn('reload error:', err),
})
```

## Backward compatibility

- Non-breaking path:
  - Introduce the new options with conservative defaults that preserve current behavior:
    - `maxBytes` undefined (no size limit)
    - `requestTimeoutMs` undefined (no timeout)
    - `maxConcurrent` undefined or `1` (preserve sequential downloads)
    - `allowRemoteFileHosts` undefined (preserve current permissive host behavior)
- Breaking (safer) defaults can be adopted in a major release:
  - `maxBytes = 5MB`, `requestTimeoutMs = 10s`, `maxConcurrent = 4`, and disallow `file://host/...` by default

## Implementation notes (checklist)

- File loader
  - [ ] Add `st.isFile()` guard
  - [ ] Enforce `maxBytes` via `stat.size`
  - [ ] Reject `file://host/...` unless in `allowRemoteFileHosts`
- HTTP loader
  - [ ] Add `AbortController` and `requestTimeoutMs`
  - [ ] Ensure errors include URL and status but not response bodies
- Reloader orchestration
  - [ ] Switch dict fetches to `Promise.allSettled` with bounded concurrency
  - [ ] Compile with last known good dicts when some fetches fail
- Docs & examples
  - [ ] Update README with new options and examples
```
