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
}

export type Action = 'mask' | 'remove' | 'tokenize' | 'ignore'

export type Policy = {
  defaultAction?: Action
  rules?: Partial<Record<PiiType, { action: Action; preserveLast4?: boolean }>>
  contextHints?: string[]
  hmacKey?: string | CryptoKey
}

export type DetectUtils = {
  src: string
  hasCtx: (words?: string[]) => boolean
  push: (h: Hit) => void
}

export type Detector = {
  id: string
  priority?: number
  match: (u: DetectUtils) => void | Promise<void>
}

export type Masker = (hit: Hit) => string
