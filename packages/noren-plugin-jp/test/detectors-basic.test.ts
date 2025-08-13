import type { DetectUtils, Hit } from '@himorishige/noren-core'
import { detectors, maskers } from '@himorishige/noren-plugin-jp'
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

describe('noren-plugin-jp detectors', () => {
  it('detects jp.postal when context present', () => {
    const text = '住所: 〒123-4567 東京都…'
    const hits = runDetect(text)
    expect(hits.find((h) => h.type === 'postal_jp')).toBeTruthy()
    expect(maskers.postal_jp({ value: '123-4567' } as unknown as Hit)).toBe('•••-••••')
  })

  it('detects jp.phone patterns and masks digits', () => {
    const text = 'TEL 03-1234-5678 または +81-90-1111-2222'
    const hits = runDetect(text)
    const phone = hits.find((h) => h.type === 'phone_jp')
    expect(phone).toBeTruthy()
    const masked = maskers.phone_jp({ value: '03-1234-5678' } as unknown as Hit)
    // after masking there should be no digits
    expect(masked.replace(/\D/g, '').length).toBe(0)
    expect(/^[•-]+$/.test(masked.replace(/\d/g, ''))).toBeTruthy()
  })

  it('detects jp.mynumber only with context', () => {
    // without context keywords in text
    const text = 'これは 123456789012 の記述'
    const hits = runDetect(text)
    // Without context, none
    expect(hits.find((h) => h.type === 'mynumber_jp')).toBeFalsy()

    const hitsCtx = runDetect(`${text} マイナンバーあり`)
    expect(hitsCtx.find((h) => h.type === 'mynumber_jp')).toBeTruthy()
    expect(maskers.mynumber_jp({ value: '123456789012' } as unknown as Hit)).toBe(
      '[REDACTED:MYNUMBER]',
    )
  })
})
