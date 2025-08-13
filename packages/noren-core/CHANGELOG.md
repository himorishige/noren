# @himorishige/noren-core

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
