// Core type definitions

export type PiiType =
  | 'email'
  | 'ipv4'
  | 'ipv6'
  | 'mac'
  | 'phone_e164'
  | 'credit_card'
  | (string & {})

export type Hit = {
  type: PiiType
  start: number
  end: number
  value: string
  risk: 'low' | 'medium' | 'high'
  priority?: number
  confidence?: number // 0.0-1.0, added in v0.3.0
  reasons?: string[] // Detection reasoning, added in v0.3.0
  features?: Record<string, any> // Additional metadata, added in v0.3.0
}

export type Action = 'mask' | 'remove' | 'tokenize' | 'ignore'

export type DetectionSensitivity = 'strict' | 'balanced' | 'relaxed'

export type Policy = {
  defaultAction?: Action
  rules?: Partial<Record<PiiType, { action: Action; preserveLast4?: boolean }>>
  contextHints?: string[]
  hmacKey?: string | CryptoKey
  sensitivity?: DetectionSensitivity // Added in v0.3.0
  confidenceThreshold?: number // Custom threshold override, added in v0.3.0
  enableContextualConfidence?: boolean // Enable P2 contextual confidence, added in v0.4.0
  contextualSuppressionEnabled?: boolean // Enable contextual suppression, added in v0.4.0
  contextualBoostEnabled?: boolean // Enable contextual boost, added in v0.4.0
}

export type DetectUtils = {
  src: string
  hasCtx: (words?: string[]) => boolean
  push: (h: Hit) => void
  canPush?: () => boolean
}

export type Detector = {
  id: string
  priority?: number
  match: (u: DetectUtils) => void | Promise<void>
}

export type Masker = (hit: Hit) => string
