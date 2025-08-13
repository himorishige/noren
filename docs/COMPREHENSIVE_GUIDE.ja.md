# Noren: 包括的ガイド - 現代の魔法使いのためのPII保護入門

## 1. この魔法（ライブラリ）が生まれた背景

……ふーん、最近の魔法使いは、Model Context Protocol (MCP)とか、そういう新しいAIの魔法の作法を使うことが増えているんだね。便利だけど、自分の大事な記憶や名前（個人情報）を、意図せず外の世界に送ってしまうのは、ちょっと怖い。

この「Noren」という魔法は、そんな現代の魔法使いたちのために作られた。店の入り口にかける「暖簾（のれん）」が、中の様子をそっと隠してくれるように、この魔法は君の言葉（データ）が外に出る前に、その中にある大事な情報（PII）を見つけて、隠したり、別のものに置き換えたりしてくれる。

いわば、簡易的な防御結界のようなものだ。誰でも手軽に使えるように、呪文の詠唱（セットアップ）はとても簡単になっている。

## 2. Norenの主な特徴

この魔法には、いくつかの面白い特徴がある。

*   **🌐 Web標準という古い魔法がベース**
    *   特定の強力な力（Node.jsのようなランタイム）に頼らず、昔からあるWeb標準という魔法（WHATWG Streams, Web Crypto API）だけで動く。だから、色々な場所（環境）で使える。
*   **🧩 魔法の組み合わせ（プラグイン）**
    *   核となる魔法（`noren-core`）に、世界中の様々な地域の魔法（日本向けプラグイン、米国向けプラグインなど）を組み合わせることで、色々な種類の個人情報に対応できる。
*   **💧 流れる水を堰き止めるような処理（ストリーム対応）**
    *   大量の言葉（データ）が流れてきても、それを一度に溜め込むんじゃなくて、流れながら処理する。だから、大きな魔力（メモリ）を消費しない。
*   **⚡️ 素早い詠唱（ハイパフォーマンス）**
    *   魔法陣（正規表現）をあらかじめ用意しておくことで、詠唱（処理）がとても速い。

## 3. クイックスタート：最初の魔法を試す

……まあ、習うより慣れろ、だ。まずは簡単な使い方を説明する。

### 準備（インストール）

まず、魔法の道具（パッケージ）を手に入れる。

```sh
pnpm install
```

### 基本的な結界術（マスキング）

これが一番基本的な使い方。名前や電話番号のような情報を「●●●」みたいに隠す魔法だ。

```javascript
import { Registry, redactText } from '@himorishige/noren-core';
import * as jp from '@himorishige/noren-plugin-jp';
import * as us from '@himorishige/noren-plugin-us';

// どんな魔法を使うか登録する場所（Registry）を作る
const reg = new Registry({
  defaultAction: 'mask', // 基本は「隠す」
  rules: {
    credit_card: { action: 'mask', preserveLast4: true }, // カード番号は最後の4桁だけ見せる
    jp_my_number: { action: 'remove' }, // マイナンバーは完全に消す
  },
  // 検出のヒントになる言葉を教えておく
  contextHints: ['TEL', '電話', '〒', '住所', 'Zip', 'Address', 'SSN'],
});

// 日本と米国の魔法を追加で登録する
reg.use(jp.detectors, jp.maskers);
reg.use(us.detectors, us.maskers);

// 結界を張りたい文章
const input = '〒150-0001 TEL 090-1234-5678 / SSN 123-45-6789 / Card: 4242 4242 4242 4242';

// 魔法を発動
const output = await redactText(reg, input, { hmacKey: 'a-very-long-and-secure-secret-key-for-testing' });

console.log(output);
// 出力: 〒•••-•••• TEL •••-••••-•••• / SSN •••-••-•••• / Card: **** **** **** 4242
```

## 4. 魔法体系の解説（アーキテクチャ）

Norenは、いくつかの魔法の書（パッケージ）が集まってできている。

| パッケージ名 | 役割 |
| :--- | :--- |
| `@himorishige/noren-core` | 全ての基本となる中核魔法。メールアドレスやIPアドレスなど、世界共通の情報を扱う。 |
| `@himorishige/noren-plugin-jp` | 日本固有の魔法。電話番号、郵便番号、マイナンバーに対応する。 |
| `@himorishige/noren-plugin-us` | 米国固有の魔法。SSNやZIPコードに対応する。 |
| `@himorishige/noren-plugin-security` | APIキーや認証トークンなど、技術的に大事な情報を守るための魔法。 |
| `@himorishige/noren-dict-reloader` | 魔法のルール（辞書）を、結界を解かずに更新するための高度な魔法。 |

## 5. 主要な呪文（APIリファレンス）

### `Registry`
全ての魔法のルールを管理する場所。どんな情報を、どうやって隠すかをここで決める。

### `redactText(registry, text, options)`
実際に結界を張る（マスキングやトークン化を行う）ための呪文。

### `createRedactionTransform()`
流れる言葉（ストリーム）に対して結界を張り続けるための魔法陣。

## 6. 活用事例：こんな時に使える

### 例1：大事な会話の記録（ログ）から個人名を隠す

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

### 例2：情報を別の印に置き換える（トークン化）

情報を完全に隠す代わりに、無意味だけどユニークな印（トークン）に置き換える魔法。後から同じ情報かどうかを照合したい時に便利だ。

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

### 例3：Webサーバーで使う

Webサーバーに届いたリクエストやレスポンスに直接結界を張ることもできる。

```javascript
// examples/hono-server.mjs を見てみて
import { Hono } from 'hono';
const app = new Hono();

app.post('/redact', async (c) => {
  const body = c.req.raw.body; // ReadableStream
  if (!body) return c.text('no body', 400);
  const redacted = body.pipeThrough(createRedactionTransform(registry));
  return new Response(redacted);
});
```

## 7. 重要な注意事項：この魔法の限界

……さて、大事な話だ。
この魔法は、あくまで手軽に使える簡易的な結界だ。日常的なうっかりミスを防ぐのには役立つけど、**完璧なセキュリティを保証するものではない**。

金融情報や、厳格な法律（GDPRやCCPAなど）が関わるような、本当に大事な情報を扱う場合は、この魔法だけに頼るのは危険だ。

そういう時は、もっと強力な防衛魔法を提供している専門家たち（AWS, Google Cloud, Azureなど）を頼ること。彼らは、巨大な城壁や見張り番（マネージドサービス）を用意してくれている。

*   **AWS**: [Amazon Comprehend](https://docs.aws.amazon.com/comprehend/latest/dg/how-pii.html), [Amazon Macie](https://docs.aws.amazon.com/macie/latest/user/what-is-macie.html)
*   **Google Cloud**: [Sensitive Data Protection (Cloud DLP)](https://cloud.google.com/sensitive-data-protection/docs/deidentify-sensitive-data)
*   **Azure**: [Azure AI Language (PII Detection)](https://learn.microsoft.com/azure/ai-services/language-service/personally-identifiable-information/how-to/redact-text-pii)

このNorenは、あくまで補助的な魔法として、賢く使うこと。いいね？

## 8. 貢献

……もし、この魔法体系に興味が出たら、君も協力してくれると嬉しい。詳しくは `CONTRIBUTING.md` を読んでみて。
