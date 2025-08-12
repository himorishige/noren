import { Registry, redactText } from '@himorishige/noren-core'

const reg = new Registry({ defaultAction: 'mask' })

const testCases = [
  '2001:db8::1',           // Valid IPv6
  '2001db8::1',            // Missing colon separator - invalid
  '::1',                   // Valid loopback
  '2001:db8:85a3::8a2e::370:7334', // Double :: invalid
  'Not IPv6: 2001:db8:85a3::8a2e::370:7334',
  '127.0.0.1',             // IPv4
]

console.log('Testing IPv6 detection:\n')
for (const text of testCases) {
  const result = await redactText(reg, text)
  const detected = result.includes('[REDACTED:ipv6]')
  console.log(`Input: "${text}"`)
  console.log(`Result: "${result}"`)
  console.log(`Detected: ${detected}`)
  console.log('---')
}