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
import * as us from '@himorishige/noren-plugin-us';

const reg = new Registry({
  defaultAction: 'mask',
  rules: { credit_card: { action: 'mask', preserveLast4: true }, jp_my_number: { action: 'remove' } },
  contextHints: ['TEL','電話','〒','住所','Zip','Address','SSN','Social Security']
});
reg.use(jp.detectors, jp.maskers, ['〒','住所','TEL','Phone']);
reg.use(us.detectors, us.maskers, ['Zip','Address','SSN','Phone']);

const input = '〒150-0001 TEL 090-1234-5678 / SSN 123-45-6789 / 4242 4242 4242 4242';
const out = await redactText(reg, input, { hmacKey: 'this-is-a-secure-key-16plus-chars' });
console.log(out);
```

## サンプル
- `node examples/basic-redact.mjs` — 基本的なマスキング
- `node examples/tokenize.mjs` — HMACベースのトークナイズ
- `node examples/detect-dump.mjs` — 検出結果のダンプ
- `node examples/stream-redact.mjs` — ストリームでの赤入れ処理
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
