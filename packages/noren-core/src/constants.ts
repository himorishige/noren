/**
 * Constants for validation and false positive prevention
 * Contains test data, example patterns, and exclusion lists
 */

// Test credit card numbers that should be excluded from detection
export const TEST_CREDIT_CARDS = new Set([
  // Visa test numbers
  '4111111111111111',
  '4012888888881881',
  '4222222222222',
  '4242424242424242',
  '4000000000000002',
  '4000000000000010',
  '4000000000000028',
  '4000000000000036',
  '4000000000000044',
  '4000000000000069',
  '4000000000000101',
  '4000000000000119',
  '4000000000000127',
  '4000000000000135',

  // Mastercard test numbers
  '5555555555554444',
  '5105105105105100',
  '5200828282828210',
  '5204230080000017',
  '5204740009999999',
  '5420923878724339',
  '5555555555554444',

  // American Express test numbers
  '378282246310005',
  '371449635398431',
  '378734493671000',
  '347000000000000',

  // Discover test numbers
  '6011111111111117',
  '6011000990139424',
  '6011981111111113',

  // JCB test numbers
  '3530111333300000',
  '3566002020360505',

  // Diners Club test numbers
  '30569309025904',
  '38520000023237',

  // Maestro test numbers
  '6759649826438453',
  '6799990100000000019',
])

// Normalize test credit cards (remove spaces and dashes)
export const NORMALIZED_TEST_CREDIT_CARDS = new Set(
  Array.from(TEST_CREDIT_CARDS).flatMap((card) => [
    card,
    card.replace(/[\s-]/g, ''), // No spaces/dashes
    card
      .replace(/(.{4})/g, '$1 ')
      .trim(), // Space every 4 digits
    card
      .replace(/(.{4})/g, '$1-')
      .slice(0, -1), // Dash every 4 digits
  ]),
)

// Credit card brand validation patterns
export const CREDIT_CARD_BRANDS = {
  visa: {
    pattern: /^4/,
    lengths: [13, 16, 19] as readonly number[],
  },
  mastercard: {
    pattern: /^(5[1-5]|2[2-7])/,
    lengths: [16] as readonly number[],
  },
  amex: {
    pattern: /^3[47]/,
    lengths: [15] as readonly number[],
  },
  discover: {
    pattern: /^(6011|65|64[4-9])/,
    lengths: [16, 19] as readonly number[],
  },
  jcb: {
    pattern: /^35(2[89]|[3-8][0-9])/,
    lengths: [16, 17, 18, 19] as readonly number[],
  },
  dinersclub: {
    pattern: /^3[0689]/,
    lengths: [14] as readonly number[],
  },
  maestro: {
    pattern: /^(5018|5020|5038|6304|6759|676[1-3])/,
    lengths: [12, 13, 14, 15, 16, 17, 18, 19] as readonly number[],
  },
}

// Example/test domains that should be excluded or downgraded
export const EXAMPLE_DOMAINS = new Set([
  // RFC 2606 reserved domains
  'example.com',
  'example.net',
  'example.org',
  'example.edu',

  // RFC 6761 special use domains
  'localhost',
  'localhost.localdomain',
  'invalid',
  'test',
  'local',

  // Common test domains
  'test.com',
  'test.net',
  'test.org',
  'testing.com',
  'demo.com',
  'sample.com',
  'fake.com',
  'dummy.com',
  'placeholder.com',

  // Temporary/disposable email domains
  '10minutemail.com',
  'guerrillamail.com',
  'mailinator.com',
  'tempmail.org',
])

// Email prefixes that are typically not PII
export const NON_PII_EMAIL_PREFIXES = new Set([
  'noreply',
  'no-reply',
  'donotreply',
  'do-not-reply',
  'admin',
  'administrator',
  'postmaster',
  'webmaster',
  'hostmaster',
  'info',
  'support',
  'help',
  'sales',
  'marketing',
  'contact',
  'abuse',
  'security',
  'privacy',
  'legal',
  'compliance',
  'billing',
  'accounts',
  'notifications',
  'alerts',
  'system',
  'daemon',
  'service',
  'robot',
  'bot',
  'automated',
])

// Context keywords for different PII types (positive indicators)
export const CONTEXT_KEYWORDS = {
  email: new Set([
    'email',
    'e-mail',
    'mail',
    'mailto',
    'from',
    'to',
    'cc',
    'bcc',
    'sender',
    'recipient',
    'address',
    'contact',
    'reach',
    'write',
    'send',
    // Japanese terms
    'メール',
    'メールアドレス',
    'eメール',
    '電子メール',
    '電子郵便',
    '送信者',
    '受信者',
    '宛先',
    'アドレス',
    '連絡先',
    '問い合わせ先',
    '送信',
    '受信',
    '返信',
    '転送',
    '配信',
    'お知らせ',
    '通知',
    '件名',
    '本文',
    '添付',
    'ファイル添付',
  ]),

  credit_card: new Set([
    'card',
    'credit',
    'debit',
    'visa',
    'mastercard',
    'amex',
    'discover',
    'jcb',
    'maestro',
    'cc',
    'payment',
    'billing',
    'charge',
    'transaction',
    'exp',
    'cvv',
    'cvc',
    'security',
    'code',
    'expiry',
    'expiration',
    // Japanese terms
    'カード',
    'クレカ',
    'クレジットカード',
    'デビットカード',
    'デビカ',
    'クレジット',
    '信用カード',
    '決済',
    '支払',
    '支払い',
    '料金',
    '有効期限',
    '期限',
    'セキュリティコード',
    'セキュリティ番号',
    'カード番号',
    'カード情報',
    '取引',
    '会計',
    '清算',
    '精算',
    'ビザ',
    'マスター',
    'アメックス',
    'JCB',
    'ジェーシービー',
    'ショッピング',
    '購入',
    '買い物',
    'お支払い',
    'ご請求',
  ]),
} as const

// Negative context keywords (indicates likely false positive)
export const NEGATIVE_CONTEXT_KEYWORDS = new Set([
  // Version/Build related
  'version',
  'ver',
  'v',
  'release',
  'rel',
  'build',
  'changelog',
  'history',

  // Test/Demo related
  'sample',
  'example',
  'demo',
  'test',
  'testing',
  'dummy',
  'fake',
  'mock',
  'placeholder',
  'template',
  'sandbox',
  'trial',

  // Documentation related
  'documentation',
  'docs',
  'spec',
  'specification',
  'tutorial',
  'guide',
  'readme',
  'license',
  'copyright',
  'author',
  'manual',

  // Security/Technical identifiers
  'uuid',
  'guid',
  'hash',
  'checksum',
  'digest',
  'signature',
  'token',
  'key',
  'secret',
  'certificate',
  'fingerprint',
  'identifier',
  'id',

  // Japanese negative terms
  'テスト',
  'サンプル',
  '例',
  '見本',
  'デモ',
  '試用',
  '試験',
  'ドキュメント',
  '仕様',
  '仕様書',
  'ガイド',
  'ガイドライン',
  'マニュアル',
  'リリース',
  'バージョン',
  '版',
  '更新',
  'アップデート',
  '開発',
  '開発用',
  '開発環境',
  'テスト環境',
  '検証',
  '実験',
  'プレースホルダー',
  'プレースホルダ',
  'ダミー',
  '偽',
  'フェイク',
  '仮',
  '一時',
  '仮データ',
  'テストデータ',
  'サンプルデータ',
])

// Detection strictness levels
export const STRICTNESS_LEVELS = {
  fast: {
    description: 'Maximum performance, minimal false positive filtering',
    contextRequired: false,
    excludeTestData: false,
    excludePrivateNetworks: false,
    brandValidation: false,
  },
  balanced: {
    description: 'Good balance of performance and accuracy',
    contextRequired: false,
    excludeTestData: true,
    excludePrivateNetworks: false,
    brandValidation: true,
  },
  strict: {
    description: 'Maximum accuracy, stricter validation',
    contextRequired: true,
    excludeTestData: true,
    excludePrivateNetworks: true,
    brandValidation: true,
  },
} as const

export type StrictnessLevel = keyof typeof STRICTNESS_LEVELS
