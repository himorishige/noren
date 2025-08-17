# Noren Project Overview

## Purpose
Noren (のれん) is an edge-native ecosystem for AI security and PII protection. Like traditional Japanese "noren" curtains that provide selective privacy, the project intelligently protects applications from security threats while maintaining functionality.

### Main Products
1. **@himorishige/noren** - Flagship AI security library for prompt injection protection (357,770 QPS, 0.0027ms detection)
2. **@himorishige/noren-core** - Battle-tested PII detection, masking, and tokenization (124KB bundle)

## Architecture
### Monorepo Structure (pnpm workspaces)
- **packages/noren/** - AI security (main product)
- **packages/noren-core/** - Data protection core
- **packages/noren-plugin-jp/** - Japan-specific detectors
- **packages/noren-plugin-us/** - US-specific detectors
- **packages/noren-plugin-network/** - Network (IPv4/IPv6/MAC) detectors
- **packages/noren-plugin-security/** - Security tokens and HTTP headers
- **packages/noren-dict-reloader/** - ETag-based policy hot-reloading
- **packages/noren-devtools/** - Development and testing tools

## Key Design Principles
- **Web Standards Only**: WHATWG Streams, WebCrypto API, no Node.js-specific APIs
- **Edge-Optimized**: Perfect for Cloudflare Workers, Vercel Edge
- **Plugin Architecture**: Core provides base, plugins add specialized features
- **Stream-First**: Built around ReadableStream/TransformStream
- **Performance**: Pre-compiled patterns, optimized algorithms
- **Type Safety**: Strict TypeScript throughout

## Technology Stack
- **Language**: TypeScript (ES2022 target)
- **Runtime**: Node.js 20.10+, works in edge environments
- **Package Manager**: pnpm 9.0.0 with workspaces
- **Testing**: Vitest with Node.js built-in test runner
- **Linting/Formatting**: Biome (replaces ESLint + Prettier)
- **Build**: TypeScript compiler + Rollup for minification
- **Release**: Changesets for version management

## Performance Characteristics
- **Bundle Size**: 124KB optimized (77% reduction)
- **Processing Speed**: 102,229 ops/second (0.0098ms per iteration)
- **AI Security**: 357,770 QPS for prompt injection detection
- **Code Reduction**: 77% smaller codebase (1,782 lines)
- **Memory**: Object pooling with automatic cleanup