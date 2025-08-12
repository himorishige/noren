import { Registry, redactText } from '@himorishige/noren-core'

const reg = new Registry({ defaultAction: 'mask' })

const text = 'Invalid: 00-11:22-33:44-55'
const result = await redactText(reg, text)

console.log(`Input: "${text}"`)
console.log(`Result: "${result}"`)
console.log(`Detected: ${result.includes('[REDACTED:mac]')}`)