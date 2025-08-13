---
'@himorishige/noren-plugin-security': minor
---

## Security Plugin v0.5.0 Performance Optimizations

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