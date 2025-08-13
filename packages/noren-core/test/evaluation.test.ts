/**
 * P3-1: Tests for accuracy measurement framework
 * Comprehensive testing of ground truth management and evaluation metrics
 */

import { describe, expect, it } from 'vitest'
import {
  type DetectionResult,
  EvaluationEngine,
  type GroundTruthEntry,
  GroundTruthManager,
  TestDatasetBuilder,
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

  it('should provide dataset statistics', () => {
    const manager = new GroundTruthManager()

    manager.addEntry({
      id: 'stats1',
      text: 'Email: john@company.com Phone: 090-1234-5678',
      annotations: [
        {
          start: 7,
          end: 23, // 'john@company.com' = 16 chars, so 7+16=23
          type: 'email',
          value: 'john@company.com',
          metadata: { difficulty: 'easy' },
        },
        {
          start: 31,
          end: 44, // '090-1234-5678' = 13 chars, so 31+13=44
          type: 'phone',
          value: '090-1234-5678',
          metadata: { difficulty: 'medium' },
        },
      ],
      metadata: { domain: 'contact' },
    })

    manager.addEntry({
      id: 'stats2',
      text: 'IP: 192.168.1.1',
      annotations: [
        {
          start: 4,
          end: 15,
          type: 'ip',
          value: '192.168.1.1',
          metadata: { difficulty: 'easy' },
        },
      ],
      metadata: { domain: 'network' },
    })

    const stats = manager.getDatasetStats()

    expect(stats.total_entries).toBe(2)
    expect(stats.total_annotations).toBe(3)
    expect(stats.avg_annotations_per_entry).toBe(1.5)
    expect(stats.type_distribution).toEqual({
      email: 1,
      phone: 1,
      ip: 1,
    })
    expect(stats.domain_distribution).toEqual({
      contact: 1,
      network: 1,
    })
    expect(stats.difficulty_distribution).toEqual({
      easy: 2,
      medium: 1,
    })
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

    const result1 = engine.evaluateEntry('overlap1', [perfectMatch])
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

    const result2 = engine.evaluateEntry('overlap1', [partialMatch])
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

    const result = engine.evaluateEntry('metrics1', detections)

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

    const result = engine.evaluateEntry('threshold1', detections)

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

    const result = engine.evaluateEntry('exclude1', detections)

    // Only email should be evaluated, IP should be ignored
    expect(result.true_positives.length).toBe(1)
    expect(result.false_positives.length).toBe(0)
    expect(result.false_negatives.length).toBe(0)
    expect(result.precision).toBe(1.0)
    expect(result.recall).toBe(1.0)
  })
})

describe('EvaluationEngine - aggregate metrics', () => {
  it('should aggregate multiple entries correctly', () => {
    const manager = new GroundTruthManager()

    manager.addEntry({
      id: 'agg1',
      text: 'Email: john@company.com',
      annotations: [
        {
          start: 7,
          end: 23, // 'john@company.com' = 16 chars, so 7+16=23
          type: 'email',
          value: 'john@company.com',
        },
      ],
    })

    manager.addEntry({
      id: 'agg2',
      text: 'Phone: 090-1234-5678 IP: 192.168.1.1',
      annotations: [
        {
          start: 7,
          end: 20, // '090-1234-5678' = 13 chars, so 7+13=20
          type: 'phone',
          value: '090-1234-5678',
        },
        {
          start: 25,
          end: 36, // '192.168.1.1' = 11 chars, so 25+11=36
          type: 'ip',
          value: '192.168.1.1',
        },
      ],
    })

    const engine = new EvaluationEngine(manager)

    const detectionResults: Record<string, DetectionResult[]> = {
      agg1: [
        {
          start: 7,
          end: 23,
          type: 'email',
          value: 'john@company.com',
          confidence: 0.95,
        },
      ],
      agg2: [
        {
          start: 7,
          end: 20,
          type: 'phone',
          value: '090-1234-5678',
          confidence: 0.85,
        },
        // Missing IP detection = false negative
      ],
    }

    const aggregateResults = engine.evaluateDataset(detectionResults)

    // Total: TP=2, FP=0, FN=1
    expect(aggregateResults.total_entries).toBe(2)
    expect(aggregateResults.total_annotations).toBe(3)
    expect(aggregateResults.total_detections).toBe(2)
    expect(aggregateResults.true_positives).toBe(2)
    expect(aggregateResults.false_positives).toBe(0)
    expect(aggregateResults.false_negatives).toBe(1)

    // Overall precision = 2/2 = 1.0, recall = 2/3 = 0.667
    expect(aggregateResults.precision).toBe(1.0)
    expect(Math.round(aggregateResults.recall * 1000) / 1000).toBe(0.667)

    // Type-specific metrics
    expect(aggregateResults.type_metrics.email).toBeTruthy()
    expect(aggregateResults.type_metrics.email.tp).toBe(1)
    expect(aggregateResults.type_metrics.email.fp).toBe(0)
    expect(aggregateResults.type_metrics.email.fn).toBe(0)

    expect(aggregateResults.type_metrics.phone).toBeTruthy()
    expect(aggregateResults.type_metrics.phone.tp).toBe(1)
    expect(aggregateResults.type_metrics.phone.fp).toBe(0)
    expect(aggregateResults.type_metrics.phone.fn).toBe(0)

    expect(aggregateResults.type_metrics.ip).toBeTruthy()
    expect(aggregateResults.type_metrics.ip.tp).toBe(0)
    expect(aggregateResults.type_metrics.ip.fp).toBe(0)
    expect(aggregateResults.type_metrics.ip.fn).toBe(1)
  })

  it('should analyze confidence distribution', () => {
    const manager = new GroundTruthManager()
    manager.addEntry({
      id: 'conf1',
      text: 'Data: test1@example.com test2@example.com',
      annotations: [
        {
          start: 6,
          end: 23, // 'test1@example.com' = 17 chars, so 6+17=23
          type: 'email',
          value: 'test1@example.com',
        },
        {
          start: 24,
          end: 41, // 'test2@example.com' = 17 chars, so 24+17=41
          type: 'email',
          value: 'test2@example.com',
        },
      ],
    })

    const engine = new EvaluationEngine(manager)

    const detectionResults: Record<string, DetectionResult[]> = {
      conf1: [
        // True positive with high confidence
        {
          start: 6,
          end: 22,
          type: 'email',
          value: 'test1@example.com',
          confidence: 0.95,
        },
        // False positive with medium confidence
        {
          start: 40,
          end: 50,
          type: 'phone',
          value: '1234567890',
          confidence: 0.65,
        },
        // Missing test2@example.com = false negative
      ],
    }

    const aggregate = engine.evaluateDataset(detectionResults)

    // Check confidence analysis
    expect(aggregate.confidence_analysis.avg_tp_confidence).toBe(0.95)
    expect(aggregate.confidence_analysis.avg_fp_confidence).toBe(0.65)

    // Check confidence buckets
    const buckets = aggregate.confidence_analysis.confidence_buckets
    expect(buckets.length).toBe(4)

    // High confidence bucket (0.9-1.0) should have 1 TP, 0 FP
    const highConfBucket = buckets.find((b) => b.range === '0.9-1.0')
    expect(highConfBucket).toBeTruthy()
    expect(highConfBucket.tp).toBe(1)
    expect(highConfBucket.fp).toBe(0)
    expect(highConfBucket.precision).toBe(1.0)

    // Medium confidence bucket (0.5-0.7) should have 0 TP, 1 FP
    const medConfBucket = buckets.find((b) => b.range === '0.5-0.7')
    expect(medConfBucket).toBeTruthy()
    expect(medConfBucket.tp).toBe(0)
    expect(medConfBucket.fp).toBe(1)
    expect(medConfBucket.precision).toBe(0.0)
  })
})

describe('TestDatasetBuilder - synthetic data generation', () => {
  it('should create synthetic entries correctly', () => {
    const entry = TestDatasetBuilder.createSyntheticEntry('synthetic1', [
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
    const entry = TestDatasetBuilder.createSyntheticEntry('empty1', [])

    expect(entry.annotations.length).toBe(0)
    expect(entry.text.includes('End of test document')).toBe(true)
  })

  it('should handle single pattern', () => {
    const entry = TestDatasetBuilder.createSyntheticEntry('single1', [
      { type: 'email', pattern: 'test@example.com' },
    ])

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

    expect(() => engine.evaluateEntry('nonexistent', [])).toThrow(/Ground truth entry not found/)
  })

  it('should handle empty detections and annotations', () => {
    const manager = new GroundTruthManager()
    manager.addEntry({
      id: 'empty1',
      text: 'No PII in this text',
      annotations: [],
    })

    const engine = new EvaluationEngine(manager)
    const result = engine.evaluateEntry('empty1', [])

    expect(result.true_positives.length).toBe(0)
    expect(result.false_positives.length).toBe(0)
    expect(result.false_negatives.length).toBe(0)
    expect(result.precision).toBe(0) // 0/0 case handled
    expect(result.recall).toBe(0)
    expect(result.f1_score).toBe(0)
  })

  it('should skip entries with errors in dataset evaluation', () => {
    const manager = new GroundTruthManager()
    manager.addEntry({
      id: 'good1',
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

    const engine = new EvaluationEngine(manager)

    const detectionResults: Record<string, DetectionResult[]> = {
      good1: [
        {
          start: 7,
          end: 23,
          type: 'email',
          value: 'test@example.com',
          confidence: 0.9,
        },
      ],
      nonexistent: [], // This entry doesn't exist in ground truth
    }

    // Should skip nonexistent entry and continue with good1
    const aggregate = engine.evaluateDataset(detectionResults)

    expect(aggregate.total_entries).toBe(1) // Only good1 was processed
    expect(aggregate.true_positives).toBe(1)
    expect(aggregate.precision).toBe(1.0)
  })
})
