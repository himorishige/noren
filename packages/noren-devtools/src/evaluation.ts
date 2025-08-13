/**
 * P3-1: Accuracy measurement framework for continuous improvement
 * Provides ground truth management and evaluation metrics
 */

/**
 * Ground truth annotation for a piece of text
 */
export interface GroundTruthAnnotation {
  start: number
  end: number
  type: string
  value: string
  confidence?: number // Human annotator confidence (0-1)
  metadata?: {
    annotator?: string
    timestamp?: number
    source?: string
    difficulty?: 'easy' | 'medium' | 'hard'
    context_type?: string
  }
}

/**
 * Ground truth dataset entry
 */
export interface GroundTruthEntry {
  id: string
  text: string
  annotations: GroundTruthAnnotation[]
  metadata?: {
    source?: string
    domain?: string // email, document, code, etc.
    language?: string
    created_at?: number
    updated_at?: number
  }
}

/**
 * Detection result for evaluation
 */
export interface DetectionResult {
  start: number
  end: number
  type: string
  value: string
  confidence: number
  risk?: string
}

/**
 * Evaluation result for a single test case
 */
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

/**
 * Aggregate evaluation metrics
 */
export interface AggregateMetrics {
  total_entries: number
  total_annotations: number
  total_detections: number

  // Counts
  true_positives: number
  false_positives: number
  false_negatives: number

  // Aggregate scores
  precision: number
  recall: number
  f1_score: number

  // Per-type breakdown
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

  // Confidence distribution analysis
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

/**
 * Evaluation configuration
 */
export interface EvaluationConfig {
  overlap_threshold: number // Minimum overlap ratio for TP (default: 0.5)
  type_matching: 'strict' | 'lenient' // Strict: exact match, Lenient: semantic match
  confidence_threshold?: number // Minimum confidence for detection to count
  exclude_types?: string[] // Types to exclude from evaluation
}

/**
 * Ground truth dataset manager
 */
export class GroundTruthManager {
  private entries: Map<string, GroundTruthEntry> = new Map()

  /**
   * Add a ground truth entry
   */
  addEntry(entry: GroundTruthEntry): void {
    // Validate annotations don't overlap
    const annotations = entry.annotations.sort((a, b) => a.start - b.start)
    for (let i = 1; i < annotations.length; i++) {
      if (annotations[i].start < annotations[i - 1].end) {
        throw new Error(
          `Overlapping annotations in entry ${entry.id}: positions ${annotations[i - 1].start}-${annotations[i - 1].end} and ${annotations[i].start}-${annotations[i].end}`,
        )
      }
    }

    // Validate annotation bounds
    for (const annotation of annotations) {
      if (
        annotation.start < 0 ||
        annotation.end > entry.text.length ||
        annotation.start >= annotation.end
      ) {
        throw new Error(
          `Invalid annotation bounds in entry ${entry.id}: ${annotation.start}-${annotation.end} for text length ${entry.text.length}`,
        )
      }

      // Validate annotation value matches text
      const actualValue = entry.text.slice(annotation.start, annotation.end)
      if (actualValue !== annotation.value) {
        throw new Error(
          `Annotation value mismatch in entry ${entry.id}: expected "${annotation.value}", got "${actualValue}"`,
        )
      }
    }

    this.entries.set(entry.id, entry)
  }

  /**
   * Get a ground truth entry by ID
   */
  getEntry(id: string): GroundTruthEntry | undefined {
    return this.entries.get(id)
  }

  /**
   * Get all entries
   */
  getAllEntries(): GroundTruthEntry[] {
    return Array.from(this.entries.values())
  }

  /**
   * Get entries by metadata filter
   */
  getEntriesByFilter(filter: (entry: GroundTruthEntry) => boolean): GroundTruthEntry[] {
    return this.getAllEntries().filter(filter)
  }

  /**
   * Remove an entry
   */
  removeEntry(id: string): boolean {
    return this.entries.delete(id)
  }

  /**
   * Get statistics about the dataset
   */
  getDatasetStats(): {
    total_entries: number
    total_annotations: number
    avg_annotations_per_entry: number
    type_distribution: Record<string, number>
    domain_distribution: Record<string, number>
    difficulty_distribution: Record<string, number>
  } {
    const entries = this.getAllEntries()
    const stats = {
      total_entries: entries.length,
      total_annotations: 0,
      avg_annotations_per_entry: 0,
      type_distribution: {} as Record<string, number>,
      domain_distribution: {} as Record<string, number>,
      difficulty_distribution: {} as Record<string, number>,
    }

    for (const entry of entries) {
      stats.total_annotations += entry.annotations.length

      // Count domains
      const domain = entry.metadata?.domain || 'unknown'
      stats.domain_distribution[domain] = (stats.domain_distribution[domain] || 0) + 1

      // Count types and difficulties
      for (const annotation of entry.annotations) {
        stats.type_distribution[annotation.type] =
          (stats.type_distribution[annotation.type] || 0) + 1

        const difficulty = annotation.metadata?.difficulty || 'unknown'
        stats.difficulty_distribution[difficulty] =
          (stats.difficulty_distribution[difficulty] || 0) + 1
      }
    }

    stats.avg_annotations_per_entry = stats.total_annotations / Math.max(stats.total_entries, 1)

    return stats
  }

  /**
   * Export dataset to JSON
   */
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

  /**
   * Import dataset from JSON
   */
  importFromJson(jsonData: string): void {
    const data = JSON.parse(jsonData)

    if (!data.entries || !Array.isArray(data.entries)) {
      throw new Error('Invalid JSON format: missing or invalid entries array')
    }

    for (const entry of data.entries) {
      this.addEntry(entry)
    }
  }

  /**
   * Clear all entries
   */
  clear(): void {
    this.entries.clear()
  }
}

/**
 * Evaluation engine for measuring detection accuracy
 */
export class EvaluationEngine {
  private groundTruthManager: GroundTruthManager
  private config: EvaluationConfig

  constructor(groundTruthManager: GroundTruthManager, config: Partial<EvaluationConfig> = {}) {
    this.groundTruthManager = groundTruthManager
    this.config = {
      overlap_threshold: 0.5,
      type_matching: 'strict',
      ...config,
    }
  }

  /**
   * Evaluate detection results against ground truth
   */
  evaluateEntry(entryId: string, detections: DetectionResult[]): EvaluationResult {
    const entry = this.groundTruthManager.getEntry(entryId)
    if (!entry) {
      throw new Error(`Ground truth entry not found: ${entryId}`)
    }

    // Filter detections by confidence threshold if specified
    const filteredDetections = this.config.confidence_threshold
      ? detections.filter((d) => d.confidence >= (this.config.confidence_threshold || 0))
      : detections

    // Filter by excluded types
    const finalDetections = this.config.exclude_types
      ? filteredDetections.filter((d) => !this.config.exclude_types?.includes(d.type))
      : filteredDetections

    const annotations = this.config.exclude_types
      ? entry.annotations.filter((a) => !this.config.exclude_types?.includes(a.type))
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
        if (
          overlap >= this.config.overlap_threshold &&
          this.typesMatch(detection.type, annotation.type)
        ) {
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
      entry_id: entryId,
      true_positives: truePositives,
      false_positives: falsePositives,
      false_negatives: falseNegatives,
      precision,
      recall,
      f1_score,
    }
  }

  /**
   * Evaluate multiple entries and return aggregate metrics
   */
  evaluateDataset(detectionResults: Record<string, DetectionResult[]>): AggregateMetrics {
    const results: EvaluationResult[] = []

    for (const [entryId, detections] of Object.entries(detectionResults)) {
      try {
        const result = this.evaluateEntry(entryId, detections)
        results.push(result)
      } catch (error) {
        console.warn(`Skipping entry ${entryId}: ${error}`)
      }
    }

    return this.aggregateResults(results)
  }

  /**
   * Aggregate individual evaluation results
   */
  private aggregateResults(results: EvaluationResult[]): AggregateMetrics {
    let totalTP = 0
    let totalFP = 0
    let totalFN = 0
    let totalDetections = 0
    let totalAnnotations = 0

    const typeMetrics: Record<string, { tp: number; fp: number; fn: number }> = {}
    const confidenceData: { tp_confidences: number[]; fp_confidences: number[] } = {
      tp_confidences: [],
      fp_confidences: [],
    }

    for (const result of results) {
      const tp = result.true_positives.length
      const fp = result.false_positives.length
      const fn = result.false_negatives.length

      totalTP += tp
      totalFP += fp
      totalFN += fn
      totalDetections += tp + fp
      totalAnnotations += tp + fn

      // Collect confidence data
      for (const tpResult of result.true_positives) {
        confidenceData.tp_confidences.push(tpResult.detected.confidence)
      }
      for (const fpResult of result.false_positives) {
        confidenceData.fp_confidences.push(fpResult.confidence)
      }

      // Per-type metrics
      for (const tpResult of result.true_positives) {
        const type = tpResult.ground_truth.type
        if (!typeMetrics[type]) typeMetrics[type] = { tp: 0, fp: 0, fn: 0 }
        typeMetrics[type].tp++
      }

      for (const fpResult of result.false_positives) {
        const type = fpResult.type
        if (!typeMetrics[type]) typeMetrics[type] = { tp: 0, fp: 0, fn: 0 }
        typeMetrics[type].fp++
      }

      for (const fnResult of result.false_negatives) {
        const type = fnResult.type
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

    // Confidence analysis
    const avgTPConfidence =
      confidenceData.tp_confidences.length > 0
        ? confidenceData.tp_confidences.reduce((a, b) => a + b, 0) /
          confidenceData.tp_confidences.length
        : 0

    const avgFPConfidence =
      confidenceData.fp_confidences.length > 0
        ? confidenceData.fp_confidences.reduce((a, b) => a + b, 0) /
          confidenceData.fp_confidences.length
        : 0

    // Confidence buckets (0-0.5, 0.5-0.7, 0.7-0.9, 0.9-1.0)
    const buckets = [
      { range: '0.0-0.5', tp: 0, fp: 0, precision: 0 },
      { range: '0.5-0.7', tp: 0, fp: 0, precision: 0 },
      { range: '0.7-0.9', tp: 0, fp: 0, precision: 0 },
      { range: '0.9-1.0', tp: 0, fp: 0, precision: 0 },
    ]

    for (const conf of confidenceData.tp_confidences) {
      const bucketIndex = conf < 0.5 ? 0 : conf < 0.7 ? 1 : conf < 0.9 ? 2 : 3
      buckets[bucketIndex].tp++
    }

    for (const conf of confidenceData.fp_confidences) {
      const bucketIndex = conf < 0.5 ? 0 : conf < 0.7 ? 1 : conf < 0.9 ? 2 : 3
      buckets[bucketIndex].fp++
    }

    for (const bucket of buckets) {
      bucket.precision = bucket.tp / Math.max(bucket.tp + bucket.fp, 1)
    }

    return {
      total_entries: results.length,
      total_annotations: totalAnnotations,
      total_detections: totalDetections,
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

  /**
   * Calculate overlap ratio between detection and annotation
   */
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

  /**
   * Check if detection type matches annotation type
   */
  private typesMatch(detectionType: string, annotationType: string): boolean {
    if (this.config.type_matching === 'strict') {
      return detectionType === annotationType
    } else {
      // Lenient matching - could implement semantic matching logic here
      // For now, just do exact matching
      return detectionType === annotationType
    }
  }
}

/**
 * Utility functions for creating test datasets
 * @note Using class with static methods for logical grouping of dataset creation utilities
 */
// biome-ignore lint/complexity/noStaticOnlyClass: Logical grouping of dataset builder utilities
export class TestDatasetBuilder {
  static createSyntheticEntry(
    id: string,
    patterns: Array<{ type: string; pattern: string }>,
  ): GroundTruthEntry {
    let text = `This is a test document (ID: ${id}) with various PII patterns: `
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
          timestamp: Date.now(),
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
}
