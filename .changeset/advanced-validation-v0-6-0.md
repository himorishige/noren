---
"@himorishige/noren-core": major
---

# Advanced Validation & False Positive Prevention (v0.6.0)

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
  defaultAction: 'mask',
  validationStrictness: 'balanced' // Recommended setting
})

// Plugin integration with validation
registry.use(jpPlugin.detectors, jpPlugin.maskers)

// Debug validation decisions
import { debugValidation } from '@himorishige/noren-core'
debugValidation('4242424242424242', 'credit_card', {
  surroundingText: 'Test card: 4242424242424242',
  strictness: 'balanced',
  originalIndex: 11
})
```

This release represents a major step forward in PII detection accuracy while maintaining the performance and simplicity that makes Noren Core effective for production use.