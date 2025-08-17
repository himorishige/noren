---
"@himorishige/noren": minor
---

# Noren v0.3 - Lightweight, Fast, Simple Optimization Update

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
