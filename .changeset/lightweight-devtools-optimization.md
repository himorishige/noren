---
"@himorishige/noren-devtools": patch
---

Major lightweight optimization: Remove complex features to focus on core functionality

**Breaking Changes:**
- Remove A/B testing functionality (ab-testing.ts)
- Remove improvement cycle automation (improvement-cycle.ts) 
- Remove contextual detection module (context-detection.ts)
- Remove contextual confidence scoring (contextual-confidence.ts)
- Simplify API exports to core functionality only

**Optimizations:**
- 71% bundle size reduction (192KB → 56KB)
- Streamlined codebase focused on essential development tools
- Maintain core benchmarking, evaluation, and metrics functionality
- Updated documentation and examples to reflect lightweight approach

**Remaining Features:**
- Performance benchmarking with memory monitoring
- Accuracy evaluation with ground truth datasets
- Metrics collection and statistical analysis
- Unified reporting system