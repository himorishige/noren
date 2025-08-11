# @himorishige/noren-dict-reloader

[English](./README.md) | [日本語](./docs/ja/README.md)

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

## Dictionary files and manifest

The reloader expects a manifest JSON at `dictManifestUrl`, and one or more dictionary JSON files referenced by it.

- Manifest format:

```json
{
  "dicts": [
    { "id": "company", "url": "https://example.com/dicts/company-dict.json" }
  ]
}
```

- Dictionary format (one file per logical group):

```json
{
  "entries": [
    {
      "pattern": "EMP\\d{5}",
      "type": "employee_id",
      "risk": "high",
      "description": "Employee ID format: EMP followed by 5 digits"
    }
  ]
}
```

Notes:

- `pattern`: JavaScript RegExp source string (no leading/trailing slashes). It will typically be compiled with flags `gu`.
- `type`: a string PII type. Can be custom in addition to built-ins.
- `risk`: one of `low` | `medium` | `high`.
- `description`: optional, for documentation only.

Templates:

- See `example/manifest.template.json` and `example/dictionary.template.json` in this package.
- A more complete example is in `examples/dictionary-files/company-dict.json` at the repo root.

## Example: compile() that registers dictionary entries

Below is a minimal compile function that turns the loaded dictionaries into custom detectors and registers them with `Registry`.

```ts
import type { Detector, PiiType, Policy } from '@himorishige/noren-core'
import { Registry } from '@himorishige/noren-core'

type DictEntry = { pattern: string; type: string; risk: 'low' | 'medium' | 'high'; description?: string }
type DictFile = { entries?: DictEntry[] }

function compile(policy: unknown, dicts: unknown[]) {
  const registry = new Registry((policy ?? {}) as Policy)
  const detectors: Detector[] = []

  for (const d of dicts) {
    const entries = (d as DictFile).entries ?? []
    for (const e of entries) {
      if (!e?.pattern || !e?.type || !e?.risk) continue
      let re: RegExp
      try {
        re = new RegExp(e.pattern, 'gu')
      } catch {
        continue
      }
      detectors.push({
        id: `dict:${e.type}:${e.pattern}`,
        priority: 100,
        match: (u) => {
          for (const m of u.src.matchAll(re)) {
            if (m.index === undefined) continue
            u.push({
              type: e.type as PiiType,
              start: m.index,
              end: m.index + m[0].length,
              value: m[0],
              risk: e.risk,
            })
          }
        },
      })
    }
  }

  // Optionally, provide custom maskers or additional context hints:
  // registry.use(detectors, { employee_id: (h) => `EMP_***${h.value.slice(-4)}` }, ['社員番号', 'employee'])
  registry.use(detectors)
  return registry
}
```

## Local files and custom loaders

If you cannot host files over HTTP(S), you can override how files are loaded using the `load` option.

Quick start for local files on Node.js using `file://`:

```ts
import { PolicyDictReloader, fileLoader } from '@himorishige/noren-dict-reloader'

const reloader = new PolicyDictReloader({
  policyUrl: 'file:///abs/path/to/policy.json',
  dictManifestUrl: 'file:///abs/path/to/manifest.json',
  compile,
  load: fileLoader, // enables file:// support; HTTP(S) remains available
})
await reloader.start()
```

Notes:

- `fileLoader` computes ETag from the SHA-256 of file contents and uses file mtime as Last-Modified.
- Non-`file://` URLs are delegated to the built-in HTTP(S) loader.
- You can supply your own loader as a `LoaderFn` to fetch from custom stores.

## Tips

- Ensure your server sends `ETag` or `Last-Modified` and proper CORS headers if used in browsers.
- `onSwap` receives a `changed` list that may include: `policy`, `manifest`, `dict:<id>`, `dict-removed:<id>`.
- `forceReload()` will bust caches by adding a `_bust` query param when needed.