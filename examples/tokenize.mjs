import { Registry, redactText } from '../packages/noren-core/dist/index.js'
import * as jp from '../packages/noren-plugin-jp/dist/index.js'
import * as us from '../packages/noren-plugin-us/dist/index.js'

const reg = new Registry({
  defaultAction: 'mask',
  rules: {
    email: { action: 'tokenize' },
    phone_e164: { action: 'tokenize' },
    phone_jp: { action: 'tokenize' },
    us_phone: { action: 'tokenize' },
    credit_card: { action: 'mask', preserveLast4: true },
  },
  contextHints: [
    'TEL',
    '電話',
    '〒',
    '住所',
    'Zip',
    'Address',
    'SSN',
    'Social Security',
    'Email',
    'Mail',
  ],
})

reg.use(jp.detectors, jp.maskers, ['〒', '住所', 'TEL', 'Phone'])
reg.use(us.detectors, us.maskers, ['Zip', 'Address', 'SSN', 'Phone'])

const input = `
Email: alice@example.com
JP Phone: 080-9999-8888
US Phone: +1 650 555 0000
`

const out = await redactText(reg, input, { hmacKey: 'development-secret-key-for-tokenize-example-32-chars' })
console.log(out)
