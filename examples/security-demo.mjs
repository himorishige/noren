import { Registry, redactText } from '../packages/noren-core/dist/index.js'
import * as jp from '../packages/noren-plugin-jp/dist/noren-plugin-jp/src/index.js'
import * as security from '../packages/noren-plugin-security/dist/noren-plugin-security/src/index.js'
import * as us from '../packages/noren-plugin-us/dist/noren-plugin-us/src/index.js'

// Create registry with security context hints
const registry = new Registry({
  defaultAction: 'mask',
  rules: {
    sec_jwt_token: { action: 'mask' },
    sec_api_key: { action: 'mask' },
    credit_card: { action: 'mask', preserveLast4: true },
    jp_my_number: { action: 'remove' },
  },
  contextHints: [
    // Core security contexts
    'Authorization',
    'Bearer',
    'Cookie',
    'X-API-Key',
    'token',
    'api_key',
    // Japanese contexts
    'TEL',
    '電話',
    '〒',
    '住所',
    'マイナンバー',
    // US contexts
    'SSN',
    'ZIP',
    'Phone',
  ],
})

// Register all plugins
registry.use(jp.detectors, jp.maskers, ['〒', '住所', 'TEL', '電話'])
registry.use(us.detectors, us.maskers, ['ZIP', 'SSN', 'Phone'])
registry.use(security.detectors, security.maskers, [
  'Authorization',
  'Bearer',
  'Cookie',
  'X-API-Key',
  'token',
  'api_key',
])

// Test input with various PII types
const testInput = `
HTTP Request Log:
POST /api/v1/users HTTP/1.1
Host: api.example.com
Authorization: Bearer eyJmYWtlIjoiaGVhZGVyIn0.eyJmYWtlIjoicGF5bG9hZCJ9.fake_signature_demo
Cookie: session_id=abc123def456789; theme=dark; user_pref=large_text
X-API-Key: sk_live_1234567890abcdef

Request Body:
{
  "name": "田中太郎",
  "email": "tanaka@example.com",
  "phone": "090-1234-5678", 
  "address": "〒150-0001 東京都渋谷区",
  "ssn": "123-45-6789",
  "zip": "94105",
  "card": "4242 4242 4242 4242"
}

URL Parameters:
?access_token=secret_token_123&client_id=app_12345&client_secret=confidential_secret_456

Session Info:
session=1a2b3c4d5e6f7890abcdef123456789
uuid_token=550e8400-e29b-41d4-a716-446655440000
`

console.log('=== Original Input ===')
console.log(testInput)

const redacted = await redactText(registry, testInput, {
  hmacKey: 'development-security-demo-key-for-testing',
})

console.log('\n=== Security Redacted Output ===')
console.log(redacted)

// Test with custom security config for cookies
const { createSecurityMaskers } = security
const securityConfig = {
  cookieAllowlist: ['theme', 'user_pref', 'consent_*'],
  strictMode: true,
}

const customRegistry = new Registry({
  defaultAction: 'mask',
  contextHints: ['Cookie', 'Authorization', 'Bearer'],
})

customRegistry.use(security.detectors, createSecurityMaskers(securityConfig), [
  'Cookie',
  'Authorization',
  'Bearer',
])

const cookieTest = `
Cookie: session_id=secret123; theme=dark; user_pref=large_text; consent_analytics=true; tracking_id=xyz789
`

const maskedCookies = await redactText(customRegistry, cookieTest, {
  hmacKey: 'cookie-demo-key-for-testing',
})

console.log('\n=== Cookie Allowlist Demo ===')
console.log('Input:', cookieTest.trim())
console.log('Output:', maskedCookies.trim())
