/**
 * P3-1: Tests for accuracy measurement framework
 * Comprehensive testing of ground truth management and evaluation metrics
 */

import { describe, expect, it } from 'vitest'
import {
  createSyntheticEntry,
  type DetectionResult,
  EvaluationEngine,
  type GroundTruthEntry,
  GroundTruthManager,
} from '../src/evaluation.js'

describe('GroundTruthManager - basic operations', () => {
  it('should add and retrieve entries', () => {
    const manager = new GroundTruthManager()

    const entry: GroundTruthEntry = {
      id: 'test1',
      text: 'Contact john@company.com for help',
      annotations: [
        {
          start: 8,
          end: 24, // 'john@company.com' = 16 chars, so 8+16=24
          type: 'email',
          value: 'john@company.com',
        },
      ],
    }

    manager.addEntry(entry)
    const retrieved = manager.getEntry('test1')

    expect(retrieved).toEqual(entry)
  })

  it('should validate annotation bounds', () => {
    const manager = new GroundTruthManager()

    const invalidEntry: GroundTruthEntry = {
      id: 'invalid1',
      text: 'Short text',
      annotations: [
        {
          start: 5,
          end: 20, // Beyond text length
          type: 'email',
          value: 'john@company.com',
        },
      ],
    }

    expect(() => manager.addEntry(invalidEntry)).toThrow(/Invalid annotation bounds/)
  })

  it('should detect overlapping annotations', () => {
    const manager = new GroundTruthManager()

    const overlappingEntry: GroundTruthEntry = {
      id: 'overlap1',
      text: 'Call 090-1234-5678 or email john@company.com',
      annotations: [
        {
          start: 5,
          end: 17, // 090-1234-5678
          type: 'phone',
          value: '090-1234-5678',
        },
        {
          start: 10,
          end: 17, // Overlaps with phone
          type: 'number',
          value: '1234-5678',
        },
      ],
    }

    expect(() => manager.addEntry(overlappingEntry)).toThrow(/Overlapping annotations/)
  })

  it('should validate annotation values match text', () => {
    const manager = new GroundTruthManager()

    const mismatchEntry: GroundTruthEntry = {
      id: 'mismatch1',
      text: 'Contact john@company.com for help',
      annotations: [
        {
          start: 8,
          end: 23,
          type: 'email',
          value: 'jane@company.com', // Doesn't match actual text
        },
      ],
    }

    expect(() => manager.addEntry(mismatchEntry)).toThrow(/Annotation value mismatch/)
  })

  it('should export and import JSON', () => {
    const manager = new GroundTruthManager()

    const entry: GroundTruthEntry = {
      id: 'export1',
      text: 'Test email: test@example.com',
      annotations: [
        {
          start: 12,
          end: 28, // 'test@example.com' = 16 chars, so 12+16=28
          type: 'email',
          value: 'test@example.com',
        },
      ],
    }

    manager.addEntry(entry)
    const exported = manager.exportToJson()

    const newManager = new GroundTruthManager()
    newManager.importFromJson(exported)

    const imported = newManager.getEntry('export1')
    expect(imported).toEqual(entry)
  })
})

describe('EvaluationEngine - overlap calculation', () => {
  it('should calculate IoU correctly', () => {
    const manager = new GroundTruthManager()
    manager.addEntry({
      id: 'overlap1',
      text: 'Contact john@company.com today',
      annotations: [
        {
          start: 8,
          end: 24, // "john@company.com" (16 chars), so 8+16=24
          type: 'email',
          value: 'john@company.com',
        },
      ],
    })

    const engine = new EvaluationEngine(manager)

    // Perfect match (IoU = 1.0)
    const perfectMatch: DetectionResult = {
      start: 8,
      end: 24,
      type: 'email',
      value: 'john@company.com',
      confidence: 0.9,
    }

    const result1 = engine.evaluateEntry('overlap1', [perfectMatch], { overlap_threshold: 0.5 })
    expect(result1.true_positives.length).toBe(1)
    expect(result1.true_positives[0].overlap_ratio).toBe(1.0)

    // Partial match (john@company vs john@company.com)
    const partialMatch: DetectionResult = {
      start: 8,
      end: 20, // "john@company" (12 chars), so 8+12=20
      type: 'email',
      value: 'john@company',
      confidence: 0.8,
    }

    const result2 = engine.evaluateEntry('overlap1', [partialMatch], { overlap_threshold: 0.5 })
    // IoU = overlap / union = 12 / (12 + 16 - 12) = 12/16 = 0.75
    expect(result2.true_positives.length).toBe(1)
    expect(result2.true_positives[0].overlap_ratio).toBe(0.75)
  })
})

describe('EvaluationEngine - evaluation metrics', () => {
  it('should calculate precision, recall, and F1 correctly', () => {
    const manager = new GroundTruthManager()
    manager.addEntry({
      id: 'metrics1',
      text: 'Contact john@company.com or call 090-1234-5678',
      annotations: [
        {
          start: 8,
          end: 24, // 'john@company.com' = 16 chars, so 8+16=24
          type: 'email',
          value: 'john@company.com',
        },
        {
          start: 33,
          end: 46, // '090-1234-5678' = 13 chars, so 33+13=46
          type: 'phone',
          value: '090-1234-5678',
        },
      ],
    })

    const engine = new EvaluationEngine(manager)

    const detections: DetectionResult[] = [
      // True positive: email detected correctly
      {
        start: 8,
        end: 24,
        type: 'email',
        value: 'john@company.com',
        confidence: 0.9,
      },
      // False positive: detected non-existent credit card
      {
        start: 50,
        end: 54,
        type: 'credit_card',
        value: '1234',
        confidence: 0.7,
      },
      // False negative: phone number not detected (missing from detections)
    ]

    const result = engine.evaluateEntry('metrics1', detections, { overlap_threshold: 0.5 })

    // TP = 1 (email), FP = 1 (credit_card), FN = 1 (phone)
    expect(result.true_positives.length).toBe(1)
    expect(result.false_positives.length).toBe(1)
    expect(result.false_negatives.length).toBe(1)

    // Precision = TP / (TP + FP) = 1 / (1 + 1) = 0.5
    expect(result.precision).toBe(0.5)

    // Recall = TP / (TP + FN) = 1 / (1 + 1) = 0.5
    expect(result.recall).toBe(0.5)

    // F1 = 2 * (precision * recall) / (precision + recall) = 2 * 0.25 / 1.0 = 0.5
    expect(result.f1_score).toBe(0.5)
  })

  it('should handle confidence thresholds', () => {
    const manager = new GroundTruthManager()
    manager.addEntry({
      id: 'threshold1',
      text: 'Email: test@example.com',
      annotations: [
        {
          start: 7,
          end: 23, // 'test@example.com' = 16 chars, so 7+16=23
          type: 'email',
          value: 'test@example.com',
        },
      ],
    })

    const engine = new EvaluationEngine(manager, {
      overlap_threshold: 0.5,
      type_matching: 'strict',
      confidence_threshold: 0.8, // Only detections with >= 0.8 confidence count
    })

    const detections: DetectionResult[] = [
      // This detection should be filtered out due to low confidence
      {
        start: 7,
        end: 23,
        type: 'email',
        value: 'test@example.com',
        confidence: 0.6, // Below threshold
      },
    ]

    const result = engine.evaluateEntry('threshold1', detections, { overlap_threshold: 0.5 })

    // Detection filtered out, so it becomes a false negative
    expect(result.true_positives.length).toBe(0)
    expect(result.false_positives.length).toBe(0)
    expect(result.false_negatives.length).toBe(1)
    expect(result.precision).toBe(0) // 0 / 0 → 0
    expect(result.recall).toBe(0) // 0 / 1 = 0
  })

  it('should exclude specified types', () => {
    const manager = new GroundTruthManager()
    manager.addEntry({
      id: 'exclude1',
      text: 'Email: test@example.com IP: 192.168.1.1',
      annotations: [
        {
          start: 7,
          end: 23, // 'test@example.com' = 16 chars, so 7+16=23
          type: 'email',
          value: 'test@example.com',
        },
        {
          start: 28,
          end: 39, // '192.168.1.1' = 11 chars, so 28+11=39
          type: 'ip',
          value: '192.168.1.1',
        },
      ],
    })

    const engine = new EvaluationEngine(manager, {
      overlap_threshold: 0.5,
      type_matching: 'strict',
      exclude_types: ['ip'], // Exclude IP addresses from evaluation
    })

    const detections: DetectionResult[] = [
      {
        start: 7,
        end: 23,
        type: 'email',
        value: 'test@example.com',
        confidence: 0.9,
      },
      {
        start: 28,
        end: 39,
        type: 'ip',
        value: '192.168.1.1',
        confidence: 0.8,
      },
    ]

    const result = engine.evaluateEntry('exclude1', detections, { overlap_threshold: 0.5 })

    // Only email should be evaluated, IP should be ignored
    expect(result.true_positives.length).toBe(1)
    expect(result.false_positives.length).toBe(0)
    expect(result.false_negatives.length).toBe(0)
    expect(result.precision).toBe(1.0)
    expect(result.recall).toBe(1.0)
  })
})

describe('TestDatasetBuilder - synthetic data generation', () => {
  it('should create synthetic entries correctly', () => {
    const entry = createSyntheticEntry('synthetic1', [
      { type: 'email', pattern: 'john@company.com' },
      { type: 'phone', pattern: '090-1234-5678' },
      { type: 'ip', pattern: '192.168.1.1' },
    ])

    expect(entry.id).toBe('synthetic1')
    expect(entry.text.includes('john@company.com')).toBe(true)
    expect(entry.text.includes('090-1234-5678')).toBe(true)
    expect(entry.text.includes('192.168.1.1')).toBe(true)

    expect(entry.annotations.length).toBe(3)

    // Verify email annotation
    const emailAnnotation = entry.annotations.find((a) => a.type === 'email')
    expect(emailAnnotation).toBeTruthy()
    expect(emailAnnotation.value).toBe('john@company.com')
    expect(entry.text.slice(emailAnnotation.start, emailAnnotation.end)).toBe('john@company.com')

    // Verify phone annotation
    const phoneAnnotation = entry.annotations.find((a) => a.type === 'phone')
    expect(phoneAnnotation).toBeTruthy()
    expect(phoneAnnotation.value).toBe('090-1234-5678')
    expect(entry.text.slice(phoneAnnotation.start, phoneAnnotation.end)).toBe('090-1234-5678')

    // Verify metadata
    expect(entry.metadata?.source).toBe('synthetic')
    expect(entry.metadata?.domain).toBe('test')
  })

  it('should handle empty patterns', () => {
    const entry = createSyntheticEntry('empty1', [])

    expect(entry.annotations.length).toBe(0)
    expect(entry.text.includes('End of test document')).toBe(true)
  })

  it('should handle single pattern', () => {
    const entry = createSyntheticEntry('single1', [{ type: 'email', pattern: 'test@example.com' }])

    expect(entry.annotations.length).toBe(1)
    expect(entry.text.includes('test@example.com')).toBe(true)
    // Should not have comma separator for single pattern
    expect(entry.text.includes('test@example.com,')).toBe(false)
  })
})

describe('EvaluationEngine - edge cases', () => {
  it('should handle missing ground truth entries gracefully', () => {
    const manager = new GroundTruthManager()
    const engine = new EvaluationEngine(manager)

    expect(() => engine.evaluateEntry('nonexistent', [], { overlap_threshold: 0.5 })).toThrow(
      /Ground truth entry not found/,
    )
  })

  it('should handle empty detections and annotations', () => {
    const manager = new GroundTruthManager()
    manager.addEntry({
      id: 'empty1',
      text: 'No PII in this text',
      annotations: [],
    })

    const engine = new EvaluationEngine(manager)
    const result = engine.evaluateEntry('empty1', [], { overlap_threshold: 0.5 })

    expect(result.true_positives.length).toBe(0)
    expect(result.false_positives.length).toBe(0)
    expect(result.false_negatives.length).toBe(0)
    expect(result.precision).toBe(0) // 0/0 case handled
    expect(result.recall).toBe(0)
    expect(result.f1_score).toBe(0)
  })
})
