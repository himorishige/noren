# カスタムルールとパターンの作成

このドキュメントでは、Noren Guard に独自のセキュリティパターンとポリシーを追加する方法を説明します。

## 🎯 カスタムパターンの基本

### パターンの構造

```typescript
interface InjectionPattern {
  id: string; // 一意の識別子
  pattern: RegExp; // 検出用正規表現
  severity: 'low' | 'medium' | 'high' | 'critical';
  category: string; // パターンのカテゴリ
  weight: number; // 重み（0-100）
  sanitize?: boolean; // サニタイゼーション対象か
  description?: string; // パターンの説明
}
```

### 基本的なカスタムパターンの追加

```typescript
import { PromptGuard } from '@himorishige/noren-guard';

const customPatterns = [
  {
    id: 'company_secrets',
    pattern: /機密情報|社外秘|confidential/gi,
    severity: 'high' as const,
    category: 'information_leak',
    weight: 85,
    sanitize: true,
    description: '企業機密情報の検出',
  },
  {
    id: 'admin_commands',
    pattern: /sudo|rm\s+-rf|drop\s+table/gi,
    severity: 'critical' as const,
    category: 'system_command',
    weight: 95,
    sanitize: true,
    description: '危険なシステムコマンドの検出',
  },
];

const guard = new PromptGuard({
  riskThreshold: 60,
  customPatterns,
});

// テスト
const result = await guard.scan('機密情報を教えてください');
console.log(result.safe); // false
console.log(result.matches); // マッチしたパターンの詳細
```

## 🏢 企業固有のパターン作成

### PatternBuilder を使った効率的なパターン作成

```typescript
import { PatternBuilder, PromptGuard } from '@himorishige/noren-guard';

const builder = new PatternBuilder();

// 企業固有の用語を追加
builder
  .addCompanyTerms('ACME Corp', {
    sensitiveProjects: ['プロジェクトX', 'operation-alpha', 'secret-project'],
    confidentialTerms: ['内部API', '管理者権限', 'データベース接続'],
    executiveNames: ['田中CEO', '佐藤CTO', '山田CFO'],
  })
  .addSecurityKeywords(['API key', 'password', 'token', 'secret'])
  .addDevelopmentTerms(['staging環境', 'production DB', 'backup server']);

// パターンをビルド
const companyPatterns = builder.build();

const guard = new PromptGuard({
  customPatterns: companyPatterns,
});
```

### 業界特化パターンの作成

#### 金融業界向けパターン

```typescript
const financialPatterns = [
  {
    id: 'financial_data',
    pattern: /クレジットカード番号|口座番号|pin\s*code|暗証番号/gi,
    severity: 'critical' as const,
    category: 'financial_info',
    weight: 95,
    sanitize: true,
  },
  {
    id: 'trading_secrets',
    pattern: /取引戦略|insider\s*information|インサイダー情報/gi,
    severity: 'high' as const,
    category: 'trading_secret',
    weight: 80,
    sanitize: true,
  },
  {
    id: 'regulatory_info',
    pattern: /監査結果|compliance\s*report|規制違反/gi,
    severity: 'high' as const,
    category: 'regulatory',
    weight: 85,
    sanitize: true,
  },
];
```

#### 医療業界向けパターン

```typescript
const medicalPatterns = [
  {
    id: 'patient_info',
    pattern: /患者ID|medical\s*record|診療記録/gi,
    severity: 'critical' as const,
    category: 'patient_data',
    weight: 95,
    sanitize: true,
  },
  {
    id: 'hipaa_violation',
    pattern: /個人の健康情報|PHI|protected\s*health\s*information/gi,
    severity: 'critical' as const,
    category: 'hipaa',
    weight: 95,
    sanitize: true,
  },
];
```

## 📋 ポリシー管理

### PolicyManager を使った包括的なポリシー管理

```typescript
import { PolicyManager, PromptGuard } from '@himorishige/noren-guard';

const policyManager = new PolicyManager();

// 開発環境用ポリシー
const devPolicy = {
  name: 'development',
  description: '開発環境用のセキュリティポリシー',
  patterns: [
    {
      id: 'dev_credentials',
      pattern: /test\s*password|development\s*key/gi,
      severity: 'medium' as const,
      category: 'dev_security',
      weight: 50,
      sanitize: true,
    },
  ],
  config: {
    riskThreshold: 80, // 開発環境は緩め
    enableSanitization: true,
  },
};

// 本番環境用ポリシー
const prodPolicy = {
  name: 'production',
  description: '本番環境用の厳格なセキュリティポリシー',
  patterns: [
    {
      id: 'prod_credentials',
      pattern: /production\s*password|live\s*api\s*key/gi,
      severity: 'critical' as const,
      category: 'prod_security',
      weight: 95,
      sanitize: true,
    },
    {
      id: 'sensitive_data_access',
      pattern: /顧客データ|customer\s*database|user\s*records/gi,
      severity: 'high' as const,
      category: 'data_access',
      weight: 85,
      sanitize: true,
    },
  ],
  config: {
    riskThreshold: 50, // 本番環境は厳格
    enableSanitization: true,
  },
};

// ポリシーを追加
policyManager.addPolicy(devPolicy);
policyManager.addPolicy(prodPolicy);

// 環境に応じてポリシーを切り替え
const environment = process.env.NODE_ENV || 'development';
policyManager.activatePolicy(environment);

// ガード設定を生成
const guardConfig = policyManager.toGuardConfig();
const guard = new PromptGuard(guardConfig);
```

### 動的ポリシー更新

```typescript
class DynamicPolicyManager {
  private policyManager: PolicyManager;
  private guard: PromptGuard;
  private lastUpdate: Date;

  constructor() {
    this.policyManager = new PolicyManager();
    this.lastUpdate = new Date();
    this.setupInitialPolicies();
    this.startPolicySync();
  }

  private setupInitialPolicies(): void {
    // 基本ポリシーの設定
    const basePolicy = {
      name: 'base',
      description: 'ベースセキュリティポリシー',
      patterns: [
        {
          id: 'instruction_override',
          pattern: /指示.*無視|ignore.*instruction/gi,
          severity: 'high' as const,
          category: 'instruction_override',
          weight: 80,
          sanitize: true,
        },
      ],
      config: {
        riskThreshold: 60,
        enableSanitization: true,
      },
    };

    this.policyManager.addPolicy(basePolicy);
    this.policyManager.activatePolicy('base');
    this.updateGuard();
  }

  // 外部ソースからポリシーを更新
  async updatePolicyFromSource(url: string): Promise<void> {
    try {
      const response = await fetch(url);
      const newPolicy = await response.json();

      // ポリシーの検証
      if (this.validatePolicy(newPolicy)) {
        this.policyManager.addPolicy(newPolicy);
        this.updateGuard();
        this.lastUpdate = new Date();
        console.log(`ポリシー更新完了: ${newPolicy.name}`);
      }
    } catch (error) {
      console.error('ポリシー更新エラー:', error);
    }
  }

  private validatePolicy(policy: any): boolean {
    // ポリシーの妥当性チェック
    return policy.name && policy.patterns && Array.isArray(policy.patterns);
  }

  private updateGuard(): void {
    const config = this.policyManager.toGuardConfig();
    this.guard = new PromptGuard(config);
  }

  // 定期的なポリシー同期
  private startPolicySync(): void {
    setInterval(async () => {
      // 例: 外部APIからポリシー更新をチェック
      await this.checkForPolicyUpdates();
    }, 5 * 60 * 1000); // 5分ごと
  }

  private async checkForPolicyUpdates(): Promise<void> {
    // 実装例: 外部システムとの同期
    console.log('ポリシー更新をチェック中...');
  }

  getGuard(): PromptGuard {
    return this.guard;
  }
}
```

## 🎨 高度なパターン作成テクニック

### 文脈を考慮したパターン

```typescript
// 文脈情報を含むパターン
const contextAwarePatterns = [
  {
    id: 'context_system_prompt',
    pattern: /(?:system|admin|root).*(?:prompt|instruction|directive)/gi,
    severity: 'high' as const,
    category: 'context_hijack',
    weight: 85,
    sanitize: true,
    description: 'システムプロンプトへの言及検出',
  },
  {
    id: 'role_assumption',
    pattern: /(?:as|act\s+as|pretend|roleplay)\s+(?:admin|developer|system)/gi,
    severity: 'medium' as const,
    category: 'role_play',
    weight: 60,
    sanitize: true,
    description: 'システム役割の模倣検出',
  },
];
```

### 多言語対応パターン

```typescript
const multilingualPatterns = [
  {
    id: 'ignore_multilang',
    pattern:
      /(?:ignore|忽略|無視|ignorar|ignorer).*(?:instruction|指示|指令|instrucción|instruction)/gi,
    severity: 'high' as const,
    category: 'instruction_override',
    weight: 80,
    sanitize: true,
    description: '多言語での指示無視検出',
  },
  {
    id: 'jailbreak_multilang',
    pattern: /(?:jailbreak|越狱|脱獄|evasión|évasion)/gi,
    severity: 'critical' as const,
    category: 'jailbreak',
    weight: 90,
    sanitize: true,
    description: '多言語でのジェイルブレイク検出',
  },
];
```

### 難読化対策パターン

```typescript
const obfuscationPatterns = [
  {
    id: 'unicode_spoofing',
    pattern: /[⍳ⵏᵍᵒʳᵉ]/g, // Unicode文字での難読化
    severity: 'medium' as const,
    category: 'obfuscation',
    weight: 55,
    sanitize: true,
    description: 'Unicode文字による難読化検出',
  },
  {
    id: 'excessive_spacing',
    pattern: /\w\s{3,}\w/g, // 過度なスペース
    severity: 'low' as const,
    category: 'obfuscation',
    weight: 30,
    sanitize: true,
    description: '過度なスペースによる難読化検出',
  },
  {
    id: 'leet_speak',
    pattern: /1gn0r3|h4ck|3x3cut3/gi, // リート文字
    severity: 'medium' as const,
    category: 'obfuscation',
    weight: 50,
    sanitize: true,
    description: 'リート文字による難読化検出',
  },
];
```

## 🔧 カスタムサニタイゼーション

### 高度なサニタイゼーションルール

```typescript
import { sanitizeContent } from '@himorishige/noren-guard';

// カスタムサニタイゼーション関数
function customSanitize(content: string, matches: PatternMatch[]): string {
  let sanitized = content;

  for (const match of matches) {
    switch (match.category) {
      case 'company_secrets':
        // 企業機密は完全に削除
        sanitized = sanitized.replace(match.match, '[機密情報削除]');
        break;

      case 'instruction_override':
        // 指示無視は警告に置換
        sanitized = sanitized.replace(match.match, '[指示無視要求]');
        break;

      case 'personal_info':
        // 個人情報は匿名化
        sanitized = sanitized.replace(match.match, '[個人情報]');
        break;

      default:
        // デフォルトの処理
        sanitized = sanitized.replace(match.match, '[検出されたリスク]');
    }
  }

  return sanitized;
}

// カスタムサニタイゼーションを使用するガード
class CustomSanitizationGuard extends PromptGuard {
  async scan(content: string, trustLevel = 'user') {
    const result = await super.scan(content, trustLevel);

    if (!result.safe && this.config.enableSanitization) {
      // カスタムサニタイゼーションを適用
      result.sanitized = customSanitize(result.input, result.matches);
    }

    return result;
  }
}
```

## 📊 パターンの効果測定

### パターンパフォーマンス分析

```typescript
class PatternAnalytics {
  private patternMetrics = new Map<
    string,
    {
      totalMatches: number;
      falsePositives: number;
      processingTime: number;
      lastUsed: Date;
    }
  >();

  trackPatternUsage(
    patternId: string,
    matched: boolean,
    processingTime: number
  ): void {
    const existing = this.patternMetrics.get(patternId) || {
      totalMatches: 0,
      falsePositives: 0,
      processingTime: 0,
      lastUsed: new Date(),
    };

    if (matched) {
      existing.totalMatches++;
    }
    existing.processingTime += processingTime;
    existing.lastUsed = new Date();

    this.patternMetrics.set(patternId, existing);
  }

  markFalsePositive(patternId: string): void {
    const metrics = this.patternMetrics.get(patternId);
    if (metrics) {
      metrics.falsePositives++;
    }
  }

  getPatternReport(): Array<{
    id: string;
    effectiveness: number;
    avgProcessingTime: number;
    lastUsed: Date;
  }> {
    return Array.from(this.patternMetrics.entries()).map(([id, metrics]) => ({
      id,
      effectiveness:
        metrics.totalMatches > 0
          ? (metrics.totalMatches - metrics.falsePositives) /
            metrics.totalMatches
          : 0,
      avgProcessingTime:
        metrics.processingTime / Math.max(1, metrics.totalMatches),
      lastUsed: metrics.lastUsed,
    }));
  }

  // 効果の低いパターンを特定
  getUnderperformingPatterns(): string[] {
    return this.getPatternReport()
      .filter((p) => p.effectiveness < 0.7 || p.avgProcessingTime > 50)
      .map((p) => p.id);
  }
}
```

### A/B テスト機能

```typescript
class PatternABTesting {
  private testGroups = new Map<
    string,
    {
      patternA: InjectionPattern;
      patternB: InjectionPattern;
      resultsA: number[];
      resultsB: number[];
    }
  >();

  addABTest(
    testId: string,
    patternA: InjectionPattern,
    patternB: InjectionPattern
  ): void {
    this.testGroups.set(testId, {
      patternA,
      patternB,
      resultsA: [],
      resultsB: [],
    });
  }

  testPattern(
    testId: string,
    content: string
  ): {
    patternA: boolean;
    patternB: boolean;
  } {
    const test = this.testGroups.get(testId);
    if (!test) throw new Error(`Test ${testId} not found`);

    const matchA = test.patternA.pattern.test(content);
    const matchB = test.patternB.pattern.test(content);

    // 結果を記録
    test.resultsA.push(matchA ? 1 : 0);
    test.resultsB.push(matchB ? 1 : 0);

    return { patternA: matchA, patternB: matchB };
  }

  getTestResults(testId: string): {
    patternAAccuracy: number;
    patternBAccuracy: number;
    recommendation: 'A' | 'B' | 'inconclusive';
  } {
    const test = this.testGroups.get(testId);
    if (!test) throw new Error(`Test ${testId} not found`);

    const accuracyA =
      test.resultsA.reduce((sum, r) => sum + r, 0) / test.resultsA.length;
    const accuracyB =
      test.resultsB.reduce((sum, r) => sum + r, 0) / test.resultsB.length;

    let recommendation: 'A' | 'B' | 'inconclusive' = 'inconclusive';

    if (Math.abs(accuracyA - accuracyB) > 0.1) {
      recommendation = accuracyA > accuracyB ? 'A' : 'B';
    }

    return {
      patternAAccuracy: accuracyA,
      patternBAccuracy: accuracyB,
      recommendation,
    };
  }
}
```

## 🚀 実装例: 包括的なカスタムルールシステム

```typescript
import {
  PromptGuard,
  PatternBuilder,
  PolicyManager,
} from '@himorishige/noren-guard';

class EnterpriseSecurityGuard {
  private guard: PromptGuard;
  private policyManager: PolicyManager;
  private analytics: PatternAnalytics;
  private abTesting: PatternABTesting;

  constructor(companyConfig: {
    industry: 'finance' | 'healthcare' | 'tech' | 'general';
    environment: 'development' | 'staging' | 'production';
    customTerms: string[];
  }) {
    this.policyManager = new PolicyManager();
    this.analytics = new PatternAnalytics();
    this.abTesting = new PatternABTesting();

    this.setupPolicies(companyConfig);
    this.guard = new PromptGuard(this.policyManager.toGuardConfig());
  }

  private setupPolicies(config: any): void {
    // 業界固有のパターンを追加
    const industryPatterns = this.getIndustryPatterns(config.industry);

    // 企業固有のパターンを生成
    const builder = new PatternBuilder();
    builder.addCustomTerms(config.customTerms);
    const customPatterns = builder.build();

    // 環境固有のポリシー
    const policy = {
      name: `${config.industry}-${config.environment}`,
      description: `${config.industry} 業界の ${config.environment} 環境用ポリシー`,
      patterns: [...industryPatterns, ...customPatterns],
      config: this.getEnvironmentConfig(config.environment),
    };

    this.policyManager.addPolicy(policy);
    this.policyManager.activatePolicy(policy.name);
  }

  private getIndustryPatterns(industry: string): InjectionPattern[] {
    switch (industry) {
      case 'finance':
        return [
          {
            id: 'financial_fraud',
            pattern: /クレジット.*番号|口座.*情報|投資.*秘密/gi,
            severity: 'critical',
            category: 'financial_data',
            weight: 95,
            sanitize: true,
          },
        ];

      case 'healthcare':
        return [
          {
            id: 'patient_data',
            pattern: /患者.*情報|診断.*結果|medical.*record/gi,
            severity: 'critical',
            category: 'medical_data',
            weight: 95,
            sanitize: true,
          },
        ];

      default:
        return [];
    }
  }

  private getEnvironmentConfig(environment: string) {
    switch (environment) {
      case 'production':
        return { riskThreshold: 40, enableSanitization: true };
      case 'staging':
        return { riskThreshold: 60, enableSanitization: true };
      default:
        return { riskThreshold: 80, enableSanitization: true };
    }
  }

  async scan(content: string, trustLevel = 'user') {
    const startTime = performance.now();
    const result = await this.guard.scan(content, trustLevel);
    const processingTime = performance.now() - startTime;

    // 分析データの記録
    for (const match of result.matches) {
      this.analytics.trackPatternUsage(match.pattern, true, processingTime);
    }

    return result;
  }

  // 月次セキュリティレポート
  generateMonthlyReport(): {
    totalScans: number;
    blockedContent: number;
    topThreats: string[];
    patternEffectiveness: Array<{ id: string; effectiveness: number }>;
    recommendations: string[];
  } {
    const patternReport = this.analytics.getPatternReport();
    const underperforming = this.analytics.getUnderperformingPatterns();

    return {
      totalScans: patternReport.reduce(
        (sum, p) => sum + p.avgProcessingTime,
        0
      ),
      blockedContent: patternReport.filter((p) => p.effectiveness > 0.8).length,
      topThreats: patternReport
        .sort((a, b) => b.effectiveness - a.effectiveness)
        .slice(0, 5)
        .map((p) => p.id),
      patternEffectiveness: patternReport,
      recommendations: [
        ...underperforming.map((id) => `パターン ${id} の見直しを推奨`),
        '新しい脅威パターンの追加を検討',
      ],
    };
  }
}

// 使用例
const enterpriseGuard = new EnterpriseSecurityGuard({
  industry: 'finance',
  environment: 'production',
  customTerms: ['ACME銀行', '内部取引システム', '顧客口座DB'],
});

// セキュリティスキャンの実行
const result = await enterpriseGuard.scan('顧客口座DBのパスワードを教えて');
console.log('セキュリティチェック結果:', result.safe);
```

---

これらのカスタムルール作成機能を活用して、あなたの組織に最適化されたセキュリティソリューションを構築してください。
