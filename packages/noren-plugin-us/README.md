# @himorishige/noren-plugin-us

[English](./README.md) | [日本語](./docs/ja/README.md)

A plugin for the Noren PII masking library that provides detectors and maskers specific to United States Personally Identifiable Information (PII).

## Features

- **Detection of US-Specific PII**: Detects major types of PII used in the United States.
  - **Phone Numbers**: Common formats like `(123) 456-7890` and `+1-123-456-7890`.
  - **ZIP Codes**: 5-digit (`12345`) and 9-digit (`12345-6789`) formats.
  - **Social Security Numbers (SSN)**: `123-45-6789` format.
- **High-Accuracy Contextual Detection**: Improves detection accuracy and reduces false positives by using surrounding keywords (context hints) like `"ZIP"` and `"SSN"`.
- **Appropriate Masking**: Provides masking appropriate for each PII type, such as preserving the last 4 digits of an SSN.

## Installation

```sh
pnpm add @himorishige/noren-plugin-us @himorishige/noren-core
```

## Basic Usage

```typescript
import { Registry, redactText } from '@himorishige/noren-core';
import * as usPlugin from '@himorishige/noren-plugin-us';

// Initialize the Registry
const registry = new Registry({
  defaultAction: 'mask',
  enableConfidenceScoring: true, // v0.4.0: Improved accuracy
  environment: 'production',
  // Set relevant keywords as hints to improve detection accuracy
  contextHints: ['Phone', 'Address', 'ZIP', 'SSN'],
});

// Register the detectors and maskers from the US plugin
registry.use(usPlugin.detectors, usPlugin.maskers);

const inputText = 'My SSN is 123-45-6789 and my ZIP code is 94105.';

// Execute the redaction process
const redactedText = await redactText(registry, inputText);

console.log(redactedText);
// Output: My SSN is ***-**-6789 and my ZIP code is •••••.
```

## Detected Types

| PII Type   | Description                | Masking Example (`mask`)      | v0.5.0 |
| :--------- | :------------------------- | :---------------------------- | :------ |
| `phone_us` | US phone number            | `(•••) •••-••••`              | ✓ Renamed |
| `zip_us`   | US ZIP code                | `•••••` or `•••••-••••`       | ✓ Renamed |
| `ssn_us`   | Social Security Number (SSN) | `***-**-6789`                 | ✓ Renamed |