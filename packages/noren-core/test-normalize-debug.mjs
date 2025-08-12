import { normalize } from '@himorishige/noren-core'

const testCases = [
  { input: '\t\n\r', display: '(tab-newline-return)' },
  { input: '   \n\n   ', display: '(spaces and newlines)' },
  { input: '\u3000', display: '(ideographic space)' },
  { input: '\t', display: '(single tab)' },
  { input: '  ', display: '(two spaces)' }
]

console.log('Testing normalize function:\n')
for (const { input, display } of testCases) {
  const result = normalize(input)
  console.log(`Input: ${display}`)
  console.log(`Input bytes: ${JSON.stringify(input)}`)
  console.log(`Result bytes: ${JSON.stringify(result)}`)
  console.log(`Changed: ${input !== result}`)
  console.log('---')
}