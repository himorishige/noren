# @himorishige/noren-core

## 0.6.4

### Patch Changes

- [#79](https://github.com/himorishige/noren/pull/79) [`a74e9b8`](https://github.com/himorishige/noren/commit/a74e9b83b2d1574c204a8c2382e953fe3ce47e63) Thanks [@himorishige](https://github.com/himorishige)! - - Rename noren-guard package to noren with updated documentation and benchmarks
  - Fix template literal warnings in MCP utilities by replacing string concatenation with template literals
  - Add missing radix parameter to parseInt calls in test files for consistent numeric parsing
  - Update biome.json schema version from 2.1.4 to 2.2.0 for compatibility
  - Remove unused imports from example files to clean up code
  - Fix unused variable warnings by prefixing with underscore
  - Ensure all lint checks pass with zero warnings

## 0.6.3

### Patch Changes

- [#77](https://github.com/himorishige/noren/pull/77) [`ea7c814`](https://github.com/himorishige/noren/commit/ea7c814de6ada089522dba3418dc2651c12ff7ee) Thanks [@himorishige](https://github.com/himorishige)! - Fix lint warnings and code quality issues

  - Fix template literal warnings in MCP utilities by replacing string concatenation with template literals
  - Add missing radix parameter to parseInt calls in test files for consistent numeric parsing
  - Update biome.json schema version from 2.1.4 to 2.2.0 for compatibility
  - Remove unused imports from example files to clean up code
  - Fix unused variable warnings by prefixing with underscore
  - Ensure all lint checks pass with zero warnings

## 0.6.2

### Patch Changes

- [#64](https://github.com/himorishige/noren/pull/64) [`4bf0831`](https://github.com/himorishige/noren/commit/4bf0831644c546d02619f5a7637c3cdd99a91597) Thanks [@himorishige](https://github.com/himorishige)! - fix type mappings

## 0.6.1

### Patch Changes

- [#60](https://github.com/himorishige/noren/pull/60) [`c67d4a0`](https://github.com/himorishige/noren/commit/c67d4a0121ed909d2d258983edc111f8547510c6) Thanks [@himorishige](https://github.com/himorishige)! - fix: type mappings

## 0.6.0

### Minor Changes

- [#51](https://github.com/himorishige/noren/pull/51) [`89f3c62`](https://github.com/himorishige/noren/commit/89f3c6295e1f5c91c154db512d8ac2fb1e5de1bc) Thanks [@himorishige](https://github.com/himorishige)! - # Advanced Validation & False Positive Prevention (v0.6.0)

  ## 🛡️ Major Features

  ### Advanced Validation System

  - **Context-aware filtering**: Smart detection of test data, examples, and weak contexts
  - **3 strictness levels**: `fast` (no validation), `balanced` (recommended), `strict` (aggressive filtering)
  - **Automatic false positive reduction**: Significant improvement in detection accuracy

  ### Plugin Validation Integration

  - **Seamless inheritance**: All plugins automatically use registry validation settings
  - **Unified validation**: Consistent behavior across core and plugin detectors
  - **Type safety**: Enhanced PII type definitions for plugin-specific patterns

  ### Enhanced Japanese Language Support

  - **Specialized validators**: Custom validation logic for Japanese phone numbers
  - **Expanded context keywords**: Comprehensive Japanese context detection
  - **Cultural awareness**: Better understanding of Japanese text patterns

  ## 🔧 Developer Experience

  ### Debug Utilities

  - **New `debugValidation()` function**: Detailed validation analysis and troubleshooting
  - **Rich metadata**: Comprehensive validation reasoning and context information
  - **Developer-friendly output**: Clear visualization of validation decisions

  ### Performance Optimizations

  - **Minimal overhead**: Validation adds <1ms while significantly improving accuracy
  - **Smart caching**: Efficient context analysis and pattern matching
  - **Memory efficient**: Linear memory usage even with validation enabled

  ## 📊 Impact

  ### False Positive Reduction

  - **Test data filtering**: Automatically excludes common test patterns (4111111111111111, test@example.com, etc.)
  - **Context scoring**: Advanced algorithm analyzes surrounding text for validation
  - **Configurable strictness**: Balance between performance and accuracy based on use case

  ### Backward Compatibility

  - **Zero breaking changes**: All existing APIs work without modification
  - **Default behavior**: Fast mode maintains v0.5.0 behavior for existing users
  - **Gradual adoption**: Easy migration to validation-enabled modes

  ## 🚀 Usage Examples

  ```typescript
  // Basic validation setup
  const registry = new Registry({
    defaultAction: "mask",
    validationStrictness: "balanced", // Recommended setting
  });

  // Plugin integration with validation
  registry.use(jpPlugin.detectors, jpPlugin.maskers);

  // Debug validation decisions
  import { debugValidation } from "@himorishige/noren-core";
  debugValidation("4242424242424242", "credit_card", {
    surroundingText: "Test card: 4242424242424242",
    strictness: "balanced",
    originalIndex: 11,
  });
  ```

  This release represents a major step forward in PII detection accuracy while maintaining the performance and simplicity that makes Noren Core effective for production use.

## 0.5.0

### Minor Changes

- [#40](https://github.com/himorishige/noren/pull/40) [`8fe8adb`](https://github.com/himorishige/noren/commit/8fe8adb035e688f89c2c0874397d89a1ae524b5e) Thanks [@himorishige](https://github.com/himorishige)! - **Performance & Bundle Size Optimization v0.5.0**

  - **Optimized IPv6 Parser**: Reduced from 235 to 161 lines (31% reduction) with simplified validation logic
  - **Single-Pass Detection**: Converted multiple detection loops to unified pattern matching for better performance
  - **Streamlined Hit Pool**: Simplified implementation from 109 to 65 lines (47% reduction)
  - **Reduced API Surface**: Exports reduced from 40 to 14 (65% reduction) for better tree-shaking
  - **Pre-compiled Regex**: All patterns compiled at module load time for O(1) performance
  - **Enhanced Build**: Aggressive terser optimization with improved compression settings

  **Performance Results**:

  - Processing speed: ~102K operations/second (0.0098ms per iteration)
  - Bundle size: 124KB (optimized dist output)
  - TypeScript codebase: 40%+ reduction to 1,782 lines
  - All 156 tests passing with full API compatibility maintained

## 0.4.1

### Patch Changes

- [#26](https://github.com/himorishige/noren/pull/26) [`46420eb`](https://github.com/himorishige/noren/commit/46420eb4a4461a863415a91b8d6289fff2a0b3fb) Thanks [@himorishige](https://github.com/himorishige)! - bugfix

- [#29](https://github.com/himorishige/noren/pull/29) [`7f20301`](https://github.com/himorishige/noren/commit/7f203015e8d09d5f9b08a3cabe6eda739295c3a0) Thanks [@himorishige](https://github.com/himorishige)! - release version

## 0.3.0

### Minor Changes

- [#22](https://github.com/himorishige/noren/pull/22) [`9ff46de`](https://github.com/himorishige/noren/commit/9ff46de14b3385d0c25d05530777806a913ad741) Thanks [@himorishige](https://github.com/himorishige)! - Minor bug fix

## 0.2.0

### Minor Changes

- [#14](https://github.com/himorishige/noren/pull/14) [`963b5fa`](https://github.com/himorishige/noren/commit/963b5fa609c475db430a2cd71f9358fc047fcd4b) Thanks [@himorishige](https://github.com/himorishige)! - Release 0.2.0 across all packages.

  This minor release improves documentation, test coverage, and loader ergonomics while keeping public APIs stable.

  Highlights:

  - Dictionary Reloader: documented file loader and baseDir option, clarified file:// URL validation and security notes, added Cloudflare Workers KV/R2 and bundle-embedded examples, shipped dictionary/manifest templates, included compile() examples, and kept the ESM extension handling fix.
  - Core and Plugins (US/JP): aligned masking behavior (no digits left after masking), updated tests, and standardized maskers to receive Hit-shaped inputs. No API changes.

  Upgrade notes:

  - No breaking changes expected. If you use file:// URLs, ensure they pass the documented validation and configure baseDir accordingly.
