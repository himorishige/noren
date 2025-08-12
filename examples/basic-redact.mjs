import { Registry, redactText } from '../packages/noren-core/dist/index.js'
import * as jp from '../packages/noren-plugin-jp/dist/noren-plugin-jp/src/index.js'
import * as us from '../packages/noren-plugin-us/dist/noren-plugin-us/src/index.js'

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

const input = `
顧客: 田中 / 〒150-0001 東京都渋谷区… TEL 090-1234-5678
US: SSN 123-45-6789, Zip 94105, Phone (415) 555-0123
Card: 4242 4242 4242 4242
`

const out = await redactText(reg, input, { hmacKey: 'development-secret-key-for-basic-example-32-chars-long' })
console.log(out)
