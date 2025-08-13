import fs from 'node:fs'
import { Readable, Writable } from 'node:stream'
import { Registry, createRedactionTransform } from '../packages/noren-core/dist/index.js'
import * as jp from '../packages/noren-plugin-jp/dist/noren-plugin-jp/src/index.js'
import * as us from '../packages/noren-plugin-us/dist/noren-plugin-us/src/index.js'

// --- create registry
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

// --- Binary-safe redaction transform (now using utility from core)
function createBinarySafeRedactionTransform(window = 96) {
  return createRedactionTransform(reg, {
    window,
    policy: {
      hmacKey: 'development-secret-key-for-stream-example-32-chars',
    }
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

// Process stream - wrapped in async function to avoid top-level await warning
async function processStream() {
  await inWeb.pipeThrough(createBinarySafeRedactionTransform()).pipeTo(outWeb)
}

processStream().catch(console.error)
