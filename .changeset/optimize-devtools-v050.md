---
"@himorishige/noren-devtools": major
---

# v0.5.0: Major Code Optimization and Unified Architecture

This release delivers significant code optimization and architectural improvements to noren-devtools, achieving ~30% code reduction while enhancing functionality and maintainability.

## 🚀 Major Changes

### Unified Statistical Analysis
- **New**: `stats-common.ts` - Centralized statistical functions (t-tests, confidence intervals, correlations)
- **Consolidation**: Eliminated duplicate statistical calculations across all modules
- **Performance**: Optimized statistical algorithms with consistent interfaces

### Unified Reporting System  
- **New**: `report-common.ts` - Consistent report generation across all tools
- **Templates**: Standardized report formats for benchmarks, A/B tests, and evaluations
- **Flexibility**: `ReportBuilder` class for custom report construction

### Streamlined Core Modules
- **ab-testing.ts**: Reduced from 1,156 → 372 lines (68% reduction)
- **benchmark.ts**: Reduced from 720 → 389 lines (46% reduction) 
- **context-detection.ts**: Reduced from 840 → 395 lines (53% reduction)
- **contextual-confidence.ts**: Reduced from 1,076 → 382 lines (65% reduction)
- **evaluation.ts**: Reduced from 607 → 514 lines (15% reduction)

### Enhanced API Consistency
- **Naming**: Standardized naming conventions (camelCase for interfaces)
- **Simplification**: Reduced API surface while maintaining functionality
- **Type Safety**: Improved TypeScript types and interfaces

## 🔧 New Features

### Statistical Functions
```typescript
import { mean, tTest, confidenceInterval, pearsonCorrelation } from '@himorishige/noren-devtools'

const result = tTest(sampleA, sampleB)
const ci = confidenceInterval(values, 0.95)
const correlation = pearsonCorrelation(x, y)
```

### Unified Reporting
```typescript
import { ReportBuilder, createABTestReport } from '@himorishige/noren-devtools'

const report = new ReportBuilder()
  .title('Performance Analysis')
  .performance('Config A', metrics)
  .comparison('Config B', 15.2, 95.0)
  .build()
```

### Simplified Context Analysis
```typescript
// Streamlined API with rule-based confidence scoring
const result = calculateContextualConfidence(hit, text, baseConfidence, config)
console.log(`Adjusted confidence: ${result.contextualConfidence}`)
console.log(`Applied rules:`, result.explanations)
```

## 📊 Performance Improvements

- **Bundle Size**: Significant reduction through code consolidation
- **Memory Usage**: Improved memory efficiency with unified utilities
- **Maintainability**: Clearer architecture with separated concerns
- **Test Coverage**: Maintained functionality while reducing complexity

## 🔄 Breaking Changes

### API Changes
- Context detection interfaces use camelCase (e.g., `jsonLike` instead of `json_like`)
- Simplified contextual confidence configuration
- Streamlined evaluation engine workflow
- Updated benchmark runner interface

### Migration Guide
Most changes are internal optimizations. Update import statements for new statistical and reporting functions. See README.md for updated examples.

## 📝 Documentation

- **README.md**: Completely updated with v0.5.0 examples
- **API Reference**: Updated to reflect new unified architecture
- **Examples**: All examples updated for new APIs

This release maintains backward compatibility for core functionality while providing a cleaner, more maintainable architecture for future development.