# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Environment-aware allowlist/denylist functionality for false positive reduction
- `AllowDenyManager` class for managing allowlist and denylist patterns
- Environment-specific configuration (`production`, `test`, `development`)
- Automatic exclusion of test domains (example.com, localhost) in non-production environments
- Custom allowlist and denylist support
- IPv6 address parsing using two-phase approach (coarse extraction + strict parsing)
- `parseIPv6` function for accurate IPv6 address validation and classification
- Support for IPv6 compressed notation (`::`) and embedded IPv4 addresses
- Private IPv6 address classification (link-local, unique local, documentation)

### Changed
- **BREAKING**: `Registry` constructor now accepts `RegistryOptions` instead of `Policy`
- IPv6 detection switched from pure regex to parser-based approach
- Improved IPv6 address accuracy and reduced false positives
- Enhanced performance for IPv6 processing with boundary checking

### Fixed
- IPv6 compressed notation (`::`) parsing errors
- False positive detection for test emails and private IP addresses
- Memory leaks in repeated IPv6 parsing operations

### Performance
- Pre-compiled regex patterns for faster matching
- Optimized IPv6 candidate extraction with multiple pattern matching
- Reduced regex complexity by moving IPv6 validation to dedicated parser

## [0.2.0] - 2024-XX-XX

### Added
- Performance optimizations for large text processing
- Context hints Set optimization for O(1) lookup
- Detector pre-sorting for improved performance
- Security enhancements with minimum HMAC key length requirement

### Changed
- Improved Japanese phone number support (060, 070, 080, 090)
- Enhanced IPv6 detection patterns
- Better postal code masking format (removed 〒 symbol from output)

### Fixed
- Binary-safe stream redaction issues
- Various edge cases in PII detection
- Memory usage optimization in repeated operations

## [0.1.0] - Initial Release

### Added
- Core PII detection and masking functionality
- Support for email, IP addresses, credit cards, phone numbers
- Plugin architecture for region-specific detection
- Japan plugin (`@himorishige/noren-plugin-jp`)
- US plugin (`@himorishige/noren-plugin-us`)
- Security plugin (`@himorishige/noren-plugin-security`)
- Dictionary reloader (`@himorishige/noren-dict-reloader`)
- HMAC-based tokenization using WebCrypto API
- WHATWG Streams support for streaming processing
- Built on Web Standards (no Node.js dependencies)
- Comprehensive test suite
- TypeScript support

### Features
- PII masking with customizable patterns
- Tokenization for data anonymization
- Context-aware detection with hints
- Streaming support for large files
- Hot-reloading of policies and dictionaries
- Multiple output formats (mask, remove, tokenize)
- Plugin-based architecture for extensibility

---

## Migration Guide

### From v0.2.x to v0.3.0

**Breaking Changes:**

1. **Registry Constructor Change**
   ```ts
   // Before v0.3.0
   const registry = new Registry({
     defaultAction: 'mask',
     rules: { ... }
   });

   // After v0.3.0
   const registry = new Registry({
     defaultAction: 'mask',
     environment: 'production', // New required field
     rules: { ... },
     allowDenyConfig: { ... } // Optional new configuration
   });
   ```

2. **IPv6 Detection Changes**
   - IPv6 detection is now more accurate but may detect fewer edge cases
   - Private IPv6 addresses (::1, fe80::, fd00::) are no longer detected by default
   - Use `allowDenyConfig.customDenylist` to force detection if needed

**Recommended Migration Steps:**

1. Add `environment` field to your Registry configuration
2. Test your application with the new IPv6 detection
3. Configure `allowDenyConfig` if you need custom allow/deny behavior
4. Update your tests to account for improved false positive reduction

**Benefits of Upgrading:**

- Reduced false positives in development/test environments
- More accurate IPv6 detection
- Better performance for IPv6 processing
- Customizable detection behavior per environment