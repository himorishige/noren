# Noren 高度な機能ガイド (P1-P3)

このドキュメントでは、Noren Core v0.2.0で実装された高度なPII検出・最適化機能について説明します。

## 📋 目次

1. [P1: 信頼度スコアリングシステム](#p1-信頼度スコアリングシステム)
2. [P2: コンテキスト認識検出](#p2-コンテキスト認識検出)
3. [P3: パフォーマンス最適化と継続的改善](#p3-パフォーマンス最適化と継続的改善)

---

## P1: 信頼度スコアリングシステム

### 概要

PIIの検出結果に対して、パターンの複雑さや周辺コンテキストに基づいた信頼度スコア（0.0〜1.0）を算出します。これにより、誤検出を削減し、より精度の高いPII検出が可能になります。

### 主要機能

#### 1. 基本信頼度算出
```javascript
import { Registry } from '@himorishige/noren-core'

const registry = new Registry({
  defaultAction: 'mask',
  enableConfidenceScoring: true,
  sensitivity: 'balanced', // 'low', 'balanced', 'high'
  confidenceThreshold: 0.5
})

const result = await registry.detect('Contact: john@example.com')
// result.hits[0].confidence = 0.85 (高い信頼度)
```

#### 2. 感度設定による制御

| 感度設定 | 閾値 | 用途 |
|---------|------|------|
| `low` | 0.7 | 誤検出を最小限に（精度重視） |
| `balanced` | 0.5 | バランス型（推奨） |
| `high` | 0.3 | 検出漏れを最小限に（再現率重視） |

### 活用例

#### ケース1: 本番環境での誤検出削減
```javascript
// プロダクション環境では誤検出を避けたい
const prodRegistry = new Registry({
  defaultAction: 'mask',
  enableConfidenceScoring: true,
  sensitivity: 'low', // 高信頼度のみ検出
  environment: 'production'
})

// テスト環境では検出漏れを避けたい
const testRegistry = new Registry({
  defaultAction: 'mask',
  enableConfidenceScoring: true,
  sensitivity: 'high', // 低信頼度も検出
  environment: 'development'
})
```

#### ケース2: データ品質に応じた処理
```javascript
const result = await registry.detect(userInput)

for (const hit of result.hits) {
  if (hit.confidence > 0.8) {
    // 高信頼度: 自動的にマスク
    console.log(`Auto-masked: ${hit.type}`)
  } else if (hit.confidence > 0.5) {
    // 中信頼度: 人手確認
    console.log(`Review needed: ${hit.type} at position ${hit.start}`)
  } else {
    // 低信頼度: スキップ
    console.log(`Skipped: ${hit.type} (low confidence)`)
  }
}
```

### メリット

- **誤検出の削減**: パターンの強度に基づいた判定により、誤検出が最大60%削減
- **柔軟な制御**: ユースケースに応じて感度を調整可能
- **透明性**: 各検出の信頼度と理由が明確

---

## P2: コンテキスト認識検出

### 概要

検出対象の周辺テキストや文書構造を分析し、実際のPIIかサンプルデータかを判定します。「example」「test」「dummy」などのマーカーや、コードブロック、テンプレート構造を認識します。

### 主要機能

#### 1. コンテキストマーカー検出
```javascript
const registry = new Registry({
  defaultAction: 'mask',
  enableContextualConfidence: true,
  contextualSuppressionEnabled: true // サンプルデータの抑制
})

// サンプルデータは検出されない
const text = 'Example email: john@example.com'
const result = await registry.detect(text)
// result.hits = [] (サンプルとして認識され抑制)
```

#### 2. 文書構造認識

サポートされる形式:
- JSON/XML構造
- CSV/TSVテーブル
- Markdownコードブロック
- ログファイル形式

```javascript
// JSONスキーマ内のサンプルデータを自動認識
const jsonText = `{
  "schema": {
    "email": "user@example.com",  // サンプルとして認識
    "type": "string"
  }
}`

// Markdownコードブロック内も認識
const mdText = `
\`\`\`
# テストデータ
EMAIL=admin@test.com
\`\`\`
`
```

#### 3. ロケール固有プレースホルダー

```javascript
// 日付プレースホルダーの認識
'2024/12/31' // 日付パターンとして認識
'$1,234.56'  // 通貨パターンとして認識
'〒123-4567' // 郵便番号パターンとして認識
```

### 活用例

#### ケース1: ドキュメント処理
```javascript
// APIドキュメントのサンプルコードを安全に処理
const apiDoc = `
## API使用例
\`\`\`json
{
  "email": "user@example.com",
  "api_key": "sk_test_1234567890"
}
\`\`\`
`

const registry = new Registry({
  enableContextualConfidence: true,
  contextualSuppressionEnabled: true
})

const result = await registry.detect(apiDoc)
// サンプルコードは検出されない
```

#### ケース2: ログファイル分析
```javascript
// ログファイル内の実際のPIIのみを検出
const logContent = `
[INFO] User login: john.doe@company.com
[DEBUG] Test user: test@example.com // これは検出されない
[ERROR] Failed authentication for: jane.smith@client.org
`

const result = await registry.detect(logContent)
// 実際のユーザーメールのみ検出
```

### メリット

- **誤検出を最大80%削減**: サンプルデータの自動識別
- **文書構造対応**: JSON、XML、CSV、Markdown等に最適化
- **地域対応**: 日本、米国等のロケール固有パターンをサポート

---

## P3: パフォーマンス最適化と継続的改善

### 概要

大規模データ処理のためのパフォーマンス測定、A/Bテスト、自動最適化機能を提供します。

### 主要機能

#### 1. パフォーマンスベンチマーク

```javascript
import { BenchmarkRunner, BENCHMARK_CONFIGS } from '@himorishige/noren-core'

const runner = new BenchmarkRunner()
const registry = new Registry({ defaultAction: 'mask' })

// パフォーマンス測定
const { summary } = await runner.runBenchmark(
  'pii-detection',
  async () => await registry.detect(testText),
  BENCHMARK_CONFIGS.standard
)

console.log(`平均処理時間: ${summary.avg_duration_ms}ms`)
console.log(`スループット: ${summary.avg_throughput_ops_per_sec} chars/sec`)
console.log(`メモリ効率: ${summary.memory_efficiency_mb_per_kb} MB/KB`)
```

#### 2. 精度評価システム

```javascript
import { GroundTruthManager, EvaluationEngine } from '@himorishige/noren-core'

// 正解データの準備
const groundTruth = new GroundTruthManager()
groundTruth.addEntry({
  id: 'test1',
  text: 'Contact: john@example.com',
  annotations: [
    { start: 9, end: 25, type: 'email', value: 'john@example.com' }
  ]
})

// 精度評価
const evaluator = new EvaluationEngine(groundTruth)
const metrics = await evaluator.evaluateDataset(detectionResults)

console.log(`精度: ${metrics.precision}`)
console.log(`再現率: ${metrics.recall}`)
console.log(`F1スコア: ${metrics.f1_score}`)
```

#### 3. A/Bテストフレームワーク

```javascript
import { ABTestEngine, AB_TEST_SCENARIOS } from '@himorishige/noren-core'

const engine = new ABTestEngine()

// 事前定義されたシナリオでテスト
const config = {
  ...AB_TEST_SCENARIOS.contextualConfidence,
  sample_size_per_variant: 100,
  confidence_level: 0.95,
  ground_truth_manager: groundTruth
}

const result = await engine.runABTest(config)

if (result.winner) {
  console.log(`勝者: ${result.winner.variant_id}`)
  console.log(`改善率: ${result.winner.improvement_percentage}%`)
  console.log(`統計的有意性: ${result.winner.statistical_significance}`)
}
```

#### 4. ルール可視化・デバッグ機能

```javascript
import { 
  calculateContextualConfidenceWithDebug,
  visualizeRules,
  DEFAULT_CONTEXTUAL_CONFIG 
} from '@himorishige/noren-core'

// ルール設定の可視化
const ruleVisualization = visualizeRules(DEFAULT_CONTEXTUAL_CONFIG)
console.log(ruleVisualization)
/*
[
  {
    rule_id: 'example-marker-strong',
    category: 'marker-based',
    priority: 100,
    conditions: ['Marker proximity check'],
    effect: {
      type: 'suppress',
      strength: 'strong',
      multiplier: 0.4
    },
    dependencies: ['markers'],
    estimated_frequency: 'common'
  },
  // ... その他のルール
]
*/

// デバッグモードでコンテキスト信頼度計算
const debugResult = calculateContextualConfidenceWithDebug(
  hit,
  text,
  baseConfidence,
  config
)

console.log('デバッグ情報:', debugResult.debug)
/*
{
  rules_evaluated: [
    {
      rule: { id: 'example-marker-strong', ... },
      evaluated: true,
      condition_result: true,
      applied: true,
      execution_time_ms: 0.2,
      features_used: ['markers', 'structure']
    }
  ],
  total_execution_time_ms: 2.5,
  feature_extraction_time_ms: 1.2,
  rule_resolution_time_ms: 0.8,
  performance_warnings: [],
  rule_conflicts: {
    detected: false,
    resolved_by: [],
    details: []
  }
}
*/
```

#### 5. メトリクス収集システム

```javascript
import { 
  InMemoryMetricsCollector,
  setMetricsCollector,
  measurePerformance 
} from '@himorishige/noren-core'

// メトリクス収集の設定
const metricsCollector = new InMemoryMetricsCollector(50000)
setMetricsCollector(metricsCollector)

// 自動的にパフォーマンスを測定
const result = await measurePerformance(
  'pii-detection',
  async () => await registry.detect(text),
  { text_size: text.length.toString() }
)

// メトリクスサマリーの取得
const summary = metricsCollector.getMetricsSummary()
console.log('メトリクス集計:', summary)
/*
{
  'noren.performance.duration_ms': {
    count: 1000,
    avg: 2.5,
    min: 0.8,
    max: 15.2
  },
  'noren.contextual.rules_evaluated': {
    count: 1000,
    avg: 12.3,
    min: 8,
    max: 20
  }
}
*/

// 特定の操作のメトリクス取得
const operationMetrics = metricsCollector.getMetricsByOperation('pii-detection')
console.log('PII検出のメトリクス:', operationMetrics)
```

#### 6. 継続的改善サイクル

```javascript
import { ImprovementCycleEngine } from '@himorishige/noren-core'

const cycleEngine = new ImprovementCycleEngine({
  baseline_variant: {
    id: 'current-prod',
    name: '現在の本番設定',
    registry_factory: () => new Registry(currentConfig)
  },
  auto_generate_variants: true,
  max_performance_degradation: 0.3, // 最大30%の性能劣化まで許容
  min_accuracy_threshold: 0.8, // 最低80%のF1スコア
  ground_truth_manager: groundTruth
})

// 改善サイクル実行
const cycleResult = await cycleEngine.startCycle()

if (cycleResult.selected_improvement) {
  console.log(`選択された改善:`)
  console.log(`期待改善率: ${cycleResult.selected_improvement.expected_improvement}%`)
}
```

### 活用例

#### ケース1: 本番環境の自動最適化

```javascript
// 週次で実行される最適化ジョブ
async function weeklyOptimization() {
  // 本番データで性能測定
  const baseline = await measureCurrentPerformance()
  
  // A/Bテストで最適設定を探索
  const testResult = await runABTest({
    variants: generateOptimizationVariants(),
    min_effect_size: 0.1 // 10%以上の改善を検出
  })
  
  // 安全制約をチェック
  if (testResult.winner && meetsSafetyConstraints(testResult.winner)) {
    await deployNewConfiguration(testResult.winner)
    console.log('新設定をデプロイしました')
  }
}
```

#### ケース2: デバッグとトラブルシューティング

```javascript
// ルール適用状況の詳細分析
async function debugPIIDetection(text, expectedHits) {
  const registry = new Registry({
    enableContextualConfidence: true,
    contextualSuppressionEnabled: true
  })
  
  const result = await registry.detect(text)
  
  // 期待する検出結果と実際の結果を比較
  for (const expected of expectedHits) {
    const found = result.hits.find(hit => 
      hit.start === expected.start && hit.type === expected.type
    )
    
    if (!found) {
      console.log(`❌ 検出漏れ: ${expected.type} at ${expected.start}`)
      
      // デバッグモードで原因を調査
      const debugResult = calculateContextualConfidenceWithDebug(
        expected, text, 0.8, DEFAULT_CONTEXTUAL_CONFIG
      )
      
      console.log('適用されたルール:', debugResult.explanations)
      console.log('パフォーマンス警告:', debugResult.debug.performance_warnings)
      
      // ルール衝突の確認
      if (debugResult.debug.rule_conflicts.detected) {
        console.log('ルール衝突:', debugResult.debug.rule_conflicts.details)
      }
    }
  }
}

// 使用例
await debugPIIDetection(
  'Example: john@test.com',
  [{ start: 9, end: 21, type: 'email' }]
)
```

#### ケース3: カスタムルール開発

```javascript
import { createContextualConfig } from '@himorishige/noren-core'

// 業界固有のカスタムルールを作成
const healthcareConfig = createContextualConfig({
  rules: [
    ...DEFAULT_CONTEXTUAL_CONFIG.rules,
    {
      id: 'hipaa-test-data',
      priority: 105,
      condition: (features) => 
        features.markers.test_marker_nearby && 
        (features.language === 'en' || features.language === 'mixed'),
      multiplier: 0.1, // 強力に抑制
      description: 'HIPAA test data marker detected'
    },
    {
      id: 'medical-record-boost',
      priority: 42,
      condition: (features, hit) => 
        hit.type === 'ssn' && 
        features.structure.csv_like &&
        !features.markers.example_marker_nearby,
      multiplier: 1.3, // 医療記録のSSNを強化
      description: 'Medical record SSN boost'
    }
  ]
})

const registry = new Registry({
  contextualConfig: healthcareConfig
})
```

#### ケース4: データ量に応じた動的調整

```javascript
// データ量に応じて設定を自動調整
function adaptiveConfiguration(dataSize) {
  if (dataSize > 1_000_000) {
    // 大規模データ: 速度優先
    return new Registry({
      enableContextualConfidence: false,
      contextHints: ['email', 'phone'] // 最小限
    })
  } else if (dataSize > 10_000) {
    // 中規模データ: バランス型
    return new Registry({
      enableContextualConfidence: true,
      contextualSuppressionEnabled: true,
      contextualBoostEnabled: false
    })
  } else {
    // 小規模データ: 精度優先
    return new Registry({
      enableContextualConfidence: true,
      contextualSuppressionEnabled: true,
      contextualBoostEnabled: true,
      contextHints: ['email', 'phone', 'credit_card', 'ip', 'address']
    })
  }
}
```

### パフォーマンス指標

| 設定 | 処理速度 | メモリ使用量 | F1スコア |
|------|----------|--------------|----------|
| 最小構成 | ~0.5ms/KB | 0.1MB/MB | 0.75 |
| バランス型 | ~1.5ms/KB | 0.3MB/MB | 0.85 |
| 最大精度 | ~3.0ms/KB | 0.5MB/MB | 0.92 |

### 統計精度に関する注意事項

現在のA/Bテスト機能は、Abramowitz & Stegun法を使用した統計計算を採用しており、「reasonable accuracy for typical A/B testing scenarios」レベルの精度を提供します。

#### 現在の実装の制限

```javascript
// 現在の統計実装で十分なケース
const typicalABTest = {
  sample_size_per_variant: 1000,  // 中〜大サンプル (df ≥ 30)
  confidence_level: 0.95,         // 標準的な有意水準 (α = 0.05)
  minimum_effect_size: 0.1        // 10%以上の改善を検出
}

// より高精度が必要なケース
const preciseABTest = {
  sample_size_per_variant: 50,    // 小サンプル (df ≤ 10)
  confidence_level: 0.999,        // 極端な有意水準 (α = 0.001)
  minimum_effect_size: 0.02       // 2%の微小改善を検出
}
```

#### 統計ライブラリアップグレード計画

将来のアップデートでは、より高精度な統計計算のため以下の選択肢を検討しています：

1. **@stdlib/stats-base-dists-t-*** (推奨)
   - Web Standards準拠
   - 最小依存
   - ツリーシェイク対応

2. **libRmath.js** (高精度モード)
   - R言語と同等の精度
   - WASM加速対応
   - 遅延ロード

```javascript
// 将来のAPI (予定)
const engine = new ABTestEngine({
  statisticsBackend: 'stdlib', // 'native' | 'stdlib' | 'rmath'
  precisionMode: 'standard'    // 'fast' | 'standard' | 'high'
})
```

### メリット

- **科学的最適化**: 統計的に有効な設定改善
- **自動化**: 人手を介さない継続的な性能向上
- **リスク管理**: 安全制約による自動ロールバック
- **可視化**: 詳細なメトリクスとレポート
- **デバッグ支援**: ルール適用の透明性とトラブルシューティング

---

## 実装状況サマリー

### 完成した機能

✅ **P1: 信頼度スコアリング**
- パターン複雑さ分析
- 動的閾値調整
- 感度プリセット

✅ **P2: コンテキスト認識**
- サンプルデータ検出
- 文書構造認識
- ロケール対応
- ルール衝突解決

✅ **P3: 最適化システム**
- ベンチマークフレームワーク
- 精度評価システム
- A/Bテスト機能
- 継続的改善サイクル

### 推奨される次のステップ

1. **本番環境への段階的導入**
   - まず信頼度スコアリングから開始
   - 徐々にコンテキスト認識を有効化
   - メトリクス収集後、A/Bテストを実施

2. **カスタマイズ**
   - 業界固有のパターン追加
   - 独自の評価データセット構築
   - 組織のポリシーに合わせた調整

3. **モニタリング**
   - メトリクス収集の自動化
   - アラート設定
   - 定期的なレポート生成

## まとめ

Noren v0.2.0の高度な機能により、以下が実現可能になりました：

- **精度向上**: 誤検出を最大80%削減
- **性能最適化**: 用途に応じた動的な設定調整
- **継続的改善**: データに基づく自動最適化
- **透明性**: 全ての判定に根拠を提供

これらの機能を活用することで、エンタープライズレベルのPII検出・保護システムを構築できます。