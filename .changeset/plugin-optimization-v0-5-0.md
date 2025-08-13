---
"@himorishige/noren-plugin-jp": minor
"@himorishige/noren-plugin-us": minor
---

**Plugin Optimization v0.5.0**

## Breaking Changes
- **PII Type Naming Convention**: Updated to `type_country` format for consistency
  - `jp_postal` → `postal_jp`, `jp_my_number` → `mynumber_jp` 
  - `us_phone` → `phone_us`, `us_zip` → `zip_us`, `us_ssn` → `ssn_us`

## Performance Optimizations
- **Context Hints as Sets**: Converted to `Set` for O(1) lookup performance
- **Pre-compiled Regex Patterns**: All patterns compiled at module load time
- **Code Size Reduction**: 
  - plugin-us: 453 → 197 lines (56% reduction)
  - plugin-jp: 685 → 199 lines (71% reduction)
  - validators simplified with streamlined logic

## Enhanced Features
- **Improved Confidence Scoring**: More accurate validation with context awareness
- **Boundary Detection**: Better false positive reduction
- **Memory Optimization**: Reduced object allocations in hot paths

All existing functionality maintained with full backward compatibility except for PII type name changes.