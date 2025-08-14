# API リファレンス

*v0.5.0 - 軽量最適化版*

## コアクラス

### Registry

PII検出とマスキング設定のメインクラス。

#### コンストラクタ

```typescript
new Registry(options: RegistryOptions)
```

**RegistryOptions** (Policy を拡張):

| プロパティ | 型 | 説明 |
|----------|------|-------------|
| `defaultAction` | `'mask' \| 'remove' \| 'tokenize' \| 'ignore'` | 検出されたPIIのデフォルトアクション |
| `environment` | `'production' \| 'test' \| 'development'` | 環境固有の動作 |
| `allowDenyConfig` | `AllowDenyConfig` | 許可/拒否リスト設定 |
| `enableConfidenceScoring` | `boolean` | 信頼度ベースフィルタリングを有効化 (デフォルト: true) |
| `sensitivity` | `'strict' \| 'balanced' \| 'relaxed'` | **v0.5.0新機能** - 検出感度レベル |
| `confidenceThreshold` | `number` | **v0.5.0新機能** - 検出の最小信頼度 (0.0-1.0) |
| `rules` | `Record<PiiType, Rule>` | タイプ固有の検出ルール |
| `contextHints` | `string[]` | コンテキスト認識検出のキーワード |
| `hmacKey` | `string \| CryptoKey` | トークン化用HMACキー (最小32文字) |

**AllowDenyConfig**:

| プロパティ | 型 | 説明 |
|----------|------|-------------|
| `environment` | `Environment` | 環境設定 |
| `customAllowlist` | `Map<PiiType, Set<string>>` | 除外するカスタムパターン |
| `customDenylist` | `Map<PiiType, Set<string>>` | 強制検出するカスタムパターン |
| `allowPrivateIPs` | `boolean` | プライベートIPアドレスを許可するか |
| `allowTestPatterns` | `boolean` | 一般的なテストパターンを許可するか |

#### メソッド

##### use(detectors, maskers, contextHints)
プラグインから検出器とマスカーを登録。

```typescript
use(
  detectors?: Detector[], 
  maskers?: Record<string, Masker>, 
  contextHints?: string[]
): void
```

##### detect(text, contextHints)
テキスト内のPIIを検出し、ヒットを返す。

```typescript
detect(text: string, contextHints?: string[]): Promise<{
  src: string
  hits: Hit[]
}>
```

##### useLazy(pluginName, plugin)
**v0.5.0新機能** - パフォーマンス向上のためプラグインを遅延読み込み。

```typescript
useLazy(pluginName: string, plugin: LazyPlugin): Promise<void>
```

##### maskerFor(type)
特定のPIIタイプ用マスカー関数を取得。

```typescript
maskerFor(type: PiiType): Masker | undefined
```

##### getPolicy()
現在のポリシー設定を取得。

```typescript
getPolicy(): Policy
```

### AllowDenyManager

**v0.3.0新機能** - 許可リストと拒否リストパターンを管理。

#### コンストラクタ

```typescript
new AllowDenyManager(config?: AllowDenyConfig)
```

#### メソッド

##### isAllowed(value, type)
値が許可されるべきか（PIIとして扱わない）をチェック。

```typescript
isAllowed(value: string, type: PiiType): boolean
```

##### addToAllowlist(type, patterns)
実行時に許可リストにパターンを追加。

```typescript
addToAllowlist(type: PiiType, patterns: string[]): void
```

##### addToDenylist(type, patterns)
実行時に拒否リストにパターンを追加。

```typescript
addToDenylist(type: PiiType, patterns: string[]): void
```

##### getConfig()
デバッグ用の現在設定を取得。

```typescript
getConfig(): {
  environment: Environment
  allowPrivateIPs: boolean
  allowTestPatterns: boolean
  allowlist: Record<string, string[]>
  denylist: Record<string, string[]>
}
```

## IPv6関数

### parseIPv6(address)

**v0.3.0新機能** - IPv6アドレスをパースして検証。

```typescript
parseIPv6(address: string): IPv6ParseResult
```

**IPv6ParseResult**:

| プロパティ | 型 | 説明 |
|----------|------|-------------|
| `valid` | `boolean` | アドレスが有効かどうか |
| `normalized` | `string?` | アドレスの正規形 |
| `isPrivate` | `boolean?` | プライベートアドレスかどうか |
| `isLoopback` | `boolean?` | ループバックアドレスかどうか |
| `isDocumentation` | `boolean?` | ドキュメントアドレスかどうか |
| `isLinkLocal` | `boolean?` | リンクローカルアドレスかどうか |
| `isUniqueLocal` | `boolean?` | ユニークローカルアドレスかどうか |
| `error` | `string?` | 無効な場合のエラーメッセージ |

**例**:
```typescript
import { parseIPv6 } from '@himorishige/noren-core'

const result = parseIPv6('2001:db8::1')
console.log(result)
// {
//   valid: true,
//   normalized: '2001:0db8:0000:0000:0000:0000:0000:0001',
//   isDocumentation: true,
//   isPrivate: false
// }
```

## ユーティリティ関数

### redactText(registry, text, overrides)

テキストからPIIをマスクする便利関数。

```typescript
redactText(
  registry: Registry, 
  text: string, 
  overrides?: Partial<Policy>
): Promise<string>
```

## 型定義

### Environment

**v0.3.0新機能**:

```typescript
type Environment = 'production' | 'test' | 'development'
```

### Hit

検出されたPIIマッチを表す。

```typescript
interface Hit {
  type: PiiType
  start: number
  end: number
  value: string
  risk: 'low' | 'medium' | 'high'
  priority?: number
  confidence?: number    // 0.0-1.0, v0.3.0で追加
  reasons?: string[]     // 検出理由, v0.3.0で追加  
  features?: Record<string, unknown> // 追加メタデータ, v0.3.0で追加
}
```

### Detector

PII検出器のインターフェース。

```typescript
interface Detector {
  id: string             // 一意の検出器識別子
  match(utils: DetectUtils): void | Promise<void>
  priority?: number      // 小さい数字 = 高い優先度
}
```

### DetectionSensitivity

**v0.5.0新機能** - 事前定義された感度レベル：

```typescript
type DetectionSensitivity = 'strict' | 'balanced' | 'relaxed'
```

- **strict**: 高精度、低再現率 (信頼度 ≥ 0.8)
- **balanced**: 精度と再現率のバランス (信頼度 ≥ 0.5) 
- **relaxed**: 高再現率、低精度 (信頼度 ≥ 0.3)

## 環境固有の動作

### 環境別デフォルト許可リスト

#### 本番環境
- 安全なパターンのみ許可:
  - `noreply@`, `no-reply@`, `donotreply@`, `do-not-reply@`

#### テスト/開発環境
- **メールドメイン**: `example.com`, `example.org`, `localhost`, `invalid`
- **IPv4アドレス**: ループバック (`127.0.0.1`)、ドキュメント範囲、プライベートネットワーク
- **IPv6アドレス**: ループバック (`::1`)、リンクローカル、ユニークローカル、ドキュメント
- **電話番号**: テスト範囲 (`555-0100` から `555-0199`)、繰り返し数字
- **クレジットカード**: 一般的なテストカード番号

### カスタム設定例

#### 本番環境で企業ドメインを許可
```typescript
const registry = new Registry({
  defaultAction: 'mask',
  environment: 'production',
  allowDenyConfig: {
    customAllowlist: new Map([
      ['email', new Set([
        'noreply@mycompany.com',
        'support@mycompany.com',
        'admin@mycompany.com'
      ])]
    ])
  }
})
```

#### テストパターンの強制検出
```typescript
const registry = new Registry({
  defaultAction: 'mask',
  environment: 'test',
  allowDenyConfig: {
    customDenylist: new Map([
      ['email', new Set(['test@'])] // test@メールの強制検出
    ])
  }
})
```

#### 厳格なIP検出での開発
```typescript
const registry = new Registry({
  defaultAction: 'mask',
  environment: 'development',
  allowDenyConfig: {
    allowPrivateIPs: false // 開発環境でもプライベートIPを検出
  }
})
```

## v0.5.0の新機能

### 信頼度スコアリングシステム

```typescript
import { CONFIDENCE_THRESHOLDS, filterByConfidence } from '@himorishige/noren-core'

// 事前定義しきい値
CONFIDENCE_THRESHOLDS.strict    // 0.8
CONFIDENCE_THRESHOLDS.balanced  // 0.5  
CONFIDENCE_THRESHOLDS.relaxed   // 0.3

// 信頼度でヒットをフィルタ
const highConfidenceHits = filterByConfidence(hits, 0.8)
```

### 遅延プラグイン読み込み

```typescript
import { clearPluginCache } from '@himorishige/noren-core'

// オンデマンドでプラグイン読み込み
await registry.useLazy('jp-plugin', () => import('@himorishige/noren-plugin-jp'))

// 必要に応じてキャッシュクリア
clearPluginCache('jp-plugin')
```

### 強化されたストリーム処理

```typescript
import { createRedactionTransform } from '@himorishige/noren-core'

const transform = createRedactionTransform(registry, {
  // v0.5.0で強化されたオプション
  confidenceThreshold: 0.7,
  enableBackpressure: true
})
```

## パフォーマンス特性 (v0.5.0)

### 検出パフォーマンス
- シンプルテキスト (< 1KB): 検出あたり < 0.5ms (2倍高速)
- 複数PII複雑テキスト: 検出あたり < 0.1ms (2倍高速)
- IPv6パース: 候補アドレスあたり ~0.05ms (2倍高速)
- 処理速度: 102,229回/秒

### メモリ使用量
- ベースメモリフットプリント: ~1MB (50%削減)
- メモリ成長: 1000回操作で < 2.5MB (50%削減)
- オブジェクトプーリング: 自動クリーンアップと再利用

### バンドルサイズ最適化
- コアバンドル: 124KB (77%コード削減)
- プラグインバンドル: 各< 150KB
- ツリーシェーキング対応: 65%エクスポート削減

### スケーリング特性
- 入力サイズに対する線形スケーリング
- 20倍入力 → 2-5倍処理時間 (最適化アルゴリズム)
- 大きなストリーム向け強化バックプレッシャー処理

## 移行ガイド

### v0.4.xからv0.5.0へ

**破壊的変更:**
- 複雑なdevtools機能の削除 (A/Bテスト、コンテキスト検出)
- 信頼度スコアリングシステムの簡素化
- プラグイン読み込み機構の更新

```typescript
// v0.5.0以前
import { BenchmarkRunner, ImprovementCycle } from '@himorishige/noren-devtools'

// v0.5.0以降 - 簡素化されたdevtools
import { BenchmarkRunner, EvaluationEngine } from '@himorishige/noren-devtools'
// ImprovementCycleと複雑な機能は削除
```

### v0.2.xからv0.5.0へ

#### Registryコンストラクタ
```typescript
// v0.3.0以前
const registry = new Registry({
  defaultAction: 'mask',
  rules: { email: { action: 'remove' } }
})

// v0.3.0以降 (必須変更は // NEW でマーク)
const registry = new Registry({
  defaultAction: 'mask',
  environment: 'production', // NEW: 必須フィールド
  rules: { email: { action: 'remove' } },
  allowDenyConfig: { // NEW: オプション設定
    allowTestPatterns: false
  }
})
```

#### IPv6検出の変更
- プライベートIPv6アドレスはデフォルトで検出されない
- 必要に応じてカスタム拒否リストで強制検出:

```typescript
const registry = new Registry({
  defaultAction: 'mask',
  environment: 'production',
  allowDenyConfig: {
    customDenylist: new Map([
      ['ipv6', new Set(['::1', 'fe80::', 'fd00::'])]
    ])
  }
})
```

---

**免責事項**

このソフトウェアは「現状のまま」提供され、いかなる保証もありません。検出漏れや偽陽性の可能性があります。ユーザーは最終出力を検証し、適用される法律と規制への準拠を確保する責任があります。このリポジトリの情報は法的助言を構成しません。

**ライセンス**
MIT License - 詳細は [LICENSE](../../LICENSE) を参照。

---

**プライバシーファーストな開発のために ❤️ で作られました**