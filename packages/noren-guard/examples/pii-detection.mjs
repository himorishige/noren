#!/usr/bin/env node

/**
 * PII Detection Example for @himorishige/noren-guard
 * Demonstrates credit card, token, and personal data detection/masking
 */

import {
  createFinancialConfig,
  createPersonalConfig,
  createSecurityConfig,
  financialPatterns,
  PIIGuard,
  PromptGuard,
  personalPatterns,
  securityPatterns,
} from '../dist/index.js'

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
}

function colorize(text, color) {
  return `${colors[color]}${text}${colors.reset}`
}

// Test data with various PII types
const testData = [
  {
    name: 'Credit Card Information',
    content: 'My credit card number is 4532 1234 5678 9012 and expires 12/25',
    expectedDetection: 'credit_card',
  },
  {
    name: 'JWT Token',
    content:
      'Authorization: Bearer eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiYWRtaW4iOnRydWV9.TJVA95OrM7E2cBab30RMHrHDcEfxjoYZgeFONFh7HgQ',
    expectedDetection: 'jwt_token',
  },
  {
    name: 'API Key',
    content: 'Use this API key: sk_live_1234567890abcdef1234567890abcdef',
    expectedDetection: 'api_key',
  },
  {
    name: 'GitHub Token',
    content: 'My GitHub PAT is ghp_1234567890abcdef1234567890abcdef12345678',
    expectedDetection: 'github_token',
  },
  {
    name: 'Email Address',
    content: 'Contact me at john.doe@company.com for more information',
    expectedDetection: 'email',
  },
  {
    name: 'US Phone Number',
    content: 'Call me at (555) 123-4567 or text me',
    expectedDetection: 'us_phone',
  },
  {
    name: 'Social Security Number',
    content: 'My SSN is 123-45-6789 for tax purposes',
    expectedDetection: 'us_ssn',
  },
  {
    name: 'Japanese Phone Number',
    content: '携帯番号は090-1234-5678です',
    expectedDetection: 'jp_phone',
  },
  {
    name: 'Mixed PII Data',
    content: 'Email: admin@example.com, Card: 5555444433332222, API: sk_test_abcd1234efgh5678',
    expectedDetection: 'multiple',
  },
  {
    name: 'Safe Content',
    content: 'This is a normal message without any sensitive information',
    expectedDetection: 'none',
  },
]

async function demonstrateFinancialDetection() {
  console.log(colorize('💳 Financial PII Detection', 'cyan'))
  console.log('=' * 50)
  console.log()

  const financialConfig = createFinancialConfig()
  const guard = new PromptGuard(financialConfig)

  const financialTests = testData.filter(
    (t) => t.expectedDetection === 'credit_card' || t.name === 'Safe Content',
  )

  for (const test of financialTests) {
    console.log(colorize(`Testing: ${test.name}`, 'yellow'))
    console.log(`Content: "${test.content}"`)

    const result = await guard.scan(test.content)
    const status = result.safe ? colorize('✅ SAFE', 'green') : colorize('⚠️  DETECTED', 'red')

    console.log(`${status} | Risk: ${result.risk}/100`)

    if (result.matches.length > 0) {
      console.log('Detected patterns:')
      result.matches.forEach((match) => {
        console.log(`  - ${colorize(match.pattern, 'magenta')} (${match.severity})`)
      })
    }

    if (result.sanitized !== result.input) {
      console.log(colorize('Sanitized:', 'blue'))
      console.log(`"${result.sanitized}"`)
    }

    console.log()
  }
}

async function demonstrateSecurityDetection() {
  console.log(colorize('🔐 Security Token Detection', 'cyan'))
  console.log('=' * 50)
  console.log()

  const securityConfig = createSecurityConfig()
  const guard = new PromptGuard(securityConfig)

  const securityTests = testData.filter((t) =>
    ['jwt_token', 'api_key', 'github_token', 'none'].includes(t.expectedDetection),
  )

  for (const test of securityTests) {
    console.log(colorize(`Testing: ${test.name}`, 'yellow'))
    console.log(`Content: "${test.content.slice(0, 80)}${test.content.length > 80 ? '...' : ''}"`)

    const result = await guard.scan(test.content)
    const status = result.safe ? colorize('✅ SAFE', 'green') : colorize('🚨 CRITICAL', 'red')

    console.log(`${status} | Risk: ${result.risk}/100`)

    if (result.matches.length > 0) {
      console.log('Detected tokens:')
      result.matches.forEach((match) => {
        console.log(`  - ${colorize(match.pattern, 'red')} (${match.severity})`)
      })
    }

    if (result.sanitized !== result.input) {
      console.log(colorize('Sanitized:', 'blue'))
      console.log(
        `"${result.sanitized.slice(0, 100)}${result.sanitized.length > 100 ? '...' : ''}"`,
      )
    }

    console.log()
  }
}

async function demonstratePersonalDataDetection() {
  console.log(colorize('👤 Personal Data Detection', 'cyan'))
  console.log('=' * 50)
  console.log()

  const personalConfig = createPersonalConfig()
  const guard = new PromptGuard(personalConfig)

  const personalTests = testData.filter((t) =>
    ['email', 'us_phone', 'us_ssn', 'jp_phone', 'none'].includes(t.expectedDetection),
  )

  for (const test of personalTests) {
    console.log(colorize(`Testing: ${test.name}`, 'yellow'))
    console.log(`Content: "${test.content}"`)

    const result = await guard.scan(test.content)
    const status = result.safe ? colorize('✅ SAFE', 'green') : colorize('⚠️  DETECTED', 'red')

    console.log(`${status} | Risk: ${result.risk}/100`)

    if (result.matches.length > 0) {
      console.log('Detected PII:')
      result.matches.forEach((match) => {
        console.log(`  - ${colorize(match.pattern, 'magenta')} (${match.severity})`)
      })
    }

    if (result.sanitized !== result.input) {
      console.log(colorize('Sanitized:', 'blue'))
      console.log(`"${result.sanitized}"`)
    }

    console.log()
  }
}

async function demonstrateComprehensiveDetection() {
  console.log(colorize('🛡️  Comprehensive PII Detection', 'cyan'))
  console.log('=' * 50)
  console.log()

  // Combine all patterns for comprehensive detection
  const comprehensiveConfig = {
    customPatterns: [...financialPatterns, ...securityPatterns, ...personalPatterns],
    riskThreshold: 50,
    enableSanitization: true,
  }
  const guard = new PromptGuard(comprehensiveConfig)

  const mixedTest = testData.find((t) => t.expectedDetection === 'multiple')

  console.log(colorize(`Testing: ${mixedTest.name}`, 'yellow'))
  console.log(`Content: "${mixedTest.content}"`)

  const result = await guard.scan(mixedTest.content)
  const status = result.safe
    ? colorize('✅ SAFE', 'green')
    : colorize('🚨 MULTIPLE PII DETECTED', 'red')

  console.log(`${status} | Risk: ${result.risk}/100`)

  console.log('All detected PII:')
  result.matches.forEach((match) => {
    console.log(`  - ${colorize(match.pattern, 'red')} (${match.category}, ${match.severity})`)
  })

  console.log(colorize('Fully sanitized output:', 'blue'))
  console.log(`"${result.sanitized}"`)
  console.log()
}

async function demonstratePresetComparison() {
  console.log(colorize('⚖️  Preset Comparison', 'cyan'))
  console.log('=' * 50)
  console.log()

  const testContent =
    'Contact: admin@company.com, API: sk_live_1234567890abcdef, Card: 4111111111111111'

  const presets = [
    { name: 'Business Standard', config: await PIIGuard.business() },
    { name: 'Compliance Strict', config: await PIIGuard.compliance() },
    { name: 'Comprehensive', config: await PIIGuard.comprehensive() },
  ]

  console.log(`Test content: "${testContent}"`)
  console.log()

  for (const preset of presets) {
    const guard = new PromptGuard(preset.config)
    const result = await guard.scan(testContent)

    console.log(colorize(`${preset.name}:`, 'yellow'))
    console.log(`  Risk: ${result.risk}/100 | Safe: ${result.safe ? 'Yes' : 'No'}`)
    console.log(`  Matches: ${result.matches.length}`)
    console.log(`  Sanitized: "${result.sanitized}"`)
    console.log()
  }
}

async function demonstrateAvailableOptions() {
  console.log(colorize('📋 Available Options', 'cyan'))
  console.log('=' * 50)
  console.log()

  console.log(colorize('Available Dictionaries:', 'yellow'))
  const dictionaries = ['financial', 'security', 'personal']
  dictionaries.forEach((dict) => {
    console.log(`  - ${dict}`)
  })
  console.log()

  console.log(colorize('Available Presets:', 'yellow'))
  const presets = await PIIGuard.listPresets()
  for (const preset of presets) {
    console.log(`  - ${preset}`)
  }
  console.log()
}

// Run the demonstration
async function main() {
  try {
    console.log(colorize('🛡️  Noren Guard - PII Detection Demo', 'cyan'))
    console.log(colorize('Demonstrating credit card, token, and personal data protection', 'blue'))
    console.log('=' * 70)
    console.log()

    await demonstrateAvailableOptions()
    await demonstrateFinancialDetection()
    await demonstrateSecurityDetection()
    await demonstratePersonalDataDetection()
    await demonstrateComprehensiveDetection()
    await demonstratePresetComparison()

    console.log(colorize('🎉 PII Detection Demo completed!', 'green'))
    console.log(colorize('For more examples, check out:', 'cyan'))
    console.log('  - basic-usage.mjs (General prompt injection)')
    console.log('  - custom-patterns.mjs (Custom rule creation)')
    console.log('  - streaming.mjs (Stream processing)')
  } catch (error) {
    console.error(colorize('Error:', 'red'), error.message)
    process.exit(1)
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main()
}
