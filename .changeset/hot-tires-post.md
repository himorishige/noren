---
"@himorishige/noren-core": minor
"@himorishige/noren-dict-reloader": minor
"@himorishige/noren-plugin-jp": minor
"@himorishige/noren-plugin-security": minor
"@himorishige/noren-plugin-us": minor
---

Release 0.2.0 across all packages.

This minor release improves documentation, test coverage, and loader ergonomics while keeping public APIs stable.

Highlights:
- Dictionary Reloader: documented file loader and baseDir option, clarified file:// URL validation and security notes, added Cloudflare Workers KV/R2 and bundle-embedded examples, shipped dictionary/manifest templates, included compile() examples, and kept the ESM extension handling fix.
- Core and Plugins (US/JP): aligned masking behavior (no digits left after masking), updated tests, and standardized maskers to receive Hit-shaped inputs. No API changes.

Upgrade notes:
- No breaking changes expected. If you use file:// URLs, ensure they pass the documented validation and configure baseDir accordingly.
