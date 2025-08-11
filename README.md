# Noren

Edge‑native PII redaction and tokenization with country plugins (JP/US first).  
Built on **Web Standards** (WHATWG Streams, WebCrypto, fetch). Node 20+ only.

> Status: **alpha**. Interfaces may change.

## Features
- **High Performance**: Pre-compiled regex patterns, optimized context hints, and efficient detection algorithms
- Lightweight core: normalization, common detectors (email/IP/credit card), masking & HMAC tokenization
- Pluggable country modules (JP/US) for local formats and dictionaries
- Stream‑first: works with WHATWG `ReadableStream`/`TransformStream`
- Web‑standards only: no Node‑specific APIs beyond the standard globals
- Policy + dictionary hot‑reload via ETag/If‑None‑Match
- **Enhanced Detection**: Improved IPv6 patterns, comprehensive Japanese phone numbers (060/070/080/090)

## Packages
- `@himorishige/noren-core` — core APIs (global detectors, masking/tokenization)
- `@himorishige/noren-plugin-jp` — Japan: phone/postal/MyNumber detectors + maskers
- `@himorishige/noren-plugin-us` — US: phone/ZIP/SSN detectors + maskers
- `@himorishige/noren-dict-reloader` — ETag‑based policy/dictionary hot‑reloader

## Requirements
- Node.js **20.10+**

## Quick start
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

## Use Cases & Examples

### Real-World Applications

**🔒 Customer Support Systems**
```ts
// Mask customer data in support tickets before storing in external systems
const supportTicket = `
Customer: John Doe (john.doe@example.com)
Phone: +1-555-123-4567
Issue: Payment failed for card 4242 4242 4242 4242
`;
const masked = await redactText(registry, supportTicket);
console.log(masked);
```
**Output:**
```
Customer: John Doe ([REDACTED:email])
Phone: [REDACTED:phone_e164]  
Issue: Payment failed for card **** **** **** 4242
```

**📊 Analytics & Logging**  
```ts
// Remove PII from application logs while preserving structure
const logEntry = `
[INFO] User 192.168.1.100 accessed account@company.com 
[ERROR] Failed payment: SSN 123-45-6789, Card: 5555-4444-3333-2222
`;
const sanitized = await redactText(registry, logEntry);
console.log(sanitized);
```
**Output:**
```
[INFO] User [REDACTED:ipv4] accessed [REDACTED:email]
[ERROR] Failed payment: [REDACTED:us_ssn], Card: **** **** **** 2222
```

**🌐 Edge/CDN Processing**
```ts
// Pre-process user content at edge locations before forwarding
const userContent = `Contact us: support@acme.com or call 080-1234-5678`;
const stream = new ReadableStream({ /* user input */ })
  .pipeThrough(createRedactionTransform())
  .pipeTo(destinationStream);
```

**🔄 Data Migration & ETL**
```ts
// Tokenize sensitive fields during database migrations
const customerRecord = {
  name: "田中太郎", 
  email: "tanaka@example.jp",
  phone: "090-1234-5678",
  address: "〒150-0001 東京都渋谷区"
};
const tokenized = await redactText(registry, JSON.stringify(customerRecord), {
  rules: { email: { action: 'tokenize' }, phone_jp: { action: 'tokenize' } },
  hmacKey: 'migration-secret-key-for-tokenization'
});
console.log(tokenized);
```
**Output:**
```json
{
  "name": "田中太郎",
  "email": "TKN_EMAIL_a1b2c3d4e5f67890",
  "phone": "TKN_PHONE_JP_9f8e7d6c5b4a3210",
  "address": "〒•••-•••• 東京都渋谷区"
}
```

**🧪 Development & Testing**
```ts
// Generate safe test data from production dumps
const prodData = `
User: alice@company.com, CC: 4111-1111-1111-1111
Location: 192.168.100.50, ZIP: 94105
`;
const testData = await redactText(registry, prodData);
console.log(testData);
```
**Output:**
```
User: [REDACTED:email], CC: **** **** **** 1111
Location: [REDACTED:ipv4], ZIP: [REDACTED:us_zip]
```

### Code Examples
- `node examples/basic-redact.mjs` — basic masking
- `node examples/tokenize.mjs` — HMAC‑based tokenization
- `node examples/detect-dump.mjs` — dump detections
- `node examples/stream-redact.mjs` — streaming redaction
- `pnpm add -w -D hono @hono/node-server && node examples/hono-server.mjs` — Hono endpoint (`/redact`)

## Managed alternatives (recommended)
For production or regulated workloads, consider **managed PII services**:

- **AWS**: [Amazon Comprehend — Detect/Redact PII](https://docs.aws.amazon.com/comprehend/latest/dg/how-pii.html)  
  Also see **[Amazon Macie](https://docs.aws.amazon.com/macie/latest/user/what-is-macie.html)** for sensitive data discovery in S3.
- **Google Cloud**: [Sensitive Data Protection (Cloud DLP)](https://cloud.google.com/sensitive-data-protection/docs/deidentify-sensitive-data)
- **Azure**: [Azure AI Language — PII detection](https://learn.microsoft.com/azure/ai-services/language-service/personally-identifiable-information/how-to/redact-text-pii)

Noren is a **lightweight helper** for edge/dev/stream pre‑processing and **does not provide compliance guarantees**.

## Performance

Recent optimizations have significantly improved performance:
- **Large text processing**: ~1.5ms for 100 PII elements
- **Repeated detection**: 1000 iterations in ~7ms (0.007ms per call)  
- **Context hint processing**: 500 iterations with 20+ hints in ~4.5ms

### Security Requirements
- **HMAC keys** must be at least 16 characters long for tokenization
- **IPv6 detection** now supports compressed notation (`::`) and mixed formats
- **Japanese phone numbers** include all current mobile prefixes (060, 070, 080, 090)

## Disclaimer
Noren is provided **"AS IS"**, without warranties of any kind. It may miss or misclassify personal data.  
You are responsible for reviewing outputs and ensuring regulatory compliance (e.g., GDPR/CCPA, sectoral rules).  
Not intended for safety‑critical use. Nothing in this repository constitutes legal advice.

## License
MIT © himorishige
