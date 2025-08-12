import { Registry, redactText } from '@himorishige/noren-core'

const reg = new Registry({ defaultAction: 'mask' })

const testCases = [
  'Visit http://user@example.com/page',
  'Emailuser@example.com without space',
  'Email: user@example.com',
  'Contact <user@example.com> for help'
]

console.log('Testing email detection patterns:\n')
for (const text of testCases) {
  const result = await redactText(reg, text)
  const detected = result.includes('[REDACTED:email]')
  console.log(`Text: "${text}"`)
  console.log(`Result: "${result}"`)
  console.log(`Detected: ${detected}`)
  console.log('---')
}