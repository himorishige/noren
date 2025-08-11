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

## Recent Performance Optimizations

The codebase has been optimized for better performance:

### Implemented Optimizations
- **Pre-compiled Regex Patterns**: All regular expressions are now compiled at module load time instead of runtime
- **Context Hints Set Optimization**: Context hints are managed using `Set` for O(1) lookup performance
- **Detector Pre-sorting**: Detectors are sorted once during registration instead of on every detection
- **Type Safety Improvements**: Reduced unsafe type assertions with null-safe helper functions
- **Security Enhancements**: HMAC keys now require minimum 16-character length

### Benchmark Results
- **Large text processing**: ~1.5ms for 100 PII elements
- **Repeated detection**: 1000 iterations in ~7ms (0.007ms per call)
- **Context hint processing**: 500 iterations with 20+ hints in ~4.5ms

### Japanese Phone Numbers
Updated to support all current Japanese mobile numbers:
- 060-xxxx-xxxx (mobile)
- 070-xxxx-xxxx (mobile/PHS)
- 080-xxxx-xxxx (mobile)
- 090-xxxx-xxxx (mobile)

### IPv6 Detection
Enhanced IPv6 pattern to support compressed notation (`::`) and mixed formats.

## Development Notes

- The project is in **alpha** status - interfaces may change
- Focus on maintaining Web Standards compatibility
- Prioritize stream processing capabilities for edge deployment
- Keep core lightweight, push complexity to plugins when possible
- All optimizations maintain backward compatibility
- Benchmark tests are available in `packages/noren-core/test/benchmark.test.ts`