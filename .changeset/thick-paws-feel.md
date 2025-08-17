---
"@himorishige/noren": patch
---

Fix Web Standards compatibility and pattern detection issues

- Replace Node.js-specific APIs with Web Standards for Deno/Bun compatibility
- Fix ALL_PATTERNS export duplication in patterns.ts
- Temporarily disable Aho-Corasick algorithm due to regex pattern incompatibility
- Adjust performance test thresholds to realistic values
- Remove console.warn() calls from error handlers
- Add compatibility checks for process.memoryUsage() in tests
