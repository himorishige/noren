# @himorishige/noren-plugin-network

## 0.6.4

### Patch Changes

- [#79](https://github.com/himorishige/noren/pull/79) [`a74e9b8`](https://github.com/himorishige/noren/commit/a74e9b83b2d1574c204a8c2382e953fe3ce47e63) Thanks [@himorishige](https://github.com/himorishige)! - - Rename noren-guard package to noren with updated documentation and benchmarks
  - Fix template literal warnings in MCP utilities by replacing string concatenation with template literals
  - Add missing radix parameter to parseInt calls in test files for consistent numeric parsing
  - Update biome.json schema version from 2.1.4 to 2.2.0 for compatibility
  - Remove unused imports from example files to clean up code
  - Fix unused variable warnings by prefixing with underscore
  - Ensure all lint checks pass with zero warnings
- Updated dependencies [[`a74e9b8`](https://github.com/himorishige/noren/commit/a74e9b83b2d1574c204a8c2382e953fe3ce47e63)]:
  - @himorishige/noren-core@0.6.4

## 0.6.3

### Patch Changes

- Updated dependencies [[`ea7c814`](https://github.com/himorishige/noren/commit/ea7c814de6ada089522dba3418dc2651c12ff7ee)]:
  - @himorishige/noren-core@0.6.3

## 0.6.2

### Patch Changes

- [#64](https://github.com/himorishige/noren/pull/64) [`4bf0831`](https://github.com/himorishige/noren/commit/4bf0831644c546d02619f5a7637c3cdd99a91597) Thanks [@himorishige](https://github.com/himorishige)! - fix type mappings

- Updated dependencies [[`4bf0831`](https://github.com/himorishige/noren/commit/4bf0831644c546d02619f5a7637c3cdd99a91597)]:
  - @himorishige/noren-core@0.6.2

## 0.6.1

### Patch Changes

- [#60](https://github.com/himorishige/noren/pull/60) [`c67d4a0`](https://github.com/himorishige/noren/commit/c67d4a0121ed909d2d258983edc111f8547510c6) Thanks [@himorishige](https://github.com/himorishige)! - fix: type mappings

- Updated dependencies [[`c67d4a0`](https://github.com/himorishige/noren/commit/c67d4a0121ed909d2d258983edc111f8547510c6)]:
  - @himorishige/noren-core@0.6.1

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
