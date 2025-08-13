---
"@himorishige/noren-plugin-jp": minor
"@himorishige/noren-plugin-us": minor
"@himorishige/noren-dict-reloader": minor
---

**v0.5.0 Optimization Release**

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