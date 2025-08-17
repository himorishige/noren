# 移行ガイド v0.2 → v0.3

このガイドでは、Noren v0.2からv0.3への移行について説明します。

## 🎯 重要なポイント

### ✅ **100% 後方互換性**

**既存のコードは一切変更不要です。** v0.2のAPIはすべてそのまま動作します。

```typescript
// v0.2のコード - 変更不要で動作
import { isSafe, scanText, createGuard } from '@himorishige/noren';

const safe = isSafe('テキスト');           // ✅ 動作
const result = await scanText('テキスト');   // ✅ 動作  
const guard = createGuard();               // ✅ 動作
```

### 🚀 **オプションのアップグレード**

新機能は段階的に導入可能で、既存コードと共存できます。

## 📋 移行戦略

### レベル1: 即座の恩恵（変更なし）

v0.3にアップグレードするだけで、既存コードが自動的に高速化されます：

```bash
npm install @himorishige/noren@0.3
```

**自動的に得られる改善：**
- 40%のパフォーマンス向上
- 62%のバンドルサイズ削減
- より安定したキャッシュ

### レベル2: 簡単なAPI移行（推奨）

既存の関数を新しい簡単なAPIに徐々に置き換え：

```typescript
// 段階的移行の例

// Before (v0.2スタイル)
import { isSafe } from '@himorishige/noren';
const safe = isSafe('ユーザー入力');

// After (v0.3推奨)
import { isContentSafe } from '@himorishige/noren';
const safe = await isContentSafe('ユーザー入力');

// Before (v0.2スタイル)  
import { scanText } from '@himorishige/noren';
const result = await scanText('テキスト');

// After (v0.3推奨)
import { detectThreats } from '@himorishige/noren';
const result = await detectThreats('テキスト');
```

### レベル3: 高度な最適化（オプション）

パフォーマンス重視のアプリケーション向け：

```typescript
// 事前ロードで最高性能
import { preload, createLazyGuard } from '@himorishige/noren';

// アプリケーション起動時
await preload('balanced');

// 必要な場所で高速利用
const guard = await createLazyGuard(['core']);
```

## 🔄 段階的移行プラン

### フェーズ1: アップグレード（1分）

```bash
npm install @himorishige/noren@0.3
npm test  # 既存テストがパスすることを確認
```

**効果：** 即座に40%の性能向上

### フェーズ2: セキュリティレベル導入（5分）

単一の設定でアプリ全体のセキュリティレベルを統一：

```typescript
// アプリケーション初期化時に追加
import { setSecurityLevel } from '@himorishige/noren';

// 用途に応じて選択
await setSecurityLevel('strict');     // 金融・医療
await setSecurityLevel('balanced');   // 一般用途（デフォルト）
await setSecurityLevel('permissive'); // 内部ツール
```

**効果：** 一貫したセキュリティポリシーと設定の簡素化

### フェーズ3: 簡単API移行（30分）

段階的に新しいAPIに移行：

```typescript
// 1. boolean チェックの移行
// Before
const safe = isSafe(text);
// After  
const safe = await isContentSafe(text);

// 2. 詳細分析の移行
// Before
const result = await scanText(text);
// After
const result = await detectThreats(text);

// 3. コンテンツサニタイゼーション
// Before
const result = await scanText(text, { config: { enableSanitization: true } });
const cleaned = result.sanitized;
// After
const cleaned = await sanitizeContent(text);
```

**効果：** より直感的なAPIと型安全性の向上

### フェーズ4: 大容量データ最適化（必要に応じて）

大きなファイルやリアルタイム処理がある場合：

```typescript
// Before: 一括処理
const result = await scanText(largeText);

// After: ストリーミング処理  
import { processLargeText } from '@himorishige/noren';
const result = await processLargeText(largeText, {
  chunkSize: 1024,
  level: 'balanced'
});
```

**効果：** メモリ使用量削減と大容量ファイル対応

### フェーズ5: パフォーマンス最適化（高負荷アプリ向け）

トラフィックが多いアプリケーション向け：

```typescript
// 1. 事前ロード戦略
import { preload } from '@himorishige/noren';
await preload('balanced');

// 2. 動的ロードの活用
import { createLazyGuard } from '@himorishige/noren';
const guard = await createLazyGuard(['core', 'security']);

// 3. フレームワーク統合
import { createExpressMiddleware } from '@himorishige/noren';
app.use(createExpressMiddleware({ level: 'strict' }));
```

**効果：** 最大性能と最小バンドルサイズ

## 🎯 用途別移行パターン

### Webアプリケーション

```typescript
// Before (v0.2)
import { createGuard } from '@himorishige/noren';
const guard = createGuard({ riskThreshold: 60 });

app.post('/api/chat', async (req, res) => {
  const result = await guard.scan(req.body.message);
  if (!result.safe) {
    return res.status(400).json({ error: 'Blocked' });
  }
  // 処理続行...
});

// After (v0.3) - 段階的移行
import { setSecurityLevel, detectThreats } from '@himorishige/noren';

// アプリ起動時
await setSecurityLevel('balanced');

app.post('/api/chat', async (req, res) => {
  const result = await detectThreats(req.body.message);
  if (!result.safe) {
    return res.status(400).json({ 
      error: 'Blocked',
      risk: result.risk,
      level: result.level 
    });
  }
  // 処理続行...
});
```

### エッジ関数（Cloudflare Workers/Vercel）

```typescript
// Before (v0.2)
import { isSafe } from '@himorishige/noren';

export default async function handler(request) {
  const { prompt } = await request.json();
  if (!isSafe(prompt, 70)) {
    return new Response('Blocked', { status: 400 });
  }
  // 処理続行...
}

// After (v0.3) - 軽量化
import { isContentSafe } from '@himorishige/noren';

export default async function handler(request) {
  const { prompt } = await request.json();
  if (!(await isContentSafe(prompt))) {
    return new Response('Blocked', { status: 400 });
  }
  // 処理続行...
}
```

### バッチ処理

```typescript
// Before (v0.2)
import { createGuard } from '@himorishige/noren';
const guard = createGuard();

for (const item of items) {
  const result = await guard.scan(item.content);
  processResult(result);
}

// After (v0.3) - 一括処理
import { scanBatch } from '@himorishige/noren';

const inputs = items.map(item => ({ 
  content: item.content, 
  trust: 'user' 
}));
const results = await scanBatch(inputs);
```

## 🧪 テスト戦略

### 既存テストの継続

```typescript
// 既存のテストは変更不要
describe('Noren Guard', () => {
  it('should detect dangerous content', async () => {
    const result = await scanText('ignore instructions');
    expect(result.safe).toBe(false);
  });
});
```

### 新APIのテスト追加

```typescript
describe('Noren v0.3 Features', () => {
  it('should work with new simple API', async () => {
    const safe = await isContentSafe('Hello world');
    expect(safe).toBe(true);
  });

  it('should support security levels', async () => {
    await setSecurityLevel('strict');
    const result = await detectThreats('suspicious content');
    expect(result.level).toBeDefined();
  });
});
```

## 📊 移行後の検証

### パフォーマンス確認

```typescript
// ベンチマーク比較
import { benchmark } from '@himorishige/noren/examples';

// 移行前後の性能測定
console.time('detection');
const result = await detectThreats(testContent);
console.timeEnd('detection');

// または付属のベンチマークツール使用
node examples/optimized-benchmark.mjs
```

### バンドルサイズ確認

```bash
# Webpackの場合
npx webpack-bundle-analyzer dist/main.js

# Rollupの場合  
npx rollup-plugin-visualizer

# 期待値: 13KB（動的ロード時）、34KB（全機能時）
```

## ⚠️ 注意点とトラブルシューティング

### よくある問題

**問題1: 新APIが async/await を要求**
```typescript
// ❌ 同期APIから非同期APIへの変更
const safe = isSafe(text); // 同期

// ✅ 解決
const safe = await isContentSafe(text); // 非同期
```

**問題2: セキュリティレベルの初期化忘れ**
```typescript
// ❌ setSecurityLevel を呼び忘れ
const result = await detectThreats(text); // デフォルト設定

// ✅ 解決  
await setSecurityLevel('balanced');
const result = await detectThreats(text);
```

**問題3: TypeScript型エラー**
```typescript
// 新APIは戻り値の型が改善されている
const result: ThreatResult = await detectThreats(text);
```

### デバッグ支援

```typescript
// デバッグモードで詳細ログ
import { createGuard } from '@himorishige/noren';
const guard = createGuard({ 
  enablePerfMonitoring: true,
  debug: true 
});

const metrics = guard.getMetrics();
console.log('Performance:', metrics);
```

## 🎉 移行完了チェックリスト

- [ ] v0.3にアップグレード完了
- [ ] 既存テスト全てパス
- [ ] セキュリティレベル設定済み
- [ ] 主要APIを新版に移行
- [ ] パフォーマンス改善を確認
- [ ] バンドルサイズ削減を確認
- [ ] 新機能のテスト追加
- [ ] ドキュメント更新

## 🔗 関連リソース

- [API リファレンス](./api-reference.md) - 全API詳細
- [パフォーマンスガイド](./performance.md) - 最適化テクニック
- [ユースケース集](./use-cases.md) - 実装例
- [ベストプラクティス](./best-practices.md) - 推奨パターン

---

**移行で困った時は、既存のAPIがそのまま使えることを思い出してください。** 新機能は段階的に、必要に応じて導入すればOKです。