import type { Detector, DetectUtils, Hit } from '@himorishige/noren-core'
import { detectors, maskers } from '@himorishige/noren-plugin-us'
import { describe, expect, it } from 'vitest'

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
    expect(hits.find((h) => h.type === 'us_phone')).toBeTruthy()
    const masked = maskers.us_phone({ value: '415-555-2671' } as unknown as Hit)
    // after masking there should be no digits
    expect(masked.replace(/\D/g, '').length).toBe(0)
    // only bullets and separators remain
    expect(/^[•\s().+-]+$/.test(masked)).toBeTruthy()
  })

  it('detects US ZIP only with context', () => {
    const base = 'The code is 94105'
    const hitsNo = runDetect(base)
    expect(hitsNo.find((h) => h.type === 'us_zip')).toBeFalsy()

    const hitsYes = runDetect('Address ZIP: 94105')
    expect(hitsYes.find((h) => h.type === 'us_zip')).toBeTruthy()
    expect(maskers.us_zip({ value: '94105-1234' } as unknown as Hit)).toBe('•••••-••••')
  })

  it('detects US SSN only with context and masks to last4', () => {
    const text = 'SSN 123-45-6789'
    const hits = runDetect(text)
    expect(hits.find((h) => h.type === 'us_ssn')).toBeTruthy()
    expect(maskers.us_ssn({ value: '123-45-6789' } as unknown as Hit)).toBe('***-**-6789')
  })
})
