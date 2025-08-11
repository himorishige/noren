# @himorishige/noren-plugin-security

HTTPヘッダー、URLパラメータ、Cookie、トークン構造を検出・マスクするセキュリティプラグインです。  
Norenコアライブラリと組み合わせて、Webアプリケーションの認証・認可情報を安全に処理します。

## 特長

- **JWT Token Detection**: `eyJ*.eyJ*.***` 形式の構造を保持してマスク
- **API Key Detection**: `sk_`, `pk_`, `api_` プリフィックス付きキーの検出
- **HTTP Header Security**: Authorization, X-API-Key等の機密ヘッダーを検出
- **Cookie Allowlist**: 許可リスト機能で必要なCookieのみ保護対象外に
- **URL Parameter Scanning**: アクセストークン、クライアントシークレット等をURL内から検出
- **Session ID Detection**: セッション識別子の検出・マスク
- **UUID & Hex Token**: 長いトークン文字列の検出（文脈ヒント必須）

## インストール

```sh
pnpm add @himorishige/noren-plugin-security
```

## 基本的な使用方法

```typescript
import { Registry, redactText } from '@himorishige/noren-core'
import * as security from '@himorishige/noren-plugin-security'

const registry = new Registry({
  defaultAction: 'mask',
  contextHints: ['Authorization', 'Cookie', 'Bearer', 'token', 'API-Key']
})

registry.use(
  security.detectors,
  security.maskers,
  ['Authorization', 'Bearer', 'Cookie', 'token', 'API-Key']
)

const httpRequest = `
POST /api/users HTTP/1.1
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c
Cookie: session_id=abc123def456; theme=dark; user_pref=collapsed
X-API-Key: sk_live_1234567890abcdef
`

const masked = await redactText(registry, httpRequest)
console.log(masked)
```

**出力結果:**
```
POST /api/users HTTP/1.1
[REDACTED:AUTH]
Cookie: session_id=ab****56; theme=dark; user_pref=collapsed  
[REDACTED:AUTH]
```

## Cookie Allowlist機能

特定のCookieを保護対象外にする場合：

```typescript
import { createSecurityMaskers } from '@himorishige/noren-plugin-security'

const config = {
  cookieAllowlist: ['theme', 'lang', 'consent_*'], // ワイルドカード対応
  strictMode: true
}

const customMaskers = createSecurityMaskers(config)

registry.use(
  security.detectors,
  customMaskers,
  ['Cookie', 'Set-Cookie']
)

const cookieHeader = 'Cookie: session_token=secret123; theme=dark; consent_analytics=true'
const result = await redactText(registry, cookieHeader)

// 結果: "Cookie: session_token=se****23; theme=dark; consent_analytics=true"
// theme と consent_analytics は allowlist により保護されない
```

## 検出されるPII種別

### トークン・認証情報
| Type | 説明 | リスク |
|------|------|---------|
| `sec_jwt_token` | JWT形式 (xxx.yyy.zzz) | High |
| `sec_api_key` | API Key (`sk_`, `pk_` プリフィックス付き) | High |
| `sec_session_id` | セッションID (`session=value`) | High |
| `sec_auth_header` | Authorization ヘッダー | High |

### URL・パラメータ
| Type | 説明 | リスク |
|------|------|---------|
| `sec_url_token` | URLパラメータ内のトークン | High |
| `sec_client_secret` | OAuth クライアントシークレット | High |

### その他の識別子
| Type | 説明 | リスク |
|------|------|---------|
| `sec_uuid_token` | UUID形式のトークン | Medium |
| `sec_hex_token` | 長い16進数文字列 | Medium |
| `sec_cookie` | Cookie値 | Medium |
| `sec_set_cookie` | Set-Cookie値 | Medium |

## 高度な設定

### SecurityConfig オプション

```typescript
interface SecurityConfig {
  cookieAllowlist?: string[]    // 許可するCookie名
  headerAllowlist?: string[]    // 許可するヘッダー名  
  strictMode?: boolean          // 厳格モード
  jwtMinLength?: number         // JWT最小長（デフォルト: 50）
  apiKeyMinLength?: number      // APIキー最小長（デフォルト: 16）
}
```

### カスタムマスキング

```typescript
import { createSecurityMaskers, SECURITY_PATTERNS } from '@himorishige/noren-plugin-security'

const config: SecurityConfig = {
  cookieAllowlist: ['essential_*'],
  strictMode: true,
  jwtMinLength: 100  // より厳格な JWT 検出
}

const customMaskers = createSecurityMaskers(config)
```

## 実用例

### 1. API Gateway ログ処理
```typescript
const apiLog = `
[INFO] GET /api/v1/users?access_token=secret123&page=1
[DEBUG] Headers: {"Authorization": "Bearer eyJ...", "X-API-Key": "sk_live_..."}
`

const sanitized = await redactText(registry, apiLog)
// 機密情報をマスクしてログ保存
```

### 2. デバッグ情報の安全化
```typescript
const debugInfo = `
Request: POST /oauth/token
Body: client_id=app123&client_secret=confidential456
Response: {"access_token": "eyJ...", "refresh_token": "rt_..."}
`

const safeDebug = await redactText(registry, debugInfo)
// 開発者間で共有可能な形式に変換
```

### 3. CDN/Edge での前処理
```typescript
// エッジロケーションでユーザー送信データを前処理
const userInput = request.body
const processed = await redactText(registry, userInput, {
  rules: {
    sec_jwt_token: { action: 'tokenize' },
    sec_api_key: { action: 'remove' }
  }
})
```

## 制限事項

- Cookie allowlist は正確なCookie解析に依存します
- JWT検出は標準的な `eyJ` プリフィックスに基づきます
- 文脈ヒントが重要：適切なキーワードを `contextHints` に含める必要があります
- カスタムトークン形式は追加の正規表現パターンが必要な場合があります

## ライセンス

MIT © himorishige