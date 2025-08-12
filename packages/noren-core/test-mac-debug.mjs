import { Registry, redactText } from '@himorishige/noren-core'

const reg = new Registry({ defaultAction: 'mask' })

const testCases = [
  '00:11:22:33:44:55',     // Valid MAC
  '00:11:22:33:44:55:66',  // 7 octets - invalid
  '00:11:22:33:44',        // 5 octets - invalid
  '00-11-22-33-44-55',     // Valid MAC with dashes
  'GG:11:22:33:44:55',     // Invalid hex
]

console.log('Testing MAC address detection:\n')
for (const mac of testCases) {
  const text = `Invalid: ${mac}`
  const result = await redactText(reg, text)
  const detected = result.includes('[REDACTED:mac]')
  console.log(`Input: "${text}"`)
  console.log(`Result: "${result}"`)
  console.log(`Detected: ${detected}`)
  console.log('---')
}