# @himorishige/noren

## 0.2.0

### Minor Changes

- [#79](https://github.com/himorishige/noren/pull/79) [`a74e9b8`](https://github.com/himorishige/noren/commit/a74e9b83b2d1574c204a8c2382e953fe3ce47e63) Thanks [@himorishige](https://github.com/himorishige)! - - Rename noren-guard package to noren with updated documentation and benchmarks
  - Fix template literal warnings in MCP utilities by replacing string concatenation with template literals
  - Add missing radix parameter to parseInt calls in test files for consistent numeric parsing
  - Update biome.json schema version from 2.1.4 to 2.2.0 for compatibility
  - Remove unused imports from example files to clean up code
  - Fix unused variable warnings by prefixing with underscore
  - Ensure all lint checks pass with zero warnings
