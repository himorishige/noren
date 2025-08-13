# 統計ライブラリ評価レポート

## 概要

Noren Core v0.2.0のA/Bテスト機能における統計計算の精度向上を目的として、現在の自前実装と候補ライブラリの評価を行う。

## 現在の実装（Abramowitz & Stegun法）

### 実装状況
- **ファイル**: `packages/noren-core/src/ab-testing.ts`
- **手法**: Abramowitz & Stegun近似法
- **対象分布**: Student's t分布、正規分布、不完全ベータ関数
- **精度レベル**: "reasonable accuracy for typical A/B testing scenarios"

### 実装詳細
```typescript
// t分布p値計算（簡略版）
private static approximateTDistributionPValue(t: number, df: number): number {
  const absT = Math.abs(t)
  
  // 大自由度では正規分布近似
  if (df > 100) {
    return this.approximateNormalCDF(-absT)
  }
  
  // Abramowitz & Stegun法による改良近似
  if (absT < 0.5) {
    const tSquared = absT * absT
    const beta = this.incompleteBeta(0.5, df / 2, df / (df + tSquared))
    return beta / 2
  }
  
  const x = df / (df + absT * absT)
  const beta = this.incompleteBeta(df / 2, 0.5, x)
  return beta / 2
}
```

### 適用範囲と制限
| パラメータ | 現在の実装で十分 | より高精度が必要 |
|-----------|------------------|------------------|
| サンプルサイズ | 1000+ per variant (df ≥ 30) | <100 per variant (df ≤ 10) |
| 有意水準 | α = 0.05, 0.01 | α = 0.001以下 |
| 効果サイズ | >10%の改善検出 | <5%の微小改善検出 |
| 逆関数利用 | 閾値判定のみ | 頻繁な臨界値計算 |

### メリット
- ✅ Web Standards準拠（ブラウザ・Node.js両対応）
- ✅ 依存関係なし
- ✅ 軽量（~500行のコード）
- ✅ 典型的なA/Bテストでは実用レベル

### デメリット
- ❌ 小標本での精度不足
- ❌ 極端な尾確率での丸め誤差
- ❌ 逆関数（quantile）の近似精度
- ❌ 将来の機能拡張（多重比較、逐次解析）に対する制約

## 候補ライブラリ評価

### 1. @stdlib/stats-base-dists-t-* (推奨)

#### 基本情報
- **CDFパッケージ**: `@stdlib/stats-base-dists-t-cdf`
- **Quantileパッケージ**: `@stdlib/stats-base-dists-t-quantile`
- **最新版**: 0.2.2 (3ヶ月前更新)
- **ライセンス**: Apache-2.0

#### Web Standards対応
```javascript
// ESモジュール (ブラウザ向け)
import tcdf from '@stdlib/stats-base-dists-t-cdf';
import tquantile from '@stdlib/stats-base-dists-t-quantile';

// UMD形式 (Universal Module Definition)
// Observable、ブラウザ、Node.js環境で利用可能

// Deno対応
// 専用ブランチでDeno環境向けビルドあり
```

#### API例
```javascript
// CDF計算
const pValue = tcdf(tStatistic, degreesOfFreedom);

// 逆関数（quantile）計算
const criticalValue = tquantile(0.025, degreesOfFreedom); // 両側5%

// ファクトリー関数
const tCDF_df10 = tcdf.factory(10);
const p1 = tCDF_df10(2.0);
const p2 = tCDF_df10(3.0);
```

#### メリット
- ✅ Web Standards準拠（ブラウザ・Node.js対応）
- ✅ 最小依存（必要な関数のみ導入可能）
- ✅ ツリーシェイク対応
- ✅ 正則化不完全ベータ関数による安定実装
- ✅ Rライブラリと同等の数値結果
- ✅ 活発な開発・メンテナンス

#### デメリット
- ❌ パッケージサイズの増加（~100KB per function）
- ❌ 追加依存関係の管理

#### 移行プラン
```typescript
// Phase 1: オプショナル導入
interface StatisticsEngine {
  tcdf(t: number, df: number): number;
  tquantile(p: number, df: number): number;
}

class StdlibEngine implements StatisticsEngine {
  async tcdf(t: number, df: number): Promise<number> {
    const { default: tcdf } = await import('@stdlib/stats-base-dists-t-cdf');
    return tcdf(t, df);
  }
  
  async tquantile(p: number, df: number): Promise<number> {
    const { default: tquantile } = await import('@stdlib/stats-base-dists-t-quantile');
    return tquantile(p, df);
  }
}

// Phase 2: 設定可能なエンジン
const abTestEngine = new ABTestEngine({
  statisticsBackend: 'stdlib' // 'native' | 'stdlib' | 'rmath'
});
```

### 2. libRmath.js (高精度モード)

#### 基本情報
- **リポジトリ**: [R-js/libRmath.js](https://github.com/R-js/libRmath.js)
- **実装**: R言語のlibRmathをJavaScript/WASMに移植
- **精度**: R言語と同等（最高レベル）

#### 対応範囲
- Student's t分布（中心・非中心）
- 正規分布、F分布、カイ二乗分布等
- WASM加速対応

#### メリット
- ✅ R言語と同等の最高精度
- ✅ 非中心分布対応（検出力分析）
- ✅ 統計パッケージとの互換性
- ✅ ブラウザ対応（ESM形式）

#### デメリット
- ❌ 大きなバンドルサイズ（~1MB+）
- ❌ WASM要件（IE11非対応）
- ❌ 複雑な初期化プロセス

#### 適用場面
- 小標本・極端な有意水準での検定
- 検出力分析・サンプルサイズ設計
- 研究・学術用途での高精度要求

### 3. 純JavaScript統計ライブラリ

#### jStat
- **特徴**: 包括的な統計ライブラリ
- **問題**: 一部APIの精度に注記あり
- **サイズ**: ~200KB

#### simple-statistics
- **特徴**: 軽量・シンプル
- **問題**: t分布カバレッジが限定的
- **サイズ**: ~50KB

#### w-distributions (WASM)
- **特徴**: Cephes数学ライブラリベース
- **問題**: メンテナンス状況要確認
- **サイズ**: ~300KB

## 推奨する導入計画

### Phase 1: 最小インパクト導入（即座）
```typescript
// 1. 統計エンジンインターフェース作成
interface StatisticsBackend {
  name: string;
  tcdf(t: number, df: number): Promise<number>;
  tquantile(p: number, df: number): Promise<number>;
}

// 2. 既存実装をフォールバックとして保持
class NativeStatisticsBackend implements StatisticsBackend {
  name = 'native';
  async tcdf(t: number, df: number): Promise<number> {
    return StatisticalAnalysis.approximateTDistributionPValue(t, df);
  }
  // ... 既存実装
}

// 3. stdlib導入（オプショナル）
class StdlibStatisticsBackend implements StatisticsBackend {
  name = 'stdlib';
  // 動的インポートで必要時のみロード
}
```

### Phase 2: 設定可能なエンジン化（1-2週間後）
```typescript
const abTestConfig = {
  statisticsBackend: 'stdlib', // 'native' | 'stdlib'
  fallbackToNative: true,       // エラー時の自動フォールバック
  precisionMode: 'standard'     // 'fast' | 'standard' | 'high'
};
```

### Phase 3: 高精度モード追加（将来）
```typescript
// 必要時のみlibRmath.jsを遅延ロード
class RmathStatisticsBackend implements StatisticsBackend {
  name = 'rmath';
  private rmathModule?: any;
  
  async initializeWASM() {
    if (!this.rmathModule) {
      this.rmathModule = await import('libRmath.js');
    }
  }
}
```

## 検証計画

### 1. 精度検証ハーネス
```typescript
interface AccuracyTestCase {
  name: string;
  t_statistic: number;
  degrees_of_freedom: number;
  expected_p_value: number; // R言語の pt() 関数による参照値
  tolerance: number;
}

const testCases: AccuracyTestCase[] = [
  // 典型的なケース
  { name: 'typical_case', t_statistic: 2.0, degrees_of_freedom: 30, expected_p_value: 0.02733, tolerance: 1e-4 },
  // 小標本
  { name: 'small_sample', t_statistic: 2.0, degrees_of_freedom: 5, expected_p_value: 0.05097, tolerance: 1e-3 },
  // 極端な尾
  { name: 'extreme_tail', t_statistic: 5.0, degrees_of_freedom: 10, expected_p_value: 0.0002551, tolerance: 1e-5 },
];
```

### 2. パフォーマンステスト
```typescript
interface PerformanceTestResult {
  backend_name: string;
  operations_per_second: number;
  bundle_size_kb: number;
  initialization_time_ms: number;
}
```

### 3. 回帰テスト
- 既存のA/Bテスト結果との整合性確認
- エッジケースでの動作検証
- フォールバック機能のテスト

## 意思決定マトリックス

| 要素 | 現在実装 | stdlib | libRmath.js |
|------|----------|--------|-------------|
| **精度** | 中 | 高 | 最高 |
| **バンドルサイズ** | 最小 | 小 | 大 |
| **ブラウザ対応** | ◎ | ◎ | ○ |
| **メンテナンス負荷** | 高 | 低 | 中 |
| **導入リスク** | なし | 低 | 中 |
| **将来性** | 制限あり | 良好 | 良好 |

## 結論と推奨アクション

### 即座に実行すべき対応
1. **@stdlib/stats-base-dists-t-cdf / -t-quantile** の段階的導入
   - 最小リスクで精度向上を実現
   - 既存実装をフォールバックとして保持

### 検討・計画段階の対応
2. **統計エンジン設定可能化**
   - 用途に応じた選択肢提供
   - A/Bテスト結果の信頼性向上

3. **回帰テスト・精度検証の整備**
   - 移行時の品質保証
   - 継続的な品質モニタリング

この段階的アプローチにより、リスクを最小化しながらNoren Coreの統計計算精度を向上させることができる。