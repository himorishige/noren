import { Registry, redactText } from '@himorishige/noren-core'

const reg = new Registry({ defaultAction: 'mask' })

const text = 'Invalid: 2001::db8:::1'
const result = await redactText(reg, text)

console.log(`Input: "${text}"`)
console.log(`Result: "${result}"`)
console.log(`Detected: ${result.includes('[REDACTED:ipv6]')}`)