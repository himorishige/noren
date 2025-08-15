// Noren Network Plugin - IPv4, IPv6, and MAC address detection

// Core exports
export { detectors, unifiedDetector } from './detectors.js'
// IPv6 utilities
export { type IPv6ParseResult, parseIPv6 } from './ipv6-parser.js'
export { maskers } from './maskers.js'
// Pattern constants for advanced customization
export {
  NETWORK_PATTERN_TYPES,
  NETWORK_PATTERNS,
  UNIFIED_NETWORK_PATTERN,
} from './patterns.js'

// Validation utilities
export {
  type NetworkValidationContext,
  type NetworkValidationResult,
  validateIPv4,
  validateIPv6,
  validateMAC,
  validateNetworkCandidate,
} from './validators.js'
