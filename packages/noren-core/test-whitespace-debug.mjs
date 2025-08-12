import { Registry, redactText } from '@himorishige/noren-core'

const reg = new Registry({ defaultAction: 'mask' })

const testCases = [
  { input: '', display: '(empty string)' },
  { input: ' ', display: '(single space)' },
  { input: '\t\n\r', display: '(tab-newline-return)' },
  { input: '   \n\n   ', display: '(spaces and newlines)' },
  { input: '\u3000', display: '(ideographic space)' }
]

console.log('Testing whitespace handling:\n')
for (const { input, display } of testCases) {
  const result = await redactText(reg, input)
  const unchanged = result === input
  console.log(`Input: ${display}`)
  console.log(`Input length: ${input.length}`)
  console.log(`Result length: ${result.length}`)
  console.log(`Unchanged: ${unchanged}`)
  if (!unchanged) {
    console.log(`Input bytes: ${JSON.stringify(input)}`)
    console.log(`Result bytes: ${JSON.stringify(result)}`)
  }
  console.log('---')
}