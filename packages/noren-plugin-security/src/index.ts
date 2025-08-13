// Noren Security Plugin - Header and token scrubber

// Core exports
export { detectors } from './detectors.js'
export { createSecurityMaskers, maskers } from './maskers.js'
// Pattern constants for advanced customization
export { SECURITY_CONTEXTS, SECURITY_PATTERNS } from './patterns.js'
// Types and configuration
export type {
  CookieInfo,
  HeaderInfo,
  SecurityConfig,
  SecurityFeatures,
  SecurityPiiType,
} from './types.js'
// Utilities for advanced usage
export {
  applyDefaultConfig,
  isCookieAllowed,
  isHeaderAllowed,
  parseCookieHeader,
  parseHttpHeader,
  parseSetCookieHeader,
  setSecurityDebugLogger,
} from './utils.js'
