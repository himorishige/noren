import { Registry, redactText } from '@himorishige/noren-core'
import { describe, expect, it } from 'vitest'

/**
 * Basic redaction/tokenization behavior tests against built outputs.
 * We import from dist to avoid adding TS runtime loaders. [DM]
 */

describe('redactText - credit card masking/tokenization', () => {
  it('masks credit card with default mask', async () => {
    const reg = new Registry({ defaultAction: 'mask' })
    const input = 'Card: 4242 4242 4242 4242'
    const out = await redactText(reg, input)
    expect(out).toContain('[REDACTED:credit_card]')
  })

  it('masks credit card preserving last 4 when configured', async () => {
    const reg = new Registry({
      rules: { credit_card: { action: 'mask', preserveLast4: true } },
    })
    const input = 'Card: 4242-4242-4242-4242'
    const out = await redactText(reg, input)
    expect(out).toContain('**** **** **** 4242')
  })

  it('tokenizes credit card when defaultAction is tokenize and hmacKey is provided', async () => {
    const reg = new Registry({
      defaultAction: 'tokenize',
      hmacKey: 'thisisalongersecretkey123456789012',
    })
    const input = 'Card: 4242 4242 4242 4242'
    const out = await redactText(reg, input)
    expect(out).toMatch(/TKN_CREDIT_CARD_[A-Za-z0-9_-]+/)
  })
})

describe('redactText - email masking', () => {
  it('masks email by default', async () => {
    const reg = new Registry({ defaultAction: 'mask' })
    const input = 'email: foo.bar+baz@example.com'
    const out = await redactText(reg, input)
    expect(out).toContain('[REDACTED:email]')
  })
})
