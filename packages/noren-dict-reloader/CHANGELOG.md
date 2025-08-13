# @himorishige/noren-dict-reloader

## 1.0.0

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

- [#27](https://github.com/himorishige/noren/pull/27) [`967322d`](https://github.com/himorishige/noren/commit/967322df513011618020512544355e26e60a8535) Thanks [@himorishige](https://github.com/himorishige)! - fix: perfomance

- [#29](https://github.com/himorishige/noren/pull/29) [`7f20301`](https://github.com/himorishige/noren/commit/7f203015e8d09d5f9b08a3cabe6eda739295c3a0) Thanks [@himorishige](https://github.com/himorishige)! - release version

- Updated dependencies [[`46420eb`](https://github.com/himorishige/noren/commit/46420eb4a4461a863415a91b8d6289fff2a0b3fb), [`7f20301`](https://github.com/himorishige/noren/commit/7f203015e8d09d5f9b08a3cabe6eda739295c3a0)]:
  - @himorishige/noren-core@0.4.1

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
