import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import type { DetectUtils, Detector, Hit } from '@himorishige/noren-core'
import { detectors, maskers } from '@himorishige/noren-plugin-us'

function runDetect(src: string, ctxHints: string[] = []): Hit[] {
  const hits: Hit[] = []
  const u: DetectUtils = {
    src,
    hasCtx: (ws?: string[]) => (ws ?? ctxHints).some((w) => src.includes(w)),
    push: (h: Hit) => hits.push(h),
  }
  for (const d of detectors as unknown as Detector[]) void d.match(u)
  return hits
}

describe('noren-plugin-us detectors', () => {
  it('detects US phone and masks', () => {
    const text = 'Call me at (415) 555-2671 or +1 650 555 1234'
    const hits = runDetect(text)
    assert.ok(hits.find((h) => h.type === 'us_phone'))
    const masked = maskers.us_phone({ value: '415-555-2671' } as unknown as Hit)
    // after masking there should be no digits
    assert.equal(masked.replace(/\D/g, '').length, 0)
    // only bullets and separators remain
    assert.ok(/^[•\s().+-]+$/.test(masked))
  })

  it('detects US ZIP only with context', () => {
    const base = 'The code is 94105'
    const hitsNo = runDetect(base)
    assert.ok(!hitsNo.find((h) => h.type === 'us_zip'))

    const hitsYes = runDetect('Address ZIP: 94105')
    assert.ok(hitsYes.find((h) => h.type === 'us_zip'))
    assert.equal(maskers.us_zip({ value: '94105-1234' } as unknown as Hit), '•••••-••••')
  })

  it('detects US SSN only with context and masks to last4', () => {
    const text = 'SSN 123-45-6789'
    const hits = runDetect(text)
    assert.ok(hits.find((h) => h.type === 'us_ssn'))
    assert.equal(maskers.us_ssn({ value: '123-45-6789' } as unknown as Hit), '***-**-6789')
  })
})
