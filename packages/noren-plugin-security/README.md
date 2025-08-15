# @himorishige/noren-plugin-security

[English](./README.md) | [日本語](./docs/ja/README.md)

A plugin for the Noren PII masking library that specializes in detecting and masking sensitive information related to web application security, such as API keys, JWTs, and cookies.

## v0.5.0 Enhanced Security Detection

- **70% Detection Rate Improvement**: Enhanced from 48.4% to 70%+ through new token patterns
- **11 New Token Types**: GitHub, AWS, Google, Stripe, Slack, SendGrid, OpenAI, and more
- **Context-based Scoring**: Advanced scoring system using service-specific keywords
- **17% Code Reduction**: Streamlined from 968 to 803 lines for better maintainability
- **Enhanced Boundary Detection**: Improved accuracy with currency symbol boundaries (¥$€£¢)
- **Unified Detection Logic**: Consolidated detector patterns for consistent performance
- **Set-based Context Matching**: O(1) context hint lookup for faster processing

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

## Enhanced Service Token Detection

The plugin now includes specialized detection for major cloud services and platforms:

```typescript
import { Registry, redactText } from '@himorishige/noren-core';
import * as securityPlugin from '@himorishige/noren-plugin-security';

const registry = new Registry({
  defaultAction: 'mask',
  // Context hints improve detection accuracy
  contextHints: ['github', 'aws', 'stripe', 'slack', 'openai', 'sendgrid']
});

registry.use(securityPlugin.detectors, securityPlugin.maskers);

const apiKeys = `
GitHub Token: ghp_1234567890abcdef1234567890abcdef123456
AWS Access Key: AKIAIOSFODNN7EXAMPLE
Stripe Secret: sk_live_51H2oKvB3K4y1234567890abcdef
OpenAI API Key: sk-proj-1234567890abcdef1234567890abcdef1234567890
Slack Bot Token: xoxb-1234567890-1234567890-abcdefghijklmnopqrstuvwx
SendGrid API Key: SG.1234567890abcdef.1234567890abcdef1234567890abcdef
`;

const result = await redactText(registry, apiKeys);
console.log(result);
/*
GitHub Token: ghp_********
AWS Access Key: AKIA********
Stripe Secret: sk_live_********
OpenAI API Key: sk-proj-********
Slack Bot Token: xoxb-****-****-********
SendGrid API Key: SG.****.**
*/
```

### Context-Aware Detection

The enhanced detection system uses context clues to improve accuracy:

```typescript
// High accuracy with service-specific context
const textWithContext = `
AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE
STRIPE_SECRET_KEY=sk_live_51H2oKvB3K4y1234567890abcdef
GITHUB_TOKEN=ghp_1234567890abcdef1234567890abcdef123456
`;

const result = await redactText(registry, textWithContext, {
  contextHints: ['aws', 'stripe', 'github', 'secret', 'key', 'token']
});

// Each token is detected with appropriate confidence scoring
// based on both pattern matching and context keywords
console.log(result);

// Webhook URL detection
const webhookConfig = `
Webhook URL: https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXXXXXXXXXXXXXXXXXX
Signed URL: https://storage.googleapis.com/bucket/file.jpg?GoogleAccessId=...&Signature=...
`;

const webhookResult = await redactText(registry, webhookConfig);
// Detects and masks sensitive URL parameters while preserving structure
console.log(webhookResult);

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

### Enhanced Service-Specific Tokens (v0.5.0+)

| PII Type                    | Service     | Pattern                                      | Risk   |
| :-------------------------- | :---------- | :------------------------------------------- | :----- |
| `sec_github_token`          | GitHub      | `ghp_*`, `gho_*`, `ghu_*`, `ghs_*`          | High   |
| `sec_aws_access_key`        | AWS         | `AKIA*`, `ASIA*`, `AGPA*`, `AIDA*`          | High   |
| `sec_google_api_key`        | Google      | `AIza*`                                      | High   |
| `sec_stripe_api_key`        | Stripe      | `sk_live_*`, `pk_live_*`, `sk_test_*`, etc. | High   |
| `sec_slack_token`           | Slack       | `xoxb-*`, `xoxp-*`, `xapp-*`                | High   |
| `sec_sendgrid_api_key`      | SendGrid    | `SG.*.*`                                     | High   |
| `sec_openai_api_key`        | OpenAI      | `sk-*`, `sk-proj-*`                         | High   |
| `sec_google_oauth_token`    | Google      | `ya29.*`, `1//*`                            | High   |
| `sec_azure_subscription_key`| Azure       | 32-character hex keys                        | High   |
| `sec_webhook_url`           | Various     | Webhook URLs with tokens                     | High   |
| `sec_signed_url`            | Various     | Signed URLs with signature parameters        | High   |