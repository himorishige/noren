# Noren (暖簾)

[English](../../README.md) | [日本語](./README.md)

**Web標準**に基づいて構築された、**高速**かつ**軽量**な個人情報（PII）マスキング＆トークン化ライブラリです。

Noren (暖簾)は、アプリケーションの「エッジ」で機密データを保護します。日本の「暖簾」がプライバシーを保護するように、Norenは個人情報や機密情報がコアシステムに到達する前に即座にマスクします。

**🚀 3つの核心理念:**
- **⚡ 高速 (FAST)**: 事前コンパイルされたパターン、最適化されたアルゴリズム、サブミリ秒の検出
- **🪶 軽量 (LIGHTWEIGHT)**: 124KBバンドルサイズ（77%コード削減）、依存関係ゼロ
- **✨ シンプル (SIMPLE)**: 1行のセットアップ、実用的なデフォルト設定、最小限の構成

**モダンな特徴:**
- **🌐 ユニバーサル**: あらゆる環境で動作（Node.js, Cloudflare Workers, Deno, Bun）
- **🎯 スマート**: 信頼度スコアリングによる精密な制御
- **🔌 拡張可能**: 地域やカスタムニーズに対応するプラグインアーキテクチャ

> **ステータス: v0.5.0 リリース**
> このリリースは、77%コード削減と102K+操作/秒の処理速度を実現した大幅なパフォーマンス最適化を提供します。

## ✨ 主な特長

### 🚀 **超高速 & 軽量**
- **124KB**のバンドルサイズ - エッジ環境へのデプロイに最適
- **事前コンパイル済みパターン**による最高のパフォーマンス
- **最適化されたアルゴリズム**が巨大なテキストも効率的に処理
- オブジェクトプーリングとバックプレッシャー処理による**メモリセーフ**な設計
- **102K+操作/秒**の最適化された単一パス検出

### 🎯 **スマートな検出**
- TLD検証付きの**メールアドレス**
- Luhnアルゴリズム検証付きの**クレジットカード**
- **IPアドレス**（IPv4 & IPv6）の適切な解析
- **電話番号**（E164フォーマット）
- プラグインシステムによる**カスタムパターン**

### 🌐 **Web標準のみ**
- **WHATWG Streams**による効率的なデータ処理
- **Web Crypto API**による安全なトークン化
- **あらゆる環境で動作**: Node.js, Cloudflare Workers, Deno, Bun
- 特定のランタイムへの**依存関係なし**

### 🔌 **プラグインアーキテクチャ**
- **地域特化プラグイン**: 日本、米国など（今後追加予定）
- **セキュリティプラグイン**: HTTPヘッダー、APIトークン、Cookie
- ホットリロード対応の**カスタム辞書**
- テストとベンチマークのための**開発ツール**

## 🔌 パッケージ構成

| パッケージ名                             | 説明                                                               |
| :--------------------------------------- | :----------------------------------------------------------------- |
| [`@himorishige/noren-core`](../../packages/noren-core/README.md)                | 🎯 **コアライブラリ** - 高速なPII検出、マスキング、トークン化 |
| [`@himorishige/noren-plugin-jp`](../../packages/noren-plugin-jp/README.md)           | 🇯🇵 **日本向けプラグイン** - 電話番号、郵便番号、マイナンバー |
| [`@himorishige/noren-plugin-us`](../../packages/noren-plugin-us/README.md)           | 🇺🇸 **米国向けプラグイン** - 電話番号、郵便番号、SSN |
| [`@himorishige/noren-plugin-security`](../../packages/noren-plugin-security/README.md)     | 🛡️ **セキュリティプラグイン** - HTTPヘッダー、APIトークン、Cookie |
| [`@himorishige/noren-dict-reloader`](../../packages/noren-dict-reloader/README.md)       | 🔄 **動的リロード** - ETagベースのポリシーホットリロード |
| [`@himorishige/noren-devtools`](../../packages/noren-devtools/README.md)            | 🔧 **開発ツール** - ベンチマーク、A/Bテスト、評価 |

## 動作要件

*   Node.js **20.10以上**

## 🚀 クイックスタート

### 1. **インストール**
```bash
npm install @himorishige/noren-core
# または、追加プラグインと共にインストール
npm install @himorishige/noren-core @himorishige/noren-plugin-jp @himorishige/noren-plugin-security
```

### 2. **基本的な使い方** (1分セットアップ)
```typescript
import { Registry, redactText } from '@himorishige/noren-core'

// シンプルな設定でRegistryを作成
const registry = new Registry({
  defaultAction: 'mask', // 'mask', 'remove', または 'tokenize'
  environment: 'production' // テスト用データなどを自動で除外
})

// テキストを処理
const input = 'Email: john@example.com, Card: 4242-4242-4242-4242, IP: 192.168.1.1'
const result = await redactText(registry, input)

console.log(result)
// 出力: Email: [REDACTED:email], Card: [REDACTED:credit_card], IP: [REDACTED:ipv4]
```

### 3. **地域別プラグインの利用**
```typescript
import { Registry, redactText } from '@himorishige/noren-core'
import * as jpPlugin from '@himorishige/noren-plugin-jp'
import * as securityPlugin from '@himorishige/noren-plugin-security'

const registry = new Registry({
  defaultAction: 'mask',
  enableConfidenceScoring: true, // 信頼度スコアリングで精度向上
  rules: {
    credit_card: { action: 'mask', preserveLast4: true }, // クレカは末尾4桁を保持
    mynumber_jp: { action: 'remove' } // v0.5.0: マイナンバーは完全に削除
  }
})

// プラグインを追加
registry.use(jpPlugin.detectors, jpPlugin.maskers)
registry.use(securityPlugin.detectors, securityPlugin.maskers)

const input = '〒150-0001 カード: 4242-4242-4242-4242 Bearer: eyJ0eXAiOiJKV1Q...'
const result = await redactText(registry, input)
// 出力: 〒•••-•••• カード: **** **** **** 4242 Bearer: [REDACTED:AUTH]
```

### 4. **トークン化** (高度な利用)

```typescript
const registry = new Registry({
  defaultAction: 'tokenize',
  hmacKey: 'your-secure-32-character-key-here-123456' // 32文字以上が必須
})

const input = 'User email: alice@company.com'
const result = await redactText(registry, input)
// 出力: User email: TKN_EMAIL_AbC123XyZ...

// トークンは一貫性があります - 同じ入力は同じトークンを生成します
const sameResult = await redactText(registry, input)
// 両方の結果は同一のトークンになります
```

### 5. **ストリーム処理** (大規模データ)
```typescript
import { createRedactionTransform } from '@himorishige/noren-core'

const registry = new Registry({ defaultAction: 'mask' })
const transform = createRedactionTransform(registry)

// あらゆるReadableStreamで使用可能
const stream = new ReadableStream({
  start(controller) {
    controller.enqueue('Data with email@example.com and more...')
    controller.close()
  }
})

const redactedStream = stream.pipeThrough(transform)
```

## 💡 ユースケース

### 🎯 **一般的なシナリオ**
- **APIログ**: APIリクエスト/レスポンスログからPIIを削除
- **カスタマーサポート**: サポートチケット内の機密データをマスク
- **データ分析**: 構造を維持したままデータセットを匿名化
- **コンプライアンス**: GDPR、CCPA、その他のプライバシー規制に対応

### 🚀 **エッジ環境での利用**
サーバーレスやエッジコンピューティングに最適です:
- **Cloudflare Workers**: エッジでデータを処理
- **Vercel Functions**: サーバーレスでのPII保護
- **AWS Lambda**: 軽量なランタイムフットプリント
- **Deno Deploy**: ネイティブなWeb標準サポート

## 🔧 高度な設定

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

### 環境を意識した処理
```typescript
const registry = new Registry({
  environment: 'development', // 'development'環境ではテストパターンを自動的に除外
  allowDenyConfig: {
    allowList: ['test@company.com'], // カスタムの除外設定
    denyList: []  // 強制的に検出
  }
})
```

### プラグイン開発
```typescript
// カスタム検出器の作成
const myDetector: Detector = {
  id: 'custom.ssn',
  match: ({ src, push }) => {
    // 独自の検出ロジック
  }
}

registry.use([myDetector], { ssn: (hit) => '***-**-****' })
```

## 📚 ドキュメントと使用例

### 📖 **パッケージドキュメント**
- **[@himorishige/noren-core](../../packages/noren-core/README.md)**: コアライブラリのドキュメント
- **[@himorishige/noren-devtools](../../packages/noren-devtools/README.md)**: 開発ツールと高度な機能
- **各プラグインパッケージ**: それぞれのパッケージのREADMEを参照

### 🎯 **使用例**
- **[基本的な使い方](../../examples/basic-redact.mjs)**: シンプルなPII秘匿化
- **[トークン化](../../examples/tokenize.mjs)**: HMACベースのトークン化
- **[ストリーム処理](../../examples/stream-redact.mjs)**: 大規模ファイルの処理
- **[セキュリティプラグイン](../../examples/security-demo.mjs)**: HTTPヘッダーとトークン
- **[Webサーバー](../../examples/hono-server.mjs)**: Honoフレームワークとの統合

## ⚡ パフォーマンスとベンチマーク

### 📊 **ベンチマーク** (v0.5.0)
- **バンドルサイズ**: 124KB最適化ディストリビューション
- **処理速度**: 102,229操作/秒 (0.0098ms per iteration)
- **メモリ効率**: オブジェクトプーリングと自動クリーンアップ
- **コード削減**: 77%コンパクトなコードベース (1,782行)
- **API表面**: tree-shakingのため65%エクスポート削減

### 🔬 **テストと開発**
```bash
# ベンチマークの実行 (@himorishige/noren-devtoolsが必要)
npm install @himorishige/noren-devtools
node examples/benchmark-demo.mjs
```

## 🤝 コントリビューションとサポート

### 🐛 **課題と質問**
- **GitHub Issues**: [バグ報告や機能リクエスト](https://github.com/himorishige/noren/issues)
- **Discussions**: [質問やアイデアの共有](https://github.com/himorishige/noren/discussions)

### 🔄 **アップグレードガイド**
v0.3.xからの移行をお考えですか？ 破壊的変更と更新手順については、**[移行ガイド](./migration-guide-ja.md)**を参照してください。

## マネージドサービスの利用（推奨）

コンプライアンス準拠が厳格に求められる本番環境や大規模なワークロードでは、各クラウドプロバイダーが提供するマネージドサービスの利用を強く推奨します。

*   **AWS**: [Amazon Comprehend (PII検出・秘匿化)](https://docs.aws.amazon.com/comprehend/latest/dg/how-pii.html), [Amazon Macie (S3データ検出)](https://docs.aws.amazon.com/macie/latest/user/what-is-macie.html)
*   **Google Cloud**: [Sensitive Data Protection (Cloud DLP)](https://cloud.google.com/sensitive-data-protection/docs/deidentify-sensitive-data)
*   **Azure**: [Azure AI Language (PII検出)](https://learn.microsoft.com/azure/ai-services/language-service/personally-identifiable-information/how-to/redact-text-pii)

`Noren`は、あくまで**エッジ環境や開発、ストリーミングの前処理などを補助する軽量なツール**であり、単体でGDPRやCCPAなどの法規制への準拠を保証するものではありません。

## 免責事項

本ソフトウェアは**現状のまま（AS IS）**提供され、いかなる保証もいたしません。個人情報の検出漏れや誤検出が発生する可能性があります。最終的な出力の確認と、各種法令への準拠は、利用者自身の責任で行ってください。本リポジトリのいかなる情報も、法的助言を構成するものではありません。

## 📄 **ライセンス**
[MIT](../../LICENSE) © himorishige