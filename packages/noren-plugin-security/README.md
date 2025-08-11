# @himorishige/noren-plugin-security

A plugin for the Noren PII masking library that specializes in detecting and masking sensitive information related to web application security, such as API keys, JWTs, and cookies.

## Features

- **Diverse Token Detection**: Structurally detects JWTs (JSON Web Tokens), prefixed API keys (`sk_`, etc.), session IDs, and UUIDs.
- **HTTP Header Support**: Redacts entire sensitive HTTP headers like `Authorization` and `X-API-Key`.
- **Selective Cookie Masking**: Parses `Cookie` and `Set-Cookie` headers and safely masks only the cookies not included in a predefined allowlist. Wildcards (`*`) are supported.
- **URL Parameter Scanning**: Detects sensitive parameters often found in URLs, such as `access_token` and `client_secret`.
- **Flexible Configuration**: The `createSecurityMaskers` function allows you to customize behavior, such as the cookie allowlist.

## Installation

```sh
pnpm add @himorishige/noren-plugin-security @himorishige/noren-core
```

## Basic Usage

```typescript
import { Registry, redactText } from '@himorishige/noren-core';
import * as securityPlugin from '@himorishige/noren-plugin-security';

const registry = new Registry({
  defaultAction: 'mask',
  contextHints: ['Authorization', 'Cookie', 'Bearer', 'token', 'API-Key'],
});

// Register the security plugin
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

### Cookie Allowlist Feature

You can exclude specific cookies (e.g., for UI preferences) from being masked.

```typescript
import { createSecurityMaskers } from '@himorishige/noren-plugin-security';

// Create custom maskers with an allowlist for specific cookie names
const customMaskers = createSecurityMaskers({
  cookieAllowlist: ['theme', 'lang', 'consent_*'], // Wildcards are supported
});

// Register the custom maskers
registry.use(securityPlugin.detectors, customMaskers);

const cookieHeader = 'Cookie: session_token=secret123; theme=dark; consent_analytics=true';
const result = await redactText(registry, cookieHeader);

// Result: "Cookie: session_token=se****23; theme=dark; consent_analytics=true"
// 'theme' and 'consent_analytics' are not masked because they are in the allowlist.
console.log(result);
```

## Detected Types

| PII Type          | Description                     | Risk   |
| :---------------- | :------------------------------ | :----- |
| `sec_jwt_token`   | JWT (JSON Web Token)            | High   |
| `sec_api_key`     | API Key (`sk_`, `pk_`, etc.)    | High   |
| `sec_auth_header` | `Authorization` Header          | High   |
| `sec_session_id`  | Session ID (`session=...`)      | High   |
| `sec_url_token`   | Token in URL parameter          | High   |
| `sec_client_secret`| OAuth Client Secret            | High   |
| `sec_cookie`      | Cookie value                    | Medium |
| `sec_set_cookie`  | `Set-Cookie` value              | Medium |
| `sec_uuid_token`  | UUID-formatted token            | Medium |
| `sec_hex_token`   | Long hexadecimal string token   | Medium |