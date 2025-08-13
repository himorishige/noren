# @himorishige/noren-plugin-security

[English](./README.md) | [日本語](./docs/ja/README.md)

A plugin for the Noren PII masking library that specializes in detecting and masking sensitive information related to web application security, such as API keys, JWTs, and cookies.

## v0.5.0 Performance Optimizations

- **17% Code Reduction**: Streamlined from 968 to 803 lines for better maintainability
- **Enhanced Boundary Detection**: Improved accuracy with currency symbol boundaries (¥$€£¢)
- **Unified Detection Logic**: Consolidated detector patterns for consistent performance
- **Set-based Context Matching**: O(1) context hint lookup for faster processing
- **Advanced Confidence Scoring**: Enhanced JWT and API key validation algorithms

## Features

- **Smart Token Detection**: Advanced structural detection of JWTs, API keys with prefixes (`sk_`, `pk_`, etc.), session IDs, and UUIDs with enhanced confidence scoring
- **HTTP Header Security**: Complete redaction of sensitive headers like `Authorization` and `X-API-Key` with context-aware validation
- **Intelligent Cookie Management**: Sophisticated parsing of `Cookie` and `Set-Cookie` headers with allowlist support and wildcard patterns (`*`)
- **URL Parameter Protection**: Comprehensive scanning for sensitive URL parameters (`access_token`, `client_secret`, etc.) with risk-based classification
- **Enhanced Boundary Detection**: Improved accuracy with currency symbol boundaries to prevent false positives
- **Configurable Security Levels**: Flexible `createSecurityMaskers` function with customizable allowlists and strict mode options
- **Performance Optimized**: Streamlined detection logic with O(1) context matching and pre-compiled patterns

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