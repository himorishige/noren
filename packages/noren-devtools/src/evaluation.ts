/**
 * Accuracy measurement framework for PII detection evaluation
 * Streamlined implementation with unified ground truth management and metrics calculation
 */

import type { Hit, Registry } from '@himorishige/noren-core'
import { type AccuracyMetrics, createEvaluationReport, printReport } from './report-common.js'
import { mean } from './stats-common.js'

// ===== Core Interfaces =====

export interface GroundTruthAnnotation {
  start: number
  end: number
  type: string
  value: string
  confidence?: number
  metadata?: {
    annotator?: string
    difficulty?: 'easy' | 'medium' | 'hard'
    source?: string
  }
}

export interface GroundTruthEntry {
  id: string
  text: string
  annotations: GroundTruthAnnotation[]
  metadata?: {
    source?: string
    domain?: string
    language?: string
    created_at?: number
  }
}

export interface DetectionResult {
  start: number
  end: number
  type: string
  value: string
  confidence: number
  risk?: string
}

export interface EvaluationResult {
  entry_id: string
  true_positives: Array<{
    detected: DetectionResult
    ground_truth: GroundTruthAnnotation
    overlap_ratio: number
  }>
  false_positives: DetectionResult[]
  false_negatives: GroundTruthAnnotation[]
  precision: number
  recall: number
  f1_score: number
}

export interface AggregateMetrics {
  total_entries: number
  total_annotations: number
  total_detections: number
  true_positives: number
  false_positives: number
  false_negatives: number
  precision: number
  recall: number
  f1_score: number
  type_metrics: Record<
    string,
    {
      tp: number
      fp: number
      fn: number
      precision: number
      recall: number
      f1_score: number
    }
  >
  confidence_analysis: {
    avg_tp_confidence: number
    avg_fp_confidence: number
    confidence_buckets: Array<{
      range: string
      tp: number
      fp: number
      precision: number
    }>
  }
}

export interface EvaluationConfig {
  sample_size?: number
  overlap_threshold?: number
  confidence_threshold?: number
  include_false_positives?: boolean
  include_false_negatives?: boolean
  exclude_types?: string[]
}

// ===== Ground Truth Manager =====

export class GroundTruthManager {
  private entries = new Map<string, GroundTruthEntry>()

  addEntry(entry: GroundTruthEntry): void {
    // Validate annotation bounds
    for (const annotation of entry.annotations) {
      if (
        annotation.start < 0 ||
        annotation.end > entry.text.length ||
        annotation.start >= annotation.end
      ) {
        throw new Error(`Invalid annotation bounds in entry ${entry.id}`)
      }
    }

    // Check for overlapping annotations
    for (let i = 0; i < entry.annotations.length; i++) {
      for (let j = i + 1; j < entry.annotations.length; j++) {
        const annotation1 = entry.annotations[i]
        const annotation2 = entry.annotations[j]

        if (
          (annotation1.start < annotation2.end && annotation1.end > annotation2.start) ||
          (annotation2.start < annotation1.end && annotation2.end > annotation1.start)
        ) {
          throw new Error(`Overlapping annotations in entry ${entry.id}`)
        }
      }
    }

    // Validate annotation values
    for (const annotation of entry.annotations) {
      const actualValue = entry.text.slice(annotation.start, annotation.end)
      if (actualValue !== annotation.value) {
        throw new Error(`Annotation value mismatch in entry ${entry.id}`)
      }
    }

    this.entries.set(entry.id, entry)
  }

  getEntry(id: string): GroundTruthEntry | undefined {
    return this.entries.get(id)
  }

  getAllEntries(): GroundTruthEntry[] {
    return Array.from(this.entries.values())
  }

  getEntriesByFilter(filter: (entry: GroundTruthEntry) => boolean): GroundTruthEntry[] {
    return this.getAllEntries().filter(filter)
  }

  clear(): void {
    this.entries.clear()
  }

  exportToJson(): string {
    return JSON.stringify(
      {
        version: '1.0',
        exported_at: Date.now(),
        entries: this.getAllEntries(),
      },
      null,
      2,
    )
  }

  importFromJson(jsonData: string): void {
    const data = JSON.parse(jsonData)
    if (!data.entries || !Array.isArray(data.entries)) {
      throw new Error('Invalid JSON format: missing entries array')
    }

    for (const entry of data.entries) {
      this.addEntry(entry)
    }
  }
}

// ===== Evaluation Engine =====

export class EvaluationEngine {
  constructor(
    private groundTruthManager?: GroundTruthManager,
    private config?: EvaluationConfig,
  ) {}

  evaluateEntry(
    entryId: string,
    detections: DetectionResult[],
    config?: EvaluationConfig,
  ): EvaluationResult {
    if (!this.groundTruthManager) {
      throw new Error('GroundTruthManager not provided to constructor')
    }
    const entry = this.groundTruthManager.getEntry(entryId)
    if (!entry) {
      throw new Error(`Ground truth entry not found: ${entryId}`)
    }
    return this.evaluateEntry_internal(entry, detections, { ...this.config, ...config })
  }

  async evaluateAgainstGroundTruth(
    registry: Registry,
    groundTruthManager: GroundTruthManager,
    config: EvaluationConfig = {},
  ): Promise<{ aggregate: AggregateMetrics; results: EvaluationResult[] }> {
    const entries = groundTruthManager.getAllEntries()
    const sampleSize = Math.min(config.sample_size || entries.length, entries.length)
    const sampledEntries = entries.slice(0, sampleSize)

    console.log(`🔍 Evaluating ${sampledEntries.length} entries against ground truth...`)

    const results: EvaluationResult[] = []

    for (let i = 0; i < sampledEntries.length; i++) {
      const entry = sampledEntries[i]
      console.log(
        `  Progress: ${(((i + 1) / sampledEntries.length) * 100).toFixed(1)}% (${i + 1}/${sampledEntries.length})`,
      )

      try {
        const detections = await registry.detect(entry.text)
        const detectionResults: DetectionResult[] = detections.hits.map((hit: Hit) => ({
          start: hit.start,
          end: hit.end,
          type: hit.type,
          value: hit.value,
          confidence: hit.confidence || 0.5,
          risk: hit.risk,
        }))

        const result = this.evaluateEntry_internal(entry, detectionResults, config)
        results.push(result)
      } catch (error) {
        console.warn(`Skipping entry ${entry.id}: ${error}`)
      }
    }

    const aggregate = this.aggregateResults(results)

    // Generate report
    this.printEvaluationReport(aggregate)

    return { aggregate, results }
  }

  private evaluateEntry_internal(
    entry: GroundTruthEntry,
    detections: DetectionResult[],
    config: EvaluationConfig,
  ): EvaluationResult {
    const overlapThreshold = config.overlap_threshold || 0.5

    // Filter detections by confidence threshold
    const filteredDetections = config.confidence_threshold
      ? detections.filter((d) => (d.confidence ?? 0) >= (config.confidence_threshold ?? 0))
      : detections

    // Filter by excluded types
    const finalDetections = config.exclude_types
      ? filteredDetections.filter((d) => !config.exclude_types?.includes(d.type))
      : filteredDetections

    const annotations = config.exclude_types
      ? entry.annotations.filter((a) => !config.exclude_types?.includes(a.type))
      : entry.annotations

    const truePositives: EvaluationResult['true_positives'] = []
    const falsePositives: DetectionResult[] = []
    const matchedAnnotations = new Set<number>()

    // Find true positives and false positives
    for (const detection of finalDetections) {
      let bestMatch: { annotation: GroundTruthAnnotation; index: number; overlap: number } | null =
        null

      for (let i = 0; i < annotations.length; i++) {
        const annotation = annotations[i]
        if (matchedAnnotations.has(i)) continue

        const overlap = this.calculateOverlap(detection, annotation)
        if (overlap >= overlapThreshold && detection.type === annotation.type) {
          if (!bestMatch || overlap > bestMatch.overlap) {
            bestMatch = { annotation, index: i, overlap }
          }
        }
      }

      if (bestMatch) {
        truePositives.push({
          detected: detection,
          ground_truth: bestMatch.annotation,
          overlap_ratio: bestMatch.overlap,
        })
        matchedAnnotations.add(bestMatch.index)
      } else {
        falsePositives.push(detection)
      }
    }

    // Find false negatives (unmatched annotations)
    const falseNegatives = annotations.filter((_, index) => !matchedAnnotations.has(index))

    // Calculate metrics
    const tp = truePositives.length
    const fp = falsePositives.length
    const fn = falseNegatives.length

    const precision = tp / Math.max(tp + fp, 1)
    const recall = tp / Math.max(tp + fn, 1)
    const f1_score = (2 * (precision * recall)) / Math.max(precision + recall, 1)

    return {
      entry_id: entry.id,
      true_positives: truePositives,
      false_positives: falsePositives,
      false_negatives: falseNegatives,
      precision,
      recall,
      f1_score,
    }
  }

  private aggregateResults(results: EvaluationResult[]): AggregateMetrics {
    let totalTP = 0
    let totalFP = 0
    let totalFN = 0

    const typeMetrics: Record<string, { tp: number; fp: number; fn: number }> = {}
    const tpConfidences: number[] = []
    const fpConfidences: number[] = []

    for (const result of results) {
      totalTP += result.true_positives.length
      totalFP += result.false_positives.length
      totalFN += result.false_negatives.length

      // Collect confidence data and per-type metrics
      for (const tp of result.true_positives) {
        tpConfidences.push(tp.detected.confidence)
        const type = tp.ground_truth.type
        if (!typeMetrics[type]) typeMetrics[type] = { tp: 0, fp: 0, fn: 0 }
        typeMetrics[type].tp++
      }

      for (const fp of result.false_positives) {
        fpConfidences.push(fp.confidence)
        const type = fp.type
        if (!typeMetrics[type]) typeMetrics[type] = { tp: 0, fp: 0, fn: 0 }
        typeMetrics[type].fp++
      }

      for (const fn of result.false_negatives) {
        const type = fn.type
        if (!typeMetrics[type]) typeMetrics[type] = { tp: 0, fp: 0, fn: 0 }
        typeMetrics[type].fn++
      }
    }

    // Calculate aggregate scores
    const precision = totalTP / Math.max(totalTP + totalFP, 1)
    const recall = totalTP / Math.max(totalTP + totalFN, 1)
    const f1_score = (2 * (precision * recall)) / Math.max(precision + recall, 1)

    // Calculate per-type metrics
    const finalTypeMetrics: AggregateMetrics['type_metrics'] = {}
    for (const [type, counts] of Object.entries(typeMetrics)) {
      const typePrecision = counts.tp / Math.max(counts.tp + counts.fp, 1)
      const typeRecall = counts.tp / Math.max(counts.tp + counts.fn, 1)
      const typeF1 = (2 * (typePrecision * typeRecall)) / Math.max(typePrecision + typeRecall, 1)

      finalTypeMetrics[type] = {
        tp: counts.tp,
        fp: counts.fp,
        fn: counts.fn,
        precision: typePrecision,
        recall: typeRecall,
        f1_score: typeF1,
      }
    }

    // Confidence analysis using mean from stats-common
    const avgTPConfidence = tpConfidences.length > 0 ? mean(tpConfidences) : 0
    const avgFPConfidence = fpConfidences.length > 0 ? mean(fpConfidences) : 0

    // Confidence buckets
    const buckets = [
      { range: '0.0-0.5', tp: 0, fp: 0, precision: 0 },
      { range: '0.5-0.7', tp: 0, fp: 0, precision: 0 },
      { range: '0.7-0.9', tp: 0, fp: 0, precision: 0 },
      { range: '0.9-1.0', tp: 0, fp: 0, precision: 0 },
    ]

    for (const conf of tpConfidences) {
      const bucketIndex = conf < 0.5 ? 0 : conf < 0.7 ? 1 : conf < 0.9 ? 2 : 3
      buckets[bucketIndex].tp++
    }

    for (const conf of fpConfidences) {
      const bucketIndex = conf < 0.5 ? 0 : conf < 0.7 ? 1 : conf < 0.9 ? 2 : 3
      buckets[bucketIndex].fp++
    }

    for (const bucket of buckets) {
      bucket.precision = bucket.tp / Math.max(bucket.tp + bucket.fp, 1)
    }

    return {
      total_entries: results.length,
      total_annotations: totalTP + totalFN,
      total_detections: totalTP + totalFP,
      true_positives: totalTP,
      false_positives: totalFP,
      false_negatives: totalFN,
      precision,
      recall,
      f1_score,
      type_metrics: finalTypeMetrics,
      confidence_analysis: {
        avg_tp_confidence: avgTPConfidence,
        avg_fp_confidence: avgFPConfidence,
        confidence_buckets: buckets,
      },
    }
  }

  private calculateOverlap(detection: DetectionResult, annotation: GroundTruthAnnotation): number {
    const overlapStart = Math.max(detection.start, annotation.start)
    const overlapEnd = Math.min(detection.end, annotation.end)

    if (overlapStart >= overlapEnd) return 0

    const overlapLength = overlapEnd - overlapStart
    const detectionLength = detection.end - detection.start
    const annotationLength = annotation.end - annotation.start

    // Use intersection over union (IoU)
    const unionLength = detectionLength + annotationLength - overlapLength
    return overlapLength / unionLength
  }

  private printEvaluationReport(metrics: AggregateMetrics): void {
    const accuracyMetrics: AccuracyMetrics = {
      precision: metrics.precision,
      recall: metrics.recall,
      f1Score: metrics.f1_score,
      truePositives: metrics.true_positives,
      falsePositives: metrics.false_positives,
      falseNegatives: metrics.false_negatives,
    }

    const report = createEvaluationReport('PII Detection Evaluation', accuracyMetrics)
    printReport(report)
  }
}

// ===== Test Dataset Builder =====

export function createSyntheticEntry(
  id: string,
  patterns: Array<{ type: string; pattern: string }>,
): GroundTruthEntry {
  let text = `This is a test document (ID: ${id}) with PII patterns: `
  const annotations: GroundTruthAnnotation[] = []

  for (let i = 0; i < patterns.length; i++) {
    const { type, pattern } = patterns[i]
    const start = text.length
    text += pattern
    const end = text.length

    annotations.push({
      start,
      end,
      type,
      value: pattern,
      confidence: 1.0,
      metadata: {
        annotator: 'synthetic',
        difficulty: 'medium',
      },
    })

    if (i < patterns.length - 1) {
      text += ', '
    }
  }

  text += '. End of test document.'

  return {
    id,
    text,
    annotations,
    metadata: {
      source: 'synthetic',
      domain: 'test',
      language: 'en',
      created_at: Date.now(),
    },
  }
}

export function createEmailTestDataset(): GroundTruthManager {
  const manager = new GroundTruthManager()

  const testEntries = [
    {
      id: 'email_test_1',
      text: 'Please contact john.doe@company.com for more information.',
      annotations: [
        {
          start: 15,
          end: 37,
          type: 'email',
          value: 'john.doe@company.com',
          confidence: 1.0,
        },
      ],
    },
    {
      id: 'email_test_2',
      text: 'Send reports to admin@example.org and backup@test.co.jp',
      annotations: [
        {
          start: 16,
          end: 33,
          type: 'email',
          value: 'admin@example.org',
          confidence: 1.0,
        },
        {
          start: 38,
          end: 56,
          type: 'email',
          value: 'backup@test.co.jp',
          confidence: 1.0,
        },
      ],
    },
  ]

  for (const entry of testEntries) {
    manager.addEntry({
      ...entry,
      annotations: entry.annotations.map((a) => ({
        ...a,
        metadata: { annotator: 'test', difficulty: 'easy' as const },
      })),
      metadata: {
        source: 'test',
        domain: 'email',
        language: 'en',
        created_at: Date.now(),
      },
    })
  }

  return manager
}
