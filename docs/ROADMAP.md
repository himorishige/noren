# Noren Development Roadmap

## Vision
Build the **fastest, lightest, and simplest** PII detection library while maintaining accuracy and extensibility.

## Core Principles
- **Fast**: Sub-millisecond detection, 10MB/s+ throughput
- **Lightweight**: <150KB per plugin, minimal dependencies
- **Simple**: One-line setup, sensible defaults, clear APIs

## Feature Priorities

### Priority 1: High
*Critical features for core stability and immediate needs*
- [ ] **Core Improvements**
  - IPv6 boundary detection optimization
  - Memory pool implementation for stream processing
  - Enhanced false positive reduction with context analysis
  - Performance target: 15MB/s throughput

- [ ] **EU Finance Plugin** (`@himorishige/noren-plugin-eu`)
  - IBAN (International Bank Account Number) with Mod97 validation
  - VAT numbers for major EU countries
  - SEPA payment references
  - Size budget: 100KB max

- [ ] **Canada Plugin** (`@himorishige/noren-plugin-ca`)
  - SIN (Social Insurance Number) with Luhn validation
  - Provincial health card numbers
  - Postal codes (K1A 0B1 format)
  - Size budget: 80KB max

- [ ] **Cloud Provider Plugin** (`@himorishige/noren-plugin-cloud`)
  - AWS access keys and secrets
  - Azure subscription IDs and keys
  - GCP service account keys
  - Kubernetes secrets and configs
  - Size budget: 120KB max

### Priority 2: Medium
*Important features for global expansion and optimization*
- [ ] **Performance Optimizations**
  - SIMD operations for pattern matching (where available)
  - WebAssembly compilation for browser deployment
  - Streaming optimizations with backpressure handling
  - Target: 20MB/s throughput

- [ ] **LATAM Bundle** (`@himorishige/noren-plugin-latam`)
  - Brazil: CPF, CNPJ with validation
  - Mexico: RFC, CURP
  - Argentina: DNI, CUIT
  - Size budget: 150KB for entire bundle

- [ ] **India Plugin** (`@himorishige/noren-plugin-in`)
  - Aadhaar number with Verhoeff checksum
  - PAN (Permanent Account Number)
  - Indian phone numbers (+91)
  - Size budget: 100KB max

- [ ] **Australia/NZ Plugin** (`@himorishige/noren-plugin-au`)
  - TFN (Tax File Number)
  - Medicare numbers
  - NZ IRD numbers
  - Size budget: 80KB max

### Priority 3: Low
*Advanced features and ecosystem development*
- [ ] **WebAssembly Edition**
  - Pure WASM compilation for maximum performance
  - Browser-optimized bundle
  - SharedArrayBuffer support for parallel processing
  - Target: 50MB/s in supported environments

- [ ] **Industry-Specific Packs**
  - Healthcare: HIPAA compliance pack
  - Finance: PCI-DSS compliance pack
  - Education: FERPA compliance pack
  - Modular composition of existing plugins

- [ ] **Developer Ecosystem**
  - Plugin development CLI tool
  - Automated accuracy testing framework
  - Community plugin marketplace
  - Plugin certification program

## Plugin Extension Guidelines

### JP Plugin Extensions (Minimal)
- Driver's license numbers (with checksum validation only)
- Health insurance numbers (format validation only)
- Keep under 150KB total

### US Plugin Extensions (Minimal)
- State driver's license (checksum states only)
- EIN (Employer Identification Number)
- Keep under 150KB total

## Performance Targets

### Benchmark Goals
| Metric | Current (v0.5.0) | Target (v1.0) |
|--------|-----------------|---------------|
| Throughput | 10MB/s | 20MB/s |
| Latency (p95) | 0.1ms | 0.05ms |
| Memory overhead | 50MB | 25MB |
| Bundle size (core) | 124KB | 100KB |
| False positive rate | <1% | <0.1% |

### Size Budgets
| Package | Maximum Size |
|---------|-------------|
| Core | 100KB |
| Regional plugins | 150KB each |
| Security plugin | 120KB |
| DevTools | 200KB |
| Dict reloader | 50KB |

## Testing Strategy

### Accuracy Requirements
- Precision: >95% for validated patterns (Luhn, Mod97, etc.)
- Recall: >90% for common formats
- False positive rate: <0.1% in production environments

### Performance Testing
- Continuous benchmarking on every PR
- Memory leak detection in streaming scenarios
- Cross-platform performance validation

## Breaking Changes Policy

### Allowed Breaking Changes
- v0.x: API changes allowed with migration guide
- v1.0+: Breaking changes only in major versions
- Deprecation period: 6 months minimum

### Migration Support
- Automated migration scripts where possible
- Detailed migration guides
- Compatibility layers for gradual migration

## Community Engagement

### Contribution Guidelines
- Plugin template repository
- Automated testing for community plugins
- Code review process for official plugins

### Support Channels
- GitHub Discussions for questions
- Issue templates for bugs/features
- Monthly community calls (post v1.0)

## Success Metrics

### Adoption Metrics
- npm downloads growth
- GitHub stars and community engagement
- Production deployments tracking

### Quality Metrics
- Test coverage: >95%
- Documentation coverage: 100%
- Issue resolution time: <48 hours for critical

## Risk Mitigation

### Technical Risks
- **WebAssembly compatibility**: Maintain pure JS fallback
- **Performance regression**: Automated benchmarking gates
- **Security vulnerabilities**: Regular security audits

### Business Risks
- **Competitor features**: Focus on core strengths (fast/light/simple)
- **Maintenance burden**: Strict plugin size/complexity limits
- **Breaking changes**: Clear versioning and migration paths

---

*This roadmap is subject to change based on community feedback and business priorities. Features will be implemented based on priority and available resources.*

*Last updated: 2025-08-14*