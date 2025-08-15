/**
 * Debug test for JSON detection issues
 */

import { describe, expect, it } from 'vitest'
import { Registry } from '../src/index.js'

describe('Debug JSON detection', () => {
  it('should debug JSON detection step by step', async () => {
    const registry = new Registry({
      defaultAction: 'mask',
      enableJsonDetection: true,
    })

    const jsonInput = JSON.stringify({
      email: 'test@example.com',
    })

    console.log('Input JSON:', jsonInput)

    const result = await registry.detect(jsonInput)

    console.log('Result hits:', result.hits)
    console.log('Hit count:', result.hits.length)

    for (const hit of result.hits) {
      console.log('Hit:', {
        type: hit.type,
        value: hit.value,
        features: hit.features,
        reasons: hit.reasons,
      })
    }

    expect(result.hits.length).toBeGreaterThan(0)
  })

  it('should debug enableJsonDetection false', async () => {
    const registry = new Registry({
      defaultAction: 'mask',
      enableJsonDetection: false,
    })

    const jsonInput = JSON.stringify({
      user: {
        email: 'john@example.com',
      },
    })

    console.log('Input JSON (enableJsonDetection: false):', jsonInput)

    const result = await registry.detect(jsonInput)

    console.log('Result hits (should not have JSON features):', result.hits)

    for (const hit of result.hits) {
      console.log('Hit:', {
        type: hit.type,
        value: hit.value,
        features: hit.features,
        reasons: hit.reasons,
      })
    }

    expect(result.hits.length).toBeGreaterThan(0)
  })

  it('should debug NDJSON format', async () => {
    const registry = new Registry({
      defaultAction: 'mask',
      enableJsonDetection: true,
    })

    const ndjsonInput = [
      JSON.stringify({ email: 'user1@example.com' }),
      JSON.stringify({ email: 'user2@example.com' }),
    ].join('\n')

    console.log('NDJSON Input:', ndjsonInput)

    const result = await registry.detect(ndjsonInput)

    const emailHits = result.hits.filter((h) => h.type === 'email' && h.features?.isJsonDetection)
    console.log('Email hits with JSON detection:', emailHits.length)

    for (const hit of emailHits) {
      console.log('NDJSON Hit:', {
        value: hit.value,
        jsonPath: hit.features?.jsonPath,
        keyName: hit.features?.keyName,
      })
    }

    expect(emailHits.length).toBeGreaterThan(0)
  })
})
