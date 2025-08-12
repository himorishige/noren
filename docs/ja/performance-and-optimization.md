# パフォーマンスと最適化

[English](../performance-and-optimization.md) | [日本語](./performance-and-optimization.md)

このドキュメントでは、Norenを高速で軽量にするパフォーマンス最適化とビルドサイズに関する考慮事項について説明します。

## 設計思想

Norenは**「デフォルトで高速」**という原則で構築されています。最適化は後付けではなく、コアアーキテクチャに組み込まれています。ライブラリは以下を優先します：

- **ゼロコスト抽象化**: 使用する機能に対してのみコストを支払う
- **Tree-shaking対応**: 未使用のコードは自動的に除去される
- **ランタイム効率**: 最大スループットのためのホットパス最適化
- **メモリ効率**: 最小限のアロケーションとGC圧力

## パフォーマンス最適化

### 1. 事前コンパイル済み正規表現

**問題**: ランタイムでの正規表現コンパイルは、大量のテキスト処理時に高コスト。

**解決策**: すべての正規表現パターンをモジュールロード時にコンパイルし、再利用。

```typescript
// ❌ 遅い: 呼び出しごとにコンパイル
function detect(text) {
  const emailPattern = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi
  return emailPattern.test(text)
}

// ✅ 高速: モジュールレベルで事前コンパイル
const EMAIL_PATTERN = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi
function detect(text) {
  return EMAIL_PATTERN.test(text)
}
```

**効果**: 繰り返し検出で約15%のパフォーマンス向上。

### 2. 統一パターン検出

**問題**: 複数の正規表現パターンを順次実行するのは非効率。

**解決策**: 頻繁に使用されるパターンを単一の正規表現に結合し、ワンパス検出を実現。

```typescript
// ❌ テキストを複数回走査
text.match(EMAIL_PATTERN)
text.match(IPV4_PATTERN) 
text.match(MAC_PATTERN)

// ✅ 統一パターンでシングルパス
const UNIFIED_PATTERN = /(email_group)|(ipv4_group)|(mac_group)/gi
const matches = text.matchAll(UNIFIED_PATTERN)
```

**効果**: 一般的なPII種別に対してテキスト走査時間を約50%削減。

### 3. Setによるコンテキストヒント最適化

**問題**: コンテキストヒントでのArray.includes()はO(n)の複雑さ。

**解決策**: O(1)検索パフォーマンスのためにSetを使用。

```typescript
// ❌ ヒントチェックごとにO(n)検索
const hints = ['email', 'phone', 'address']
if (hints.includes(hint)) { /* ... */ }

// ✅ SetでO(1)検索
const hintsSet = new Set(['email', 'phone', 'address'])
if (hintsSet.has(hint)) { /* ... */ }
```

**効果**: 20+ヒントでのコンテキスト処理が約25%高速化。

### 4. Hitオブジェクト用のオブジェクトプール

**問題**: Hitオブジェクトの頻繁な割り当て/解放がGC圧力を生成。

**解決策**: オブジェクトプールを通じてHitオブジェクトを再利用。

```typescript
class HitPool {
  private pool: Hit[] = []
  
  acquire(type, start, end, value, risk): Hit {
    const hit = this.pool.pop()
    if (hit) {
      // 既存オブジェクトを再利用
      hit.type = type
      hit.start = start
      // ... その他のプロパティ
      return hit
    }
    return { type, start, end, value, risk } // プールが空の場合は新規作成
  }
  
  release(hits: Hit[]): void {
    // 機密データをクリアしてからプールに返却
    for (const hit of hits) {
      this.securelyWipeHit(hit)
      this.pool.push(hit)
    }
  }
}
```

**効果**: 高スループット処理時のGC圧力を約30%削減。

### 5. 最適化されたHex変換

**問題**: Hex変換での文字列結合が遅い。

**解決策**: Hex値の事前計算ルックアップテーブル。

```typescript
// ❌ 遅い文字列操作
function toHex(byte) {
  return byte.toString(16).padStart(2, '0')
}

// ✅ 高速ルックアップテーブル
const HEX_TABLE = new Array(256)
for (let i = 0; i < 256; i++) {
  HEX_TABLE[i] = ((i >>> 4) & 0xf).toString(16) + (i & 0xf).toString(16)
}
function toHex(byte) {
  return HEX_TABLE[byte]
}
```

**効果**: HMACトークン生成が約40%高速化。

## ビルドサイズ最適化

### 1. Tree-shaking対応モジュール構造

**戦略**: Tree-shakingが可能な個別モジュールに関心を分離。

```
src/
├── patterns.ts      # 正規表現パターン (tree-shaking可能)
├── utils.ts         # ユーティリティ関数 (個別エクスポート)
├── masking.ts       # マスキング関数 (tree-shaking可能)
├── pool.ts          # オブジェクトプール (オプション)
└── detection.ts     # コア検出 (常に含まれる)
```

**結果**: 未使用モジュールは最終バンドルから自動的に除去される。

### 2. 条件付きインポートと遅延ローディング

**戦略**: 必要な時のみプラグインをロード。

```typescript
// プラグインの遅延ローディング用キャッシュ
const pluginCache = new Map()

export async function loadPlugin(name, plugin) {
  if (pluginCache.has(name)) return pluginCache.get(name)
  
  const loaded = await Promise.all([
    plugin.detectors?.() ?? Promise.resolve([]),
    plugin.maskers?.() ?? Promise.resolve({}),
    plugin.contextHints?.() ?? Promise.resolve([])
  ])
  
  pluginCache.set(name, loaded)
  return loaded
}
```

**結果**: 使用されるプラグインのみがロードされ、初期バンドルサイズが削減される。

### 3. 最小限のランタイム依存関係

**戦略**: Web標準APIのみを使用し、外部依存関係を回避。

- **WHATWG Streams**: ストリーミング処理用
- **Web Crypto API**: HMACトークン化用  
- **TextEncoder/TextDecoder**: 文字列/バイト変換用
- **RegExp**: パターンマッチング用

**結果**: ランタイム依存関係ゼロ = より小さなバンドルサイズ。

### 4. 最適化された本番ビルド

**戦略**: 異なるユースケース用の異なるビルド。

```json
{
  "main": "dist/index.js",           // フルCommonJSビルド
  "module": "dist/index.mjs",        // バンドラー用ESモジュール
  "browser": "dist/index.min.js",    // ブラウザ用圧縮版
  "types": "dist/index.d.ts"         // TypeScript定義
}
```

**圧縮結果**:
- **コアライブラリ**: 約8KB 圧縮+gzip
- **全プラグイン込み**: 約25KB 圧縮+gzip
- **個別プラグイン**: 各3-5KB

## ベンチマーク結果

### 処理パフォーマンス

**テスト環境**: Node.js 22, MacBook Pro M1
**テストデータ**: 10,000文字、PII要素100個

| 指標 | 最適化前 | 最適化後 | 改善度 |
|------|----------|----------|--------|
| 大容量テキスト処理 | 3.2ms | 1.8ms | 44%高速化 |
| 繰り返し検出 (1000回) | 12ms | 7ms | 42%高速化 |
| コンテキストヒント処理 | 6.1ms | 4.5ms | 26%高速化 |
| メモリ使用量 | 2.1MB | 1.4MB | 33%削減 |

### バンドルサイズ分析

| ビルドターゲット | サイズ (圧縮) | サイズ (gzip) | Tree-shaking |
|-----------------|--------------|---------------|--------------|
| コアのみ | 12KB | 4KB | ✅ 完全サポート |
| + 日本プラグイン | 18KB | 6KB | ✅ 個別モジュール |
| + 米国プラグイン | 20KB | 7KB | ✅ 個別モジュール |
| + セキュリティプラグイン | 25KB | 8KB | ✅ 個別モジュール |
| 全プラグイン | 35KB | 12KB | ✅ 未使用コード除去 |

## パフォーマンスのベストプラクティス

### 1. Registryの再利用
```typescript
// ✅ Registryインスタンスを再利用
const registry = new Registry({ /* config */ })
// 複数操作で同じregistryを使用

// ❌ 毎回新しいregistryを作成
const result1 = await redactText(new Registry(config), text1)
const result2 = await redactText(new Registry(config), text2)
```

### 2. バッチ処理
```typescript
// ✅ 同じregistryで複数テキストを処理
const results = await Promise.all([
  redactText(registry, text1),
  redactText(registry, text2),
  redactText(registry, text3)
])

// ❌ 逐次処理
const result1 = await redactText(registry, text1)
const result2 = await redactText(registry, text2)
const result3 = await redactText(registry, text3)
```

### 3. 大容量データのストリーミング
```typescript
// ✅ 大容量ファイルにストリームを使用
const stream = fileStream
  .pipeThrough(new TextDecoderStream())
  .pipeThrough(createRedactionTransform(registry))
  .pipeThrough(new TextEncoderStream())

// ❌ ファイル全体をメモリにロード
const content = await fs.readFile('large-file.txt', 'utf8')
const redacted = await redactText(registry, content)
```

### 4. スマートプラグインローディング
```typescript
// ✅ 必要なプラグインのみロード
if (needsJapanSupport) {
  await registry.useLazy('japan', japanPlugin)
}

// ❌ すべてのプラグインを事前にロード
registry.use(japanPlugin.detectors, japanPlugin.maskers)
registry.use(usPlugin.detectors, usPlugin.maskers)
registry.use(securityPlugin.detectors, securityPlugin.maskers)
```

## Web標準準拠

Norenのパフォーマンス最適化はWeb標準上に構築されています：

- **ストリーミング**: メモリ効率的な処理のためのWHATWG Streams
- **暗号化**: 安全で高性能なハッシュ化のためのWeb Crypto API
- **国際化**: 組み込みUnicode正規化 (NFKC)
- **モジュール**: 最適なtree-shakingのためのESモジュール

これにより、Node.js、Deno、Bun、ブラウザ環境全体で一貫したパフォーマンスが保証されます。

## モニタリングとプロファイリング

### 組み込みベンチマーク

パフォーマンステストの実行：

```bash
# ベンチマークテストの実行
cd packages/noren-core
pnpm test benchmark

# メモリ使用量のプロファイル
node --inspect-brk test-performance.js
```

### カスタムパフォーマンス監視

```typescript
import { performance } from 'perf_hooks'

const start = performance.now()
const result = await redactText(registry, text)
const end = performance.now()

console.log(`処理時間: ${end - start}ms`)
console.log(`処理文字数: ${text.length}文字`)
console.log(`検出されたPII要素: ${result.split('REDACTED').length - 1}個`)
```

## 将来の最適化

計画中の改善:

1. **WebAssembly高速化** - 正規表現集約的な操作用
2. **ワーカースレッドサポート** - CPU集約的処理用
3. **ストリーミングパーサー** - 構造化データ (JSON, XML) 用
4. **アダプティブバッチング** - 入力サイズと複雑さに基づく
5. **機械学習** - コンテキスト認識検出精度向上

これらの最適化は後方互換性を維持しながらパフォーマンスの限界を押し広げます。