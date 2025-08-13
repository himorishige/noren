# @himorishige/noren-plugin-security

## 0.5.0

### Minor Changes

- [#43](https://github.com/himorishige/noren/pull/43) [`c7be5f2`](https://github.com/himorishige/noren/commit/c7be5f2ac25c70d56d87e2cad3a1e368ca532457) Thanks [@himorishige](https://github.com/himorishige)! - ## Security Plugin v0.5.0 Performance Optimizations

  ### Core Improvements

  - **17% Code Reduction**: Streamlined from 968 to 803 lines through consolidation of duplicate logic
  - **Enhanced Detection Engine**: Unified `createContextualDetector` function eliminates redundant detector implementations
  - **Improved Confidence Scoring**: Enhanced JWT and API key validation with more sophisticated algorithms
  - **Set-based Context Matching**: Optimized context hint lookup from O(n) to O(1) for better performance

  ### Enhanced Security Features

  - **Advanced Boundary Detection**: Added currency symbol boundaries (¥$€£¢) to prevent false positives in financial contexts
  - **Smarter URL Parameter Detection**: Improved risk-based classification for sensitive URL parameters
  - **Optimized Token Validation**: Consolidated masking patterns with configurable preserve lengths
  - **Unified Error Handling**: Streamlined cookie and header parsing with consistent error recovery

  ### Technical Optimizations

  - **Pre-compiled Pattern Cache**: All regex patterns optimized for repeated use
  - **Generic Helper Functions**: Consolidated parsing and validation logic across detectors and maskers
  - **Memory Efficient Processing**: Reduced object creation during detection cycles
  - **Simplified API Surface**: Maintained full backward compatibility while reducing internal complexity

  ### Detection Improvements

  - **JWT Structure Validation**: Enhanced three-part format validation with proper Base64URL checking
  - **API Key Entropy Analysis**: Improved character diversity scoring for better accuracy
  - **Session ID Patterns**: More reliable detection with enhanced boundary checking
  - **Cookie Allowlist Logic**: Streamlined wildcard pattern matching with security validation

  This update maintains full backward compatibility while significantly improving performance and code maintainability. All existing configurations and APIs remain unchanged.

### Patch Changes

- Updated dependencies [[`8fe8adb`](https://github.com/himorishige/noren/commit/8fe8adb035e688f89c2c0874397d89a1ae524b5e)]:
  - @himorishige/noren-core@0.5.0

## 0.4.1

### Patch Changes

- [#28](https://github.com/himorishige/noren/pull/28) [`ff172d5`](https://github.com/himorishige/noren/commit/ff172d56bafae63d16b3f6be56b9d1aca6c539c9) Thanks [@himorishige](https://github.com/himorishige)! - enchancement package

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
