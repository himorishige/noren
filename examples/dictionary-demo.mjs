import { Registry, redactText } from '../packages/noren-core/dist/index.js'
import { PolicyDictReloader } from '../packages/noren-dict-reloader/dist/index.js'
import * as jp from '../packages/noren-plugin-jp/dist/index.js'
import * as security from '../packages/noren-plugin-security/dist/index.js'
import * as us from '../packages/noren-plugin-us/dist/index.js'

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
    return new Response(JSON.stringify({
      defaultAction: 'mask',
      rules: {
        employee_id: { action: 'tokenize' },
        product_code: { action: 'mask' },
        project_code: { action: 'remove' },
        credit_card: { action: 'mask', preserveLast4: true }
      },
      contextHints: ['Employee', 'Product', 'Project', 'ID', 'Code', '社員', '製品', 'プロジェクト']
    }), {
      status: 200,
      headers: { etag: 'W/"policy-v1"', 'content-type': 'application/json' }
    })
  }
  
  if (url.startsWith(MANIFEST_URL)) {
    return new Response(JSON.stringify({
      dicts: [
        { id: 'company', url: COMPANY_DICT_URL },
        { id: 'products', url: PRODUCT_DICT_URL }
      ]
    }), {
      status: 200,
      headers: { etag: 'W/"manifest-v1"', 'content-type': 'application/json' }
    })
  }
  
  if (url.startsWith(COMPANY_DICT_URL)) {
    return new Response(JSON.stringify({
      entries: [
        { pattern: 'EMP\\d{5}', type: 'employee_id', risk: 'high' },
        { pattern: 'PROJ-[A-Z]+-\\d{4}', type: 'project_code', risk: 'medium' },
        { pattern: '社員番号[：:]?\\s*[A-Z0-9]{6,}', type: 'employee_id', risk: 'high' }
      ]
    }), {
      status: 200,
      headers: { etag: 'W/"company-v1"', 'content-type': 'application/json' }
    })
  }
  
  if (url.startsWith(PRODUCT_DICT_URL)) {
    return new Response(JSON.stringify({
      entries: [
        { pattern: 'PRD-\\d{4}-[A-Z]{2}', type: 'product_code', risk: 'medium' },
        { pattern: '製品コード[：:]?\\s*[A-Z0-9-]{8,}', type: 'product_code', risk: 'medium' }
      ]
    }), {
      status: 200,
      headers: { etag: 'W/"product-v1"', 'content-type': 'application/json' }
    })
  }
  
  return new Response('Not Found', { status: 404 })
}

// Compile function: converts policy + dictionaries into Registry
function compile(policy, dicts) {
  console.log('  📦 Compiling Registry with policy and', dicts.length, 'dictionaries')
  
  const registry = new Registry(policy)
  
  // Add standard plugins first
  registry.use(jp.detectors, jp.maskers, ['TEL', '電話', '〒', '住所'])
  registry.use(us.detectors, us.maskers, ['ZIP', 'SSN', 'Phone'])
  registry.use(security.detectors, security.maskers, ['Authorization', 'Bearer', 'Cookie'])
  
  // Process each dictionary to create custom detectors/maskers
  for (const dict of dicts) {
    const { entries = [] } = dict
    const customDetectors = []
    const customMaskers = {}
    
    for (const entry of entries) {
      if (entry.pattern) {
        customDetectors.push({
          id: `custom.${entry.type}`,
          priority: -1, // Higher priority than built-in detectors
          match: ({ src, push }) => {
            try {
              const regex = new RegExp(entry.pattern, 'gi')
              for (const m of src.matchAll(regex)) {
                if (m.index !== undefined) {
                  push({
                    type: entry.type,
                    start: m.index,
                    end: m.index + m[0].length,
                    value: m[0],
                    risk: entry.risk || 'medium'
                  })
                }
              }
            } catch (error) {
              console.warn(`  ⚠️  Invalid pattern: ${entry.pattern}`, error.message)
            }
          }
        })
        
        // Create custom masker based on action type
        const policyRule = policy.rules?.[entry.type]
        if (policyRule?.action === 'tokenize') {
          customMaskers[entry.type] = (hit) => `TKN_${entry.type.toUpperCase()}_${hit.value.slice(-4)}`
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
    }
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
Authorization: Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjMifQ.signature
Cookie: session_id=secret123; theme=dark
IP Address: 192.168.1.100
`
  
  console.log('=== Original Data ===')
  console.log(testData)
  
  // Perform redaction with HMAC key for tokenization
  const redacted = await redactText(registry, testData, {
    hmacKey: 'dictionary-demo-secret-key-for-tokenization'
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