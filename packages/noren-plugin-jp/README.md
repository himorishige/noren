# @himorishige/noren-plugin-jp

[![npm version](https://img.shields.io/npm/v/@himorishige/noren-plugin-jp.svg)](https://www.npmjs.com/package/@himorishige/noren-plugin-jp)

**Japanese PII detection plugin for Noren**

Specialized detectors and maskers for Japanese Personally Identifiable Information (PII) including phone numbers, postal codes, and My Number (マイナンバー).

## ✨ Features

### 📞 **Phone Numbers**
- **Mobile**: 090, 080, 070, 060 prefixes
- **Landline**: Area codes with proper validation  
- **International**: +81 format support
- **Context-aware**: Uses hints like "電話", "TEL"

### 📮 **Postal Codes** 
- **Standard format**: `123-4567`
- **Numeric format**: `1234567`
- **Context detection**: "〒", "住所" hints
- **Smart masking**: `〒123-4567` → `〒•••-••••`

### 🆔 **My Number (マイナンバー)**
- **12-digit validation**: Proper checksum verification
- **Context required**: Only detects with "マイナンバー", "個人番号" hints
- **High security**: `[REDACTED:MYNUMBER]` output

## 🚀 Installation

```bash
npm install @himorishige/noren-plugin-jp @himorishige/noren-core
```

## Basic Usage

```typescript
import { Registry, redactText } from '@himorishige/noren-core';
import * as jpPlugin from '@himorishige/noren-plugin-jp';

// Initialize the Registry
const registry = new Registry({
  defaultAction: 'mask',
  enableConfidenceScoring: true, // v0.4.0: Improved accuracy
  environment: 'production',
  // Set relevant keywords as hints to improve detection accuracy
  contextHints: ['電話', '住所', '〒', 'マイナンバー'],
});

// Register the detectors and maskers from the Japan plugin
registry.use(jpPlugin.detectors, jpPlugin.maskers);

const inputText = 'My phone number is 090-1234-5678, and my address is 〒150-0001.';

// Execute the redaction process
const redactedText = await redactText(registry, inputText);

console.log(redactedText);
// Output: My phone number is •••-••••-••••, and my address is 〒•••-••••.
```

## Detected Types

| PII Type       | Description          | Masking Example (`mask`) | v0.5.0 |
| :------------- | :------------------- | :----------------------- | :------ |
| `phone_jp`     | Japanese phone number| `•••-••••-••••`          | ✓ Renamed |
| `postal_jp`    | Japanese postal code | `〒•••-••••`             | ✓ Renamed |
| `mynumber_jp`  | My Number            | `[REDACTED:MYNUMBER]`    | ✓ Renamed |