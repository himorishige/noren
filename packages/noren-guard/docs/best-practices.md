# ベストプラクティス

このドキュメントでは、Noren Guard を効果的かつ安全に実装するためのベストプラクティスを紹介します。

## 🎯 設定の選択

### 適切なプリセットの選択

```typescript
import { PromptGuard, PRESETS } from '@himorishige/noren-guard';

// 本番環境 - 高セキュリティが必要
const productionGuard = new PromptGuard(PRESETS.STRICT);

// 開発環境 - バランス重視
const developmentGuard = new PromptGuard(PRESETS.BALANCED);

// 高トラフィック環境 - パフォーマンス重視
const highTrafficGuard = new PromptGuard(PRESETS.PERFORMANCE);

// MCPサーバー - MCP特化
const mcpGuard = new PromptGuard(PRESETS.MCP);
```

### 環境別設定の管理

```typescript
class EnvironmentGuardFactory {
  static createGuard(): PromptGuard {
    const env = process.env.NODE_ENV || 'development';

    switch (env) {
      case 'production':
        return new PromptGuard({
          ...PRESETS.STRICT,
          enablePerfMonitoring: true,
          maxProcessingTime: 30, // 本番は高速化
        });

      case 'staging':
        return new PromptGuard({
          ...PRESETS.BALANCED,
          enablePerfMonitoring: true,
        });

      case 'development':
        return new PromptGuard({
          ...PRESETS.PERMISSIVE,
          enablePerfMonitoring: false,
        });

      case 'test':
        return new PromptGuard({
          riskThreshold: 90, // テスト時は緩く
          enableSanitization: false,
          enablePerfMonitoring: false,
        });

      default:
        return new PromptGuard(PRESETS.BALANCED);
    }
  }
}
```

## 🔒 セキュリティベストプラクティス

### 1. 信頼レベルの適切な設定

```typescript
// ✅ 良い例: 適切な信頼レベル設定
async function processInput(
  input: string,
  source: 'user' | 'admin' | 'external'
) {
  let trustLevel: TrustLevel;

  switch (source) {
    case 'admin':
      trustLevel = 'system'; // 管理者は信頼
      break;
    case 'user':
      trustLevel = 'user'; // 一般ユーザー
      break;
    case 'external':
      trustLevel = 'untrusted'; // 外部は非信頼
      break;
  }

  const result = await guard.scan(input, trustLevel);
  return result;
}

// ❌ 悪い例: 全て同じ信頼レベル
async function badProcessInput(input: string) {
  // 全て 'user' として処理 - セキュリティリスク
  return await guard.scan(input, 'user');
}
```

### 2. 多層防御の実装

```typescript
class MultiLayerSecurity {
  private preFilter: PromptGuard;
  private mainGuard: PromptGuard;
  private postFilter: PromptGuard;

  constructor() {
    // 第1層: 軽量な事前フィルタ
    this.preFilter = new PromptGuard({
      riskThreshold: 90,
      enableSanitization: false,
      maxProcessingTime: 10,
    });

    // 第2層: メインのセキュリティチェック
    this.mainGuard = new PromptGuard(PRESETS.STRICT);

    // 第3層: 詳細な事後チェック
    this.postFilter = new PromptGuard({
      riskThreshold: 30,
      enableContextSeparation: true,
      enablePerfMonitoring: true,
    });
  }

  async processWithLayers(input: string): Promise<{
    result: string;
    securityLevel: 'high' | 'medium' | 'low';
    blocked: boolean;
  }> {
    // 第1層: 明らかに危険なコンテンツを早期ブロック
    const preCheck = this.preFilter.quickScan(input);
    if (!preCheck.safe) {
      return {
        result: '',
        securityLevel: 'high',
        blocked: true,
      };
    }

    // 第2層: 詳細な分析とサニタイゼーション
    const mainResult = await this.mainGuard.scan(input);
    if (!mainResult.safe) {
      if (mainResult.risk > 80) {
        return {
          result: '',
          securityLevel: 'high',
          blocked: true,
        };
      }
      // 中リスクはサニタイズして継続
      input = mainResult.sanitized;
    }

    // 第3層: 最終的な安全性確認
    const postResult = await this.postFilter.scan(input);

    return {
      result: postResult.sanitized,
      securityLevel: postResult.risk > 50 ? 'medium' : 'low',
      blocked: false,
    };
  }
}
```

### 3. レート制限との組み合わせ

```typescript
class RateLimitedGuard {
  private guard: PromptGuard;
  private requests = new Map<
    string,
    {
      count: number;
      lastReset: Date;
      riskScore: number;
    }
  >();

  constructor() {
    this.guard = new PromptGuard(PRESETS.STRICT);
  }

  async scanWithRateLimit(
    input: string,
    clientId: string
  ): Promise<{ allowed: boolean; result?: DetectionResult }> {
    const now = new Date();
    const clientData = this.requests.get(clientId) || {
      count: 0,
      lastReset: now,
      riskScore: 0,
    };

    // 1時間ごとにリセット
    if (now.getTime() - clientData.lastReset.getTime() > 3600000) {
      clientData.count = 0;
      clientData.riskScore = 0;
      clientData.lastReset = now;
    }

    // リスクスコアに基づく動的制限
    const maxRequests = this.getMaxRequests(clientData.riskScore);

    if (clientData.count >= maxRequests) {
      return { allowed: false };
    }

    // セキュリティチェック
    const result = await this.guard.scan(input);

    // リクエスト統計の更新
    clientData.count++;
    clientData.riskScore = (clientData.riskScore + result.risk) / 2;

    this.requests.set(clientId, clientData);

    return { allowed: true, result };
  }

  private getMaxRequests(avgRiskScore: number): number {
    if (avgRiskScore > 70) return 10; // 高リスクユーザーは制限
    if (avgRiskScore > 40) return 50; // 中リスクユーザーは一般的な制限
    return 100; // 低リスクユーザーは通常制限
  }
}
```

## ⚡ パフォーマンス最適化

### 1. ガードインスタンスの再利用

```typescript
// ✅ 良い例: シングルトンパターンでガードを再利用
class GuardSingleton {
  private static instance: PromptGuard;

  static getInstance(): PromptGuard {
    if (!GuardSingleton.instance) {
      GuardSingleton.instance = new PromptGuard(PRESETS.BALANCED);
    }
    return GuardSingleton.instance;
  }
}

// 使用例
const guard = GuardSingleton.getInstance();
const result = await guard.scan(input);

// ❌ 悪い例: 毎回新しいインスタンスを作成
async function badScan(input: string) {
  const guard = new PromptGuard(); // パフォーマンス悪化
  return await guard.scan(input);
}
```

### 2. バッチ処理の活用

```typescript
// ✅ 良い例: バッチ処理で効率化
async function processMultipleInputs(
  inputs: string[]
): Promise<DetectionResult[]> {
  const guard = new PromptGuard();

  const batchInputs = inputs.map((content) => ({
    content,
    trust: 'user' as const,
  }));
  return await guard.scanBatch(batchInputs);
}

// ❌ 悪い例: 個別処理
async function badProcessMultiple(
  inputs: string[]
): Promise<DetectionResult[]> {
  const guard = new PromptGuard();
  const results = [];

  for (const input of inputs) {
    // 1つずつ処理 - 非効率
    results.push(await guard.scan(input));
  }

  return results;
}
```

### 3. 適応的な処理モード

```typescript
class AdaptiveGuard {
  private guard: PromptGuard;
  private performanceMetrics = {
    avgProcessingTime: 0,
    totalRequests: 0,
  };

  constructor() {
    this.guard = new PromptGuard({
      ...PRESETS.BALANCED,
      enablePerfMonitoring: true,
    });
  }

  async smartScan(input: string): Promise<DetectionResult> {
    // 短いテキストはクイックスキャン
    if (input.length < 100) {
      const quickResult = this.guard.quickScan(input);
      return {
        input,
        sanitized: input,
        risk: quickResult.risk,
        safe: quickResult.safe,
        matches: [],
        segments: [],
        processingTime: 1,
      };
    }

    // 長いテキストは段階的処理
    if (input.length > 1000) {
      return await this.processLongText(input);
    }

    // 通常の処理
    return await this.guard.scan(input);
  }

  private async processLongText(input: string): Promise<DetectionResult> {
    // 高リスクパターンのみで事前チェック
    const quickCheck = this.guard.quickScan(input.substring(0, 500));

    if (quickCheck.risk > 80) {
      // 高リスクなら全体をスキャン
      return await this.guard.scan(input);
    }

    // 低リスクならサンプリング
    const samples = [
      input.substring(0, 200),
      input.substring(
        Math.floor(input.length / 2),
        Math.floor(input.length / 2) + 200
      ),
      input.substring(input.length - 200),
    ];

    let maxRisk = 0;
    let hasUnsafeContent = false;

    for (const sample of samples) {
      const result = await this.guard.scan(sample);
      maxRisk = Math.max(maxRisk, result.risk);
      if (!result.safe) {
        hasUnsafeContent = true;
      }
    }

    // 必要に応じて全体をスキャン
    if (hasUnsafeContent && maxRisk > 60) {
      return await this.guard.scan(input);
    }

    return {
      input,
      sanitized: input,
      risk: maxRisk,
      safe: !hasUnsafeContent,
      matches: [],
      segments: [],
      processingTime: 10, // 推定値
    };
  }
}
```

## 📊 監視とログ

### 1. 包括的なログシステム

```typescript
class SecurityLogger {
  private guard: PromptGuard;
  private logs: Array<{
    timestamp: Date;
    input: string;
    risk: number;
    action: string;
    clientId?: string;
    sessionId?: string;
  }> = [];

  constructor() {
    this.guard = new PromptGuard({
      ...PRESETS.STRICT,
      enablePerfMonitoring: true,
    });
  }

  async scanAndLog(
    input: string,
    context: {
      clientId?: string;
      sessionId?: string;
      userAgent?: string;
      ip?: string;
    }
  ): Promise<DetectionResult> {
    const result = await this.guard.scan(input);

    // 詳細ログ
    this.logs.push({
      timestamp: new Date(),
      input: input.substring(0, 100), // プライバシー保護のため短縮
      risk: result.risk,
      action: result.safe ? 'allowed' : 'blocked',
      clientId: context.clientId,
      sessionId: context.sessionId,
    });

    // 高リスクイベントのアラート
    if (result.risk > 85) {
      this.sendSecurityAlert({
        risk: result.risk,
        matches: result.matches,
        context,
      });
    }

    // ログローテーション
    if (this.logs.length > 10000) {
      this.rotateLogs();
    }

    return result;
  }

  private sendSecurityAlert(alert: any): void {
    // 実装例: 外部監視システムに送信
    console.warn('🚨 セキュリティアラート:', alert);
  }

  private rotateLogs(): void {
    // 古いログをファイルに保存またはDBに送信
    const oldLogs = this.logs.splice(0, 5000);
    // saveToFile(oldLogs) または saveToDatabase(oldLogs)
  }

  getSecurityReport(hours = 24): {
    totalRequests: number;
    blockedRequests: number;
    averageRisk: number;
    topPatterns: string[];
    suspiciousClients: string[];
  } {
    const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000);
    const recentLogs = this.logs.filter((log) => log.timestamp > cutoff);

    const blocked = recentLogs.filter((log) => log.action === 'blocked');
    const avgRisk =
      recentLogs.reduce((sum, log) => sum + log.risk, 0) / recentLogs.length;

    return {
      totalRequests: recentLogs.length,
      blockedRequests: blocked.length,
      averageRisk: avgRisk || 0,
      topPatterns: [], // パターン分析結果
      suspiciousClients: this.findSuspiciousClients(recentLogs),
    };
  }

  private findSuspiciousClients(logs: any[]): string[] {
    const clientRisks = new Map<string, number[]>();

    for (const log of logs) {
      if (log.clientId) {
        if (!clientRisks.has(log.clientId)) {
          clientRisks.set(log.clientId, []);
        }
        clientRisks.get(log.clientId)!.push(log.risk);
      }
    }

    return Array.from(clientRisks.entries())
      .filter(([_, risks]) => {
        const avgRisk =
          risks.reduce((sum, risk) => sum + risk, 0) / risks.length;
        return avgRisk > 60 && risks.length > 5;
      })
      .map(([clientId]) => clientId);
  }
}
```

### 2. メトリクス収集

```typescript
class MetricsCollector {
  private guard: PromptGuard;
  private metrics = {
    requests: 0,
    blocked: 0,
    avgProcessingTime: 0,
    patternHits: new Map<string, number>(),
  };

  constructor() {
    this.guard = new PromptGuard({
      enablePerfMonitoring: true,
    });
  }

  async trackScan(input: string): Promise<DetectionResult> {
    const startTime = performance.now();
    const result = await this.guard.scan(input);
    const endTime = performance.now();

    // メトリクス更新
    this.metrics.requests++;
    if (!result.safe) {
      this.metrics.blocked++;
    }

    this.metrics.avgProcessingTime =
      (this.metrics.avgProcessingTime * (this.metrics.requests - 1) +
        (endTime - startTime)) /
      this.metrics.requests;

    // パターンヒット数を記録
    for (const match of result.matches) {
      const current = this.metrics.patternHits.get(match.pattern) || 0;
      this.metrics.patternHits.set(match.pattern, current + 1);
    }

    return result;
  }

  getMetrics() {
    return {
      ...this.metrics,
      patternHits: Object.fromEntries(this.metrics.patternHits),
    };
  }

  // Prometheusメトリクス形式での出力
  getPrometheusMetrics(): string {
    const blocked = this.metrics.blocked;
    const total = this.metrics.requests;
    const blockRate = total > 0 ? blocked / total : 0;

    return `
# HELP noren_guard_requests_total Total number of requests processed
# TYPE noren_guard_requests_total counter
noren_guard_requests_total ${total}

# HELP noren_guard_blocked_total Total number of blocked requests
# TYPE noren_guard_blocked_total counter
noren_guard_blocked_total ${blocked}

# HELP noren_guard_block_rate Rate of blocked requests
# TYPE noren_guard_block_rate gauge
noren_guard_block_rate ${blockRate}

# HELP noren_guard_processing_time_avg Average processing time in milliseconds
# TYPE noren_guard_processing_time_avg gauge
noren_guard_processing_time_avg ${this.metrics.avgProcessingTime}
    `.trim();
  }
}
```

## 🔄 継続的改善

### 1. パターンの有効性測定

```typescript
class PatternEffectivenessTracker {
  private patternMetrics = new Map<
    string,
    {
      truePositives: number;
      falsePositives: number;
      totalHits: number;
    }
  >();

  reportFalsePositive(patternId: string): void {
    const metrics = this.patternMetrics.get(patternId) || {
      truePositives: 0,
      falsePositives: 0,
      totalHits: 0,
    };

    metrics.falsePositives++;
    this.patternMetrics.set(patternId, metrics);
  }

  reportTruePositive(patternId: string): void {
    const metrics = this.patternMetrics.get(patternId) || {
      truePositives: 0,
      falsePositives: 0,
      totalHits: 0,
    };

    metrics.truePositives++;
    this.patternMetrics.set(patternId, metrics);
  }

  getPatternReport(): Array<{
    patternId: string;
    precision: number;
    totalHits: number;
    recommendation: string;
  }> {
    return Array.from(this.patternMetrics.entries()).map(
      ([patternId, metrics]) => {
        const precision =
          metrics.totalHits > 0 ? metrics.truePositives / metrics.totalHits : 0;

        let recommendation = '';
        if (precision < 0.5) {
          recommendation = 'パターンの見直しが必要';
        } else if (precision < 0.8) {
          recommendation = 'パターンの調整を推奨';
        } else {
          recommendation = 'パターンは適切';
        }

        return {
          patternId,
          precision,
          totalHits: metrics.totalHits,
          recommendation,
        };
      }
    );
  }
}
```

### 2. 自動調整システム

```typescript
class SelfTuningGuard {
  private guard: PromptGuard;
  private config: GuardConfig;
  private performanceHistory: number[] = [];

  constructor(baseConfig: Partial<GuardConfig>) {
    this.config = { ...PRESETS.BALANCED, ...baseConfig };
    this.guard = new PromptGuard(this.config);
  }

  async adaptiveScan(input: string): Promise<DetectionResult> {
    const result = await this.guard.scan(input);

    // パフォーマンス履歴の更新
    this.performanceHistory.push(result.processingTime);

    // 履歴が十分溜まったら調整
    if (this.performanceHistory.length >= 100) {
      this.autoTune();
      this.performanceHistory = [];
    }

    return result;
  }

  private autoTune(): void {
    const avgTime =
      this.performanceHistory.reduce((sum, time) => sum + time, 0) /
      this.performanceHistory.length;

    // 処理時間が目標を大幅に超えている場合
    if (avgTime > this.config.maxProcessingTime * 1.5) {
      // より寛容な設定に調整
      this.config.riskThreshold = Math.min(90, this.config.riskThreshold + 5);
      this.config.enableContextSeparation = false;

      console.log('パフォーマンス改善のため設定を調整:', {
        newRiskThreshold: this.config.riskThreshold,
        contextSeparation: this.config.enableContextSeparation,
      });
    }
    // 処理時間に余裕がある場合
    else if (avgTime < this.config.maxProcessingTime * 0.5) {
      // より厳格な設定に調整
      this.config.riskThreshold = Math.max(30, this.config.riskThreshold - 5);
      this.config.enableContextSeparation = true;

      console.log('セキュリティ強化のため設定を調整:', {
        newRiskThreshold: this.config.riskThreshold,
        contextSeparation: this.config.enableContextSeparation,
      });
    }

    // ガードを再作成
    this.guard = new PromptGuard(this.config);
  }
}
```

## 🚨 トラブルシューティング

### 一般的な問題と解決策

#### 1. パフォーマンス問題

```typescript
// 問題: 処理が遅い
// 解決策: プリセット変更とバッチ処理

// ❌ 遅い設定
const slowGuard = new PromptGuard({
  enableContextSeparation: true,
  maxProcessingTime: 1000,
  enablePerfMonitoring: true
})

// ✅ 高速設定
const fastGuard = new PromptGuard(PRESETS.PERFORMANCE)

// ✅ バッチ処理で最適化
const inputs = [...] // 大量の入力
const results = await fastGuard.scanBatch(
  inputs.map(content => ({ content, trust: 'user' }))
)
```

#### 2. 偽陽性が多い問題

```typescript
// 問題: 安全なコンテンツがブロックされる
// 解決策: 閾値調整とカスタムパターン

const guard = new PromptGuard({
  riskThreshold: 80, // より寛容に
  customPatterns: [
    // 例外パターンを追加
    {
      id: 'safe_keywords',
      pattern: /legitimate.*instruction|正当な.*指示/gi,
      severity: 'low',
      category: 'exception',
      weight: -50, // 負の重みで安全性を増加
      sanitize: false,
    },
  ],
});
```

#### 3. メモリリーク

```typescript
// 問題: 長時間稼働でメモリ使用量増加
// 解決策: 定期的なクリーンアップ

class MemoryManagedGuard {
  private guard: PromptGuard;
  private requestCount = 0;

  constructor() {
    this.guard = new PromptGuard();
  }

  async scan(input: string): Promise<DetectionResult> {
    const result = await this.guard.scan(input);

    this.requestCount++;

    // 定期的にメトリクスをリセット
    if (this.requestCount % 1000 === 0) {
      this.guard.resetMetrics();

      // ガベージコレクションを促進
      if (global.gc) {
        global.gc();
      }
    }

    return result;
  }
}
```

## 📋 チェックリスト

### 実装前チェックリスト

- [ ] 適切なプリセットを選択した
- [ ] 信頼レベルの設定方針を決めた
- [ ] カスタムパターンの必要性を検討した
- [ ] パフォーマンス要件を確認した
- [ ] ログ・監視の要件を決めた

### デプロイ前チェックリスト

- [ ] 本番環境向けの設定に変更した
- [ ] セキュリティテストを実施した
- [ ] パフォーマンステストを実施した
- [ ] 偽陽性/偽陰性のテストを実施した
- [ ] 監視・アラートを設定した
- [ ] ログローテーションを設定した
- [ ] エラーハンドリングを実装した

### 運用中チェックリスト

- [ ] 定期的なセキュリティレポートを確認している
- [ ] パターンの有効性を監視している
- [ ] パフォーマンスメトリクスを監視している
- [ ] ユーザーフィードバックを収集している
- [ ] 設定の最適化を定期的に実施している

---

これらのベストプラクティスに従うことで、Noren Guard を効果的かつ安全に運用できます。実装時は段階的に導入し、継続的に改善していくことが重要です。
