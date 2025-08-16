import { Registry, redactText } from '../packages/noren-core/dist/index.js'
import { PolicyDictReloader } from '../packages/noren-dict-reloader/dist/index.js'
import * as jp from '../packages/noren-plugin-jp/dist/noren-plugin-jp/src/index.js'
import * as security from '../packages/noren-plugin-security/dist/noren-plugin-security/src/index.js'
import * as us from '../packages/noren-plugin-us/dist/noren-plugin-us/src/index.js'

// Mock server URLs for demonstration
const POLICY_URL = 'https://example.local/policy.json'
const MANIFEST_URL = 'https://example.local/manifest.json'
const COMPANY_DICT_URL = 'https://example.local/company-dict.json'
const PRODUCT_DICT_URL = 'https://example.local/product-dict.json'

// Set up mock fetch to serve dictionary files
const originalFetch = globalThis.fetch
globalThis.fetch = async (url, init) => {
  console.log(`[FETCH] ${url}`)

  if (url.startsWith(POLICY_URL)) {
    return new Response(
      JSON.stringify({
        defaultAction: 'mask',
        rules: {
          employee_id: { action: 'tokenize' },
          product_code: { action: 'mask' },
          project_code: { action: 'remove' },
          credit_card: { action: 'mask', preserveLast4: true },
        },
        contextHints: [
          'Employee',
          'Product',
          'Project',
          'ID',
          'Code',
          '社員',
          '製品',
          'プロジェクト',
        ],
      }),
      {
        status: 200,
        headers: { etag: 'W/"policy-v1"', 'content-type': 'application/json' },
      },
    )
  }

  if (url.startsWith(MANIFEST_URL)) {
    return new Response(
      JSON.stringify({
        dicts: [
          { id: 'company', url: COMPANY_DICT_URL },
          { id: 'products', url: PRODUCT_DICT_URL },
        ],
      }),
      {
        status: 200,
        headers: { etag: 'W/"manifest-v1"', 'content-type': 'application/json' },
      },
    )
  }

  if (url.startsWith(COMPANY_DICT_URL)) {
    return new Response(
      JSON.stringify({
        entries: [
          { pattern: 'EMP\\d{5}', type: 'employee_id', risk: 'high' },
          { pattern: 'PROJ-[A-Z]+-\\d{4}', type: 'project_code', risk: 'medium' },
          { pattern: '社員番号[：:]?\\s*[A-Z0-9]{6,}', type: 'employee_id', risk: 'high' },
        ],
      }),
      {
        status: 200,
        headers: { etag: 'W/"company-v1"', 'content-type': 'application/json' },
      },
    )
  }

  if (url.startsWith(PRODUCT_DICT_URL)) {
    return new Response(
      JSON.stringify({
        entries: [
          { pattern: 'PRD-\\d{4}-[A-Z]{2}', type: 'product_code', risk: 'medium' },
          { pattern: '製品コード[：:]?\\s*[A-Z0-9-]{8,}', type: 'product_code', risk: 'medium' },
        ],
      }),
      {
        status: 200,
        headers: { etag: 'W/"product-v1"', 'content-type': 'application/json' },
      },
    )
  }

  return new Response('Not Found', { status: 404 })
}

// Compile function: converts policy + dictionaries into Registry
function compile(policy, dicts, options = {}) {
  console.log('  📦 Compiling Registry with policy and', dicts.length, 'dictionaries')

  // Enhanced Registry options with new v0.3.0+ features
  const registryOptions = {
    ...policy,
    environment: options.environment ?? 'production',
    enableConfidenceScoring: options.enableConfidenceScoring ?? true,
    enableContextualConfidence: options.enableContextualConfidence ?? false,
    contextualSuppressionEnabled: options.contextualSuppressionEnabled ?? true,
    contextualBoostEnabled: options.contextualBoostEnabled ?? false,
    allowDenyConfig: options.allowDenyConfig,
  }

  const registry = new Registry(registryOptions)

  // Add standard plugins first
  registry.use(jp.detectors, jp.maskers, ['TEL', '電話', '〒', '住所'])
  registry.use(us.detectors, us.maskers, ['ZIP', 'SSN', 'Phone'])
  registry.use(security.detectors, security.maskers, ['Authorization', 'Bearer', 'Cookie'])

  // Process each dictionary to create custom detectors/maskers
  for (const dict of dicts) {
    const { entries = [] } = dict
    const customDetectors = []
    const customMaskers = {}

    // Pre-compile patterns for better performance
    const compiledPatterns = new Map()

    for (const entry of entries) {
      if (entry.pattern) {
        try {
          // Pre-compile and cache the regex pattern
          const regex = new RegExp(entry.pattern, 'gi')
          compiledPatterns.set(entry.type, { regex, entry })
        } catch (error) {
          console.warn(`  ⚠️  Invalid pattern: ${entry.pattern}`, error.message)
          continue
        }

        customDetectors.push({
          id: `custom.${entry.type}`,
          // Support configurable priority from dictionary entry
          priority: entry.priority ?? -1, // Default higher priority than built-in detectors
          match: ({ src, push, canPush }) => {
            const compiled = compiledPatterns.get(entry.type)
            if (!compiled || !canPush?.()) return

            const { regex, entry: dictEntry } = compiled

            // Reset regex state for each match operation
            regex.lastIndex = 0

            for (const m of src.matchAll(regex)) {
              if (m.index !== undefined) {
                const hit = {
                  type: dictEntry.type,
                  start: m.index,
                  end: m.index + m[0].length,
                  value: m[0],
                  risk: dictEntry.risk || 'medium',
                  // Add metadata for confidence scoring
                  features: {
                    pattern: dictEntry.pattern,
                    source: 'custom_dictionary',
                    dictionary_priority: dictEntry.priority,
                  },
                }

                // Basic confidence scoring for dictionary matches
                if (options.enableConfidenceScoring !== false) {
                  hit.confidence = calculateDictionaryConfidence(hit, m[0], dictEntry)
                  hit.reasons = [`Dictionary pattern match: ${dictEntry.pattern}`]
                }

                push(hit)

                // Respect match limits for performance
                if (!canPush?.()) break
              }
            }
          },
        })

        // Create custom masker based on action type
        const policyRule = policy.rules?.[entry.type]
        if (policyRule?.action === 'tokenize') {
          customMaskers[entry.type] = (hit) =>
            `TKN_${entry.type.toUpperCase()}_${hit.value.slice(-4)}`
        } else if (policyRule?.action === 'remove') {
          customMaskers[entry.type] = () => ''
        } else {
          customMaskers[entry.type] = () => `[REDACTED:${entry.type.toUpperCase()}]`
        }
      }
    }

    if (customDetectors.length > 0) {
      registry.use(customDetectors, customMaskers)
      console.log(`  ✅ Added ${customDetectors.length} custom detector(s)`)
    }
  }

  return registry
}

// Helper function for basic dictionary confidence scoring
function calculateDictionaryConfidence(hit, matchedText, dictEntry) {
  let confidence = 0.8 // Base confidence for dictionary matches

  // Adjust based on pattern complexity
  if (dictEntry.pattern.length > 20) confidence += 0.1
  if (dictEntry.pattern.includes('\\d{') || dictEntry.pattern.includes('\\w{')) confidence += 0.05

  // Adjust based on match length
  if (matchedText.length >= 8) confidence += 0.05

  // Risk level adjustments
  if (dictEntry.risk === 'high') confidence += 0.1
  else if (dictEntry.risk === 'low') confidence -= 0.1

  return Math.min(1.0, Math.max(0.0, confidence))
}

async function main() {
  console.log('=== Dictionary-Based PII Redaction Demo ===\n')

  // Set up dictionary reloader with error handling
  const reloader = new PolicyDictReloader({
    policyUrl: POLICY_URL,
    dictManifestUrl: MANIFEST_URL,
    compile,
    onSwap: (newRegistry, changed) => {
      console.log('🔄 Dictionary updated:', changed.join(', '))
    },
    onError: (error) => {
      console.error('❌ Reload failed:', error.message)
    },
  })

  console.log('📋 Loading dictionaries and policy...')
  await reloader.start()
  const registry = reloader.getCompiled()
  console.log('✅ Registry compiled successfully\n')

  // Test data with various PII types including custom ones
  const testData = `
=== Employee Records ===
Employee: John Doe (john.doe@company.com)
Employee ID: EMP12345
社員番号: ABC123XYZ
Phone: 090-1234-5678
Credit Card: 4242 4242 4242 4242

=== Project Information ===
Project: PROJ-ALPHA-2024
Product Code: PRD-2024-XY
製品コード: TECH-PROD-001

=== HTTP Request Log ===
POST /api/data HTTP/1.1
Authorization: Bearer eyJmYWtlIjoiaGVhZGVyIn0.eyJmYWtlIjoicGF5bG9hZCJ9.fake_signature
Cookie: session_id=secret123; theme=dark
IP Address: 192.168.1.100
`

  console.log('=== Original Data ===')
  console.log(testData)

  // Perform redaction with HMAC key for tokenization
  const redacted = await redactText(registry, testData, {
    hmacKey: 'dictionary-demo-secret-key-for-tokenization',
  })

  console.log('\n=== Redacted Data ===')
  console.log(redacted)

  // Test force reload (simulates dictionary update)
  console.log('\n📋 Testing force reload...')
  await reloader.forceReload()

  // Cleanup
  reloader.stop()
  globalThis.fetch = originalFetch

  console.log('\n✨ Demo completed successfully!')
}

// Run demo with error handling
main().catch((error) => {
  console.error('💥 Demo failed:', error)
  process.exit(1)
})
