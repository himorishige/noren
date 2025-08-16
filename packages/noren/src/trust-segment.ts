import type { RiskScore, TrustLevel, TrustSegment } from './types.js'

/**
 * Trust segment manager for handling content with different trust levels
 * Lightweight implementation focused on preventing context mixing
 */

/**
 * Trust level hierarchy (lower number = higher trust)
 */
const TRUST_HIERARCHY: Record<TrustLevel, number> = {
  system: 0,
  user: 1,
  'tool-output': 2,
  untrusted: 3,
}

/**
 * Risk multipliers based on trust level
 */
const TRUST_RISK_MULTIPLIERS: Record<TrustLevel, number> = {
  system: 0.1, // System content should rarely be flagged
  user: 1.0, // Normal risk calculation
  'tool-output': 1.2, // Tool outputs slightly more risky
  untrusted: 2.0, // Untrusted content gets higher risk scores
}

/**
 * Creates a trust segment with the specified properties
 */
export function createTrustSegment(
  content: string,
  trust: TrustLevel,
  options: {
    risk?: RiskScore
    source?: string
    metadata?: Record<string, unknown>
  } = {},
): TrustSegment {
  return {
    content,
    trust,
    risk: options.risk ?? 0,
    source: options.source,
    metadata: options.metadata,
  }
}

/**
 * Splits text into trust segments based on markers
 * Detects common context markers and creates appropriate segments
 */
export function segmentText(text: string, defaultTrust: TrustLevel = 'user'): TrustSegment[] {
  const segments: TrustSegment[] = []

  // Context markers that indicate trust boundaries
  const contextMarkers = [
    { pattern: /#\s*system\s*[:\]]/gi, trust: 'system' as TrustLevel },
    { pattern: /\[(?:INST|instruction|system)\]/gi, trust: 'system' as TrustLevel },
    { pattern: /<\|(?:im_start|system)\|>/gi, trust: 'system' as TrustLevel },
    { pattern: /<\|(?:user|human)\|>/gi, trust: 'user' as TrustLevel },
    { pattern: /```[^`]*```/gs, trust: 'tool-output' as TrustLevel },
    { pattern: /\[tool_output\]/gi, trust: 'tool-output' as TrustLevel },
  ]

  let currentIndex = 0
  const markerMatches: Array<{ index: number; length: number; trust: TrustLevel; marker: string }> =
    []

  // Find all context markers
  for (const marker of contextMarkers) {
    const regex = new RegExp(marker.pattern.source, marker.pattern.flags)
    let match: RegExpExecArray | null
    match = regex.exec(text)

    while (match !== null) {
      markerMatches.push({
        index: match.index,
        length: match[0].length,
        trust: marker.trust,
        marker: match[0],
      })

      match = regex.exec(text)
    }
  }

  // Sort markers by position
  markerMatches.sort((a, b) => a.index - b.index)

  // Create segments based on markers
  let currentTrust = defaultTrust

  for (const markerMatch of markerMatches) {
    // Add segment before marker
    if (markerMatch.index > currentIndex) {
      const content = text.slice(currentIndex, markerMatch.index).trim()
      if (content) {
        segments.push(
          createTrustSegment(content, currentTrust, {
            source: 'segmentation',
          }),
        )
      }
    }

    // Add marker as system segment (potentially dangerous)
    segments.push(
      createTrustSegment(markerMatch.marker, 'untrusted', {
        risk: 80, // High risk for context markers
        source: 'context_marker',
        metadata: { originalTrust: markerMatch.trust },
      }),
    )

    currentIndex = markerMatch.index + markerMatch.length
    currentTrust = markerMatch.trust
  }

  // Add remaining text
  if (currentIndex < text.length) {
    const content = text.slice(currentIndex).trim()
    if (content) {
      segments.push(
        createTrustSegment(content, currentTrust, {
          source: 'segmentation',
        }),
      )
    }
  }

  // If no markers found, create single segment
  if (segments.length === 0 && text.trim()) {
    segments.push(
      createTrustSegment(text.trim(), defaultTrust, {
        source: 'single_segment',
      }),
    )
  }

  return segments
}

/**
 * Merges adjacent segments with the same trust level
 */
export function mergeSegments(segments: TrustSegment[]): TrustSegment[] {
  if (segments.length <= 1) return segments

  const merged: TrustSegment[] = []
  let current = segments[0]

  for (let i = 1; i < segments.length; i++) {
    const next = segments[i]

    // Merge if same trust level and no high-risk markers
    if (
      current.trust === next.trust &&
      current.risk < 50 &&
      next.risk < 50 &&
      current.source === next.source
    ) {
      current = createTrustSegment(`${current.content} ${next.content}`, current.trust, {
        risk: Math.max(current.risk, next.risk),
        source: current.source,
        metadata: { ...current.metadata, merged: true },
      })
    } else {
      merged.push(current)
      current = next
    }
  }

  merged.push(current)
  return merged
}

/**
 * Calculates trust-adjusted risk score
 */
export function calculateTrustAdjustedRisk(baseRisk: RiskScore, trustLevel: TrustLevel): RiskScore {
  const multiplier = TRUST_RISK_MULTIPLIERS[trustLevel]
  const adjustedRisk = baseRisk * multiplier

  // Clamp to 0-100 range
  return Math.min(100, Math.max(0, adjustedRisk))
}

/**
 * Checks if content mixing between trust levels is suspicious
 */
export function detectTrustMixing(segments: TrustSegment[]): {
  suspicious: boolean
  reasons: string[]
  riskIncrease: number
} {
  const reasons: string[] = []
  let riskIncrease = 0

  // Count trust levels
  const trustCounts = new Map<TrustLevel, number>()
  for (const segment of segments) {
    trustCounts.set(segment.trust, (trustCounts.get(segment.trust) ?? 0) + 1)
  }

  // Check for suspicious patterns
  if (trustCounts.has('system') && trustCounts.has('untrusted')) {
    reasons.push('System and untrusted content mixed')
    riskIncrease += 30
  }

  if (trustCounts.size > 3) {
    reasons.push('Too many trust levels in single input')
    riskIncrease += 20
  }

  // Check for context marker injection
  const hasContextMarkers = segments.some((s) => s.source === 'context_marker' && s.risk > 50)
  if (hasContextMarkers) {
    reasons.push('Context markers detected')
    riskIncrease += 40
  }

  // Check for trust escalation attempts
  const trustLevels = segments.map((s) => TRUST_HIERARCHY[s.trust])
  for (let i = 1; i < trustLevels.length; i++) {
    if (trustLevels[i] < trustLevels[i - 1]) {
      reasons.push('Trust escalation attempt detected')
      riskIncrease += 25
      break
    }
  }

  return {
    suspicious: reasons.length > 0,
    reasons,
    riskIncrease: Math.min(100, riskIncrease),
  }
}

/**
 * Validates trust segment integrity
 */
export function validateSegments(segments: TrustSegment[]): {
  valid: boolean
  errors: string[]
} {
  const errors: string[] = []

  for (const segment of segments) {
    // Check content
    if (!segment.content || typeof segment.content !== 'string') {
      errors.push('Invalid segment content')
    }

    // Check trust level
    if (!Object.keys(TRUST_HIERARCHY).includes(segment.trust)) {
      errors.push(`Invalid trust level: ${segment.trust}`)
    }

    // Check risk range
    if (segment.risk < 0 || segment.risk > 100) {
      errors.push(`Risk score out of range: ${segment.risk}`)
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}
