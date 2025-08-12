// Test more specific patterns

const patterns = {
  // Current pattern (still allows Emailuser@)
  current: /(?<![A-Z0-9._%+-/])([A-Z0-9._%+-]{1,64}@[A-Z0-9.-]{1,253}\.[A-Z]{2,63})(?![\w])/gi,
  
  // Only allow after whitespace, start, or specific chars
  strict: /(?:^|[\s<>"'`(])([A-Z0-9._%+-]{1,64}@[A-Z0-9.-]{1,253}\.[A-Z]{2,63})(?=[\s<>"'`),;]|$)/gi,
  
  // Allow common punctuation before email
  punctuation: /(?:^|[\s<>"'`(:])([A-Z0-9._%+-]{1,64}@[A-Z0-9.-]{1,253}\.[A-Z]{2,63})(?=[\s<>"'`),;]|$)/gi
}

const testCases = [
  'Visit http://user@example.com/page',
  'Emailuser@example.com without space',
  'user@example.com',  // Start of string
  'Email: user@example.com',
  'Contact <user@example.com> for help',
  '(user@example.com)', // In parentheses
  '"user@example.com"', // In quotes
  'Send to:user@example.com please' // After colon
]

for (const [name, pattern] of Object.entries(patterns)) {
  console.log(`\nPattern: ${name}`)
  console.log('---')
  
  for (const text of testCases) {
    const matches = text.match(pattern)
    const detected = matches !== null
    console.log(`"${text}" -> ${detected ? 'DETECTED' : 'not detected'}${matches ? ': ' + JSON.stringify(matches) : ''}`)
  }
}