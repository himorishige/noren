# カスタムルールとパターンの作成

このドキュメントでは、Noren Guard の関数型APIを使って独自のセキュリティパターンとポリシーを追加する方法を説明します。

## 📚 組み込み辞書の活用

Noren Guard は3つの用途別辞書を提供しており、これらを基盤として独自のルールを構築できます。

### 利用可能な辞書カテゴリ

#### 1. 金融データ辞書（Financial）

```typescript
import { 
  financialPatterns,
  financialSanitizeRules,
  createFinancialConfig 
} from '@himorishige/noren-guard';

// 金融パターンの内容
console.log(financialPatterns.map(p => ({
  id: p.id,
  description: p.description,
  severity: p.severity
})));

/* 出力例:
[
  { id: 'credit_card', description: 'Credit card numbers', severity: 'high' },
  { id: 'bank_account', description: 'Bank account numbers', severity: 'high' },
  { id: 'routing_number', description: 'US bank routing numbers', severity: 'high' },
  { id: 'iban', description: 'International Bank Account Number', severity: 'high' },
  { id: 'swift_code', description: 'SWIFT/BIC codes', severity: 'medium' }
]
*/
```

#### 2. 個人情報辞書（Personal）

```typescript
import { 
  personalPatterns,
  personalSanitizeRules,
  createPersonalConfig 
} from '@himorishige/noren-guard';

// 個人情報パターンの内容
const personalIds = personalPatterns.map(p => p.id);
console.log(personalIds);
// ['email', 'us_phone', 'jp_phone', 'us_ssn', 'jp_mynumber', 'ip_address', 'us_zip', 'jp_postal']
```

#### 3. セキュリティトークン辞書（Security）

```typescript
import { 
  securityPatterns,
  securitySanitizeRules,
  createSecurityConfig 
} from '@himorishige/noren-guard';

// セキュリティパターンの内容
const securityIds = securityPatterns.map(p => p.id);
console.log(securityIds);
// ['jwt_token', 'api_key', 'github_token', 'aws_access_key', 'google_api_key', 'stripe_api_key', 'openai_api_key', 'auth_header', 'session_id', 'uuid_token']
```

### 組み込み辞書の拡張

#### 既存パターンに追加する方法

```typescript
import { 
  financialPatterns,
  financialSanitizeRules,
  patternBuilder,
  ruleBuilder,
  createGuard 
} from '@himorishige/noren-guard';

// 既存の金融パターンに日本固有のパターンを追加
const japaneseFinancialPatterns = patternBuilder()
  .addRegexPatterns([
    {
      regex: '\\d{4}-\\d{4}-\\d{4}-\\d{4}', // 日本のクレジットカード形式
      description: '日本形式クレジットカード',
      severity: 'high'
    },
    {
      regex: '\\d{7}', // 7桁銀行口座番号
      description: '日本の銀行口座番号',
      severity: 'high'  
    }
  ])
  .build();

// 組み込み + カスタムパターンの結合
const enhancedGuard = createGuard({
  customPatterns: [
    ...financialPatterns, // 既存の金融パターン
    ...japaneseFinancialPatterns // 追加パターン
  ],
  customRules: [
    ...financialSanitizeRules, // 既存のルール
    // 追加ルール
    {
      pattern: /\d{4}-\d{4}-\d{4}-\d{4}/g,
      action: 'replace',
      replacement: '[JP_CARD_NUMBER]',
      category: 'financial'
    }
  ],
  enableSanitization: true
});
```

#### 特定パターンのフィルタリング

```typescript
import { personalPatterns } from '@himorishige/noren-guard';

// 高重要度の個人情報のみ使用
const criticalPersonalPatterns = personalPatterns.filter(
  p => p.severity === 'critical'
);

// 特定の地域パターンのみ使用
const usOnlyPatterns = personalPatterns.filter(
  p => p.id.startsWith('us_')
);

const jpOnlyPatterns = personalPatterns.filter(
  p => p.id.startsWith('jp_') || p.id === 'email'
);

const guard = createGuard({
  customPatterns: [
    ...criticalPersonalPatterns,
    ...jpOnlyPatterns
  ]
});
```

### カスタム辞書ファイルの作成

#### 独自辞書ファイルの作成例

```typescript
/**
 * patterns/healthcare.ts - ヘルスケア専用辞書
 */
import type { InjectionPattern, SanitizeRule } from '../types.js';

export const healthcarePatterns: InjectionPattern[] = [
  {
    id: 'medical_record_number',
    pattern: /\bMRN[-:\s]*(\d{6,10})\b/gi,
    description: 'Medical Record Numbers',
    severity: 'critical',
    category: 'healthcare',
    weight: 95,
    sanitize: true
  },
  {
    id: 'patient_id',
    pattern: /\bPT[-:\s]*(\d{6,8})\b/gi,
    description: 'Patient ID numbers',
    severity: 'critical', 
    category: 'healthcare',
    weight: 95,
    sanitize: true
  },
  {
    id: 'diagnosis_code',
    pattern: /\b[A-Z]\d{2}\.\d{1,2}\b/g,
    description: 'ICD-10 diagnosis codes',
    severity: 'medium',
    category: 'healthcare', 
    weight: 70,
    sanitize: true
  },
  {
    id: 'blood_pressure',
    pattern: /\b\d{2,3}\/\d{2,3}\s*mmHg\b/gi,
    description: 'Blood pressure readings',
    severity: 'medium',
    category: 'healthcare',
    weight: 60,
    sanitize: true
  }
];

export const healthcareSanitizeRules: SanitizeRule[] = [
  {
    pattern: /\bMRN[-:\s]*(\d{6,10})\b/gi,
    action: 'replace',
    replacement: 'MRN [MEDICAL_RECORD]',
    category: 'healthcare',
    priority: 5
  },
  {
    pattern: /\bPT[-:\s]*(\d{6,8})\b/gi,
    action: 'replace',
    replacement: 'PT [PATIENT_ID]',
    category: 'healthcare',
    priority: 5
  },
  {
    pattern: /\b\d{2,3}\/\d{2,3}\s*mmHg\b/gi,
    action: 'replace',
    replacement: '[BLOOD_PRESSURE]',
    category: 'healthcare',
    priority: 3
  }
];

/**
 * ヘルスケア特化ガード設定を作成
 */
export function createHealthcareConfig() {
  return {
    customPatterns: healthcarePatterns,
    customRules: healthcareSanitizeRules,
    riskThreshold: 40, // 医療データは厳格に
    enableSanitization: true
  };
}
```

#### カスタム辞書の使用

```typescript
import { 
  createGuard,
  personalPatterns, // 組み込み個人情報辞書
  securityPatterns  // 組み込みセキュリティ辞書
} from '@himorishige/noren-guard';
import { 
  healthcarePatterns,
  healthcareSanitizeRules,
  createHealthcareConfig 
} from './patterns/healthcare.js'; // カスタム辞書

// ヘルスケア特化ガード
const healthcareGuard = createGuard(createHealthcareConfig());

// 複合辞書（ヘルスケア + 個人情報 + セキュリティ）
const comprehensiveHealthcareGuard = createGuard({
  customPatterns: [
    ...healthcarePatterns,      // カスタムヘルスケア
    ...personalPatterns,        // 組み込み個人情報
    ...securityPatterns         // 組み込みセキュリティ
  ],
  customRules: [
    ...healthcareSanitizeRules,
    // 必要に応じて組み込みルールも追加
  ],
  riskThreshold: 35 // 医療環境では厳格に
});
```

## 🎯 カスタムパターンの基本

### パターンの構造

```typescript
interface InjectionPattern {
  id: string; // 一意の識別子
  pattern: RegExp; // 検出用正規表現
  severity: 'low' | 'medium' | 'high' | 'critical';
  category: string; // パターンのカテゴリ
  weight: number; // 重み（0-100）
  sanitize: boolean; // サニタイゼーション対象か
  description?: string; // パターンの説明
}
```

### 基本的なカスタムパターンの追加

```typescript
import { createGuard } from '@himorishige/noren-guard';

const customPatterns = [
  {
    id: 'company_secrets',
    pattern: /機密情報|社外秘|confidential/gi,
    severity: 'high' as const,
    category: 'information_leak',
    weight: 85,
    sanitize: true,
    description: '機密情報の漏洩検出'
  },
  {
    id: 'personal_info',
    pattern: /マイナンバー|個人番号|\d{4}\s*\d{4}\s*\d{4}/gi,
    severity: 'critical' as const,
    category: 'pii',
    weight: 95,
    sanitize: true,
    description: 'マイナンバーの検出'
  }
];

const guard = createGuard({
  customPatterns,
  riskThreshold: 60,
  enableSanitization: true
});

// 使用例
const result = await guard.scan('この文書は機密情報を含みます');
console.log(`リスク: ${result.risk}, 安全: ${result.safe}`);
```

## 🔨 パターンビルダーの活用

### Fluent APIによるパターン構築

```typescript
import { patternBuilder, createGuard } from '@himorishige/noren-guard';

// 会社固有のパターンを構築
const companyPatterns = patternBuilder()
  .add({
    pattern: /プロジェクト[A-Z]/gi,
    description: 'プロジェクトコード',
    severity: 'medium'
  })
  .addKeywords('sensitive', ['機密', '秘密', '内部情報'], 'high')
  .addCompanyTerms('Acme Corp', [
    '新製品',
    '買収計画',
    '人事異動',
    '業績予想'
  ])
  .addRegexPatterns([
    {
      regex: 'EMP-\\d{5}',
      description: '従業員ID',
      severity: 'medium'
    },
    {
      regex: '\\b\\d{4}-\\d{4}-\\d{4}-\\d{4}\\b',
      description: 'クレジットカード番号',
      severity: 'critical'
    }
  ])
  .build();

const guard = createGuard({
  customPatterns: companyPatterns,
  enableSanitization: true
});
```

### 関数型スタイルでのパターン構築

```typescript
import { 
  createPatternBuilder,
  addPattern,
  addKeywords,
  addCompanyTerms,
  buildPatterns 
} from '@himorishige/noren-guard';

// 関数型スタイル
let state = createPatternBuilder();

// パターンを段階的に追加
state = addPattern(state, {
  pattern: /秘密鍵|private.key|-----BEGIN/gi,
  description: '暗号化キーの検出',
  severity: 'critical'
});

state = addKeywords(state, 'authentication', [
  'パスワード',
  'トークン',
  '認証情報'
], 'high');

state = addCompanyTerms(state, '当社', [
  '売上目標',
  '戦略計画',
  '特許申請'
]);

const finalPatterns = buildPatterns(state);

const guard = createGuard({
  customPatterns: finalPatterns
});
```

## 🧹 サニタイゼーションルールの作成

### 基本的なルール構造

```typescript
interface SanitizeRule {
  pattern: RegExp;
  action: 'remove' | 'replace' | 'quote' | 'neutralize';
  replacement?: string;
  category?: string;
  priority?: number;
}
```

### ルールビルダーの使用

```typescript
import { ruleBuilder, createGuard } from '@himorishige/noren-guard';

// Fluent APIでルールを構築
const sanitizeRules = ruleBuilder()
  .addRemoval(/\[SYSTEM\]/gi) // システムマーカーを削除
  .addReplacement(
    /パスワード[:：]\s*\S+/gi,
    'パスワード: [保護済み]'
  )
  .addQuote(/rm\s+-rf/gi) // 危険なコマンドを引用符で囲む
  .add({
    pattern: /\b\d{4}-\d{4}-\d{4}-\d{4}\b/g,
    action: 'replace',
    replacement: '[カード番号]',
    category: 'financial',
    priority: 5
  })
  .build();

const guard = createGuard({
  customRules: sanitizeRules,
  enableSanitization: true
});

// テスト
const result = await guard.scan('パスワード: secret123、カード: 1234-5678-9012-3456');
console.log('サニタイズ結果:', result.sanitized);
```

### 関数型スタイルでのルール構築

```typescript
import { 
  createRuleBuilder,
  addRule,
  addRemovalRule,
  addReplacementRule,
  buildRules 
} from '@himorishige/noren-guard';

let ruleState = createRuleBuilder();

// 段階的にルールを追加
ruleState = addRemovalRule(ruleState, '\\[削除対象\\]', 'system');
ruleState = addReplacementRule(
  ruleState, 
  'API_KEY=\\w+', 
  'API_KEY=[保護済み]', 
  'security'
);

ruleState = addRule(ruleState, {
  pattern: /社員番号\d+/gi,
  action: 'replace',
  replacement: '社員番号[匿名]',
  priority: 3
});

const rules = buildRules(ruleState);
```

## 🏛️ ポリシーシステムの活用

### 事前定義ポリシーの使用

```typescript
import { 
  createPolicyStore,
  addPolicy,
  activatePolicy,
  createFinancialPolicy,
  createHealthcarePolicy,
  createGovernmentPolicy,
  toGuardConfig,
  createGuard 
} from '@himorishige/noren-guard';

// ポリシーストアを作成
let store = createPolicyStore();

// 事前定義ポリシーを追加
const financial = createFinancialPolicy();
const healthcare = createHealthcarePolicy();
const government = createGovernmentPolicy();

store = addPolicy(store, financial);
store = addPolicy(store, healthcare);
store = addPolicy(store, government);

// 用途に応じてポリシーを切り替え
store = activatePolicy(store, 'financial');

const guardConfig = toGuardConfig(store);
const financialGuard = createGuard(guardConfig);

// 金融データの処理
const result = await financialGuard.scan('口座番号: 123-456-789');
```

### カスタムポリシーの作成

```typescript
import { 
  createCustomPolicy,
  mergePolicies,
  validatePolicy,
  exportPolicy,
  importPolicy 
} from '@himorishige/noren-guard';

// ベースとなるパターンを構築
const customPatterns = patternBuilder()
  .addKeywords('corporate', ['買収', '合併', 'M&A'], 'high')
  .addCompanyTerms('弊社', ['新規事業', '戦略提携'])
  .build();

const customRules = ruleBuilder()
  .addReplacement(/買収金額[:：]\s*[\d,]+円/gi, '買収金額: [金額保護]')
  .build();

// カスタムポリシーを作成
const corporatePolicy = createCustomPolicy('corporate-security', {
  description: '企業セキュリティポリシー',
  basePolicy: 'financial', // 既存ポリシーをベースに
  additionalPatterns: customPatterns,
  additionalRules: customRules,
  config: {
    riskThreshold: 40,
    enableSanitization: true,
    enableContextSeparation: true
  }
});

// ポリシーの検証
const validation = validatePolicy(corporatePolicy);
if (!validation.valid) {
  console.error('ポリシーエラー:', validation.errors);
} else {
  console.log('ポリシーは有効です');
}

// ポリシーのエクスポート/インポート
const policyJson = exportPolicy(corporatePolicy);
console.log('エクスポートされたポリシー:', policyJson);

// 後で再インポート
const importedPolicy = importPolicy(policyJson);
```

### 複数ポリシーの統合

```typescript
import { mergePolicies } from '@himorishige/noren-guard';

// 複数のポリシーを統合
const financial = createFinancialPolicy();
const healthcare = createHealthcarePolicy();

const mergedPolicy = mergePolicies('comprehensive-security', [
  financial,
  healthcare,
  corporatePolicy
], {
  description: '包括的セキュリティポリシー'
});

// 統合されたポリシーを使用
store = addPolicy(store, mergedPolicy);
store = activatePolicy(store, 'comprehensive-security');

const comprehensiveGuard = createGuard(toGuardConfig(store));
```

## 💳 PII (個人識別情報) 検出

### 組み込みPIIパターンの使用

```typescript
import { 
  createPIIPatterns,
  createPIISanitizationRules,
  createGuard 
} from '@himorishige/noren-guard';

// 標準的なPIIパターンを作成
const piiPatterns = createPIIPatterns([
  'email',      // メールアドレス
  'phone',      // 電話番号
  'ssn',        // 社会保障番号
  'creditcard', // クレジットカード
  'ip'          // IPアドレス
]);

// PII用のサニタイゼーションルール
const piiRules = createPIISanitizationRules([
  'email',
  'creditcard',
  'ssn'
]);

const piiGuard = createGuard({
  customPatterns: piiPatterns,
  customRules: piiRules,
  enableSanitization: true,
  riskThreshold: 50
});

// PIIデータのテスト
const personalData = `
連絡先: john.doe@example.com
電話: 090-1234-5678
カード: 4111-1111-1111-1111
`;

const result = await piiGuard.scan(personalData);
console.log('PII検出結果:');
console.log('元データ:', personalData);
console.log('サニタイズ後:', result.sanitized);
console.log('検出されたPII:', result.matches.length, '件');
```

### カスタムPIIパターンの作成

```typescript
// 日本固有のPIIパターン
const japanesePIIPatterns = [
  {
    id: 'japanese_phone',
    pattern: /(?:070|080|090)-\d{4}-\d{4}/g,
    description: '日本の携帯電話番号',
    severity: 'medium' as const,
    category: 'pii',
    weight: 70,
    sanitize: true
  },
  {
    id: 'postal_code',
    pattern: /\d{3}-\d{4}/g,
    description: '日本の郵便番号',
    severity: 'low' as const,
    category: 'pii',
    weight: 40,
    sanitize: true
  },
  {
    id: 'my_number',
    pattern: /\d{4}\s*\d{4}\s*\d{4}/g,
    description: 'マイナンバー',
    severity: 'critical' as const,
    category: 'pii',
    weight: 95,
    sanitize: true
  }
];

// 対応するサニタイゼーションルール
const japaneseRules = [
  {
    pattern: /(?:070|080|090)-\d{4}-\d{4}/g,
    action: 'replace' as const,
    replacement: '[携帯電話番号]',
    category: 'pii'
  },
  {
    pattern: /\d{4}\s*\d{4}\s*\d{4}/g,
    action: 'replace' as const,
    replacement: '[マイナンバー]',
    category: 'pii'
  }
];

const japanPIIGuard = createGuard({
  customPatterns: japanesePIIPatterns,
  customRules: japaneseRules,
  enableSanitization: true
});
```

## 🔍 業界特化型パターン

### 金融業界向けパターン

```typescript
const financialPatterns = patternBuilder()
  .addKeywords('financial', [
    '口座番号',
    '取引番号',
    'SWIFT',
    'IBAN',
    '信用情報'
  ], 'high')
  .addRegexPatterns([
    {
      regex: '\\b[A-Z]{4}JP[A-Z0-9]{2}\\b', // 日本のSWIFTコード
      description: 'SWIFTコード',
      severity: 'high'
    },
    {
      regex: '\\b\\d{7}\\b', // 7桁の口座番号
      description: '銀行口座番号',
      severity: 'high'
    }
  ])
  .build();

const financialRules = ruleBuilder()
  .addReplacement(/口座[:：]\s*\d+/gi, '口座: [口座番号]')
  .addReplacement(/SWIFT[:：]\s*[A-Z0-9]+/gi, 'SWIFT: [SWIFTコード]')
  .build();
```

### ヘルスケア業界向けパターン

```typescript
const healthcarePatterns = patternBuilder()
  .addKeywords('medical', [
    '診断',
    '処方',
    '患者ID',
    '病歴',
    '検査結果'
  ], 'high')
  .addRegexPatterns([
    {
      regex: 'PT\\d{6}', // 患者ID
      description: '患者識別番号',
      severity: 'critical'
    },
    {
      regex: '血圧[:：]\\s*\\d+/\\d+',
      description: '血圧データ',
      severity: 'medium'
    }
  ])
  .build();

const healthcareRules = ruleBuilder()
  .addReplacement(/PT\d{6}/g, '[患者ID]')
  .addReplacement(/血圧[:：]\s*\d+\/\d+/gi, '血圧: [測定値]')
  .build();
```

### 技術・開発業界向けパターン

```typescript
const techPatterns = patternBuilder()
  .addKeywords('security', [
    'API_KEY',
    'SECRET',
    'TOKEN',
    'PRIVATE_KEY'
  ], 'critical')
  .addRegexPatterns([
    {
      regex: 'sk-[a-zA-Z0-9]{32,}', // OpenAI API キー
      description: 'OpenAI API Key',
      severity: 'critical'
    },
    {
      regex: 'ghp_[a-zA-Z0-9]{36}', // GitHub Personal Access Token
      description: 'GitHub Token',
      severity: 'critical'
    },
    {
      regex: 'AKIA[0-9A-Z]{16}', // AWS Access Key
      description: 'AWS Access Key',
      severity: 'critical'
    }
  ])
  .build();

const techRules = ruleBuilder()
  .addReplacement(/sk-[a-zA-Z0-9]{32,}/g, '[OPENAI_KEY]')
  .addReplacement(/ghp_[a-zA-Z0-9]{36}/g, '[GITHUB_TOKEN]')
  .addReplacement(/AKIA[0-9A-Z]{16}/g, '[AWS_KEY]')
  .build();
```

## 🎛️ 高度な設定とチューニング

### パフォーマンス最適化

```typescript
// 高スループット用設定
const highThroughputGuard = createGuard({
  riskThreshold: 80, // 高い閾値で偽陽性を減らす
  enableSanitization: false, // サニタイゼーションを無効化
  enableContextSeparation: false, // コンテキスト分離を無効化
  maxProcessingTime: 25, // 処理時間制限を短く
  enablePerfMonitoring: false // パフォーマンス監視を無効化
});

// 高セキュリティ用設定
const highSecurityGuard = createGuard({
  riskThreshold: 30, // 低い閾値で厳格に
  enableSanitization: true,
  enableContextSeparation: true,
  maxProcessingTime: 200, // 時間をかけて詳細分析
  enablePerfMonitoring: true
});
```

### 動的な閾値調整

```typescript
class AdaptiveGuard {
  private guard;
  private recentScores: number[] = [];

  constructor() {
    this.guard = createGuard({
      riskThreshold: 60,
      enableSanitization: true
    });
  }

  async adaptiveScan(content: string): Promise<any> {
    const result = await this.guard.scan(content, 'user');
    
    // 最近のスコアを記録
    this.recentScores.push(result.risk);
    if (this.recentScores.length > 10) {
      this.recentScores.shift();
    }

    // 動的に閾値を調整
    this.adjustThreshold();

    return result;
  }

  private adjustThreshold(): void {
    if (this.recentScores.length < 5) return;

    const avgRisk = this.recentScores.reduce((a, b) => a + b, 0) / this.recentScores.length;
    const highRiskCount = this.recentScores.filter(score => score > 70).length;

    let newThreshold = 60; // デフォルト

    if (highRiskCount > 3) {
      // 高リスクが頻発している場合は閾値を下げる
      newThreshold = 45;
    } else if (avgRisk < 20) {
      // 全体的にリスクが低い場合は閾値を上げる
      newThreshold = 75;
    }

    this.guard.updateConfig({ riskThreshold: newThreshold });
    console.log(`閾値を ${newThreshold} に調整しました`);
  }
}
```

## 🧪 テストとデバッグ

### パターンのテスト

```typescript
async function testPatterns() {
  const testCases = [
    {
      input: '機密情報: プロジェクトXの詳細',
      expected: { safe: false, category: 'information_leak' }
    },
    {
      input: 'API_KEY=sk-abc123def456',
      expected: { safe: false, category: 'security' }
    },
    {
      input: '今日の天気はいいですね',
      expected: { safe: true }
    }
  ];

  const guard = createGuard({
    customPatterns: [...customPatterns],
    customRules: [...customRules]
  });

  for (const testCase of testCases) {
    const result = await guard.scan(testCase.input, 'user');
    
    console.log(`テスト: "${testCase.input}"`);
    console.log(`期待: 安全=${testCase.expected.safe}`);
    console.log(`結果: 安全=${result.safe}, リスク=${result.risk}`);
    
    if (testCase.expected.category) {
      const hasCategory = result.matches.some(
        match => match.category === testCase.expected.category
      );
      console.log(`カテゴリ検出: ${hasCategory}`);
    }
    
    console.log('---');
  }
}

// テストを実行
await testPatterns();
```

### パフォーマンス分析

```typescript
async function benchmarkPatterns() {
  const guard = createGuard({
    enablePerfMonitoring: true,
    customPatterns: [...customPatterns]
  });

  const testTexts = [
    'この文書は機密情報を含みます',
    'API_KEY=sk-test123',
    '通常のテキストです',
    // より多くのテストケース...
  ];

  console.log('パフォーマンステスト開始...');
  
  for (const text of testTexts) {
    const startTime = performance.now();
    const result = await guard.scan(text, 'user');
    const endTime = performance.now();
    
    console.log(`テキスト: "${text}"`);
    console.log(`処理時間: ${endTime - startTime}ms`);
    console.log(`リスク: ${result.risk}`);
    console.log('---');
  }

  const metrics = guard.getMetrics();
  console.log('全体メトリクス:', metrics);
}

await benchmarkPatterns();
```

---

このガイドを参考に、あなたの組織やアプリケーションに特化したセキュリティパターンとポリシーを作成してください。関数型APIの柔軟性を活用して、効率的で保守性の高いセキュリティソリューションを構築できます。