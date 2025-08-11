# @himorishige/noren-plugin-jp

[English](./README.md) | [日本語](./docs/ja/README.md)

A plugin for the Noren PII masking library that provides detectors and maskers specific to Japanese Personally Identifiable Information (PII).

## Features

- **Detection of Japan-Specific PII**: Detects major types of PII used in Japan.
  - **Phone Numbers**: Mobile (090/080/070/060), landlines with area codes, and international format (+81).
  - **Postal Codes**: Formats like `123-4567` and `1234567`.
  - **My Number**: 12-digit individual identification numbers.
- **High-Accuracy Contextual Detection**: Improves detection accuracy and reduces false positives by using surrounding keywords (context hints) like `"電話"` (phone), `"〒"` (postal mark), and `"マイナンバー"` (My Number).
- **Appropriate Masking**: Provides masking appropriate for each PII type (e.g., `〒123-4567` → `〒•••-••••`).

## Installation

```sh
pnpm add @himorishige/noren-plugin-jp @himorishige/noren-core
```

## Basic Usage

```typescript
import { Registry, redactText } from '@himorishige/noren-core';
import * as jpPlugin from '@himorishige/noren-plugin-jp';

// Initialize the Registry
const registry = new Registry({
  defaultAction: 'mask',
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

| PII Type       | Description          | Masking Example (`mask`) |
| :------------- | :------------------- | :----------------------- |
| `phone_jp`     | Japanese phone number| `•••-••••-••••`          |
| `jp_postal`    | Japanese postal code | `〒•••-••••`             |
| `jp_my_number` | My Number            | `[REDACTED:MYNUMBER]`    |