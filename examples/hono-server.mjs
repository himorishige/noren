import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { Registry, createRedactionTransform } from '../packages/noren-core/dist/index.js'
import * as jp from '../packages/noren-plugin-jp/dist/noren-plugin-jp/src/index.js'
import * as us from '../packages/noren-plugin-us/dist/noren-plugin-us/src/index.js'

// Registry
const reg = new Registry({
  defaultAction: 'mask',
  rules: {
    credit_card: { action: 'mask', preserveLast4: true },
    mynumber_jp: { action: 'remove' },
  },
  contextHints: ['TEL', '電話', '〒', '住所', 'Zip', 'Address', 'SSN', 'Social Security'],
})
reg.use(jp.detectors, jp.maskers, ['〒', '住所', 'TEL', 'Phone'])
reg.use(us.detectors, us.maskers, ['Zip', 'Address', 'SSN', 'Phone'])

// Binary-safe TransformStream using core utility
function createBinarySafeRedactionTransform(window = 96) {
  return createRedactionTransform(reg, {
    window,
    policy: {
      hmacKey: 'development-secret-key-for-server-example-32-chars',
    }
  })
}

const app = new Hono()

app.get('/', (c) => c.text('Noren Hono server: POST /redact with text body'))

app.post('/redact', async (c) => {
  const body = c.req.raw.body // ReadableStream<Uint8Array>
  if (!body) return c.text('no body', 400)
  const redacted = body.pipeThrough(createBinarySafeRedactionTransform())
  return new Response(redacted, { headers: { 'content-type': 'text/plain; charset=utf-8' } })
})

const port = Number(process.env.PORT || 8787)
console.log(`listening on http://localhost:${port}`)
serve({ fetch: app.fetch, port })
