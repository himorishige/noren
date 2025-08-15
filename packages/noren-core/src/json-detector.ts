// JSON/structured data detection for Noren Core
// Streaming JSON parser with PII detection based on key names and values

import type { DetectUtils, Hit, PiiType } from './types.js'

// PII key patterns for different types of sensitive data
const PII_KEY_PATTERNS = {
  email: new Set(['email', 'mail', 'contact', 'e_mail', 'メール', 'mailaddress']),
  phone: new Set(['phone', 'tel', 'mobile', 'telephone', '電話', '携帯', 'cellphone']),
  address: new Set(['address', 'addr', '住所', '所在地', 'location', 'street']),
  credit_card: new Set(['card', 'card_number', 'cc', 'cardnum', 'カード番号', 'creditcard']),
  ssn: new Set(['ssn', 'social_security', 'social', 'socialsecurity']),
  name: new Set([
    'name',
    'fullname',
    'first_name',
    'last_name',
    '氏名',
    '名前',
    'firstname',
    'lastname',
  ]),
  id: new Set(['id', 'user_id', 'customer_id', 'personal_id', 'identification']),
  birthday: new Set(['birthday', 'birth_date', 'dob', 'date_of_birth', '生年月日', 'birthdate']),
} as const

export type JsonHit = Hit & {
  jsonPath: string
  keyName: string
}

export interface JsonDetectionResult {
  hits: JsonHit[]
  isValidJson: boolean
  fallbackToText: boolean
}

/**
 * Streaming JSON detector for PII data
 * Uses key-based detection with fallback to text parsing
 */
export class JSONDetector {
  private currentPath: string[] = []
  private hits: JsonHit[] = []
  private arrayIndices: number[] = []

  /**
   * Detect PII in JSON string
   */
  detectInJson(jsonString: string, utils: DetectUtils): JsonDetectionResult {
    this.hits = []
    this.currentPath = []
    this.arrayIndices = []

    try {
      const parsed = JSON.parse(jsonString)
      this.traverseObject(parsed, utils, 0, jsonString)

      return {
        hits: this.hits,
        isValidJson: true,
        fallbackToText: false,
      }
    } catch (_error) {
      // Try NDJSON (newline-delimited JSON)
      if (this.tryNDJSON(jsonString, utils)) {
        return {
          hits: this.hits,
          isValidJson: true,
          fallbackToText: false,
        }
      }

      // Fallback to text detection
      return {
        hits: [],
        isValidJson: false,
        fallbackToText: true,
      }
    }
  }

  /**
   * Try parsing as NDJSON (newline-delimited JSON)
   */
  private tryNDJSON(text: string, utils: DetectUtils): boolean {
    const lines = text.split('\n').filter((line) => line.trim())

    for (let i = 0; i < lines.length; i++) {
      try {
        const parsed = JSON.parse(lines[i])
        this.currentPath = [`[${i}]`]
        this.arrayIndices = [i]
        this.traverseObject(parsed, utils, 0, text)
        // Reset for next iteration
        this.currentPath = []
        this.arrayIndices = []
      } catch (_error) {
        return false
      }
    }

    return true
  }

  /**
   * Recursively traverse object/array structures
   */
  private traverseObject(obj: unknown, utils: DetectUtils, depth = 0, originalJson?: string): void {
    // Prevent infinite recursion
    if (depth > 10) return

    if (Array.isArray(obj)) {
      this.traverseArray(obj, utils, depth, originalJson)
    } else if (obj && typeof obj === 'object') {
      this.traverseObjectProperties(obj as Record<string, unknown>, utils, depth, originalJson)
    }
  }

  /**
   * Traverse array elements
   */
  private traverseArray(
    arr: unknown[],
    utils: DetectUtils,
    depth: number,
    originalJson?: string,
  ): void {
    for (let i = 0; i < arr.length; i++) {
      this.currentPath.push(`[${i}]`)
      this.arrayIndices.push(i)

      this.traverseObject(arr[i], utils, depth + 1, originalJson)

      this.currentPath.pop()
      this.arrayIndices.pop()
    }
  }

  /**
   * Traverse object properties
   */
  private traverseObjectProperties(
    obj: Record<string, unknown>,
    utils: DetectUtils,
    depth: number,
    originalJson?: string,
  ): void {
    for (const [key, value] of Object.entries(obj)) {
      this.currentPath.push(key)

      if (typeof value === 'string' && value.length > 0) {
        this.checkStringValue(key, value, utils, originalJson)
      } else if (value && typeof value === 'object') {
        this.traverseObject(value, utils, depth + 1, originalJson)
      }

      this.currentPath.pop()
    }
  }

  /**
   * Check if string value contains PII based on key name and content
   */
  private checkStringValue(
    key: string,
    value: string,
    utils: DetectUtils,
    originalJson?: string,
  ): void {
    const keyLower = key.toLowerCase()
    const jsonPath = this.getJsonPath()

    // Calculate actual positions in original JSON string
    const { start, end } = this.findValuePosition(value, originalJson || JSON.stringify(value))

    // Detect PII type based on key name
    const detectedType = this.detectPiiTypeFromKey(keyLower)

    if (detectedType) {
      // Key-based detection - higher confidence
      this.addJsonHit({
        type: detectedType,
        value,
        jsonPath,
        keyName: key,
        confidence: 0.9,
        risk: this.getRiskLevel(detectedType),
        reasons: ['json_key_match', `key_pattern_${detectedType}`],
        features: {
          keyBased: true,
          detectedFromKey: key,
        },
        start,
        end,
      })
    } else {
      // Content-based detection using existing detectors
      this.detectInStringValue(value, key, jsonPath, utils, start, end)
    }
  }

  /**
   * Detect PII type from key name
   */
  private detectPiiTypeFromKey(keyLower: string): PiiType | null {
    for (const [piiType, patterns] of Object.entries(PII_KEY_PATTERNS)) {
      if (patterns.has(keyLower)) {
        // Map phone to phone_e164 to match existing types
        if (piiType === 'phone') return 'phone_e164'
        return piiType as PiiType
      }
    }

    // Check partial matches
    if (keyLower.includes('email') || keyLower.includes('mail')) return 'email'
    if (keyLower.includes('phone') || keyLower.includes('tel')) return 'phone_e164'
    if (keyLower.includes('card') || keyLower.includes('credit')) return 'credit_card'
    if (keyLower.includes('address') || keyLower.includes('addr')) return 'address'

    return null
  }

  /**
   * Use existing detectors on string values
   */
  private detectInStringValue(
    value: string,
    key: string,
    jsonPath: string,
    utils: DetectUtils,
    start: number = 0,
    end: number = 0,
  ): void {
    // Create a mock DetectUtils for this specific value
    const _mockUtils: DetectUtils = {
      src: value,
      hasCtx: utils.hasCtx,
      push: (hit: Hit) => {
        this.addJsonHit({
          type: hit.type,
          value: hit.value,
          jsonPath,
          keyName: key,
          confidence: (hit.confidence || 0.7) * 0.8, // Slightly lower confidence for content-based
          risk: hit.risk,
          reasons: [...(hit.reasons || []), 'json_content_match'],
          features: {
            ...hit.features,
            keyBased: false,
            foundInKey: key,
          },
          start,
          end,
        })
      },
      canPush: utils.canPush,
    }

    // Run built-in detection on the value
    // Note: We would need to import and use the actual detectors here
    // For now, we'll do basic pattern matching
    this.basicPatternMatch(value, key, jsonPath, ['json_content_match'], start, end)
  }

  /**
   * Basic pattern matching for common PII types
   */
  private basicPatternMatch(
    value: string,
    key: string,
    jsonPath: string,
    additionalReasons: string[] = [],
    start: number = 0,
    end: number = 0,
  ): void {
    // Email pattern
    const emailPattern = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g
    const emailMatches = value.matchAll(emailPattern)
    for (const match of emailMatches) {
      this.addJsonHit({
        type: 'email',
        value: match[0],
        jsonPath,
        keyName: key,
        confidence: 0.8,
        risk: 'medium',
        reasons: [...additionalReasons, 'json_email_pattern', 'regex_match'],
        features: {
          keyBased: false,
          foundInKey: key,
        },
        start,
        end,
      })
    }

    // Phone pattern (simple)
    const phonePattern = /\b(?:\+?1[-.\s]?)?\(?[0-9]{3}\)?[-.\s]?[0-9]{3}[-.\s]?[0-9]{4}\b/g
    const phoneMatches = value.matchAll(phonePattern)
    for (const match of phoneMatches) {
      this.addJsonHit({
        type: 'phone_e164',
        value: match[0],
        jsonPath,
        keyName: key,
        confidence: 0.7,
        risk: 'medium',
        reasons: [...additionalReasons, 'json_phone_pattern', 'regex_match'],
        features: {
          keyBased: false,
          foundInKey: key,
        },
        start,
        end,
      })
    }
  }

  /**
   * Add a JSON-specific hit
   */
  private addJsonHit(params: {
    type: PiiType
    value: string
    jsonPath: string
    keyName: string
    confidence: number
    risk: 'low' | 'medium' | 'high'
    reasons: string[]
    features: Record<string, unknown>
    start?: number
    end?: number
  }): void {
    this.hits.push({
      type: params.type,
      start: params.start || 0,
      end: params.end || params.value.length,
      value: params.value,
      risk: params.risk,
      confidence: params.confidence,
      reasons: params.reasons,
      features: params.features,
      jsonPath: params.jsonPath,
      keyName: params.keyName,
    })
  }

  /**
   * Get current JSON path
   */
  private getJsonPath(): string {
    if (this.currentPath.length === 0) return '$'
    return `$.${this.currentPath.join('.')}`
  }

  /**
   * Find the position of a value in the original JSON string
   * Simple fallback - just return default positions for now
   */
  private findValuePosition(value: string, originalJson: string): { start: number; end: number } {
    // For now, just return simple positions
    // This is a complex problem that would require more sophisticated JSON parsing
    const index = originalJson.indexOf(value)
    if (index >= 0) {
      return { start: index, end: index + value.length }
    }
    return { start: 0, end: value.length }
  }

  /**
   * Get risk level for PII type
   */
  private getRiskLevel(piiType: PiiType): 'low' | 'medium' | 'high' {
    switch (piiType) {
      case 'credit_card':
      case 'ssn':
        return 'high'
      case 'email':
      case 'phone_e164':
      case 'name':
        return 'medium'
      default:
        return 'low'
    }
  }
}

/**
 * JSON detector factory function
 */
export function createJSONDetector(): JSONDetector {
  return new JSONDetector()
}
