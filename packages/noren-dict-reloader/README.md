# @himorishige/noren-dict-reloader

An extension package for the Noren PII masking library that provides functionality to dynamically load and periodically update (hot-reload) redaction policies and custom dictionaries from remote URLs.

## Features

- **Dynamic Configuration Loading**: Loads policy and dictionary files over HTTP(S) and applies them to Noren's `Registry`.
- **Efficient Update-Checking**: Uses HTTP `ETag` headers for differential checks, reducing network traffic by only downloading files when they have changed.
- **Hot-Reloading**: Periodically reloads configurations in the background to keep them up-to-date without application restarts.
- **Flexible Retry Logic**: If an update fails, it retries using exponential backoff and jitter to avoid overwhelming the server.
- **Custom Compilation**: Allows users to freely implement the logic for transforming loaded policies and dictionaries into a `Registry`.

## Installation

```sh
pnpm add @himorishige/noren-dict-reloader @himorishige/noren-core
```

## Basic Usage

```typescript
import { Registry } from '@himorishige/noren-core';
import { PolicyDictReloader } from '@himorishige/noren-dict-reloader';

// Define a compile function to transform the policy and dictionaries into a Registry
function compile(policy, dicts) {
  const registry = new Registry(policy);
  // Implement logic here to parse the contents of dicts,
  // create custom detectors, and register them using registry.use().
  console.log('Compiled with new policy and dictionaries.');
  return registry;
}

// Initialize the reloader
const reloader = new PolicyDictReloader({
  policyUrl: 'https://example.com/noren-policy.json',
  dictManifestUrl: 'https://example.com/noren-manifest.json',
  compile,
  intervalMs: 60000, // Check for updates every 60 seconds
  onSwap: (newRegistry, changed) => {
    console.log('Configuration updated. Changed files:', changed);
    // Here, you would swap the application's Registry instance with the new one
  },
  onError: (error) => {
    console.error('Failed to reload dictionary:', error);
  },
});

// Start the hot-reloading process
await reloader.start();

// Get the initial compiled Registry instance to start using it
const initialRegistry = reloader.getCompiled();
```