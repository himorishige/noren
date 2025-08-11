# Noren

国別プラグインで拡張できる、**エッジ向けPIIマスキング／トークナイズ**ライブラリです（まずは JP / US）。  
**Web標準API**（WHATWG Streams / WebCrypto / fetch）のみで動作し、Node 20+ を前提とします。

> ステータス：**アルファ版**（インターフェースは今後変更される可能性があります）

## 特長
- **高性能化**：事前コンパイル済み正規表現、最適化されたコンテキストヒント、効率的な検出アルゴリズム
- 軽量なコア：正規化、共通の検出器（email / IP / クレカ）、マスクとHMACトークナイズ
- 国別プラグイン（JP / US）：各地域の形式や辞書に対応
- ストリーム前提：WHATWGの `ReadableStream` / `TransformStream` で処理可能
- Web標準のみ：Node固有APIに依存しません（標準グローバルのみ）
- ポリシー／辞書のETag対応ホットリロード
- **強化された検出**：IPv6圧縮記法対応、日本携帯番号の網羅的サポート（060/070/080/090）

## パッケージ
- `@himorishige/noren-core` — コアAPI（共通検出器、マスク／トークナイズ）
- `@himorishige/noren-plugin-jp` — 日本向け：電話／郵便番号／マイナンバーの検出とマスク
- `@himorishige/noren-plugin-us` — 米国向け：電話／ZIP／SSNの検出とマスク
- `@himorishige/noren-plugin-security` — HTTPヘッダー、トークン、Cookieのセキュリティ秘匿化
- `@himorishige/noren-dict-reloader` — ETagを用いたポリシー・辞書のホットリロード

## 動作要件
- Node.js **20.10以上**

## クイックスタート
```sh
pnpm i
pnpm build
```

```ts
import { Registry, redactText } from '@himorishige/noren-core';
import * as jp from '@himorishige/noren-plugin-jp';
import * as security from '@himorishige/noren-plugin-security';
import * as us from '@himorishige/noren-plugin-us';

const reg = new Registry({
  defaultAction: 'mask',
  rules: { credit_card: { action: 'mask', preserveLast4: true }, jp_my_number: { action: 'remove' } },
  contextHints: ['TEL','電話','〒','住所','Zip','Address','SSN','Authorization','Bearer','Cookie']
});
reg.use(jp.detectors, jp.maskers, ['〒','住所','TEL','Phone']);
reg.use(us.detectors, us.maskers, ['Zip','Address','SSN','Phone']);
reg.use(security.detectors, security.maskers, ['Authorization','Bearer','Cookie','X-API-Key','token']);

const input = '〒150-0001 TEL 090-1234-5678 / SSN 123-45-6789 / Card: 4242 4242 4242 4242 / Authorization: Bearer eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.signature';
const out = await redactText(reg, input, { hmacKey: 'this-is-a-secure-key-16plus-chars' });
console.log(out);
```

## 使用事例とサンプル

### 実際の活用場面

**🔒 カスタマーサポートシステム**
```ts
// サポートチケットの顧客データを外部システム保存前にマスク
const supportTicket = `
顧客: 田中太郎 (tanaka@example.com)
電話: 090-1234-5678
問題: カード 4242 4242 4242 4242 の決済が失敗
Authorization: Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjMifQ.signature
`;
const masked = await redactText(registry, supportTicket);
console.log(masked);
```
**出力結果:**
```
顧客: 田中太郎 ([REDACTED:email])
電話: •••-••••-••••
問題: カード **** **** **** 4242 の決済が失敗
[REDACTED:AUTH]
```

**📊 分析・ログ処理**
```ts
// アプリケーションログから個人情報を除去しつつ構造を保持
const logEntry = `
[INFO] ユーザー 192.168.1.100 が account@company.com にアクセス
[ERROR] 決済失敗: SSN 123-45-6789, カード: 5555-4444-3333-2222
`;
const sanitized = await redactText(registry, logEntry);
console.log(sanitized);
```
**出力結果:**
```
[INFO] ユーザー [REDACTED:ipv4] が [REDACTED:email] にアクセス
[ERROR] 決済失敗: [REDACTED:us_ssn], カード: **** **** **** 2222
```

**🌐 エッジ・CDN処理**
```ts
// エッジロケーションでユーザーコンテンツを転送前に前処理
const userContent = `お問い合わせ: support@acme.com または 080-1234-5678`;
const stream = new ReadableStream({ /* ユーザー入力 */ })
  .pipeThrough(createRedactionTransform())
  .pipeTo(destinationStream);
```

**🔄 データ移行・ETL**
```ts
// データベース移行時に機密フィールドをトークン化
const customerRecord = {
  name: "佐藤花子", 
  email: "sato@example.jp",
  phone: "070-9876-5432",
  address: "〒100-0001 東京都千代田区千代田"
};
const tokenized = await redactText(registry, JSON.stringify(customerRecord), {
  rules: { email: { action: 'tokenize' }, phone_jp: { action: 'tokenize' } },
  hmacKey: 'migration-secret-key-for-tokenization'
});
console.log(tokenized);
```
**出力結果:**
```json
{
  "name": "佐藤花子",
  "email": "TKN_EMAIL_f3e2d1c0b9a85674",
  "phone": "TKN_PHONE_JP_6c7d8e9f0a1b2345",
  "address": "〒•••-•••• 東京都千代田区千代田"
}
```

**🧪 開発・テスト環境**
```ts
// 本番データダンプから安全なテストデータを生成
const prodData = `
ユーザー: alice@company.com, カード: 4111-1111-1111-1111
場所: 192.168.100.50, 郵便番号: 〒100-0001
`;
const testData = await redactText(registry, prodData);
console.log(testData);
```
**出力結果:**
```
ユーザー: [REDACTED:email], カード: **** **** **** 1111
場所: [REDACTED:ipv4], 郵便番号: 〒•••-••••
```

**📱 モバイルアプリ・Web API**
```ts
// フォーム送信データをサーバー処理前にクライアントサイドで前処理
const formData = `
氏名: 山田太郎
メール: yamada@example.jp  
電話: 060-1111-2222
住所: 〒150-0043 東京都渋谷区道玄坂
`;
const processed = await redactText(registry, formData, {
  rules: { 
    email: { action: 'tokenize' },
    phone_jp: { action: 'mask' },
    jp_postal: { action: 'mask' }
  },
  hmacKey: 'mobile-app-secret-key-for-tokenization'
});
console.log(processed);
```
**出力結果:**
```
氏名: 山田太郎
メール: TKN_EMAIL_8a9b0c1d2e3f4567
電話: •••-••••-••••
住所: 〒•••-•••• 東京都渋谷区道玄坂
```

**🔐 HTTPセキュリティヘッダー・APIトークン**
```ts
// HTTPリクエストから認証トークンや機密ヘッダーを秘匿化
const httpLog = `
POST /api/users HTTP/1.1
Authorization: Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.signature
X-API-Key: sk_live_1234567890abcdef
Cookie: session_id=abc123secret; theme=dark; user_pref=enabled
`;
const sanitizedLog = await redactText(registry, httpLog, {
  hmacKey: 'secure-key-for-http-logs'
});
console.log(sanitizedLog);
```
**出力結果:**
```
POST /api/users HTTP/1.1
[REDACTED:AUTH]
sk_live_****
Cookie: se*****ret; theme=dark; user_pref=enabled
```

**📖 カスタム辞書・ポリシー管理**
```ts
// ドメイン固有のPII検出用カスタム辞書とホットリロード機能を使用
import { PolicyDictReloader } from '@himorishige/noren-dict-reloader';

// コンパイル関数：ポリシー + 辞書を Registry に変換
function compile(policy, dicts) {
  const registry = new Registry(policy);
  
  // 各辞書を処理してカスタム検出器・マスカーを作成
  for (const dict of dicts) {
    const { entries = [] } = dict;
    const customDetectors = [];
    const customMaskers = {};
    
    for (const entry of entries) {
      // 辞書エントリごとに検出器を作成
      if (entry.pattern) {
        customDetectors.push({
          id: `custom.${entry.type}`,
          match: ({ src, push }) => {
            const regex = new RegExp(entry.pattern, 'gi');
            for (const m of src.matchAll(regex)) {
              if (m.index !== undefined) {
                push({
                  type: entry.type,
                  start: m.index,
                  end: m.index + m[0].length,
                  value: m[0],
                  risk: entry.risk || 'medium'
                });
              }
            }
          }
        });
        // カスタムマスカーを作成
        customMaskers[entry.type] = () => `[REDACTED:${entry.type.toUpperCase()}]`;
      }
    }
    
    registry.use(customDetectors, customMaskers);
  }
  
  return registry;
}

// ETagベースホットリロード対応の辞書リローダーをセットアップ
const reloader = new PolicyDictReloader({
  policyUrl: 'https://example.com/policy.json',
  dictManifestUrl: 'https://example.com/manifest.json',
  compile,
  onSwap: (newRegistry, changed) => {
    console.log('辞書が更新されました:', changed);
    // 以降のマスキング処理で newRegistry を使用
  },
  onError: (error) => console.error('リロード失敗:', error)
});

await reloader.start();
const registry = reloader.getCompiled();

// 辞書強化版registryを使用
const text = '社員ID: EMP12345、プロジェクトコード: PROJ-ALPHA-2024';
const redacted = await redactText(registry, text);
console.log(redacted); // 社員ID: [REDACTED:EMPLOYEE_ID]、プロジェクトコード: [REDACTED:PROJECT_CODE]
```

**辞書ファイル構造:**
- **manifest.json**: `{"dicts": [{"id": "company", "url": "https://example.com/company-dict.json"}]}`
- **policy.json**: `{"defaultAction": "mask", "rules": {"employee_id": {"action": "tokenize"}}}`
- **company-dict.json**: `{"entries": [{"pattern": "EMP\\d{5}", "type": "employee_id", "risk": "high"}]}`

### コードサンプル
- `node examples/basic-redact.mjs` — 基本的なマスキング
- `node examples/tokenize.mjs` — HMACベースのトークナイズ
- `node examples/detect-dump.mjs` — 検出結果のダンプ
- `node examples/stream-redact.mjs` — ストリームでの赤入れ処理
- `node examples/security-demo.mjs` — securityプラグインによるHTTPヘッダー・トークン処理
- `node examples/dictionary-demo.mjs` — カスタム辞書とホットリロード機能
- `pnpm add -w -D hono @hono/node-server && node examples/hono-server.mjs` — Honoエンドポイント（`/redact`）

## マネージド代替（推奨）
本番用途や規制準拠が求められるケースでは、各クラウドの **マネージドPIIサービス** の利用をご検討ください。

- **AWS**: [Amazon Comprehend — Detect/Redact PII](https://docs.aws.amazon.com/comprehend/latest/dg/how-pii.html)  
  あわせて **[Amazon Macie](https://docs.aws.amazon.com/macie/latest/user/what-is-macie.html)**（S3内の機微データ検出）も有用です。
- **Google Cloud**: [Sensitive Data Protection (Cloud DLP)](https://cloud.google.com/sensitive-data-protection/docs/deidentify-sensitive-data)
- **Azure**: [Azure AI Language — PII detection](https://learn.microsoft.com/azure/ai-services/language-service/personally-identifiable-information/how-to/redact-text-pii)

Norenは**エッジ／開発／ストリーム前処理**向けの軽量な補助ツールであり、**コンプライアンス準拠を保証するものではありません**。

## パフォーマンス

最適化により処理性能が大幅に向上しました：
- **大規模テキスト処理**：100個のPII要素を約1.5msで処理
- **繰り返し検出**：1000回の検出を約7ms（1回あたり0.007ms）で完了
- **コンテキストヒント処理**：20個以上のヒントを用いた500回処理を約4.5msで完了

### セキュリティ要件
- **HMACキー**：トークナイズには16文字以上のキーが必要
- **IPv6検出**：圧縮記法（`::`）やミックス形式に対応
- **日本の携帯電話番号**：現在の全携帯プリフィックスに対応（060、070、080、090）

## 免責事項
Norenは **現状のまま（AS IS）** 提供され、いかなる保証もいたしません。誤検出・見落としが発生し得ます。  
出力の確認および各種法令（GDPR/CCPA等）への準拠は、利用者ご自身の責任でお願いします。  
本リポジトリの情報は**法的助言ではありません**。安全保障・人体に関わる用途などの**高リスク用途には適しません**。

## ライセンス
MIT © himorishige
