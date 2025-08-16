---
"@himorishige/noren-plugin-jp": patch
"@himorishige/noren-devtools": patch
"@himorishige/noren-core": patch
"@himorishige/noren": minor
---

- Rename noren-guard package to noren with updated documentation and benchmarks
- Fix template literal warnings in MCP utilities by replacing string concatenation with template literals
- Add missing radix parameter to parseInt calls in test files for consistent numeric parsing
- Update biome.json schema version from 2.1.4 to 2.2.0 for compatibility
- Remove unused imports from example files to clean up code
- Fix unused variable warnings by prefixing with underscore
- Ensure all lint checks pass with zero warnings
