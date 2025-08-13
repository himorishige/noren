# Migration Guide: v0.3.x → v0.4.0

This guide helps you migrate from Noren v0.3.x to v0.4.0, which focuses on **simplicity, performance, and maintainability**.

## 🎯 What's New in v0.4.0

### ✨ **Major Improvements**
- **77% smaller codebase**: 8,153 → 1,894 lines
- **65% smaller bundle**: 360KB → 124KB
- **Simplified API**: Removed complex configuration options
- **Better performance**: Streamlined detection algorithms
- **Cleaner architecture**: Development tools moved to separate package

### 📦 **New Package Structure**
```
@himorishige/noren-core         # Essential PII detection (NEW: simplified)
@himorishige/noren-devtools     # Advanced tools (NEW: development features)
@himorishige/noren-plugin-*     # Same as before
@himorishige/noren-dict-reloader # Same as before
```

## 🚨 Breaking Changes

### 1. **Removed Advanced Features from Core**

Features moved to `@himorishige/noren-devtools`:

```diff
// ❌ v0.3.x - These imports will fail
- import { ABTestEngine, BenchmarkRunner } from '@himorishige/noren-core'
- import { EvaluationEngine } from '@himorishige/noren-core'
- import { ContextualConfig } from '@himorishige/noren-core'

// ✅ v0.4.0 - Use devtools package
+ import { ABTestEngine, BenchmarkRunner } from '@himorishige/noren-devtools'
+ import { EvaluationEngine } from '@himorishige/noren-devtools'
+ import { ContextualConfig } from '@himorishige/noren-devtools'
```

### 2. **Simplified RegistryOptions**

```diff
// ❌ v0.3.x - Complex configuration
const registry = new Registry({
  defaultAction: 'mask',
- contextualConfig: { enabled: true, suppressionEnabled: false },
- enableContextualConfidence: true,
- contextualSuppressionEnabled: false,
- contextualBoostEnabled: true
})

// ✅ v0.4.0 - Simplified configuration  
const registry = new Registry({
  defaultAction: 'mask',
  enableConfidenceScoring: true  // Single toggle for confidence features
})
```

### 3. **Removed Complex Utility Functions**

```diff
// ❌ v0.3.x - Advanced utilities no longer in core
- import { isFalsePositive, calculateInputComplexity } from '@himorishige/noren-core'
- import { preprocessForPiiDetection } from '@himorishige/noren-core'

// ✅ v0.4.0 - Advanced utilities moved to devtools
+ import { isFalsePositive, calculateInputComplexity } from '@himorishige/noren-devtools'
```

### 4. **HMAC Key Length Requirement**

```diff
// ❌ v0.3.x - 32 character minimum
const registry = new Registry({
  defaultAction: 'tokenize',
- hmacKey: 'short-key'  // Would fail
+ hmacKey: 'at-least-16-chars'  // Now minimum 16 characters
})
```

### 5. **Token Format Changed**

```diff
// ❌ v0.3.x - Hex format
- TKN_EMAIL_a1b2c3d4e5f67890

// ✅ v0.4.0 - Base64URL format (longer but more secure)
+ TKN_EMAIL_AbC123XyZ789-_qW5tY
```

## 🔧 Migration Steps

### Step 1: Update Dependencies

```bash
# Update core package
npm update @himorishige/noren-core

# Install devtools if you used advanced features
npm install @himorishige/noren-devtools
```

### Step 2: Update Imports

**If you only used basic features:**
```typescript
// No changes needed - these still work
import { Registry, redactText } from '@himorishige/noren-core'
import * as jpPlugin from '@himorishige/noren-plugin-jp'
```

**If you used advanced features:**
```typescript
// Move advanced imports to devtools
import { Registry, redactText } from '@himorishige/noren-core'
import { 
  ABTestEngine, 
  BenchmarkRunner,
  EvaluationEngine 
} from '@himorishige/noren-devtools'
```

### Step 3: Simplify Configuration

```typescript
// Before (v0.3.x)
const registry = new Registry({
  defaultAction: 'mask',
  enableContextualConfidence: true,
  contextualSuppressionEnabled: false,
  contextualBoostEnabled: true,
  contextualConfig: {
    enabled: true,
    suppressionEnabled: false,
    boostEnabled: true,
    rules: [/* complex rules */]
  }
})

// After (v0.4.0) 
const registry = new Registry({
  defaultAction: 'mask',
  enableConfidenceScoring: true,  // Single toggle
  environment: 'production',      // Automatic smart defaults
  allowDenyConfig: {              // Simple allowlist/denylist
    allowList: ['test@company.com'],
    denyList: []
  }
})
```

### Step 4: Update HMAC Keys (if using tokenization)

```typescript
// Before (v0.3.x) - 32+ characters required
const registry = new Registry({
  defaultAction: 'tokenize',
  hmacKey: 'your-very-long-32-character-key-here'
})

// After (v0.4.0) - 16+ characters required (32+ still recommended)
const registry = new Registry({
  defaultAction: 'tokenize', 
  hmacKey: 'minimum-16-chars'  // Works, but 32+ recommended for security
})
```

### Step 5: Update Tests (if using token assertions)

```typescript
// Before (v0.3.x) - Hex format
expect(result).toMatch(/TKN_EMAIL_[0-9a-f]{16}/)

// After (v0.4.0) - Base64URL format
expect(result).toMatch(/TKN_EMAIL_[A-Za-z0-9_-]+/)
```

## 📊 Performance Improvements

After migration, you should see:

- **Faster startup**: ~65% reduction in initialization time
- **Lower memory usage**: ~40% reduction in memory footprint  
- **Smaller bundles**: ~65% reduction in bundle size
- **Better tree-shaking**: Individual modules are now more modular

## 🎯 Migration Examples

### Example 1: Basic Usage (No Changes Needed)

```typescript
// This code works unchanged in v0.4.0
import { Registry, redactText } from '@himorishige/noren-core'
import * as jpPlugin from '@himorishige/noren-plugin-jp'

const registry = new Registry({ defaultAction: 'mask' })
registry.use(jpPlugin.detectors, jpPlugin.maskers)

const result = await redactText(registry, 'Email: user@example.com')
// Works exactly the same
```

### Example 2: Advanced Features (Requires Devtools)

```typescript
// Before (v0.3.x)
import { 
  Registry, 
  BenchmarkRunner,  // ❌ No longer in core
  ABTestEngine      // ❌ No longer in core
} from '@himorishige/noren-core'

// After (v0.4.0)
import { Registry } from '@himorishige/noren-core'
import { 
  BenchmarkRunner,  // ✅ Now in devtools
  ABTestEngine      // ✅ Now in devtools
} from '@himorishige/noren-devtools'

// Usage is the same
const runner = new BenchmarkRunner()
const results = await runner.runBenchmark('test', registry, testData)
```

### Example 3: Complex Configuration (Simplified)

```typescript
// Before (v0.3.x) - Complex contextual config
const registry = new Registry({
  defaultAction: 'mask',
  contextualConfig: {
    enabled: true,
    suppressionEnabled: true,
    boostEnabled: false,
    rules: [
      { pattern: /email/i, action: 'suppress', confidence: 0.3 },
      { pattern: /contact/i, action: 'boost', confidence: 0.2 }
    ]
  }
})

// After (v0.4.0) - Simple and effective
const registry = new Registry({
  defaultAction: 'mask',
  enableConfidenceScoring: true,
  contextHints: ['email', 'contact'],  // Simple context hints
  environment: 'production'            // Smart defaults
})
```

## ❓ FAQ

### Q: Do I need to migrate if I only use basic features?
**A:** No! Basic PII detection and masking work exactly the same. Just update the package version.

### Q: What if I need the removed advanced features?
**A:** Install `@himorishige/noren-devtools` and update your imports. All features are still available.

### Q: Will my existing tokens still work?
**A:** No, the token format changed. You'll need to re-generate tokens. Consider this during your migration planning.

### Q: Is v0.4.0 faster than v0.3.x?
**A:** Yes! Significantly faster due to simplified algorithms and reduced code overhead.

### Q: Can I use both v0.3.x and v0.4.0 in the same project?
**A:** Not recommended. Choose one version and migrate completely for best compatibility.

## 🆘 Need Help?

- **GitHub Issues**: [Report migration problems](https://github.com/himorishige/noren/issues)
- **GitHub Discussions**: [Ask questions](https://github.com/himorishige/noren/discussions)
- **Documentation**: [Updated guides](https://github.com/himorishige/noren)

---

**Welcome to a simpler, faster Noren v0.4.0! 🚀**