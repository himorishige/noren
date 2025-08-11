# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Noren is an edge-native PII (Personally Identifiable Information) redaction and tokenization library built on Web Standards (WHATWG Streams, WebCrypto, fetch). It provides lightweight core functionality with pluggable country-specific modules for detecting and masking sensitive data.

## Common Development Commands

### Install dependencies
```sh
pnpm i
```

### Build all packages
```sh
pnpm build
```

### Run tests for all packages
```sh
pnpm test
```

### Run tests for a specific package
```sh
# Example for noren-core
cd packages/noren-core
pnpm test
```

### Type checking
```sh
pnpm typecheck
```

### Linting
```sh
pnpm lint
```

### Format code
```sh
pnpm format       # Auto-format
pnpm format:check # Check formatting without changing files
```

### Full CI check (lint + format)
```sh
pnpm check
```

## Architecture

### Monorepo Structure (pnpm workspaces)

The project uses pnpm workspaces with four main packages:

1. **@himorishige/noren-core** (`packages/noren-core/`)
   - Core detection logic for global PII types (email, IP, credit card)
   - Registry system for managing detectors and maskers
   - Streaming capabilities using WHATWG Streams
   - HMAC-based tokenization using WebCrypto API

2. **@himorishige/noren-plugin-jp** (`packages/noren-plugin-jp/`)
   - Japan-specific detectors: phone numbers, postal codes, MyNumber
   - Japanese context hints and masking patterns

3. **@himorishige/noren-plugin-us** (`packages/noren-plugin-us/`)
   - US-specific detectors: phone numbers, ZIP codes, SSN
   - US context hints and masking patterns

4. **@himorishige/noren-dict-reloader** (`packages/noren-dict-reloader/`)
   - ETag-based policy and dictionary hot-reloading
   - Fetch API integration for dynamic updates

### Key Design Principles

- **Web Standards Only**: No Node.js-specific APIs beyond standard globals (Node 20.10+ required)
- **Stream-First**: Built around WHATWG `ReadableStream`/`TransformStream` for efficient processing
- **Plugin Architecture**: Core provides base functionality, country plugins add regional specifics
- **Type Safety**: Written in TypeScript with strict typing throughout

### Testing

Each package has its own test suite in the `test/` directory. Tests are written in TypeScript and compiled to `dist-test/` before running with Node's built-in test runner.

### Code Style

- **Biome** for linting and formatting
- Line width: 100 characters
- Indent: 2 spaces
- Quote style: single quotes
- Semicolons: as needed (ASI-friendly)

## Development Notes

- The project is in **alpha** status - interfaces may change
- Focus on maintaining Web Standards compatibility
- Prioritize stream processing capabilities for edge deployment
- Keep core lightweight, push complexity to plugins when possible