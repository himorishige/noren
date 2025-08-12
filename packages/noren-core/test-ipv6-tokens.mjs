import { Registry, redactText } from '@himorishige/noren-core'

const reg = new Registry({
  defaultAction: 'tokenize',
  hmacKey: 'different-ipv6-inputs-key-for-unique-token-generation-testing',
})

const result1 = await redactText(reg, 'Server: 2001:db8::1')
const result2 = await redactText(reg, 'Server: fe80::1')

console.log('Testing IPv6 token generation:')
console.log(`Input 1: "2001:db8::1"`)
console.log(`Result 1: "${result1}"`)
console.log(`Input 2: "fe80::1"`)  
console.log(`Result 2: "${result2}"`)

const token1 = result1.match(/TKN_IPV6_([0-9a-f]{16})/)?.[1]
const token2 = result2.match(/TKN_IPV6_([0-9a-f]{16})/)?.[1]

console.log(`Token 1: ${token1}`)
console.log(`Token 2: ${token2}`)
console.log(`Same token: ${token1 === token2}`)