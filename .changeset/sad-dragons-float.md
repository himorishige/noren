---
"@himorishige/noren-devtools": patch
---

Fix import paths in noren-devtools examples and improve dependency configuration

- Fix incorrect import paths in all noren-devtools/examples/*.mjs files
- Update simple-ab-test.mjs to reference correct devtools output
- Move @himorishige/noren-core from peerDependencies to dependencies in noren-devtools
- Add noren-devtools path mapping to tsconfig.base.json
- Ensure examples can run correctly after build
