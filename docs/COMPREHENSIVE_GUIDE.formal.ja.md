# Noren: 包括的技術ガイド

## 1. ライブラリ開発の背景と目的

近年、大規模言語モデル（LLM）や、Anthropic社が提唱するModel Context Protocol (MCP)のような、先進的なAI技術の活用が急速に進んでいます。これに伴い、開発者や利用者が個人情報や機密情報を意図せず外部サービスに送信してしまうという、新たな情報セキュリティ上のリスクが浮上しています。

「Noren」は、このような課題に対応するために開発された、エッジネイティブなPII（Personally Identifiable Information）保護ライブラリです。アプリケーションの入り口（エッジ）で、データストリームに含まれる個人情報や機密情報をリアルタイムで検出し、マスキングやトークン化を行うことで、情報漏洩のリスクを低減させることを目的としています。

開発の初期段階では、誰もが手軽に導入できるPII保護ライブラリとして、まずは基本的な機能を提供することからスタートしました。

## 2. Norenの主な特徴

Norenライブラリは、以下の主要な特徴を備えています。

*   **🌐 Web標準API準拠**
    *   特定のJavaScriptランタイム（Node.jsなど）に依存せず、WHATWG StreamsやWeb Crypto APIといったWeb標準APIのみで構築されています。これにより、Cloudflare Workers、Deno、Bunなど、多様な環境での実行互換性を確保しています。
*   **🧩 プラグインベースのアーキテクチャ**
    *   軽量なコアパッケージ（`noren-core`）を基盤とし、国や地域に固有のPII（日本のマイナンバー、米国のSSNなど）に対応するためのプラグインを追加することで、柔軟に機能を拡張できます。
*   **💧 ストリーム処理への最適化**
    *   大量のデータを効率的に処理するため、WHATWG `ReadableStream` / `TransformStream` を中心に設計されています。これにより、メモリ使用量を抑えつつ、大規模なデータにも対応可能です。
*   **⚡️ 高速な処理性能**
    *   正規表現パターンを事前にコンパイルし、最適化された検出アルゴリズムを採用することで、高いパフォーマンスを実現しています。

## 3. クイックスタート：基本的な使用方法

### 依存関係のインストール

プロジェクトにNorenを導入します。

```sh
pnpm install
```

### 基本的なマスキング処理

以下は、テキストに含まれるPIIをマスキングする基本的なコード例です。

```javascript
import { Registry, redactText } from '@himorishige/noren-core';
import * as jp from '@himorishige/noren-plugin-jp';
import * as us from '@himorishige/noren-plugin-us';

// 検出・マスキングのルールを定義するRegistryを初期化します
const reg = new Registry({
  defaultAction: 'mask', // デフォルトのアクションを「mask」に設定
  rules: {
    credit_card: { action: 'mask', preserveLast4: true }, // クレジットカードは最後の4桁を保持
    jp_my_number: { action: 'remove' }, // マイナンバーは完全に除去
  },
  // 検出精度を向上させるためのコンテキストヒント
  contextHints: ['TEL', '電話', '〒', '住所', 'Zip', 'Address', 'SSN'],
});

// 日本向け・米国向けプラグインを登録します
reg.use(jp.detectors, jp.maskers);
reg.use(us.detectors, us.maskers);

// 処理対象の入力テキスト
const input = '〒150-0001 TEL 090-1234-5678 / SSN 123-45-6789 / Card: 4242 4242 4242 4242';

// マスキング処理を実行します
const output = await redactText(reg, input, { hmacKey: 'a-very-long-and-secure-secret-key-for-testing' });

console.log(output);
// 出力: 〒•••-•••• TEL •••-••••-•••• / SSN •••-••-•••• / Card: **** **** **** 4242
```

## 4. アーキテクチャ概要

Norenは、pnpmワークスペースを利用したモノレポ構成を採用しており、機能ごとにパッケージが分割されています。

| パッケージ名 | 説明 |
| :--- | :--- |
| `@himorishige/noren-core` | コアライブラリ。メールアドレス、IPアドレスなどグローバルなPIIの検出、マスキング、トークン化機能を提供します。 |
| `@himorishige/noren-plugin-jp` | 日本固有のPII（電話番号、郵便番号、マイナンバー）を扱うためのプラグインです。 |
| `@himorishige/noren-plugin-us` | 米国固有のPII（SSN、ZIPコード）を扱うためのプラグインです。 |
| `@himorishige/noren-plugin-security` | APIキーやJWTなど、技術的なクレデンシャル情報を保護するためのセキュリティプラグインです。 |
| `@himorishige/noren-dict-reloader` | HTTP ETagを利用して、検出辞書やポリシーを動的にリロードする機能を提供します。 |

## 5. 主要APIリファレンス

### `Registry`
検出器（Detector）とマスカー（Masker）のルールセットを管理するクラスです。どのようなPIIを、どのように処理するかのポリシーを定義します。

### `redactText(registry, text, options)`
テキストに対して、定義されたポリシーに基づきマスキングやトークン化を適用する非同期関数です。

### `createRedactionTransform()`
WHATWG Streamと連携し、ストリーミングデータに対して継続的にマスキング処理を適用する`TransformStream`を生成します。

## 6. 主な活用事例

### 事例1：アプリケーションログのサニタイズ

ログファイルに含まれる個人情報をマスキングし、安全に保管します。

```javascript
const supportTicket = `
Customer: John Doe (john.doe@example.com)
Phone: +1-555-123-4567
Issue: Payment failed for card 4242 4242 4242 4242.
`;
const masked = await redactText(registry, supportTicket);
console.log(masked);
/*
Customer: John Doe ([REDACTED:email])
Phone: [REDACTED:us_phone]
Issue: Payment failed for card **** **** **** 4242.
*/
```

### 事例2：データのトークン化による匿名化

元の情報の代わりに、一意のトークンに置き換えることで、データの関連性を維持しつつ匿名化を実現します。

```javascript
const customerRecord = {
  email: "jane.smith@example.com",
  phone: "555-987-6543",
};
const tokenized = await redactText(registry, JSON.stringify(customerRecord), {
  rules: { email: { action: 'tokenize' }, us_phone: { action: 'tokenize' } },
  hmacKey: 'a-very-long-and-secure-secret-key-for-tokenization'
});
console.log(JSON.parse(tokenized));
/*
{
  "email": "TKN_EMAIL_a1b2c3d4e5f67890",
  "phone": "TKN_US_PHONE_9f8e7d6c5b4a3210"
}
*/
```

### 事例3：Webサーバーでのリアルタイムマスキング

HonoなどのWebフレームワークと組み合わせ、HTTPリクエスト/レスポンスボディをストリーム処理でマスキングします。

```javascript
//詳細は examples/hono-server.mjs をご参照ください
import { Hono } from 'hono';
const app = new Hono();

app.post('/redact', async (c) => {
  const body = c.req.raw.body; // ReadableStream
  if (!body) return c.text('no body', 400);
  const redacted = body.pipeThrough(createRedactionTransform(registry));
  return new Response(redacted);
});
```

## 7. セキュリティに関する重要な注意事項

本ライブラリは、開発環境での補助や、情報送信前の簡易的なフィルタリングを目的として設計されています。しかし、**提供する機能は完全なセキュリティを保証するものではありません。**

金融情報、医療情報、その他厳格なコンプライアンス要件（GDPR, CCPAなど）が課せられる本番環境のシステムにおいては、本ライブラリのみに依存することはお控えください。

本格的なPII保護が求められる場合は、各クラウドプロバイダーが提供する、より堅牢で高機能なマネージドサービスの利用を強く推奨します。

*   **AWS**: [Amazon Comprehend](https://docs.aws.amazon.com/comprehend/latest/dg/how-pii.html), [Amazon Macie](https://docs.aws.amazon.com/macie/latest/user/what-is-macie.html)
*   **Google Cloud**: [Sensitive Data Protection (Cloud DLP)](https://cloud.google.com/sensitive-data-protection/docs/deidentify-sensitive-data)
*   **Azure**: [Azure AI Language (PII Detection)](https://learn.microsoft.com/azure/ai-services/language-service/personally-identifiable-information/how-to/redact-text-pii)

Norenは、これらの専門的なサービスを補完する補助ツールとしてご活用いただくことを想定しています。

## 8. プロジェクトへの貢献

本プロジェクトへの貢献に興味をお持ちいただきありがとうございます。詳細については、`CONTRIBUTING.md`をご参照ください。
