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

### Run examples
```sh
# Basic PII redaction example
node examples/basic-redact.mjs

# Tokenization example
node examples/tokenize.mjs

# Stream processing example
node examples/stream-redact.mjs examples/basic-sample.txt

# Security plugin example
node examples/security-demo.mjs

# Custom dictionary example
node examples/dictionary-demo.mjs

# Web server example (requires hono installation)
node examples/hono-server.mjs

# Development tools examples (requires noren-devtools)
node examples/benchmark-demo.mjs
node examples/ab-test-demo.mjs
node examples/evaluation-demo.mjs
```

### Release Management (Changesets)

```sh
# Create a changeset for your changes
pnpm changeset

# Check current changeset status
pnpm changeset:status

# Version packages (for maintainers)
pnpm changeset:version

# Publish packages (automated via GitHub Actions)
pnpm changeset:publish
```

#### Release Workflow

1. **Development**: Make changes to packages in feature branch (from main)
2. **Changeset Creation**: Run `pnpm changeset` to document changes
3. **Pull Request**: Create PR to main branch with changeset files
4. **PR Canary Release**: Manual canary release for specific PR testing (optional)
5. **Stable Release**: PR merge to main triggers automatic stable release

#### PR Canary Release Workflow

- **PR Canary releases**: Manual workflow_dispatch with PR number specification (`@canary` tag)

#### Testing with PR Canary Releases

```sh
# Install PR canary version for testing
npm install @himorishige/noren-core@canary
```

PR Canary releases allow testing specific PR changes before merging, enabling thorough validation of new features and fixes.

## Architecture

### Monorepo Structure (pnpm workspaces)

The project uses pnpm workspaces with six main packages:

1. **@himorishige/noren-core** (`packages/noren-core/`)
   - Core detection logic for global PII types (email, IP, credit card)
   - Registry system for managing detectors and maskers
   - Streaming capabilities using WHATWG Streams
   - HMAC-based tokenization using WebCrypto API
   - Confidence scoring system for detection accuracy

2. **@himorishige/noren-devtools** (`packages/noren-devtools/`)
   - Advanced development and testing tools
   - A/B testing, benchmarking, and accuracy evaluation
   - Performance monitoring and memory analysis
   - Configuration optimization tools

3. **@himorishige/noren-plugin-jp** (`packages/noren-plugin-jp/`)
   - Japan-specific detectors: phone numbers, postal codes, MyNumber
   - Japanese context hints and masking patterns

4. **@himorishige/noren-plugin-us** (`packages/noren-plugin-us/`)
   - US-specific detectors: phone numbers, ZIP codes, SSN
   - US context hints and masking patterns

5. **@himorishige/noren-plugin-security** (`packages/noren-plugin-security/`)
   - Security-focused detectors: JWT tokens, API keys, HTTP headers, cookies
   - Technical credential detection and masking
   - Cookie allowlist functionality for selective masking

6. **@himorishige/noren-dict-reloader** (`packages/noren-dict-reloader/`)
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
- **Security Enhancements**: HMAC keys now require minimum 32-character length
- **Bundle Size Optimization**: 65% smaller bundle size (360KB → 124KB)
- **Codebase Simplification**: 77% code reduction (8,153 → 1,894 lines)

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

### IPv6 Detection (Updated v0.3.0)
Enhanced IPv6 detection using two-phase parser approach:
- **Phase 1**: Coarse pattern extraction for candidate identification
- **Phase 2**: Strict parsing with `parseIPv6()` function for validation
- **Compressed Notation**: Proper handling of `::` compression and edge cases
- **Address Classification**: Automatic detection of private, loopback, link-local addresses
- **Performance**: ~0.1ms per candidate with reduced regex complexity

## New Features (v0.4.0)

### Development Tools Package (NEW)
- **@himorishige/noren-devtools**: Professional-grade development and testing tools
- **A/B Testing**: Scientific configuration comparison
- **Advanced Benchmarking**: Performance analysis with memory monitoring
- **Accuracy Evaluation**: Precision/recall metrics with ground truth datasets
- **Improvement Cycles**: Automated configuration optimization

### Enhanced Core Features
- **Confidence Scoring System**: Rule-based confidence calculation (0.0-1.0)
- **Detection Sensitivity Levels**: Preset thresholds (strict/balanced/relaxed)
- **Simplified API**: Streamlined configuration options
- **Token Format Upgrade**: Base64URL format for better security
- **Enhanced HMAC Security**: Increased minimum key length to 32 characters

### Advanced False Positive Reduction
- **Environment-aware Configuration**: Automatic exclusion of test patterns in development/test environments
- **AllowDenyManager Class**: Fine-grained control over detection patterns
- **Default Test Pattern Exclusion**: Automatic handling of example.com, localhost, private IPs
- **Runtime Pattern Management**: Add/remove patterns dynamically via API
- **Custom Lists**: Support for project-specific allowlist/denylist patterns

### Enhanced IPv6 Detection
- **Two-phase Parser Approach**: Coarse extraction followed by strict parsing
- **Boundary Detection**: Improved accuracy with proper IPv6 boundary checking
- **Memory Optimization**: Reduced memory growth in repeated IPv6 operations
- **Classification Support**: Detect private, documentation, link-local, and unique local addresses

## Examples and Use Cases

The `examples/` directory contains comprehensive samples demonstrating various use cases:

- **basic-redact.mjs**: Basic PII masking with core and regional plugins
- **tokenize.mjs**: HMAC-based tokenization for data anonymization
- **detect-dump.mjs**: Detailed PII detection analysis for debugging
- **stream-redact.mjs**: Efficient streaming processing for large files
- **security-demo.mjs**: HTTP header and API token redaction
- **dictionary-demo.mjs**: Custom dictionaries with hot-reloading
- **hono-server.mjs**: Web server integration example

## Development Notes

- The project is in **beta** status with stable v0.4.0 release
- Focus on maintaining Web Standards compatibility
- Prioritize stream processing capabilities for edge deployment
- Keep core lightweight, push complexity to plugins and devtools when possible
- All optimizations maintain backward compatibility
- Advanced features moved to @himorishige/noren-devtools package
- Security plugin enables protection of technical credentials (JWT, API keys, cookies)
- Custom dictionary support allows for company-specific PII patterns
- ETag-based hot-reloading enables runtime policy updates
- Confidence scoring provides fine-grained detection control
- Development tools enable scientific testing and optimization