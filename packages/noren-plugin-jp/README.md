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
- **⚡ v0.6.0**: Improved phone number conflict resolution

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

## Full-Width Character Support

This plugin works seamlessly with full-width (zenkaku) characters through Noren's built-in Unicode NFKC normalization:

```typescript
// Both half-width and full-width characters are detected equally
const halfWidth = '電話: 090-1234-5678'
const fullWidth = '電話: ０９０-１２３４-５６７８'

// Both produce identical masking results
const result1 = await redactText(registry, halfWidth)  // → 電話: •••-••••-••••
const result2 = await redactText(registry, fullWidth)  // → 電話: •••-••••-••••
```

## 🆕 What's New in v0.6.0

### ⚡ Enhanced Postal Code Detection
- **Phone Number Conflict Resolution**: Postal codes are no longer misdetected when they match phone number patterns
- **Improved Accuracy**: `TEL: 03-1234-5678` is correctly identified as a phone number, not a postal code
- **Lightweight Implementation**: Simplified algorithm for better performance while maintaining accuracy

### 🔧 Technical Improvements
- Removed heavy address dictionary dependencies
- Streamlined detection logic focusing on core functionality
- Maintained Noren's "Edge-native, Lightweight" design principles

### 📊 Performance Characteristics
- **Fast Processing**: Optimized for edge environments
- **Low Memory Usage**: Minimal memory footprint
- **Stream-First**: Designed for efficient streaming operations

### Examples of Improved Detection

```typescript
// v0.6.0 correctly distinguishes between phone and postal codes
const testCases = [
  'TEL: 03-1234-5678',           // → Detected as phone_jp
  '〒100-0001 東京都千代田区',     // → Detected as postal_jp (high confidence)
  '住所: 123-4567',              // → Detected as postal_jp (medium confidence)
  'Phone: 090-1111-2222',        // → Detected as phone_jp
]
```