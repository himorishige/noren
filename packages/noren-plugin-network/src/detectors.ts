import type { Detector } from '@himorishige/noren-core'
import { parseIPv6 } from './ipv6-parser.js'
import { NETWORK_PATTERN_TYPES, NETWORK_PATTERNS, UNIFIED_NETWORK_PATTERN } from './patterns.js'
import { validateNetworkCandidate } from './validators.js'

/**
 * Context hints for network PII detection
 */
const NETWORK_CONTEXTS = {
  ip: new Set(['ip', 'address', 'server', 'host', 'endpoint', 'url', 'api', 'dns', 'gateway']),
  ipv6: new Set(['ipv6', 'ip6', 'interface', 'link-local', 'unique-local']),
  mac: new Set(['mac', 'ethernet', 'wifi', 'interface', 'adapter', 'nic', 'hardware']),
}

/**
 * IPv4 address detector
 */
const ipv4Detector: Detector = {
  id: 'network.ipv4',
  priority: 0,
  match: ({ src, push, hasCtx, canPush }) => {
    // Optional context requirement for stricter detection
    const hasContext = hasCtx(Array.from(NETWORK_CONTEXTS.ip))

    for (const m of src.matchAll(NETWORK_PATTERNS.ipv4)) {
      if (m.index === undefined || !canPush?.()) break

      const value = m[0]
      const confidence = hasContext ? 0.8 : 0.6

      // Basic validation to reduce false positives
      const surroundingText = src.slice(
        Math.max(0, m.index - 50),
        Math.min(src.length, m.index + value.length + 50),
      )

      const validation = validateNetworkCandidate(value, 'ipv4', {
        surroundingText,
        strictness: 'balanced',
        originalIndex: 0, // Not used in this context
      })

      if (!validation.valid) continue

      push({
        type: 'ipv4',
        start: m.index,
        end: m.index + value.length,
        value,
        risk: 'low',
        confidence: Math.max(confidence, validation.confidence),
        reasons: ['ipv4_pattern', hasContext ? 'has_context' : 'no_context', validation.reason],
        features: {
          hasContext,
          isPrivate: validation.metadata?.isPrivate || false,
          octets: validation.metadata?.octets || [],
        },
      })
    }
  },
}

/**
 * IPv6 address detector
 */
const ipv6Detector: Detector = {
  id: 'network.ipv6',
  priority: -1, // Lower priority due to complex pattern
  match: ({ src, push, hasCtx, canPush }) => {
    const hasContext = hasCtx(Array.from(NETWORK_CONTEXTS.ipv6))

    for (const m of src.matchAll(NETWORK_PATTERNS.ipv6)) {
      if (m.index === undefined || !canPush?.()) break

      const value = m[0]
      let startIndex = m.index

      // Handle lookahead adjustment (similar to core implementation)
      const fullMatch = m[0]
      const ipv6Start = fullMatch.lastIndexOf(value)
      if (ipv6Start > 0) {
        startIndex = m.index + ipv6Start
      }

      // IPv6 validation using the parser
      const parseResult = parseIPv6(value)
      if (!parseResult.valid) continue

      const confidence = hasContext ? 0.9 : 0.7

      push({
        type: 'ipv6',
        start: startIndex,
        end: startIndex + value.length,
        value,
        risk: 'low',
        confidence,
        reasons: ['ipv6_pattern', hasContext ? 'has_context' : 'no_context', 'ipv6_parsed'],
        features: {
          hasContext,
          normalized: parseResult.normalized,
          isPrivate: parseResult.isPrivate || false,
          isLoopback: parseResult.isLoopback || false,
          isLinkLocal: parseResult.isLinkLocal || false,
          isUniqueLocal: parseResult.isUniqueLocal || false,
        },
      })
    }
  },
}

/**
 * MAC address detector
 */
const macDetector: Detector = {
  id: 'network.mac',
  priority: 0,
  match: ({ src, push, hasCtx, canPush }) => {
    const hasContext = hasCtx(Array.from(NETWORK_CONTEXTS.mac))

    for (const m of src.matchAll(NETWORK_PATTERNS.mac)) {
      if (m.index === undefined || !canPush?.()) break

      const value = m[0]
      const confidence = hasContext ? 0.8 : 0.5

      // Basic validation
      const surroundingText = src.slice(
        Math.max(0, m.index - 50),
        Math.min(src.length, m.index + value.length + 50),
      )

      const validation = validateNetworkCandidate(value, 'mac', {
        surroundingText,
        strictness: 'balanced',
        originalIndex: 0,
      })

      if (!validation.valid) continue

      push({
        type: 'mac',
        start: m.index,
        end: m.index + value.length,
        value,
        risk: 'low',
        confidence: Math.max(confidence, validation.confidence),
        reasons: ['mac_pattern', hasContext ? 'has_context' : 'no_context', validation.reason],
        features: {
          hasContext,
          normalized: validation.metadata?.normalized || value,
          separator: validation.metadata?.separator || ':',
        },
      })
    }
  },
}

/**
 * Unified network detector (optional, for performance optimization)
 */
const unifiedNetworkDetector: Detector = {
  id: 'network.unified',
  priority: 1,
  match: ({ src, push, hasCtx, canPush }) => {
    const hasIpContext = hasCtx(Array.from(NETWORK_CONTEXTS.ip))
    const hasIpv6Context = hasCtx(Array.from(NETWORK_CONTEXTS.ipv6))
    const hasMacContext = hasCtx(Array.from(NETWORK_CONTEXTS.mac))

    for (const match of src.matchAll(UNIFIED_NETWORK_PATTERN)) {
      if (!canPush?.()) break
      if (match.index == null) continue

      // Find which group matched
      for (let i = 1; i < match.length; i++) {
        if (match[i]) {
          const patternType = NETWORK_PATTERN_TYPES[i - 1]
          const value = match[i]
          let startIndex = match.index
          let isValid = true

          // Handle IPv6 position adjustment
          if (patternType.type === 'ipv6') {
            const fullMatch = match[0]
            const ipv6Start = fullMatch.lastIndexOf(value)
            startIndex = match.index + ipv6Start

            const result = parseIPv6(value)
            if (!result.valid) {
              isValid = false
            }
          }

          if (isValid) {
            const contextMap = {
              ipv4: hasIpContext,
              ipv6: hasIpv6Context,
              mac: hasMacContext,
            }

            const hasContext = contextMap[patternType.type as keyof typeof contextMap] || false
            const baseConfidence = hasContext ? 0.8 : 0.6

            push({
              type: patternType.type,
              start: startIndex,
              end: startIndex + value.length,
              value,
              risk: patternType.risk,
              confidence: baseConfidence,
              reasons: [`${patternType.type}_pattern`, hasContext ? 'has_context' : 'no_context'],
              features: {
                hasContext,
                unified: true,
              },
            })
          }
          break // Only process the first match in this iteration
        }
      }
    }
  },
}

// Export individual detectors (recommended for flexibility)
export const detectors: Detector[] = [ipv4Detector, ipv6Detector, macDetector]

// Export unified detector as alternative (for performance-critical scenarios)
export const unifiedDetector = unifiedNetworkDetector
