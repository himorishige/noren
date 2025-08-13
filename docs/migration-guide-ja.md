# Noren v0.2.0 マイグレーションガイド

## 概要

Noren v0.1.x から v0.2.0 への移行ガイドです。v0.2.0では高度な検出機能とパフォーマンス最適化が追加されましたが、既存のAPIとの後方互換性は維持されています。

## 主な変更点

### 新機能
- 🎯 **信頼度スコアリング**: PIIの検出精度を数値化
- 🧠 **コンテキスト認識**: サンプルデータの自動識別
- 📊 **パフォーマンス測定**: ベンチマークとメトリクス収集
- 🧪 **A/Bテスト**: 設定の自動最適化
- 🔄 **継続的改善**: データ駆動の設定改善

### 破壊的変更
なし（完全な後方互換性を維持）

## 段階的移行プラン

### ステップ1: 基本的なアップグレード（影響なし）

```bash
# パッケージの更新
npm update @himorishige/noren-core
# または
pnpm update @himorishige/noren-core
```

既存のコードはそのまま動作します：

```javascript
// v0.1.x のコード（変更不要）
import { Registry } from '@himorishige/noren-core'

const registry = new Registry({
  defaultAction: 'mask'
})

const result = await registry.detect(text)
// 従来通り動作
```

### ステップ2: 信頼度スコアリングの有効化

```javascript
// 最小限の変更で信頼度スコアを活用
const registry = new Registry({
  defaultAction: 'mask',
  enableConfidenceScoring: true,  // 追加
  sensitivity: 'balanced'          // 追加（オプション）
})

const result = await registry.detect(text)
// result.hits[0].confidence が利用可能に
```

#### 移行前後の比較

**Before (v0.1.x)**:
```javascript
const result = await registry.detect(text)
for (const hit of result.hits) {
  // 全ての検出を一律に処理
  console.log(`Found: ${hit.type}`)
}
```

**After (v0.2.0)**:
```javascript
const result = await registry.detect(text)
for (const hit of result.hits) {
  // 信頼度に基づいた処理
  if (hit.confidence > 0.7) {
    console.log(`High confidence: ${hit.type}`)
  } else {
    console.log(`Low confidence: ${hit.type} (needs review)`)
  }
}
```

### ステップ3: コンテキスト認識の導入

```javascript
// サンプルデータの誤検出を防ぐ
const registry = new Registry({
  defaultAction: 'mask',
  enableConfidenceScoring: true,
  enableContextualConfidence: true,     // 追加
  contextualSuppressionEnabled: true    // 追加
})

// APIドキュメントなどでサンプルデータを自動識別
const apiDoc = `
Example request:
{
  "email": "user@example.com"  // これは検出されない
}
`
const result = await registry.detect(apiDoc)
```

#### 設定の段階的調整

```javascript
// Phase 1: 保守的な設定から開始
const phase1Registry = new Registry({
  enableContextualConfidence: true,
  contextualSuppressionEnabled: true,
  contextualBoostEnabled: false  // ブーストは無効
})

// Phase 2: モニタリング後、ブーストを有効化
const phase2Registry = new Registry({
  enableContextualConfidence: true,
  contextualSuppressionEnabled: true,
  contextualBoostEnabled: true   // 実データの検出を強化
})
```

### ステップ4: パフォーマンス測定の追加

```javascript
import { 
  InMemoryMetricsCollector, 
  setMetricsCollector 
} from '@himorishige/noren-core'

// メトリクス収集を有効化
const metricsCollector = new InMemoryMetricsCollector()
setMetricsCollector(metricsCollector)

// 通常通り使用
const result = await registry.detect(text)

// メトリクスを取得
const metrics = metricsCollector.getMetrics()
console.log(`Average detection time: ${metrics.performance.avg_duration_ms}ms`)
console.log(`Total PIIs detected: ${metrics.accuracy.total_hits}`)
```

### ステップ5: A/Bテストによる最適化

```javascript
import { ABTestEngine, AB_TEST_SCENARIOS } from '@himorishige/noren-core'

// 既存設定と新設定を比較
const engine = new ABTestEngine()

const testConfig = {
  test_name: 'Production Optimization',
  variants: [
    {
      id: 'current',
      name: 'Current Production',
      description: '現在の本番設定',
      registryFactory: () => new Registry(currentConfig)
    },
    {
      id: 'optimized',
      name: 'Optimized Config',
      description: '最適化候補',
      registryFactory: () => new Registry({
        ...currentConfig,
        enableContextualConfidence: true
      })
    }
  ],
  sample_size_per_variant: 100,
  confidence_level: 0.95,
  minimum_effect_size: 0.1,
  benchmark_config: {
    iterations: 100,
    warmup_iterations: 10,
    text_sizes: [5000],
    pii_densities: [15]
  }
}

const result = await engine.runABTest(testConfig)

if (result.winner) {
  console.log(`Better configuration found: ${result.winner.variant_id}`)
  console.log(`Improvement: ${result.winner.improvement_percentage}%`)
}
```

## 環境別の推奨設定

### 開発環境

```javascript
// 開発環境: デバッグと検出漏れ防止を優先
const devRegistry = new Registry({
  defaultAction: 'mask',
  environment: 'development',
  enableConfidenceScoring: true,
  sensitivity: 'high',  // 低い閾値で多く検出
  enableContextualConfidence: false  // 全て検出して確認
})
```

### ステージング環境

```javascript
// ステージング: 本番に近い設定でテスト
const stagingRegistry = new Registry({
  defaultAction: 'mask',
  environment: 'staging',
  enableConfidenceScoring: true,
  sensitivity: 'balanced',
  enableContextualConfidence: true,
  contextualSuppressionEnabled: true,
  contextualBoostEnabled: false  // 保守的に
})
```

### 本番環境

```javascript
// 本番: 精度と性能のバランス
const prodRegistry = new Registry({
  defaultAction: 'mask',
  environment: 'production',
  enableConfidenceScoring: true,
  sensitivity: 'low',  // 高信頼度のみ
  enableContextualConfidence: true,
  contextualSuppressionEnabled: true,
  contextualBoostEnabled: true,
  confidenceThreshold: 0.6
})
```

## トラブルシューティング

### Q1: アップグレード後、検出数が減った

**原因**: コンテキスト認識によりサンプルデータが除外されている

**解決策**:
```javascript
// 一時的に無効化して確認
const registry = new Registry({
  enableContextualConfidence: false  // 無効化
})

// または、ログで確認
const result = await registry.detect(text)
for (const hit of result.hits) {
  if (hit.reasons?.includes('contextual:example-marker-strong')) {
    console.log('サンプルデータとして抑制:', hit.value)
  }
}
```

### Q2: パフォーマンスが遅くなった

**原因**: コンテキスト認識の処理オーバーヘッド

**解決策**:
```javascript
// パフォーマンス重視の設定
const fastRegistry = new Registry({
  defaultAction: 'mask',
  enableConfidenceScoring: false,  // 無効化
  enableContextualConfidence: false,  // 無効化
  contextHints: []  // ヒント処理も最小化
})

// または、選択的に有効化
const balancedRegistry = new Registry({
  defaultAction: 'mask',
  enableConfidenceScoring: true,  // これは軽量
  enableContextualConfidence: false  // これが重い
})
```

### Q3: 信頼度スコアの調整方法

```javascript
// カスタム閾値の設定
const customRegistry = new Registry({
  defaultAction: 'mask',
  enableConfidenceScoring: true,
  confidenceThreshold: 0.75,  // カスタム閾値
  sensitivity: undefined  // プリセットを使わない
})

// または、検出後にフィルタ
const result = await registry.detect(text)
const highConfidenceHits = result.hits.filter(hit => hit.confidence > 0.8)
```

## パフォーマンス比較

| 設定 | 相対速度 | メモリ使用量 | 検出精度 |
|------|----------|--------------|----------|
| v0.1.x デフォルト | 100% (基準) | 100% | 75% |
| v0.2.0 デフォルト（互換） | 100% | 100% | 75% |
| 信頼度スコアリング有効 | 95% | 105% | 85% |
| コンテキスト認識有効 | 60% | 120% | 92% |
| フル機能有効 | 40% | 130% | 95% |

## ベストプラクティス

### 1. 段階的な有効化

```javascript
// Week 1: ベースライン測定
const week1 = new Registry({ defaultAction: 'mask' })

// Week 2: 信頼度スコアリング
const week2 = new Registry({
  defaultAction: 'mask',
  enableConfidenceScoring: true
})

// Week 3: コンテキスト認識（抑制のみ）
const week3 = new Registry({
  defaultAction: 'mask',
  enableConfidenceScoring: true,
  enableContextualConfidence: true,
  contextualSuppressionEnabled: true,
  contextualBoostEnabled: false
})

// Week 4: フル機能
const week4 = new Registry({
  defaultAction: 'mask',
  enableConfidenceScoring: true,
  enableContextualConfidence: true,
  contextualSuppressionEnabled: true,
  contextualBoostEnabled: true
})
```

### 2. モニタリングの設定

```javascript
// メトリクス収集とアラート
const collector = new InMemoryMetricsCollector()
setMetricsCollector(collector)

// 定期的なチェック
setInterval(() => {
  const metrics = collector.getMetrics()
  
  // パフォーマンス警告
  if (metrics.performance.p95_duration_ms > 100) {
    console.warn('Performance degradation detected')
  }
  
  // 精度チェック
  if (metrics.accuracy.false_positive_rate > 0.1) {
    console.warn('High false positive rate')
  }
  
  collector.reset() // リセット
}, 60000) // 1分ごと
```

### 3. A/Bテストの活用

```javascript
// 月次の最適化サイクル
async function monthlyOptimization() {
  const currentConfig = getCurrentProductionConfig()
  
  // 自動的に改善案を生成
  const variants = VariantGenerator.generateExploratoryVariants(
    () => new Registry(currentConfig)
  )
  
  // A/Bテスト実行
  const result = await engine.runABTest({
    variants,
    sample_size_per_variant: 1000,
    confidence_level: 0.95
  })
  
  // 改善があれば適用
  if (result.winner && result.winner.improvement_percentage > 10) {
    await deployNewConfiguration(result.winner.variant_id)
  }
}
```

## サポート

- **ドキュメント**: https://github.com/himorishige/noren/docs
- **Issues**: https://github.com/himorishige/noren/issues
- **Discussions**: https://github.com/himorishige/noren/discussions

## まとめ

v0.2.0へのアップグレードは：
- ✅ **後方互換性完全維持** - 既存コードの変更不要
- ✅ **段階的導入可能** - 機能を一つずつ有効化
- ✅ **測定可能な改善** - メトリクスで効果を確認
- ✅ **リスク管理** - A/Bテストで安全に最適化

必要に応じて新機能を活用し、組織のニーズに合わせて調整してください。