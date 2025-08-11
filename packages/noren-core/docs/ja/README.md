# @himorishige/noren-core

Noren PIIマスキングライブラリのコアパッケージです。

このパッケージは、PIIの検出・マスキング・トークン化処理のエンジンとなる`Registry`クラス、主要な関数、そしてプラグインアーキテクチャの基礎となる型定義を提供します。

## 主な機能

- **プラグインアーキテクチャ**: `Registry`クラスを通じて、検出器（Detector）とマスカー（Masker）を柔軟に追加・管理できます。
- **豊富なアクション**: 検出されたPIIに対して、`mask`（マスク）、`remove`（除去）、`tokenize`（トークン化）のアクションをルールベースで指定できます。
- **共通PII検出**: メールアドレス、IPv4/IPv6アドレス、MACアドレス、クレジットカード番号（Luhnアルゴリズムチェック付き）など、世界共通で利用される基本的なPIIを標準で検出します。
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

### セキュリティのベストプラクティス

- **キーの長さ**: HMACキーは最低32文字以上を使用する（必須要件）
- **環境変数**: ソースコードにキーをハードコードしない
- **キーローテーション**: 本番環境では定期的にHMACキーを更新する
- **環境分離**: 開発・ステージング・本番環境で異なるキーを使用する

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

## API概要

- `Registry`: 検出器、マスカー、マスキングポリシーを一元管理する中央クラス。
- `redactText(registry, text, policy)`: 指定されたテキストに対して、Registryに登録されたルールに基づき秘匿化処理を実行します。
- `normalize(text)`: テキストを正規化（NFKC、空白文字の統一など）します。
- **型定義**: `PiiType`, `Hit`, `Action`, `Policy`, `Detector`, `Masker`など、プラグイン開発に必要な型を提供します。
