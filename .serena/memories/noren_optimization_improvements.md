# Noren Package Optimization Improvements

## 完了した改善内容

### Phase 1: パターン分割とdynamic import実装
- **コアパターンの分離**: `patterns/core.ts`で最重要パターンのみを抽出（9パターン）
- **遅延ローディング**: `pattern-loader.ts`でdynamic importによるオンデマンド読み込み
- **カテゴリ別管理**: core/financial/personal/security/allの5カテゴリ

### Phase 2: Aho-Corasickアルゴリズム実装
- **複数パターン同時検出**: `aho-corasick.ts`で線形時間での多パターンマッチング
- **状態保持ストリーム**: `stream-state.ts`でチャンク境界をまたぐ検出
- **パフォーマンス向上**: 5パターン以上の場合に自動でAho-Corasickを使用

### Phase 3: ビルド時最適化
- **TypedArray変換**: `compiler.ts`でパターンをバイナリ形式に最適化
- **メモリ効率化**: Trieデータ構造での効率的格納
- **シリアライゼーション**: バイナリ形式での保存・読み込み

### Phase 4: キャッシュとAPI改善
- **LRUキャッシュ**: WeakMapからMapベースのLRUキャッシュに変更
- **簡潔なAPI**: `simple-api.ts`で使いやすいインターフェース追加
- **セキュリティレベル**: strict/balanced/permissiveの3段階プリセット

## 期待される効果

### バンドルサイズ
- **コアパターンのみ**: 約60%削減（34KB → 13KB予想）
- **動的ローディング**: 初期ロード時間の短縮
- **Tree-shaking**: 未使用パターンの自動除去

### パフォーマンス
- **Aho-Corasick**: 多パターン検出で2-5倍高速化
- **LRUキャッシュ**: 安定したキャッシュヒット率
- **状態保持**: ストリーム処理での重複計算削減

### 開発者体験
- **Simple API**: `isContentSafe()`, `detectThreats()`, `sanitizeContent()`
- **Express middleware**: `createExpressMiddleware()`
- **Cloudflare Workers**: `checkRequest()`
- **専用Guard**: `createGuard('financial')`等

## 新しいAPI例

```javascript
// 簡単な安全チェック
const safe = await isContentSafe('危険な入力?')

// 脅威レベル検出
const threat = await detectThreats('入力内容', { level: 'strict' })

// 大容量テキスト処理
const result = await processLargeText(largeText, { level: 'balanced' })

// ステートフルストリーミング
const processor = createStatefulProcessor({ chunkSize: 1024 })
```

## ファイル構成

```
packages/noren/src/
├── patterns/
│   ├── core.ts          # コアパターン（最重要）
│   ├── financial.ts     # 金融系パターン
│   ├── personal.ts      # 個人情報パターン
│   ├── security.ts      # セキュリティパターン
│   └── index.ts         # 全パターン統合
├── aho-corasick.ts      # 多パターン同時検出
├── compiler.ts          # ビルド時最適化
├── pattern-loader.ts    # 動的パターンローダー
├── simple-api.ts        # 簡潔API
├── stream-state.ts      # ステートフルストリーム
└── index.ts             # エクスポート統合
```

## 互換性
- 既存のAPIは全て保持
- 新機能は追加のオプトイン形式
- TypeScript型定義も完全対応

## テスト・ベンチマーク
- `examples/optimized-benchmark.mjs`: 包括的性能測定
- `examples/quick-start-optimized.mjs`: 新機能デモ
- 全機能の動作確認済み

この最適化により、「軽量・高速・シンプル」のコンセプトがさらに強化された。