import fs from 'node:fs'
import { Readable, Writable } from 'node:stream'
import { Registry, redactText } from '../packages/noren-core/dist/index.js'
import * as jp from '../packages/noren-plugin-jp/dist/index.js'
import * as us from '../packages/noren-plugin-us/dist/index.js'

// --- create registry
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

// --- TransformStream for redaction with tail window
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
      const red = await redactText(reg, head, {
        hmacKey: 'development-secret-key-for-stream-example-32-chars',
      })
      controller.enqueue(enc.encode(red))
      tail = buf.slice(cut)
    },
    async flush(controller) {
      const red = await redactText(reg, tail, {
        hmacKey: 'development-secret-key-for-stream-example-32-chars',
      })
      controller.enqueue(new TextEncoder().encode(red))
    },
  })
}

// --- Source stream (file or sample)
const file = process.argv[2]
let inWeb
if (file) {
  const rs = fs.createReadStream(file, { encoding: 'utf8' })
  inWeb = Readable.toWeb(rs)
} else {
  const sample = `顧客: 田中 / 〒150-0001 東京都渋谷区… TEL 090-1234-5678
US: SSN 123-45-6789, Zip 94105, Phone (415) 555-0123
Card: 4242 4242 4242 4242
`
  inWeb = new ReadableStream({
    start(controller) {
      const enc = new TextEncoder()
      // Emit in small chunks to simulate streaming
      for (const chunk of sample.match(/.{1,32}/gs) ?? []) controller.enqueue(enc.encode(chunk))
      controller.close()
    },
  })
}

const outWeb = Writable.toWeb(process.stdout)
await inWeb.pipeThrough(createRedactionTransform()).pipeTo(outWeb)
