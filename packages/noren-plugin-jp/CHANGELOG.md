# @himorishige/noren-plugin-jp

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

### Patch Changes

- Updated dependencies [[`89f3c62`](https://github.com/himorishige/noren/commit/89f3c6295e1f5c91c154db512d8ac2fb1e5de1bc)]:
  - @himorishige/noren-core@0.6.0

## 0.6.0

### Minor Changes

- **Enhanced Postal Code Detection**: Improved phone number conflict resolution

  - Postal codes (123-4567) are no longer misdetected when they match phone number patterns
  - `TEL: 03-1234-5678` is correctly identified as phone_jp, not postal_jp
  - Maintained high accuracy for legitimate postal codes with context

- **Lightweight Architecture**: Simplified detection algorithm

  - Removed heavy address dictionary dependencies (47 prefectures, 80+ address units)
  - Streamlined context analysis for better performance
  - Focused on core functionality: phone number conflict avoidance + postal symbol detection

- **Performance Optimizations**: Aligned with Noren's Edge-native principles

  - Reduced memory usage through simplified logic
  - Faster processing for large text documents
  - Maintained detection accuracy for high-confidence cases (〒 symbol, postal context)

- **Code Quality Improvements**:
  - Removed 200+ lines of complex address matching code
  - Simplified confidence scoring (3 levels: 0.9, 0.6, 0.4)
  - Enhanced test coverage with realistic use cases

### Breaking Changes

None. All public APIs remain compatible.

### Migration Guide

No migration required. The simplified implementation maintains backward compatibility while improving accuracy and performance.

## 0.5.0

### Minor Changes

- [#42](https://github.com/himorishige/noren/pull/42) [`c1539db`](https://github.com/himorishige/noren/commit/c1539db898842fd4bb03e49f3c3b9e25f90f0872) Thanks [@himorishige](https://github.com/himorishige)! - **v0.5.0 Optimization Release**

  ## Plugin Breaking Changes

  - **PII Type Naming Convention**: Updated to `type_country` format for consistency
    - `jp_postal` → `postal_jp`, `jp_my_number` → `mynumber_jp`
    - `us_phone` → `phone_us`, `us_zip` → `zip_us`, `us_ssn` → `ssn_us`

  ## Plugin Performance Optimizations

  - **Context Hints as Sets**: Converted to `Set` for O(1) lookup performance
  - **Pre-compiled Regex Patterns**: All patterns compiled at module load time
  - **Code Size Reduction**:
    - plugin-us: 453 → 197 lines (56% reduction)
    - plugin-jp: 685 → 199 lines (71% reduction)
    - validators simplified with streamlined logic

  ## Plugin Enhanced Features

  - **Improved Confidence Scoring**: More accurate validation with context awareness
  - **Japanese Boundary Detection**: Improved regex patterns for Japanese context
  - **International Phone Support**: +81 prefix detection without context requirement
  - **Memory Optimization**: Reduced object allocations in hot paths

  ## Dict-Reloader Breaking Changes

  - **Simplified CompileOptions**: Removed rarely-used options
    - `enableContextualConfidence` → use `enableConfidenceScoring`
    - `contextualSuppressionEnabled`, `contextualBoostEnabled` → consolidated into core
    - `allowDenyConfig.disableDefaults` → simplified to boolean options

  ## Dict-Reloader Performance Optimizations

  - **Unified Fetch Logic**: Combined `conditionalGet` functions for 30% code reduction
  - **Optimized Semaphore**: Simplified concurrency control implementation
  - **Enhanced Error Handling**: Improved timeout management and error messages
  - **Memory Efficiency**: Optimized Map management and reduced object allocation

  All core functionality maintained with documented migration paths for breaking changes.

### Patch Changes

- Updated dependencies [[`8fe8adb`](https://github.com/himorishige/noren/commit/8fe8adb035e688f89c2c0874397d89a1ae524b5e)]:
  - @himorishige/noren-core@0.5.0

## 0.4.1

### Patch Changes

- [#26](https://github.com/himorishige/noren/pull/26) [`46420eb`](https://github.com/himorishige/noren/commit/46420eb4a4461a863415a91b8d6289fff2a0b3fb) Thanks [@himorishige](https://github.com/himorishige)! - bugfix

- [#29](https://github.com/himorishige/noren/pull/29) [`7f20301`](https://github.com/himorishige/noren/commit/7f203015e8d09d5f9b08a3cabe6eda739295c3a0) Thanks [@himorishige](https://github.com/himorishige)! - release version

- Updated dependencies [[`46420eb`](https://github.com/himorishige/noren/commit/46420eb4a4461a863415a91b8d6289fff2a0b3fb), [`7f20301`](https://github.com/himorishige/noren/commit/7f203015e8d09d5f9b08a3cabe6eda739295c3a0)]:
  - @himorishige/noren-core@0.4.1

## 0.3.0

### Minor Changes

- [#22](https://github.com/himorishige/noren/pull/22) [`9ff46de`](https://github.com/himorishige/noren/commit/9ff46de14b3385d0c25d05530777806a913ad741) Thanks [@himorishige](https://github.com/himorishige)! - Minor bug fix

### Patch Changes

- Updated dependencies [[`9ff46de`](https://github.com/himorishige/noren/commit/9ff46de14b3385d0c25d05530777806a913ad741)]:
  - @himorishige/noren-core@0.3.0

## 0.2.0

### Minor Changes

- [#14](https://github.com/himorishige/noren/pull/14) [`963b5fa`](https://github.com/himorishige/noren/commit/963b5fa609c475db430a2cd71f9358fc047fcd4b) Thanks [@himorishige](https://github.com/himorishige)! - Release 0.2.0 across all packages.

  This minor release improves documentation, test coverage, and loader ergonomics while keeping public APIs stable.

  Highlights:

  - Dictionary Reloader: documented file loader and baseDir option, clarified file:// URL validation and security notes, added Cloudflare Workers KV/R2 and bundle-embedded examples, shipped dictionary/manifest templates, included compile() examples, and kept the ESM extension handling fix.
  - Core and Plugins (US/JP): aligned masking behavior (no digits left after masking), updated tests, and standardized maskers to receive Hit-shaped inputs. No API changes.

  Upgrade notes:

  - No breaking changes expected. If you use file:// URLs, ensure they pass the documented validation and configure baseDir accordingly.

### Patch Changes

- Updated dependencies [[`963b5fa`](https://github.com/himorishige/noren/commit/963b5fa609c475db430a2cd71f9358fc047fcd4b)]:
  - @himorishige/noren-core@0.2.0
