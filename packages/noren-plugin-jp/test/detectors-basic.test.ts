import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { detectors, maskers } from '@himorishige/noren-plugin-jp'
import type { Detector, DetectUtils, Hit } from '@himorishige/noren-core'

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

describe('noren-plugin-jp detectors', () => {
  it('detects jp.postal when context present', () => {
    const text = '住所: 〒123-4567 東京都…'
    const hits = runDetect(text)
    assert.ok(hits.find((h) => h.type === 'jp_postal'))
    assert.equal(maskers.jp_postal({ value: '123-4567' } as unknown as Hit), '〒•••-••••')
  })

  it('detects jp.phone patterns and masks digits', () => {
    const text = 'TEL 03-1234-5678 または +81-90-1111-2222'
    const hits = runDetect(text)
    const phone = hits.find((h) => h.type === 'phone_jp')
    assert.ok(phone)
    const masked = maskers.phone_jp({ value: '03-1234-5678' } as unknown as Hit)
    // after masking there should be no digits
    assert.equal(masked.replace(/\D/g, '').length, 0)
    assert.ok(/^[•\-]+$/.test(masked.replace(/\d/g, '•')))
  })

  it('detects jp.mynumber only with context', () => {
    // without context keywords in text
    const text = 'これは 123456789012 の記述'
    const hits = runDetect(text)
    // Without context, none
    assert.ok(!hits.find((h) => h.type === 'jp_my_number'))

    const hitsCtx = runDetect(`${text} マイナンバーあり`)
    assert.ok(hitsCtx.find((h) => h.type === 'jp_my_number'))
    assert.equal(maskers.jp_my_number({ value: '123456789012' } as unknown as Hit), '[REDACTED:MYNUMBER]')
  })
})
