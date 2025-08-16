#!/usr/bin/env node

/**
 * Custom Dictionary Example for @himorishige/noren-guard
 * Demonstrates custom pattern creation and dictionary extension
 */

import {
  DictionaryLoader,
  // Individual patterns for tree-shaking
  financialPatterns,
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

async function demonstrateCustomDictionary() {
  console.log(colorize('🏢 Custom Company Dictionary', 'cyan'))
  console.log('=' * 50)
  console.log()

  // Create a custom dictionary for a fictitious company
  DictionaryLoader.createCustomDictionary('acme_corp', {
    description: 'ACME Corporation custom PII patterns',
    patterns: [
      {
        id: 'employee_id',
        description: 'ACME employee IDs (EMP-XXXXX format)',
        pattern: '\\bEMP-\\d{5}\\b',
        severity: 'medium',
        weight: 70,
        category: 'company',
        sanitize: true,
        contexts: ['employee', 'id', 'acme'],
      },
      {
        id: 'project_code',
        description: 'ACME project codes (PROJ-XXX format)',
        pattern: '\\bPROJ-[A-Z]{3}\\b',
        severity: 'medium',
        weight: 65,
        category: 'company',
        sanitize: true,
        contexts: ['project', 'code', 'acme'],
      },
      {
        id: 'customer_number',
        description: 'ACME customer numbers (CUST-XXXXXXXX format)',
        pattern: '\\bCUST-\\d{8}\\b',
        severity: 'high',
        weight: 80,
        category: 'company',
        sanitize: true,
        contexts: ['customer', 'number', 'acme'],
      },
    ],
    sanitizeRules: [
      {
        pattern: '\\bEMP-\\d{5}\\b',
        action: 'replace',
        replacement: '[EMPLOYEE_ID]',
        category: 'company',
        priority: 3,
      },
      {
        pattern: '\\bCUST-\\d{8}\\b',
        action: 'replace',
        replacement: '[CUSTOMER_NUMBER]',
        category: 'company',
        priority: 4,
      },
    ],
  })

  // Test the custom dictionary
  const customConfig = DictionaryLoader.createConfigFromCustomDictionary('acme_corp')
  const guard = new PromptGuard(customConfig)

  const testCases = [
    'Employee EMP-12345 is working on PROJ-ABC for customer CUST-87654321',
    'Contact john.doe@acme.com regarding EMP-67890',
    'This is a normal message without company data',
  ]

  for (const testCase of testCases) {
    console.log(colorize(`Testing: "${testCase}"`, 'yellow'))
    const result = await guard.scan(testCase)
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

async function demonstrateExtendedDictionary() {
  console.log(colorize('🔧 Extended Dictionary', 'cyan'))
  console.log('=' * 50)
  console.log()

  // Create an extended financial dictionary with crypto patterns
  DictionaryLoader.createCustomDictionary('financial_crypto', {
    description: 'Financial patterns including cryptocurrency',
    patterns: [
      // Include base financial patterns
      ...financialPatterns.map((p) => ({
        id: p.id,
        description: p.description,
        pattern: p.pattern.source,
        severity: p.severity,
        weight: p.weight,
        category: p.category,
        sanitize: p.sanitize,
      })),
      // Add crypto patterns
      {
        id: 'crypto_wallet',
        description: 'Bitcoin wallet addresses',
        pattern: '\\b[13][a-km-zA-HJ-NP-Z1-9]{25,34}\\b',
        severity: 'high',
        weight: 85,
        category: 'financial',
        sanitize: true,
        contexts: ['bitcoin', 'wallet', 'crypto'],
      },
      {
        id: 'ethereum_address',
        description: 'Ethereum addresses',
        pattern: '\\b0x[a-fA-F0-9]{40}\\b',
        severity: 'high',
        weight: 85,
        category: 'financial',
        sanitize: true,
        contexts: ['ethereum', 'address', 'crypto'],
      },
    ],
    sanitizeRules: [
      {
        pattern: '\\b[13][a-km-zA-HJ-NP-Z1-9]{25,34}\\b',
        action: 'replace',
        replacement: '[BITCOIN_WALLET]',
        category: 'financial',
        priority: 4,
      },
      {
        pattern: '\\b0x[a-fA-F0-9]{40}\\b',
        action: 'replace',
        replacement: '[ETH_ADDRESS]',
        category: 'financial',
        priority: 4,
      },
    ],
  })

  // Test the extended dictionary
  const extendedConfig = DictionaryLoader.createConfigFromCustomDictionary('financial_crypto')
  const guard = new PromptGuard(extendedConfig)

  const testCases = [
    'My Bitcoin wallet: 1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa',
    'Ethereum address: 0x742d35Cc6634C0532925a3b8D0E3BAF85a4a39a6',
    'Credit card: 4532-1234-5678-9012 and crypto wallet',
  ]

  for (const testCase of testCases) {
    console.log(colorize(`Testing: "${testCase}"`, 'yellow'))
    const result = await guard.scan(testCase)
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

async function demonstrateIndividualPatterns() {
  console.log(colorize('🌳 Tree-shaking Friendly Patterns', 'cyan'))
  console.log('=' * 50)
  console.log()

  console.log(colorize('Using individual pattern imports for optimal bundle size:', 'blue'))
  console.log()

  // Use only specific patterns (tree-shaking friendly)
  const lightweightConfig = {
    customPatterns: [
      ...securityPatterns.filter((p) => p.id === 'jwt_token' || p.id === 'api_key'),
      ...financialPatterns.filter((p) => p.id === 'credit_card'),
    ],
    riskThreshold: 60,
    enableSanitization: true,
  }

  const guard = new PromptGuard(lightweightConfig)

  console.log(colorize('Loaded patterns:', 'yellow'))
  lightweightConfig.customPatterns.forEach((pattern) => {
    console.log(`  - ${pattern.id} (${pattern.category})`)
  })
  console.log()

  const testCase = 'API key: sk_live_123abc, Card: 4111111111111111, JWT: eyJ0eXAiOiJKV1Q...'
  console.log(colorize(`Testing: "${testCase}"`, 'yellow'))

  const result = await guard.scan(testCase)
  const status = result.safe ? colorize('✅ SAFE', 'green') : colorize('⚠️  DETECTED', 'red')

  console.log(`${status} | Risk: ${result.risk}/100`)
  console.log(`Matches: ${result.matches.map((m) => m.pattern).join(', ')}`)
  console.log()
}

async function demonstrateAvailableDictionaries() {
  console.log(colorize('📚 Available Dictionaries', 'cyan'))
  console.log('=' * 50)
  console.log()

  console.log(colorize('Custom Dictionaries:', 'yellow'))
  const customDictionaries = DictionaryLoader.getCustomDictionaries()
  if (customDictionaries.length > 0) {
    customDictionaries.forEach((dict) => {
      console.log(`  📝 [Custom] ${dict}`)
    })
  } else {
    console.log('  No custom dictionaries created yet')
  }
  console.log()

  console.log(colorize('Individual Pattern Categories:', 'yellow'))
  console.log(`  📦 Financial patterns: ${financialPatterns.length}`)
  console.log(`  📦 Security patterns: ${securityPatterns.length}`)
  console.log(`  📦 Personal patterns: ${personalPatterns.length}`)
  console.log()

  console.log(colorize('Dictionary Capabilities:', 'yellow'))
  console.log(`  Custom dictionaries: ${customDictionaries.length}`)
  console.log(
    `  Tree-shakable patterns: ${financialPatterns.length + securityPatterns.length + personalPatterns.length}`,
  )
  console.log()
}

// Run the demonstration
async function main() {
  try {
    console.log(colorize('🛡️  Noren Guard - Custom Dictionary Demo', 'cyan'))
    console.log(colorize('Demonstrating custom patterns and dictionary extension', 'blue'))
    console.log('=' * 70)
    console.log()

    await demonstrateAvailableDictionaries()
    await demonstrateCustomDictionary()
    await demonstrateExtendedDictionary()
    await demonstrateIndividualPatterns()

    console.log(colorize('🎉 Custom Dictionary Demo completed!', 'green'))
    console.log(colorize('Key benefits:', 'cyan'))
    console.log('  ✅ Custom company patterns')
    console.log('  ✅ Dictionary extension capability')
    console.log('  ✅ Tree-shaking friendly imports')
    console.log('  ✅ Flexible pattern management')
  } catch (error) {
    console.error(colorize('Error:', 'red'), error.message)
    process.exit(1)
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main()
}
