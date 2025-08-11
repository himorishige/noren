# @himorishige/noren-core

The core package for the Noren PII masking library.

This package provides the `Registry` class, which acts as the engine for PII detection, masking, and tokenization, along with key functions and the foundational type definitions for the plugin architecture.

## Features

- **Plugin Architecture**: Flexibly add and manage detectors and maskers through the `Registry` class.
- **Rich Actions**: Apply `mask`, `remove`, or `tokenize` actions to detected PII based on a ruleset.
- **Common PII Detection**: Natively detects globally common PII types such as email addresses, IPv4/IPv6 addresses, MAC addresses, and credit card numbers (with a Luhn algorithm check).
- **Web Standards-Compliant**: Built on web standards like WHATWG Streams and the Web Crypto API, making it independent of specific runtimes.
- **HMAC Tokenization**: Supports deterministic tokenization based on HMAC-SHA256 using the Web Crypto API.

## Installation

```sh
pnpm add @himorishige/noren-core
```

## Basic Usage

```typescript
import { Registry, redactText } from '@himorishige/noren-core';

// Create a Registry instance and define basic rules
const registry = new Registry({
  // Default action is 'mask'
  defaultAction: 'mask',
  // Set individual rules for specific PII types
  rules: {
    credit_card: { action: 'mask', preserveLast4: true }, // Keep the last 4 digits of credit cards
    email: { action: 'tokenize' }, // Tokenize email addresses
  },
});

const inputText = 'Contact: user@example.com, Card Number: 4242-4242-4242-4242';

// Execute the redaction process
// An hmacKey is required for tokenization
const redactedText = await redactText(registry, inputText, {
  hmacKey: 'a-very-secure-secret-key-of-sufficient-length',
});

console.log(redactedText);
// Output: Contact: TKN_EMAIL_5de1e4e7a3b4b5c6, Card Number: **** **** **** 4242
```

## API Overview

- `Registry`: The central class for managing detectors, maskers, and masking policies.
- `redactText(registry, text, policy)`: Executes the redaction process on the given text based on the rules registered in the Registry.
- `normalize(text)`: Normalizes text (NFKC, unifies whitespace, etc.).
- **Type Definitions**: Provides types necessary for plugin development, such as `PiiType`, `Hit`, `Action`, `Policy`, `Detector`, and `Masker`.