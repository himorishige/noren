# Noren (暖簾)

`Noren`は、**爆速**・**超軽量**・**美しくシンプル**なWeb標準ベースの個人情報(PII)マスキング＆トークナイズライブラリです。

「Noren (暖簾)」は、アプリケーションのエッジで個人情報を無駄な複雑さなしに保護します。日本の「暖簾」がエレガントなままプライバシーを守るように、Norenは125KB以下のサイズでシステムにデータが到達する前にPIIや機密情報を瞬時にマスクします。

サーバーサイドNode.jsはもちろん、Cloudflare Workersのようなエッジコンピューティング環境や、Deno、Bunなど、Web標準APIをサポートする様々なJavaScriptランタイムで動作するように設計されています。

> **ステータス: v0.4.0 ベータ版**
> このリリースはシンプルさとパフォーマンスに焦点を当てています。高度な機能は`@himorishige/noren-devtools`で利用できます。

## 🚀 3つの核心理念

- **⚡ 高速 (FAST)**: 事前コンパイルパターン、最適化アルゴリズム、サブミリ秒検出
- **🪶 軽量 (LIGHTWEIGHT)**: < 125KBバンドル (v0.3.xから65%小型化)、依存関係なし
- **✨ シンプル (SIMPLE)**: 一行セットアップ、合理的デフォルト、最小限の設定

## 主な特長

*   **⚡ 高速な処理性能**
    *   正規表現パターンを事前にコンパイルし、検出アルゴリズムを最適化することで、大量のテキストデータでも高速に処理します。

*   **🧩 プラグインによる柔軟な拡張**
    *   軽量なコア機能（共通PII検出、マスキング、トークナイズ）に加え、国別のプラグイン（日本、米国など）を組み合わせることで、各地域の固有フォーマット（マイナンバー、社会保障番号など）に柔軟に対応できます。

*   **🌐 Web標準技術への準拠**
    *   [WHATWG Streams](https://streams.spec.whatwg.org/)、[Web Crypto API](https://developer.mozilla.org/ja/docs/Web/API/Web_Crypto_API)、[fetch](https://developer.mozilla.org/ja/docs/Web/API/Fetch_API)といったWeb標準APIのみで構築されており、特定のJavaScriptランタイムに依存しません。

*   **🔄 動的な辞書・ポリシー更新**
    *   HTTPのETagを利用して、アプリケーションを停止することなく、検出ルールやカスタム辞書を動的に更新（ホットリロード）できます。

*   **🛡️ 幅広いセキュリティ対応**
    *   個人情報だけでなく、HTTPヘッダーに含まれる認証トークンやAPIキー、Cookieといった技術的な機密情報も検出し、安全に秘匿化できます。

## パッケージ構成

| パッケージ名                             | 説明                                                               |
| :--------------------------------------- | :----------------------------------------------------------------- |
| `@himorishige/noren-core`                | コアAPI。共通のPII（メールアドレス、IPアドレス等）検出、マスキング、トークナイズ機能、信頼度スコアリングを提供します。 |
| `@himorishige/noren-devtools`            | 開発ツール。ベンチマーク、A/Bテスト、精度評価、パフォーマンスモニタリング機能を提供します。 |
| `@himorishige/noren-plugin-jp`           | 日本向けプラグイン。電話番号、郵便番号、マイナンバー等を検出・マスクします。 |
| `@himorishige/noren-plugin-us`           | 米国向けプラグイン。電話番号、ZIPコード、SSN等を検出・マスクします。 |
| `@himorishige/noren-plugin-security`     | セキュリティプラグイン。HTTPヘッダー、APIトークン、Cookie等を秘匿化します。 |
| `@himorishige/noren-dict-reloader`       | ETagを利用し、ポリシーや辞書を動的にリロードする機能を提供します。 |

## 動作要件

*   Node.js **20.10以上**

## ⚡ まずは試してみよう (30秒セットアップ)

**高速・軽量・シンプル** — すぐに動作確認できます：

```bash
npm install @himorishige/noren-core
```

```typescript
import { Registry, redactText } from '@himorishige/noren-core'

// ⚡ 高速: 一行セットアップ、設定不要
const registry = new Registry({ defaultAction: 'mask' })

// 🪶 軽量: 瞬時検出、重い処理なし
const result = await redactText(registry, 'Email: test@example.com, Card: 4242-4242-4242-4242')

// ✨ シンプル: クリーンな出力、期待通りの結果
console.log(result)
// 出力: Email: [REDACTED:email], Card: [REDACTED:credit_card]
```

**これだけ！** 高速検出、軽量フットプリント、シンプルAPI。🚀

## クイックスタート

### **基本的な使い方**
```typescript
import { Registry, redactText } from '@himorishige/noren-core'
import * as jp from '@himorishige/noren-plugin-jp'
import * as security from '@himorishige/noren-plugin-security'
import * as us from '@himorishige/noren-plugin-us'

// 検出・マスク処理のルールを定義するRegistryを作成
const reg = new Registry({
  defaultAction: 'mask', // デフォルトのアクションはマスク
  enableConfidenceScoring: true, // v0.4.0: 精度向上の新機能
  environment: 'production', // 環境に応じた自動調整
  // 特定のPIIタイプに対するルールを個別に設定
  rules: {
    credit_card: { action: 'mask', preserveLast4: true }, // クレカは末尾4桁を保持
    jp_my_number: { action: 'remove' }, // マイナンバーは完全に除去
  },
  // 検出精度を上げるためのヒントとなるキーワード
  contextHints: ['TEL','電話','〒','住所','Zip','Address','SSN','Authorization','Bearer','Cookie']
})

    // 各国・用途別のプラグインを登録
    reg.use(jp.detectors, jp.maskers);
    reg.use(us.detectors, us.maskers);
    reg.use(security.detectors, security.maskers);

    // 処理対象のテキスト
    const input = '〒150-0001 TEL 090-1234-5678 / SSN 123-45-6789 / Card: 4242 4242 4242 4242 / Authorization: Bearer eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.signature';

// PIIをマスク・除去（トークナイズする場合はhmacKeyを指定）
const out = await redactText(reg, input)

console.log(out)
// 出力: 〒•••-•••• TEL •••-••••-•••• / SSN •••-••-•••• / Card: **** **** **** 4242 / [REDACTED:AUTH]
```

4.  **本番環境での環境変数利用**

    本番環境では、HMACキーを環境変数に安全に保存してください：

    ```ts
    // .env ファイル:
    // NOREN_HMAC_KEY=your-32-character-or-longer-secret-key-here-for-production

const reg = new Registry({
  defaultAction: 'tokenize',
  hmacKey: process.env.NOREN_HMAC_KEY, // 環境変数から読み込み（最低32文字必要）
})

    const input = 'Email: user@example.com, Card: 4242 4242 4242 4242';
    const out = await redactText(reg, input);
    console.log(out);
    // 出力: Email: TKN_EMAIL_abc123def456789, Card: TKN_CREDIT_CARD_789def456123abc
    ```

    **セキュリティのベストプラクティス:**
    - HMACキーは最低32文字以上を使用する（必須要件）
    - ソースコードにシークレットをハードコードしない
    - 開発・ステージング・本番環境で異なるキーを使用する
    - 本番環境では定期的にキーをローテーションする
    ```

## ユースケースと実践例

`Noren`は、様々なシーンで機密データを保護するために活用できます。

#### 🔒 カスタマーサポートのログ管理

サポートの問い合わせログを外部システムに保存する前に、個人情報をマスクします。

```ts
const supportTicket = `
顧客: 田中太郎 (tanaka@example.com)
電話: 090-1234-5678
問題: カード 4242 4242 4242 4242 の決済が失敗しました。
`;
const masked = await redactText(registry, supportTicket);
console.log(masked);
/*
顧客: 田中太郎 ([REDACTED:email])
電話: •••-••••-••••
問題: カード **** **** **** 4242 の決済が失敗しました。
*/
```

#### 📊 アプリケーションログのサニタイズ

ログの構造を維持したまま、IPアドレスやメールアドレスなどの個人情報だけを安全に除去します。

```ts
const logEntry = `
[INFO] ユーザー 192.168.1.100 が account@company.com にアクセスしました。
[ERROR] 決済失敗: SSN 123-45-6789, カード: 5555-4444-3333-2222
`;
const sanitized = await redactText(registry, logEntry);
console.log(sanitized);
/*
[INFO] ユーザー [REDACTED:ipv4] が [REDACTED:email] にアクセスしました。
[ERROR] 決済失敗: [REDACTED:us_ssn], カード: **** **** **** 2222
*/
```

#### 🔄 データ移行（ETL）でのトークン化

データベース移行時に、元の値との関連性を保ちつつ、機密データをトークンに置き換えます。

```ts
const customerRecord = {
  name: "佐藤花子",
  email: "sato@example.jp",
  phone: "070-9876-5432",
};
const tokenized = await redactText(registry, JSON.stringify(customerRecord), {
  rules: { email: { action: 'tokenize' }, phone_jp: { action: 'tokenize' } },
  hmacKey: 'migration-secret-key-for-tokenization' // トークン化にはHMACキーが必須
});
console.log(JSON.parse(tokenized));
/*
{
  name: "佐藤花子",
  email": "TKN_EMAIL_f3e2d1c0b9a85674",
  phone": "TKN_PHONE_JP_6c7d8e9f0a1b2345"
}
*/
```

#### 🔐 HTTPリクエスト/レスポンスの秘匿化

APIサーバーのログから、認証トークンや機密情報を含むヘッダーを秘匿化します。

```ts
const httpLog = `
POST /api/users HTTP/1.1
Authorization: Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.signature
X-API-Key: sk_live_1234567890abcdef
Cookie: session_id=abc123secret;
`;
const sanitizedLog = await redactText(registry, httpLog);
console.log(sanitizedLog);
/*
POST /api/users HTTP/1.1
[REDACTED:AUTH]
sk_live_****
Cookie: se*****ret;
*/
```

#### 📖 カスタム辞書による独自ルールの適用

社内固有のID（社員番号など）やプロジェクトコードといった、独自の機密情報を検出対象に追加します。

```ts
// 1. 辞書やポリシーを定義したJSONファイルを用意
// policy.json: {"defaultAction": "mask", "rules": {"employee_id": {"action": "tokenize"}}}
// company-dict.json: {"entries": [{"pattern": "EMP\d{5}", "type": "employee_id", "risk": "high"}]}

// 2. PolicyDictReloaderで動的に読み込む
import { PolicyDictReloader } from '@himorishige/noren-dict-reloader';
const reloader = new PolicyDictReloader({ /* ...設定... */ });
await reloader.start();
const registry = reloader.getCompiled();

// 3. カスタムルールでテキストを処理
const text = '社員ID: EMP12345、プロジェクトコード: PROJ-ALPHA-2024';
const redacted = await redactText(registry, text);
console.log(redacted); // 社員ID: TKN_EMPLOYEE_ID_...、プロジェクトコード: [REDACTED:PROJECT_CODE]
```

その他のコードサンプルは`examples/`ディレクトリにあります。

## マネージドサービスの利用（推奨）

コンプライアンス準拠が厳格に求められる本番環境や大規模なワークロードでは、各クラウドプロバイダーが提供するマネージドサービスの利用を強く推奨します。

*   **AWS**: [Amazon Comprehend (PII検出・秘匿化)](https://docs.aws.amazon.com/comprehend/latest/dg/how-pii.html), [Amazon Macie (S3データ検出)](https://docs.aws.amazon.com/macie/latest/user/what-is-macie.html)
*   **Google Cloud**: [Sensitive Data Protection (Cloud DLP)](https://cloud.google.com/sensitive-data-protection/docs/deidentify-sensitive-data)
*   **Azure**: [Azure AI Language (PII検出)](https://learn.microsoft.com/azure/ai-services/language-service/personally-identifiable-information/how-to/redact-text-pii)

`Noren`は、あくまで**エッジ環境や開発、ストリーミングの前処理などを補助する軽量なツール**であり、単体でGDPRやCCPAなどの法規制への準拠を保証するものではありません。

## 免責事項

本ソフトウェアは**現状のまま（AS IS）**提供され、いかなる保証もいたしません。個人情報の検出漏れや誤検出が発生する可能性があります。最終的な出力の確認と、各種法令への準拠は、利用者自身の責任で行ってください。本リポジトリのいかなる情報も、法的助言を構成するものではありません。

## ライセンス

[MIT](./LICENSE) © himorishige