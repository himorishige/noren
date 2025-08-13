# @himorishige/noren-core

[English](./README.md) | [日本語](./docs/ja/README.md)

The core package for the Noren PII masking library.

This package provides the `Registry` class, which acts as the engine for PII detection, masking, and tokenization, along with key functions and the foundational type definitions for the plugin architecture.

## Features

### Core Functionality
- **Plugin Architecture**: Flexibly add and manage detectors and maskers through the `Registry` class.
- **Rich Actions**: Apply `mask`, `remove`, or `tokenize` actions to detected PII based on a ruleset.
- **Common PII Detection**: Natively detects globally common PII types such as email addresses, IPv4/IPv6 addresses, MAC addresses, and credit card numbers (with a Luhn algorithm check).
- **Web Standards-Compliant**: Built on web standards like WHATWG Streams and the Web Crypto API, making it independent of specific runtimes.
- **HMAC Tokenization**: Supports deterministic tokenization based on HMAC-SHA256 using the Web Crypto API.

### Advanced Features (v0.2.0+)
- **🎯 Confidence Scoring (P1)**: Dynamic confidence scores (0.0-1.0) for each detection, reducing false positives by up to 60%
- **🧠 Contextual Awareness (P2)**: Smart detection of sample data vs. real PII using document structure and context markers, reducing false positives by up to 80%
- **📊 Performance Optimization (P3)**: Built-in benchmarking, A/B testing framework, and metrics collection for continuous improvement
- **🔍 Rule Visualization**: Debug and visualize contextual confidence rules with detailed performance analysis
- **📈 Statistics Engine**: Configurable statistical backends with support for high-precision libraries like @stdlib

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

## Production Usage with Environment Variables

For production environments, it's recommended to store the HMAC key in environment variables:

```typescript
import { Registry, redactText } from '@himorishige/noren-core';

// .env file:
// NOREN_HMAC_KEY=your-32-character-or-longer-secret-key-here-for-production

const registry = new Registry({
  defaultAction: 'tokenize',
  hmacKey: process.env.NOREN_HMAC_KEY, // Load from environment variable
});

const inputText = 'Contact: user@example.com, Card: 4242-4242-4242-4242';
const redactedText = await redactText(registry, inputText);

console.log(redactedText);
// Output: Contact: TKN_EMAIL_abc123def456789, Card: TKN_CREDIT_CARD_789abc123def456
```

### Security Best Practices

- **Key Length**: Use at least 32 characters for the HMAC key (minimum requirement)
- **Environment Variables**: Never hardcode keys in source code
- **Key Rotation**: Regularly rotate HMAC keys in production
- **Separate Keys**: Use different keys for development, staging, and production environments

### Edge Runtime Support

The library works in edge environments like Cloudflare Workers and Vercel Edge Functions:

```typescript
// Cloudflare Workers
export default {
  async fetch(request, env) {
    const registry = new Registry({
      hmacKey: env.NOREN_HMAC_KEY, // Cloudflare environment variable
    });
    // ... processing logic
  }
};

// Vercel Edge Functions
export default async function handler(request) {
  const registry = new Registry({
    hmacKey: process.env.NOREN_HMAC_KEY, // Vercel environment variable
  });
  // ... processing logic
}
```

## Advanced Features Usage

### Confidence Scoring and Contextual Awareness

```typescript
import { Registry } from '@himorishige/noren-core';

// Enable advanced features for production
const registry = new Registry({
  defaultAction: 'mask',
  
  // P1: Confidence scoring
  enableConfidenceScoring: true,
  confidenceThreshold: 0.7, // Only process high-confidence detections
  
  // P2: Contextual awareness
  enableContextualConfidence: true,
  contextualSuppressionEnabled: true, // Suppress sample data
  contextualBoostEnabled: false, // Start conservative
});

// Process mixed content with sample data
const mixedText = `
Production user: admin@company.com
Example: user@example.com
Test data: test@dummy.com
`;

const result = await registry.detect(mixedText);
// Only "admin@company.com" will be detected - sample data suppressed
```

### A/B Testing and Optimization

```typescript
import { ABTestEngine, AB_TEST_SCENARIOS } from '@himorishige/noren-core';

// Create A/B testing engine with high-precision statistics
const engine = new ABTestEngine({
  statisticsBackend: 'stdlib', // Uses @stdlib for better accuracy
  fallbackToNative: true
});

// Run predefined contextual confidence test
const testResult = await engine.runABTest({
  ...AB_TEST_SCENARIOS.contextualConfidence,
  sample_size_per_variant: 500,
  confidence_level: 0.95
});

console.log(`Winner: ${testResult.winner?.variant_id}`);
console.log(`Improvement: ${testResult.winner?.improvement_percentage}%`);
```

### Rule Debugging and Visualization

```typescript
import { 
  calculateContextualConfidenceWithDebug,
  visualizeRules,
  DEFAULT_CONTEXTUAL_CONFIG 
} from '@himorishige/noren-core';

// Visualize all contextual rules
const ruleViz = visualizeRules(DEFAULT_CONTEXTUAL_CONFIG);
console.log('Rule categories:', ruleViz.map(r => r.category));

// Debug specific detection
const debugResult = calculateContextualConfidenceWithDebug(
  hit, text, baseConfidence
);

console.log('Applied rules:', debugResult.explanations);
console.log('Performance:', debugResult.debug.total_execution_time_ms);
```

### Performance Monitoring

```typescript
import { 
  BenchmarkRunner,
  InMemoryMetricsCollector,
  setMetricsCollector 
} from '@himorishige/noren-core';

// Set up metrics collection
const metricsCollector = new InMemoryMetricsCollector();
setMetricsCollector(metricsCollector);

// Your normal PII processing...
const result = await registry.detect(text);

// View performance metrics
const summary = metricsCollector.getMetricsSummary();
console.log('Average processing time:', summary['noren.performance.duration_ms'].avg);
```

## API Overview

- `Registry`: The central class for managing detectors, maskers, and masking policies.
- `redactText(registry, text, policy)`: Executes the redaction process on the given text based on the rules registered in the Registry.
- `normalize(text)`: Normalizes text (NFKC, unifies whitespace, etc.).
- **Type Definitions**: Provides types necessary for plugin development, such as `PiiType`, `Hit`, `Action`, `Policy`, `Detector`, and `Masker`.

## Documentation

### Advanced Features Guide
- 📖 **[Advanced Features Guide (日本語)](../../docs/advanced-features-ja.md)** - Comprehensive guide to P1-P3 features including confidence scoring, contextual awareness, and A/B testing
- 📊 **[Statistical Library Evaluation](../../docs/statistical-library-evaluation.md)** - Technical analysis of statistical computation backends

### Core Documentation
- 📚 **[Implementation Details (日本語)](../../docs/implementation-details-ja.md)** - Detailed technical implementation information
- 🚀 **[Migration Guide (日本語)](../../docs/migration-guide-ja.md)** - Migration guide for upgrading between versions