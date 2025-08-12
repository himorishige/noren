import { PolicyDictReloader } from '@himorishige/noren-dict-reloader'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

// minimal compile: just bundle inputs to verify wiring
function compile(policy: unknown, dicts: unknown[]) {
  return { policy, dicts, stamp: Date.now() }
}

describe('PolicyDictReloader basic', () => {
  const POLICY_URL = 'https://example.local/policy.json'
  const MANIFEST_URL = 'https://example.local/manifest.json'
  const DICT1_URL = 'https://example.local/dict-1.json'
  const DICT2_URL = 'https://example.local/dict-2.json'

  let originalFetch: typeof fetch

  beforeAll(() => {
    originalFetch = globalThis.fetch
    globalThis.fetch = (async (url: string, init?: RequestInit) => {
      // emulate no-cache headers usage
      void init
      if (url.startsWith(POLICY_URL)) {
        return new Response(JSON.stringify({ allow: true }), {
          status: 200,
          headers: { etag: 'W/"p1"', 'last-modified': new Date().toUTCString() },
        })
      }
      if (url.startsWith(MANIFEST_URL)) {
        return new Response(
          JSON.stringify({
            dicts: [
              { id: 'd1', url: DICT1_URL },
              { id: 'd2', url: DICT2_URL },
            ],
          }),
          { status: 200, headers: { etag: 'W/"m1"' } },
        )
      }
      if (url.startsWith(DICT1_URL)) {
        return new Response(JSON.stringify({ entries: [{ k: 'a', v: 1 }] }), {
          status: 200,
          headers: { etag: 'W/"d1"' },
        })
      }
      if (url.startsWith(DICT2_URL)) {
        return new Response(JSON.stringify({ entries: [{ k: 'b', v: 2 }] }), {
          status: 200,
          headers: { etag: 'W/"d2"' },
        })
      }
      return new Response('not found', { status: 404 })
    }) as typeof fetch
  })

  afterAll(() => {
    globalThis.fetch = originalFetch
  })

  it('loads policy+manifest+dicts and compiles on start()', async () => {
    const swaps: Array<{ changed: string[]; compiled: ReturnType<typeof compile> }> = []
    const r = new PolicyDictReloader({
      policyUrl: POLICY_URL,
      dictManifestUrl: MANIFEST_URL,
      compile,
      onSwap: (compiled, changed) => swaps.push({ compiled, changed }),
      onError: (e) => {
        throw e instanceof Error ? e : new Error(String(e))
      },
    })

    await r.start() // should perform first tick

    // compiled should be available
    const c = r.getCompiled()
    expect(c).toBeTruthy()
    expect(Array.isArray(c.dicts)).toBe(true)
    expect(c.dicts.length).toBe(2)

    // onSwap should be called with changed list that includes policy/manifest/dicts
    expect(swaps.length >= 1).toBeTruthy()
    const first = swaps[0]
    expect(first.changed).toContain('policy')
    expect(first.changed).toContain('manifest')
    expect(first.changed).toContain('dict:d1')
    expect(first.changed).toContain('dict:d2')

    r.stop()
  })
})
