import type { DetectUtils, Hit } from '@himorishige/noren-core'
import { detectors, maskers } from '@himorishige/noren-plugin-us'
import { describe, expect, it } from 'vitest'

function runDetect(src: string, ctxHints: string[] = []): Hit[] {
  const hits: Hit[] = []
  const u: DetectUtils = {
    src,
    hasCtx: (ws?: string[]) =>
      (ws ?? ctxHints).some((w) => src.toLowerCase().includes(w.toLowerCase())),
    push: (h: Hit) => hits.push(h),
    canPush: () => true,
  }
  for (const d of detectors) void d.match(u)
  return hits
}

describe('noren-plugin-us detectors', () => {
  it('detects US phone and masks', () => {
    const text = 'Call me at (415) 555-2671 or +1 650 555 1234'
    const hits = runDetect(text)
    expect(hits.find((h) => h.type === 'phone_us')).toBeTruthy()
    const masked = maskers.phone_us({ value: '415-555-2671' } as unknown as Hit)
    // after masking there should be no digits
    expect(masked.replace(/\D/g, '').length).toBe(0)
    // only bullets and separators remain
    expect(/^[•\s().+-]+$/.test(masked)).toBeTruthy()
  })

  it('detects US ZIP only with context', () => {
    const base = 'The code is 94105'
    const hitsNo = runDetect(base)
    expect(hitsNo.find((h) => h.type === 'zip_us')).toBeFalsy()

    const hitsYes = runDetect('Address ZIP: 94105')
    expect(hitsYes.find((h) => h.type === 'zip_us')).toBeTruthy()
    expect(maskers.zip_us({ value: '94105-1234' } as unknown as Hit)).toBe('•••••-••••')
  })

  it('detects US SSN only with context and masks to last4', () => {
    const text = 'SSN 123-45-6789'
    const hits = runDetect(text)
    expect(hits.find((h) => h.type === 'ssn_us')).toBeTruthy()
    expect(maskers.ssn_us({ value: '123-45-6789' } as unknown as Hit)).toBe('***-**-6789')
  })
})
