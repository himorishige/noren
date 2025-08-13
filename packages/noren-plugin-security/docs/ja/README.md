# @himorishige/noren-plugin-security

Noren PIIマスキングライブラリのプラグインで、APIキー、JWT、CookieといったWebアプリケーションのセキュリティに関連する機密情報の検出とマスキングに特化しています。

## v0.5.0 パフォーマンス最適化

- **17%のコード削減**: 968行から803行に削減し、保守性を大幅に向上
- **境界検出の強化**: 通貨記号境界（¥$€£¢）により誤検知を削減
- **統一された検出ロジック**: 一貫したパフォーマンスのために検出パターンを統合
- **Set ベースのコンテキスト照合**: O(1) のコンテキストヒント検索で高速化
- **高度な信頼度スコアリング**: JWTとAPIキー検証アルゴリズムの強化

## 主な機能

- **スマートなトークン検出**: 信頼度スコアリング強化により、JWT、プレフィックス付きAPIキー（`sk_`、`pk_` など）、セッションID、UUIDを高精度で構造検出
- **HTTPヘッダーセキュリティ**: コンテキスト対応検証による `Authorization` および `X-API-Key` などの機密ヘッダーの完全な秘匿化
- **インテリジェントCookie管理**: 許可リスト対応とワイルドカードパターン（`*`）による `Cookie` および `Set-Cookie` ヘッダーの高度な解析
- **URLパラメータ保護**: リスクベース分類による機密URLパラメータ（`access_token`、`client_secret` など）の包括的スキャン
- **境界検出の強化**: 通貨記号境界により誤検知を防ぎ、精度を向上
- **設定可能なセキュリティレベル**: カスタマイズ可能な許可リストと厳密モードオプションを備えた柔軟な `createSecurityMaskers` 関数
- **パフォーマンス最適化**: O(1) コンテキスト照合と事前コンパイル済みパターンによる効率的な検出ロジック

## インストール

```sh
pnpm add @himorishige/noren-plugin-security @himorishige/noren-core
```

## 基本的な使い方

```typescript
import { Registry, redactText } from '@himorishige/noren-core';
import * as securityPlugin from '@himorishige/noren-plugin-security';

const registry = new Registry({
  defaultAction: 'mask',
  contextHints: ['Authorization', 'Cookie', 'Bearer', 'token', 'API-Key'],
});

// セキュリティプラグインを登録
registry.use(securityPlugin.detectors, securityPlugin.maskers);

const httpLog = `
POST /api/users HTTP/1.1
Authorization: Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjMifQ.SflKxwR...
Cookie: session_id=abc123def456; theme=dark
X-API-Key: sk_live_1234567890abcdef
`;

const maskedLog = await redactText(registry, httpLog);
console.log(maskedLog);
/*
POST /api/users HTTP/1.1
[REDACTED:AUTH]
Cookie: session_id=ab****56; theme=dark
[REDACTED:API_KEY]
*/
```

### Cookieの許可リスト機能

特定のCookie（例: UI設定など）をマスキング対象から除外できます。

```typescript
import { createSecurityMaskers } from '@himorishige/noren-plugin-security';

// 許可するCookie名を指定して、カスタムマスカーを作成
const customMaskers = createSecurityMaskers({
  cookieAllowlist: ['theme', 'lang', 'consent_*'], // ワイルドカードも利用可能
});

// カスタムマスカーを登録
registry.use(securityPlugin.detectors, customMaskers);

const cookieHeader = 'Cookie: session_token=secret123; theme=dark; consent_analytics=true';
const result = await redactText(registry, cookieHeader);

// 結果: "Cookie: session_token=se****23; theme=dark; consent_analytics=true"
// 'theme'と'consent_analytics'は許可リストに含まれるため、マスクされない
console.log(result);
```

## 検出対象

| PIIタイプ | 説明 | リスク |
| :--- | :--- | :--- |
| `sec_jwt_token` | JWT (JSON Web Token) | High |
| `sec_api_key` | APIキー (`sk_`, `pk_` 等) | High |
| `sec_auth_header` | `Authorization` ヘッダー | High |
| `sec_session_id` | セッションID (`session=...`) | High |
| `sec_url_token` | URLパラメータ内のトークン | High |
| `sec_client_secret` | OAuthクライアントシークレット | High |
| `sec_cookie` | Cookieの値 | Medium |
| `sec_set_cookie` | `Set-Cookie` の値 | Medium |
| `sec_uuid_token` | UUID形式のトークン | Medium |
| `sec_hex_token` | 長い16進数文字列のトークン | Medium |
