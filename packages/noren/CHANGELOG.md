# @himorishige/noren

## 0.3.0

### Minor Changes

- [#84](https://github.com/himorishige/noren/pull/84) [`d71e93b`](https://github.com/himorishige/noren/commit/d71e93bc64cc95add42626219d5273f5ca150882) Thanks [@himorishige](https://github.com/himorishige)! - # Noren v0.3 - Lightweight, Fast, Simple Optimization Update

  ## 🚀 Performance Improvements

  - **67,000+ QPS**: 88% throughput improvement (was 35,777 QPS)
  - **0.015ms average**: 82% response time improvement (was 0.027ms)
  - **Aho-Corasick algorithm**: 2-5x faster multi-pattern detection
  - **LRU cache**: 85%+ cache hit rate for pattern compilation optimization

  ## 🪶 Bundle Size Reduction

  - **62% lighter**: 34KB → 13KB (core patterns only)
  - **Dynamic pattern loading**: Load only required pattern categories
  - **Tree-shaking support**: Automatically exclude unused features

  ## 🎯 New Simple APIs

  - `isContentSafe()`: Fast boolean content safety check
  - `detectThreats()`: Detailed threat analysis with risk scoring
  - `setSecurityLevel()`: Security presets (strict/balanced/permissive)
  - `sanitizeContent()`: Automatic content sanitization

  ## 🔧 Optimization Techniques

  - **TypedArray optimization**: 38% memory usage reduction
  - **Stateful processing**: Chunk boundary-aware detection for large texts
  - **Preload functionality**: Application startup performance optimization

  ## 🆕 Advanced Features

  - **Dynamic pattern loading**: `createLazyGuard()` and `preload()` functions
  - **Large text processing**: `processLargeText()` for efficient handling
  - **Framework integrations**: Express.js middleware and Cloudflare Workers helpers

  ## 🔄 Backward Compatibility

  - **100% backward compatible**: All existing v0.2 code works without changes
  - **Gradual upgrade path**: Optional adoption of new features

  ## 🛠️ Code Quality Improvements

  - **Fixed 13 Biome lint warnings**: noNonNullAssertion and noExplicitAny
  - **Enhanced type safety**: Replaced non-null assertions with safe null checks
  - **Express type support**: Changed from `any` to `unknown` types

  ## 📚 Documentation Updates

  - **Performance guide**: Optimization techniques and real benchmarks
  - **Migration guide**: Step-by-step upgrade instructions
  - **API reference**: Complete API documentation with new features
  - **Getting started**: Usage examples and best practices

## 0.2.0

### Minor Changes

- [#79](https://github.com/himorishige/noren/pull/79) [`a74e9b8`](https://github.com/himorishige/noren/commit/a74e9b83b2d1574c204a8c2382e953fe3ce47e63) Thanks [@himorishige](https://github.com/himorishige)! - - Rename noren-guard package to noren with updated documentation and benchmarks
  - Fix template literal warnings in MCP utilities by replacing string concatenation with template literals
  - Add missing radix parameter to parseInt calls in test files for consistent numeric parsing
  - Update biome.json schema version from 2.1.4 to 2.2.0 for compatibility
  - Remove unused imports from example files to clean up code
  - Fix unused variable warnings by prefixing with underscore
  - Ensure all lint checks pass with zero warnings
