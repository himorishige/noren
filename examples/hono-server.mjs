import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { Registry, redactText } from '../packages/noren-core/dist/index.js'
import * as jp from '../packages/noren-plugin-jp/dist/index.js'
import * as us from '../packages/noren-plugin-us/dist/index.js'

// Registry
const reg = new Registry({
  defaultAction: 'mask',
  rules: {
    credit_card: { action: 'mask', preserveLast4: true },
    jp_my_number: { action: 'remove' },
  },
  contextHints: ['TEL', '電話', '〒', '住所', 'Zip', 'Address', 'SSN', 'Social Security'],
})
reg.use(jp.detectors, jp.maskers, ['〒', '住所', 'TEL', 'Phone'])
reg.use(us.detectors, us.maskers, ['Zip', 'Address', 'SSN', 'Phone'])

// TransformStream (same as stream example)
function createRedactionTransform(window = 96) {
  const dec = new TextDecoder()
  const enc = new TextEncoder()
  let tail = ''
  return new TransformStream({
    async transform(chunk, controller) {
      const text = dec.decode(chunk, { stream: true })
      const buf = tail + text
      const cut = Math.max(0, buf.length - window)
      const head = buf.slice(0, cut)
      const red = await redactText(reg, head, { hmacKey: 'dev-secret' })
      controller.enqueue(enc.encode(red))
      tail = buf.slice(cut)
    },
    async flush(controller) {
      const red = await redactText(reg, tail, { hmacKey: 'dev-secret' })
      controller.enqueue(new TextEncoder().encode(red))
    },
  })
}

const app = new Hono()

app.get('/', (c) => c.text('Noren Hono server: POST /redact with text body'))

app.post('/redact', async (c) => {
  const body = c.req.raw.body // ReadableStream<Uint8Array>
  if (!body) return c.text('no body', 400)
  const redacted = body.pipeThrough(createRedactionTransform())
  return new Response(redacted, { headers: { 'content-type': 'text/plain; charset=utf-8' } })
})

const port = Number(process.env.PORT || 8787)
console.log(`listening on http://localhost:${port}`)
serve({ fetch: app.fetch, port })
