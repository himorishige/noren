# @himorishige/noren-core

Noren PIIマスキングライブラリのコアパッケージです。

このパッケージは、PIIの検出・マスキング・トークン化処理のエンジンとなる`Registry`クラス、主要な関数、そしてプラグインアーキテクチャの基礎となる型定義を提供します。

## 主な機能

- **プラグインアーキテクチャ**: `Registry`クラスを通じて、ディテクター（Detector）とマスカー（Masker）を柔軟に追加・管理できます。
- **豊富なアクション**: 検出されたPIIに対して、`mask`（マスク）、`remove`（除去）、`tokenize`（トークン化）のアクションをルールベースで指定できます。
- **共通PII検出**: メールアドレス、クレジットカード番号（Luhnアルゴリズムチェック付き）、電話番号など、世界共通で利用される基本的なPIIを標準で検出します。
- **ネットワーク検出**: IPv4/IPv6アドレス、MACアドレスは[@himorishige/noren-plugin-network](../noren-plugin-network)プラグインで利用可能です（v0.6.0+）。
- **Web標準準拠**: WHATWG StreamsやWeb Crypto APIなど、特定のランタイムに依存しないWeb標準技術をベースに構築されています。
- **HMACトークン化**: Web Crypto APIを利用したHMAC-SHA256ベースの決定論的トークン化をサポートします。

## インストール

```sh
pnpm add @himorishige/noren-core
```

## 基本的な使い方

```typescript
import { Registry, redactText } from '@himorishige/noren-core';

// Registryインスタンスを作成し、基本ルールを定義
const registry = new Registry({
  // デフォルトのアクションは 'mask'
  defaultAction: 'mask',
  // PIIタイプごとにルールを個別に設定
  rules: {
    credit_card: { action: 'mask', preserveLast4: true }, // クレジットカードは末尾4桁を保持
    email: { action: 'tokenize' }, // メールアドレスはトークン化
  },
});

const inputText = '連絡先: user@example.com, カード番号: 4242-4242-4242-4242';

// テキストの秘匿化処理を実行
// トークン化には hmacKey の指定が必須
const redactedText = await redactText(registry, inputText, {
  hmacKey: 'a-very-secure-secret-key-of-sufficient-length',
});

console.log(redactedText);
// 出力: 連絡先: TKN_EMAIL_5de1e4e7a3b4b5c6, カード番号: **** **** **** 4242
```

## 本番環境での環境変数の利用

本番環境では、HMACキーを環境変数に保存することを推奨します：

```typescript
import { Registry, redactText } from '@himorishige/noren-core';

// .env ファイル:
// NOREN_HMAC_KEY=your-32-character-or-longer-secret-key-here-for-production

const registry = new Registry({
  defaultAction: 'tokenize',
  hmacKey: process.env.NOREN_HMAC_KEY, // 環境変数から読み込み
});

const inputText = '連絡先: user@example.com, カード: 4242-4242-4242-4242';
const redactedText = await redactText(registry, inputText);

console.log(redactedText);
// 出力: 連絡先: TKN_EMAIL_abc123def456789, カード: TKN_CREDIT_CARD_789abc123def456
```

## v0.5.0 新機能・性能最適化

### 大幅な性能向上
- **単一パス検出**: 統合パターンマッチングで102,229操作/秒を実現（0.0098ms per iteration）
- **77%コード削減**: 8,153行から1,782行への大幅スリム化
- **IPv6パーサー最適化**: 31%サイズ削減と強化された検証ロジック
- **Hit Pool軽量化**: 47%サイズ削減とオブジェクトプーリング最適化
- **API表面削減**: 65%エクスポート削減でtree-shaking最適化

### セキュリティのベストプラクティス

- **キーの長さ**: HMACキーは最低32文字以上を使用する（v0.5.0で強制要件）
- **環境変数**: ソースコードにキーをハードコードしない
- **キーローテーション**: 本番環境では定期的にHMACキーを更新する
- **環境分離**: 開発・ステージング・本番環境で異なるキーを使用する
- **Base64URLフォーマット**: セキュリティ強化されたトークン形式

### Edgeランタイムサポート

ライブラリはCloudflare WorkersやVercel Edge Functionsなどのエッジ環境でも動作します：

```typescript
// Cloudflare Workers
export default {
  async fetch(request, env) {
    const registry = new Registry({
      hmacKey: env.NOREN_HMAC_KEY, // Cloudflareの環境変数
    });
    // ... 処理ロジック
  }
};

// Vercel Edge Functions
export default async function handler(request) {
  const registry = new Registry({
    hmacKey: process.env.NOREN_HMAC_KEY, // Vercelの環境変数
  });
  // ... 処理ロジック
}
```

## 高度な設定

### データ型とオブジェクト処理

Norenは**文字列のみ**を処理します。オブジェクトや配列を処理する場合は、文字列に変換してから渡す必要があります：

```typescript
import { Registry, redactText } from '@himorishige/noren-core'

const registry = new Registry({ defaultAction: 'mask' })

// ❌ これは失敗します - オブジェクトはサポートされていません
const badExample = { email: 'user@example.com' }
// await redactText(registry, badExample) // エラー: s.normalize is not a function

// ✅ まずJSON文字列に変換します
const jsonString = JSON.stringify({ email: 'user@example.com', phone: '090-1234-5678' })
const result = await redactText(registry, jsonString)
// 出力: {"email":"[REDACTED:email]","phone":"•••-••••-••••"}

// ✅ カスタムオブジェクト処理ヘルパー
async function redactObject(registry, obj, options = {}) {
  if (typeof obj === 'string') {
    return await redactText(registry, obj, options)
  }
  
  if (Array.isArray(obj)) {
    const results = []
    for (const item of obj) {
      results.push(await redactObject(registry, item, options))
    }
    return results
  }
  
  if (obj && typeof obj === 'object') {
    const result = {}
    for (const [key, value] of Object.entries(obj)) {
      result[key] = await redactObject(registry, value, options)
    }
    return result
  }
  
  return obj // 数値、ブール値などはそのまま返す
}

// 複雑にネストした構造を処理
const complexData = {
  user: { email: 'user@example.com', phones: ['090-1111-2222', '03-3333-4444'] },
  messages: ['連絡先: admin@company.com', '電話: 080-5555-6666']
}

const redacted = await redactObject(registry, complexData, {
  hmacKey: 'your-secure-32-character-key-here-123456'
})
// 出力: 文字列値のみでPIIが適切にマスクされたネストしたオブジェクト
```

### 全角文字のサポート

NorenはUnicode NFKC正規化により、全角文字も自動的に処理します：

```typescript
const registry = new Registry({ defaultAction: 'mask' })

// 全角文字は処理前に自動的に正規化されます
const fullWidthInput = 'メール: ｕｓｅｒ@ｅｘａｍｐｌｅ.ｃｏｍ 電話: ０９０-１２３４-５６７８'
const result = await redactText(registry, fullWidthInput)
// 出力: メ-ル: [REDACTED:email] 電話: •••-••••-••••

// 半角の同等文字との検出結果は同じです
const halfWidthInput = 'メール: user@example.com 電話: 090-1234-5678'  
const sameResult = await redactText(registry, halfWidthInput)
// 両方の入力は同等のマスキング結果を生成します
```

## 🔗 MCP (Model Context Protocol) 統合

NorenはstdioでJSON-RPC通信を行うMCPサーバーに特化したサポートを提供します。Claude CodeなどのAIツールが外部サービスと通信する際に機密データを保護する場合に特に有用です。

### MCPトランスフォームストリーム

MCPサーバーでのリアルタイムstdio処理用：

```typescript
import { 
  Registry, 
  createMCPRedactionTransform,
  redactJsonRpcMessage 
} from '@himorishige/noren-core'

// 包括的なPII検出用のレジストリを作成
const registry = new Registry({
  defaultAction: 'mask',
  validationStrictness: 'fast', // リアルタイム処理用に最適化
  enableJsonDetection: true,
  rules: {
    email: { action: 'mask' },
    api_key: { action: 'remove' },
    jwt_token: { action: 'tokenize' }
  },
  hmacKey: 'mcp-server-redaction-key-32-chars-minimum-length-required'
})

// MCP最適化トランスフォームストリームを作成
const transform = createMCPRedactionTransform({
  registry,
  policy: { defaultAction: 'mask' },
  lineBufferSize: 64 * 1024
})

// stdio通信を処理
await process.stdin
  .pipeThrough(transform)
  .pipeTo(process.stdout)
```

### JSON-RPCメッセージ処理

個別のJSON-RPCメッセージを処理する場合：

```typescript
// JSON-RPCリクエストを処理
const request = {
  jsonrpc: '2.0',
  method: 'getUserProfile',
  params: {
    email: 'user@company.com',
    phone: '090-1234-5678'
  },
  id: 1
}

const redacted = await redactJsonRpcMessage(request, { registry })
console.log(redacted)
// 出力: {
//   jsonrpc: '2.0',
//   method: 'getUserProfile', 
//   params: {
//     email: '[REDACTED:email]',
//     phone: '•••-••••-••••'
//   },
//   id: 1
// }
```

### MCPサーバープロキシ例

stdio通信からPIIを自動的に除去するプロキシサーバーを作成：

```javascript
#!/usr/bin/env node
import { Registry, createMCPRedactionTransform } from '@himorishige/noren-core'
import { Readable, Writable } from 'node:stream'

class MCPRedactionProxy {
  constructor(options = {}) {
    this.registry = new Registry({
      defaultAction: 'mask',
      enableJsonDetection: true,
      validationStrictness: 'fast'
    })
  }

  async start() {
    const inputStream = Readable.toWeb(process.stdin)
    const outputStream = Writable.toWeb(process.stdout)
    
    const transform = createMCPRedactionTransform({
      registry: this.registry,
      policy: { defaultAction: 'mask' }
    })

    await inputStream
      .pipeThrough(transform)
      .pipeTo(outputStream)
  }
}

// プロキシを開始
const proxy = new MCPRedactionProxy()
await proxy.start()
```

### MCP使用例

**1. AIアシスタント通信**
- Claude Code AIインタラクションでのユーザーデータ保護
- 外部API通信からのPII除去
- AIモデル会話の安全なログ記録

**2. 開発ツール統合**
- PII保護機能付きIDE拡張
- プライバシー機能付きコード解析ツール
- 自動データサニタイゼーション付きデバッグログ

**3. CI/CDパイプライン保護**
- PII除去機能付きビルドログ
- テストデータの匿名化
- 環境変数保護

### MCPユーティリティ

ライブラリはMCP処理用のユーティリティ関数も提供します：

```typescript
import {
  parseJsonLines,
  isValidJsonRpcMessage,
  extractSensitiveContent,
  containsJsonRpcPattern,
  getMessageType
} from '@himorishige/noren-core'

// 行区切りJSONメッセージを解析
const messages = parseJsonLines(ndjsonString)

// JSON-RPCメッセージ形式を検証
if (isValidJsonRpcMessage(message)) {
  const type = getMessageType(message) // 'request' | 'response' | 'notification' | 'error'
}

// 潜在的に機密性の高いコンテンツを抽出
const sensitiveContent = extractSensitiveContent(jsonRpcMessage)
```

## API概要

- `Registry`: ディテクター、マスカー、マスキングポリシーを一元管理する中央クラス。
- `redactText(registry, text, policy)`: 指定されたテキストに対して、Registryに登録されたルールに基づき秘匿化処理を実行します。
- `createMCPRedactionTransform(options)`: MCP通信用の最適化されたトランスフォームストリームを作成します。
- `redactJsonRpcMessage(message, options)`: JSON-RPCメッセージから個別にPIIを除去します。
- `normalize(text)`: テキストを正規化（NFKC、空白文字の統一など）します。
- **型定義**: `PiiType`, `Hit`, `Action`, `Policy`, `Detector`, `Masker`など、プラグイン開発に必要な型を提供します。
