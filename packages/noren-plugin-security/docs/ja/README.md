# @himorishige/noren-plugin-security

Noren PIIマスキングライブラリのプラグインで、APIキー、JWT、CookieといったWebアプリケーションのセキュリティに関連する機密情報の検出とマスキングに特化しています。

## 主な機能

- **多様なトークン検出**: JWT（JSON Web Token）、プレフィックス付きAPIキー（`sk_`など）、セッションID、UUIDなどを構造的に検出します。
- **HTTPヘッダー対応**: `Authorization`や`X-API-Key`などの機密情報を含むHTTPヘッダーを丸ごと秘匿化します。
- **Cookieの選択的マスキング**: `Cookie`および`Set-Cookie`ヘッダーを解析し、事前に定義した許可リスト（Allowlist）に含まれないCookieのみを安全にマスクします。ワイルドカード（`*`）も利用可能です。
- **URLパラメータのスキャン**: `access_token`や`client_secret`など、URLに含まれがちな機密パラメータを検出します。
- **柔軟な設定**: `createSecurityMaskers`関数を通じて、Cookieの許可リストなどの挙動をカスタマイズできます。

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
