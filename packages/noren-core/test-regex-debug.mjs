// Test different regex patterns directly

const patterns = {
  current: /(?<![\w])([A-Z0-9._%+-]{1,64}@[A-Z0-9.-]{1,253}\.[A-Z]{2,63})(?![\w])/gi,
  withSpace: /(?:^|[\s<>"'`])([A-Z0-9._%+-]{1,64}@[A-Z0-9.-]{1,253}\.[A-Z]{2,63})(?=[\s<>"'`]|$)/gi,
  wordBoundary: /\b([A-Z0-9._%+-]{1,64}@[A-Z0-9.-]{1,253}\.[A-Z]{2,63})\b/gi
}

const testCases = [
  'Visit http://user@example.com/page',
  'Emailuser@example.com without space', 
  'Email: user@example.com',
  'Contact <user@example.com> for help'
]

for (const [name, pattern] of Object.entries(patterns)) {
  console.log(`\nTesting pattern: ${name}`)
  console.log(`Pattern: ${pattern}`)
  console.log('---')
  
  for (const text of testCases) {
    const matches = text.match(pattern)
    console.log(`Text: "${text}"`)
    console.log(`Matches: ${matches ? JSON.stringify(matches) : 'none'}`)
  }
}