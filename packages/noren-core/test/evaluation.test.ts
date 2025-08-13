/**
 * P3-1: Tests for accuracy measurement framework
 * Comprehensive testing of ground truth management and evaluation metrics
 */

import { deepStrictEqual, ok, strictEqual, throws } from 'node:assert'
import { test } from 'node:test'
import {
  type DetectionResult,
  EvaluationEngine,
  type GroundTruthEntry,
  GroundTruthManager,
  TestDatasetBuilder,
} from '../src/evaluation.js'

test('GroundTruthManager - basic operations', async (t) => {
  await t.test('should add and retrieve entries', () => {
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

    deepStrictEqual(retrieved, entry)
  })

  await t.test('should validate annotation bounds', () => {
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

    throws(() => manager.addEntry(invalidEntry), /Invalid annotation bounds/)
  })

  await t.test('should detect overlapping annotations', () => {
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

    throws(() => manager.addEntry(overlappingEntry), /Overlapping annotations/)
  })

  await t.test('should validate annotation values match text', () => {
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

    throws(() => manager.addEntry(mismatchEntry), /Annotation value mismatch/)
  })

  await t.test('should provide dataset statistics', () => {
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

    strictEqual(stats.total_entries, 2)
    strictEqual(stats.total_annotations, 3)
    strictEqual(stats.avg_annotations_per_entry, 1.5)
    deepStrictEqual(stats.type_distribution, {
      email: 1,
      phone: 1,
      ip: 1,
    })
    deepStrictEqual(stats.domain_distribution, {
      contact: 1,
      network: 1,
    })
    deepStrictEqual(stats.difficulty_distribution, {
      easy: 2,
      medium: 1,
    })
  })

  await t.test('should export and import JSON', () => {
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
    deepStrictEqual(imported, entry)
  })
})

test('EvaluationEngine - overlap calculation', async (t) => {
  await t.test('should calculate IoU correctly', () => {
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
    strictEqual(result1.true_positives.length, 1)
    strictEqual(result1.true_positives[0].overlap_ratio, 1.0)

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
    strictEqual(result2.true_positives.length, 1)
    strictEqual(result2.true_positives[0].overlap_ratio, 0.75)
  })
})

test('EvaluationEngine - evaluation metrics', async (t) => {
  await t.test('should calculate precision, recall, and F1 correctly', () => {
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
    strictEqual(result.true_positives.length, 1)
    strictEqual(result.false_positives.length, 1)
    strictEqual(result.false_negatives.length, 1)

    // Precision = TP / (TP + FP) = 1 / (1 + 1) = 0.5
    strictEqual(result.precision, 0.5)

    // Recall = TP / (TP + FN) = 1 / (1 + 1) = 0.5
    strictEqual(result.recall, 0.5)

    // F1 = 2 * (precision * recall) / (precision + recall) = 2 * 0.25 / 1.0 = 0.5
    strictEqual(result.f1_score, 0.5)
  })

  await t.test('should handle confidence thresholds', () => {
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
    strictEqual(result.true_positives.length, 0)
    strictEqual(result.false_positives.length, 0)
    strictEqual(result.false_negatives.length, 1)
    strictEqual(result.precision, 0) // 0 / 0 → 0
    strictEqual(result.recall, 0) // 0 / 1 = 0
  })

  await t.test('should exclude specified types', () => {
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
    strictEqual(result.true_positives.length, 1)
    strictEqual(result.false_positives.length, 0)
    strictEqual(result.false_negatives.length, 0)
    strictEqual(result.precision, 1.0)
    strictEqual(result.recall, 1.0)
  })
})

test('EvaluationEngine - aggregate metrics', async (t) => {
  await t.test('should aggregate multiple entries correctly', () => {
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
    strictEqual(aggregateResults.total_entries, 2)
    strictEqual(aggregateResults.total_annotations, 3)
    strictEqual(aggregateResults.total_detections, 2)
    strictEqual(aggregateResults.true_positives, 2)
    strictEqual(aggregateResults.false_positives, 0)
    strictEqual(aggregateResults.false_negatives, 1)

    // Overall precision = 2/2 = 1.0, recall = 2/3 = 0.667
    strictEqual(aggregateResults.precision, 1.0)
    strictEqual(Math.round(aggregateResults.recall * 1000) / 1000, 0.667)

    // Type-specific metrics
    ok(aggregateResults.type_metrics.email)
    strictEqual(aggregateResults.type_metrics.email.tp, 1)
    strictEqual(aggregateResults.type_metrics.email.fp, 0)
    strictEqual(aggregateResults.type_metrics.email.fn, 0)

    ok(aggregateResults.type_metrics.phone)
    strictEqual(aggregateResults.type_metrics.phone.tp, 1)
    strictEqual(aggregateResults.type_metrics.phone.fp, 0)
    strictEqual(aggregateResults.type_metrics.phone.fn, 0)

    ok(aggregateResults.type_metrics.ip)
    strictEqual(aggregateResults.type_metrics.ip.tp, 0)
    strictEqual(aggregateResults.type_metrics.ip.fp, 0)
    strictEqual(aggregateResults.type_metrics.ip.fn, 1)
  })

  await t.test('should analyze confidence distribution', () => {
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
    strictEqual(aggregate.confidence_analysis.avg_tp_confidence, 0.95)
    strictEqual(aggregate.confidence_analysis.avg_fp_confidence, 0.65)

    // Check confidence buckets
    const buckets = aggregate.confidence_analysis.confidence_buckets
    strictEqual(buckets.length, 4)

    // High confidence bucket (0.9-1.0) should have 1 TP, 0 FP
    const highConfBucket = buckets.find((b) => b.range === '0.9-1.0')
    ok(highConfBucket)
    strictEqual(highConfBucket.tp, 1)
    strictEqual(highConfBucket.fp, 0)
    strictEqual(highConfBucket.precision, 1.0)

    // Medium confidence bucket (0.5-0.7) should have 0 TP, 1 FP
    const medConfBucket = buckets.find((b) => b.range === '0.5-0.7')
    ok(medConfBucket)
    strictEqual(medConfBucket.tp, 0)
    strictEqual(medConfBucket.fp, 1)
    strictEqual(medConfBucket.precision, 0.0)
  })
})

test('TestDatasetBuilder - synthetic data generation', async (t) => {
  await t.test('should create synthetic entries correctly', () => {
    const entry = TestDatasetBuilder.createSyntheticEntry('synthetic1', [
      { type: 'email', pattern: 'john@company.com' },
      { type: 'phone', pattern: '090-1234-5678' },
      { type: 'ip', pattern: '192.168.1.1' },
    ])

    strictEqual(entry.id, 'synthetic1')
    ok(entry.text.includes('john@company.com'))
    ok(entry.text.includes('090-1234-5678'))
    ok(entry.text.includes('192.168.1.1'))

    strictEqual(entry.annotations.length, 3)

    // Verify email annotation
    const emailAnnotation = entry.annotations.find((a) => a.type === 'email')
    ok(emailAnnotation)
    strictEqual(emailAnnotation.value, 'john@company.com')
    strictEqual(entry.text.slice(emailAnnotation.start, emailAnnotation.end), 'john@company.com')

    // Verify phone annotation
    const phoneAnnotation = entry.annotations.find((a) => a.type === 'phone')
    ok(phoneAnnotation)
    strictEqual(phoneAnnotation.value, '090-1234-5678')
    strictEqual(entry.text.slice(phoneAnnotation.start, phoneAnnotation.end), '090-1234-5678')

    // Verify metadata
    strictEqual(entry.metadata?.source, 'synthetic')
    strictEqual(entry.metadata?.domain, 'test')
  })

  await t.test('should handle empty patterns', () => {
    const entry = TestDatasetBuilder.createSyntheticEntry('empty1', [])

    strictEqual(entry.annotations.length, 0)
    ok(entry.text.includes('End of test document'))
  })

  await t.test('should handle single pattern', () => {
    const entry = TestDatasetBuilder.createSyntheticEntry('single1', [
      { type: 'email', pattern: 'test@example.com' },
    ])

    strictEqual(entry.annotations.length, 1)
    ok(entry.text.includes('test@example.com'))
    // Should not have comma separator for single pattern
    ok(!entry.text.includes('test@example.com,'))
  })
})

test('EvaluationEngine - edge cases', async (t) => {
  await t.test('should handle missing ground truth entries gracefully', () => {
    const manager = new GroundTruthManager()
    const engine = new EvaluationEngine(manager)

    throws(() => engine.evaluateEntry('nonexistent', []), /Ground truth entry not found/)
  })

  await t.test('should handle empty detections and annotations', () => {
    const manager = new GroundTruthManager()
    manager.addEntry({
      id: 'empty1',
      text: 'No PII in this text',
      annotations: [],
    })

    const engine = new EvaluationEngine(manager)
    const result = engine.evaluateEntry('empty1', [])

    strictEqual(result.true_positives.length, 0)
    strictEqual(result.false_positives.length, 0)
    strictEqual(result.false_negatives.length, 0)
    strictEqual(result.precision, 0) // 0/0 case handled
    strictEqual(result.recall, 0)
    strictEqual(result.f1_score, 0)
  })

  await t.test('should skip entries with errors in dataset evaluation', () => {
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

    strictEqual(aggregate.total_entries, 1) // Only good1 was processed
    strictEqual(aggregate.true_positives, 1)
    strictEqual(aggregate.precision, 1.0)
  })
})
