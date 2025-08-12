# Noren (暖簾)

[English](./README.md) | [日本語](./docs/ja/README.md)

A fast, lightweight PII (Personally Identifiable Information) masking and tokenization library built on **Web Standards**.

Noren (暖簾) is a fast, lightweight PII masking library that protects data at your application's "edge". Like the Japanese "noren"
(shop curtain) that hangs at an entrance to provide privacy, Noren instantly masks sensitive data like PII and API keys within data
streams before they reach your core system.

It is designed to run in various JavaScript environments that support web standards, including server-side Node.js, edge computing platforms like Cloudflare Workers, Deno, and Bun.

> **Status: Alpha**
> Please note that APIs and other specifications may change in the future as the project is under active development.

## Key Features

*   **⚡ High Performance**
    *   Achieves high-speed processing even for large text data by using pre-compiled regular expression patterns and optimized detection algorithms.
    *   IPv6 detection using two-phase parsing approach for improved accuracy and performance.

*   **🎯 Advanced False Positive Reduction** (New in v0.3.0)
    *   Environment-aware allowlist/denylist functionality to prevent false positives in development/test environments.
    *   Automatic exclusion of test domains (example.com, localhost) and private IPs based on environment.
    *   Customizable allowlist and denylist for fine-grained control over detection.

*   **🧩 Flexible Plugin Architecture**
    *   In addition to a lightweight core (for common PII detection, masking, and tokenization), it flexibly supports region-specific formats (like My Number in Japan or SSN in the US) through country-specific plugins.

*   **🌐 Built on Web Standards**
    *   Constructed solely with Web Standard APIs like [WHATWG Streams](https://streams.spec.whatwg.org/), [Web Crypto API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Crypto_API), and [fetch](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API), ensuring it does not depend on any specific JavaScript runtime.

*   **🔄 Dynamic Dictionary & Policy Reloading**
    *   Utilizes HTTP ETags to dynamically update detection rules and custom dictionaries (hot-reloading) without needing to restart the application.

*   **🛡️ Comprehensive Security Coverage**
    *   Detects and securely redacts not only personal information but also technical sensitive data such as authentication tokens, API keys, and cookies found in HTTP headers.

## Package Structure

| Package Name                             | Description                                                               |
| :--------------------------------------- | :----------------------------------------------------------------- |
| `@himorishige/noren-core`                | The core API, providing common PII (email, IP address, etc.) detection, masking, and tokenization. |
| `@himorishige/noren-plugin-jp`           | A plugin for Japan, for detecting and masking phone numbers, postal codes, and My Number. |
| `@himorishige/noren-plugin-us`           | A plugin for the US, for detecting and masking phone numbers, ZIP codes, and SSNs. |
| `@himorishige/noren-plugin-security`     | A security plugin for redacting HTTP headers, API tokens, and cookies. |
| `@himorishige/noren-dict-reloader`       | Provides functionality to dynamically reload policies and dictionaries using ETags. |

## Requirements

*   Node.js **20.10+**

## Quick Start

1.  **Installation**
    ```sh
    pnpm i
    ```

2.  **Build**
    ```sh
    pnpm build
    ```

3.  **Basic Usage**
    ```ts
    import { Registry, redactText } from '@himorishige/noren-core';
    import * as jp from '@himorishige/noren-plugin-jp';
    import * as security from '@himorishige/noren-plugin-security';
    import * as us from '@himorishige/noren-plugin-us';

    // Create a Registry to define detection and masking rules
    const reg = new Registry({
      defaultAction: 'mask', // Default action is 'mask'
      environment: 'production', // Set environment (production/test/development)
      // Set individual rules for specific PII types
      rules: {
        credit_card: { action: 'mask', preserveLast4: true }, // Keep the last 4 digits for credit cards
        jp_my_number: { action: 'remove' }, // Completely remove My Number
      },
      // Keywords to use as hints for improving detection accuracy
      contextHints: ['TEL','電話','〒','住所','Zip','Address','SSN','Authorization','Bearer','Cookie']
    });

    // Register plugins for different regions and purposes
    reg.use(jp.detectors, jp.maskers);
    reg.use(us.detectors, us.maskers);
    reg.use(security.detectors, security.maskers);

    // Input text to be processed
    const input = '〒150-0001 TEL 090-1234-5678 / SSN 123-45-6789 / Card: 4242 4242 4242 4242 / Authorization: Bearer eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.signature';

    // Mask or remove PII (an hmacKey is required for tokenization)
    const out = await redactText(reg, input, { hmacKey: 'this-is-a-secure-key-16plus-chars' });

    console.log(out);
    // Output: 〒•••-•••• TEL •••-••••-•••• / SSN •••-••-•••• / Card: **** **** **** 4242 / [REDACTED:AUTH]
    ```

4.  **Environment-Aware Configuration** (New in v0.3.0)

    Noren now supports environment-specific configuration to reduce false positives in development and testing:

    ```ts
    // Development/Test Environment
    const devRegistry = new Registry({
      defaultAction: 'mask',
      environment: 'test', // Automatically excludes test patterns
      allowDenyConfig: {
        allowPrivateIPs: true, // Allow private IPs (192.168.*, 10.*, etc.)
        allowTestPatterns: true, // Allow test@example.com, localhost, etc.
        customAllowlist: new Map([
          ['email', new Set(['support@mycompany.com'])] // Custom exceptions
        ])
      }
    });

    // Production Environment
    const prodRegistry = new Registry({
      defaultAction: 'tokenize',
      environment: 'production', // Strict detection
      hmacKey: process.env.NOREN_HMAC_KEY,
      allowDenyConfig: {
        allowPrivateIPs: false, // Detect private IPs
        customDenylist: new Map([
          ['email', new Set(['noreply@'])] // Force detection of no-reply emails
        ])
      }
    });

    // Test environment automatically excludes common test patterns
    const testInput = 'Contact: test@example.com, IP: 192.168.1.1, Real: user@gmail.com';
    const devResult = await redactText(devRegistry, testInput);
    console.log(devResult);
    // Output: Contact: test@example.com, IP: 192.168.1.1, Real: [REDACTED:email]

    const prodResult = await redactText(prodRegistry, testInput);
    console.log(prodResult);
    // Output: Contact: TKN_EMAIL_abc123, IP: TKN_IPV4_def456, Real: TKN_EMAIL_ghi789
    ```

5.  **Production Usage with Environment Variables**

    For production environments, store the HMAC key securely in environment variables:

    ```ts
    // .env file:
    // NOREN_HMAC_KEY=your-32-character-or-longer-secret-key-here-for-production

    const reg = new Registry({
      defaultAction: 'tokenize',
      environment: 'production',
      hmacKey: process.env.NOREN_HMAC_KEY, // Load from environment variable
    });
    ```

    **Security Best Practices:**
    - Use at least 32 characters for HMAC keys (minimum requirement)
    - Never hardcode secrets in source code
    - Use different keys for development, staging, and production
    - Rotate keys regularly in production environments

## Use Cases & Examples

`Noren` can be used to protect sensitive data in various scenarios.

#### 🔒 Managing Customer Support Logs

Mask personal information in support tickets before storing them in external systems.

```ts
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

#### 📊 Sanitizing Application Logs

Safely remove PII like IP addresses and email addresses from logs while preserving the log structure.

```ts
const logEntry = `
[INFO] User 192.168.1.100 accessed account@company.com.
[ERROR] Payment failed: SSN 123-45-6789, Card: 5555-4444-3333-2222
`;
const sanitized = await redactText(registry, logEntry);
console.log(sanitized);
/*
[INFO] User [REDACTED:ipv4] accessed [REDACTED:email].
[ERROR] Payment failed: [REDACTED:us_ssn], Card: **** **** **** 2222
*/
```

#### 🔄 Tokenization for Data Migration (ETL)

Replace sensitive data with tokens during database migrations, preserving the ability to correlate data without exposing the original values.

```ts
const customerRecord = {
  name: "Jane Smith",
  email: "jane.smith@example.com",
  phone: "555-987-6543",
};
const tokenized = await redactText(registry, JSON.stringify(customerRecord), {
  rules: { email: { action: 'tokenize' }, us_phone: { action: 'tokenize' } },
  hmacKey: 'migration-secret-key-for-tokenization' // hmacKey is required for tokenization
});
console.log(JSON.parse(tokenized));
/*
{
  "name": "Jane Smith",
  "email": "TKN_EMAIL_a1b2c3d4e5f67890",
  "phone": "TKN_US_PHONE_9f8e7d6c5b4a3210"
}
*/
```

#### 🔐 Redacting HTTP Requests/Responses

Redact authentication tokens and other sensitive headers from API server logs.

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

#### 📖 Applying Custom Rules with Dictionaries

Add custom detection rules for internal identifiers, such as employee IDs or project codes.

```ts
// 1. Prepare JSON files for your policy and dictionary
// policy.json: {"defaultAction": "mask", "rules": {"employee_id": {"action": "tokenize"}}}
// company-dict.json: {"entries": [{"pattern": "EMP\\d{5}", "type": "employee_id", "risk": "high"}]}

// 2. Load them dynamically with PolicyDictReloader
import { PolicyDictReloader } from '@himorishige/noren-dict-reloader';
const reloader = new PolicyDictReloader({ /* ...config... */ });
await reloader.start();
const registry = reloader.getCompiled();

// 3. Process text with your custom rules
const text = 'Employee ID: EMP12345, Project Code: PROJ-ALPHA-2024';
const redacted = await redactText(registry, text);
console.log(redacted); // Employee ID: TKN_EMPLOYEE_ID_..., Project Code: [REDACTED:PROJECT_CODE]
```

More examples are available in the `examples/` directory.

## Managed Alternatives (Recommended)

For production environments or workloads with strict compliance requirements, we strongly recommend considering managed PII services from cloud providers.

*   **AWS**: [Amazon Comprehend (Detect and Redact PII)](https://docs.aws.amazon.com/comprehend/latest/dg/how-pii.html), [Amazon Macie (S3 Data Discovery)](https://docs.aws.amazon.com/macie/latest/user/what-is-macie.html)
*   **Google Cloud**: [Sensitive Data Protection (Cloud DLP)](https://cloud.google.com/sensitive-data-protection/docs/deidentify-sensitive-data)
*   **Azure**: [Azure AI Language (PII Detection)](https://learn.microsoft.com/azure/ai-services/language-service/personally-identifiable-information/how-to/redact-text-pii)

`Noren` is a lightweight tool intended to assist with pre-processing in edge, development, or streaming contexts and **does not guarantee compliance** with regulations like GDPR or CCPA on its own.

## Disclaimer

This software is provided **"AS IS"**, without warranty of any kind. It may fail to detect or misclassify personal information. You are solely responsible for reviewing the output and ensuring compliance with all applicable laws and regulations. Nothing in this repository constitutes legal advice.

## License

[MIT](./LICENSE) © himorishige
