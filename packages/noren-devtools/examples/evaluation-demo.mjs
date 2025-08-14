/**
 * P3-1: Evaluation framework integration demo
 * Shows how to evaluate PII detection accuracy using ground truth data
 */

import { Registry } from '../../noren-core/dist/index.js'
import { 
  GroundTruthManager,
  EvaluationEngine,
  TestDatasetBuilder,
} from '../dist/noren-devtools/src/index.js'

/**
 * Demo: Basic evaluation workflow
 */
async function basicEvaluationDemo() {
  console.log('=== Basic Evaluation Demo ===')
  
  // Initialize registry with basic configuration
  const registry = new Registry({
    defaultAction: 'mask',
    contextHints: ['email', 'phone', 'address'],
    enableContextualConfidence: true
  })
  
  // Set up ground truth dataset
  const groundTruthManager = new GroundTruthManager()
  
  // Add ground truth entries with various PII patterns
  const sampleEntries = [
    {
      id: 'email-test-1',
      text: 'Please contact support@company.com for help with your account.',
      annotations: [{
        start: 15,
        end: 34, // 'support@company.com' = 19 chars
        type: 'email',
        value: 'support@company.com',
        metadata: { difficulty: 'easy', source: 'synthetic' }
      }],
      metadata: { domain: 'customer_support', language: 'en' }
    },
    {
      id: 'phone-test-1', 
      text: 'Call us at 090-1234-5678 during business hours.',
      annotations: [{
        start: 11,
        end: 24, // '090-1234-5678' = 13 chars
        type: 'phone',
        value: '090-1234-5678',
        metadata: { difficulty: 'medium', source: 'synthetic' }
      }],
      metadata: { domain: 'customer_support', language: 'ja' }
    },
    {
      id: 'mixed-test-1',
      text: 'Contact John Doe at john.doe@example.com or call (555) 123-4567.',
      annotations: [
        {
          start: 8,
          end: 16, // 'John Doe' = 8 chars
          type: 'name',
          value: 'John Doe',
          metadata: { difficulty: 'easy' }
        },
        {
          start: 20,
          end: 40, // 'john.doe@example.com' = 20 chars
          type: 'email', 
          value: 'john.doe@example.com',
          metadata: { difficulty: 'easy' }
        },
        {
          start: 49,
          end: 63, // '(555) 123-4567' = 14 chars
          type: 'phone',
          value: '(555) 123-4567',
          metadata: { difficulty: 'hard', source: 'us_format' }
        }
      ],
      metadata: { domain: 'mixed', language: 'en' }
    }
  ]
  
  // Add all entries to ground truth
  for (const entry of sampleEntries) {
    groundTruthManager.addEntry(entry)
  }
  
  console.log('Ground Truth Dataset Statistics:')
  console.log(JSON.stringify(groundTruthManager.getDatasetStats(), null, 2))
  
  // Run detection on each entry and collect results
  const detectionResults = {}
  
  for (const entry of sampleEntries) {
    console.log(`\\nRunning detection on: "${entry.text}"`)
    const result = await registry.detect(entry.text)
    
    // Convert to evaluation format
    detectionResults[entry.id] = result.hits.map(hit => ({
      start: hit.start,
      end: hit.end,
      type: hit.type,
      value: hit.value,
      confidence: hit.confidence || 0.8 // Default confidence if not available
    }))
    
    console.log(`  Detected ${result.hits.length} PII elements:`)
    for (const hit of result.hits) {
      console.log(`    - ${hit.type}: "${hit.value}" (confidence: ${hit.confidence || 0.8})`)
    }
  }
  
  // Evaluate detection results
  const evaluationEngine = new EvaluationEngine(groundTruthManager, {
    overlap_threshold: 0.5,
    type_matching: 'strict'
  })
  
  const aggregateMetrics = evaluationEngine.evaluateDataset(detectionResults)
  
  console.log('\\n=== Evaluation Results ===')
  console.log(`Total Entries: ${aggregateMetrics.total_entries}`)
  console.log(`Total Ground Truth Annotations: ${aggregateMetrics.total_annotations}`)
  console.log(`Total Detections: ${aggregateMetrics.total_detections}`)
  console.log()
  console.log(`Overall Metrics:`)
  console.log(`  Precision: ${(aggregateMetrics.precision * 100).toFixed(2)}%`)
  console.log(`  Recall: ${(aggregateMetrics.recall * 100).toFixed(2)}%`)
  console.log(`  F1-Score: ${(aggregateMetrics.f1_score * 100).toFixed(2)}%`)
  console.log()
  console.log(`Confusion Matrix:`)
  console.log(`  True Positives: ${aggregateMetrics.true_positives}`)
  console.log(`  False Positives: ${aggregateMetrics.false_positives}`)
  console.log(`  False Negatives: ${aggregateMetrics.false_negatives}`)
  
  console.log('\\n=== Per-Type Performance ===')
  for (const [piiType, metrics] of Object.entries(aggregateMetrics.type_metrics)) {
    console.log(`${piiType}:`)
    console.log(`  Precision: ${(metrics.precision * 100).toFixed(2)}%`)
    console.log(`  Recall: ${(metrics.recall * 100).toFixed(2)}%`)
    console.log(`  F1-Score: ${(metrics.f1_score * 100).toFixed(2)}%`)
    console.log(`  TP: ${metrics.tp}, FP: ${metrics.fp}, FN: ${metrics.fn}`)
    console.log()
  }
  
  console.log('=== Confidence Analysis ===')
  const confAnalysis = aggregateMetrics.confidence_analysis
  console.log(`Average TP Confidence: ${(confAnalysis.avg_tp_confidence * 100).toFixed(2)}%`)
  console.log(`Average FP Confidence: ${(confAnalysis.avg_fp_confidence * 100).toFixed(2)}%`)
  console.log()
  console.log('Confidence Distribution:')
  for (const bucket of confAnalysis.confidence_buckets) {
    if (bucket.tp > 0 || bucket.fp > 0) {
      console.log(`  ${bucket.range}: Precision ${(bucket.precision * 100).toFixed(2)}% (TP: ${bucket.tp}, FP: ${bucket.fp})`)
    }
  }
  
  // Generate individual entry evaluations for detailed analysis
  console.log('\\n=== Detailed Entry Analysis ===')
  for (const entryId of Object.keys(detectionResults)) {
    const entryResult = evaluationEngine.evaluateEntry(entryId, detectionResults[entryId])
    console.log(`\\n${entryId}:`)
    console.log(`  Precision: ${(entryResult.precision * 100).toFixed(2)}%`)
    console.log(`  Recall: ${(entryResult.recall * 100).toFixed(2)}%`)
    console.log(`  F1-Score: ${(entryResult.f1_score * 100).toFixed(2)}%`)
    
    if (entryResult.true_positives.length > 0) {
      console.log(`  True Positives (${entryResult.true_positives.length}):`)
      for (const tp of entryResult.true_positives) {
        console.log(`    ✓ ${tp.detected.type}: "${tp.detected.value}" (overlap: ${(tp.overlap_ratio * 100).toFixed(1)}%)`)
      }
    }
    
    if (entryResult.false_positives.length > 0) {
      console.log(`  False Positives (${entryResult.false_positives.length}):`)
      for (const fp of entryResult.false_positives) {
        console.log(`    ✗ ${fp.type}: "${fp.value}" (unexpected detection)`)
      }
    }
    
    if (entryResult.false_negatives.length > 0) {
      console.log(`  False Negatives (${entryResult.false_negatives.length}):`)
      for (const fn of entryResult.false_negatives) {
        console.log(`    ✗ ${fn.type}: "${fn.value}" (missed detection)`)
      }
    }
  }
}

/**
 * Demo: Synthetic dataset generation
 */
function syntheticDatasetDemo() {
  console.log('\\n\\n=== Synthetic Dataset Generation Demo ===')
  
  const patterns = [
    { type: 'email', patterns: [
      'test@example.com', 'admin@company.co.jp', 'support+help@service.org',
      'user123@domain.net', 'contact@startup.io'
    ]},
    { type: 'phone', patterns: [
      '090-1234-5678', '080-9876-5432', '070-1111-2222',
      '(555) 123-4567', '+81-90-1234-5678'
    ]},
    { type: 'ip', patterns: [
      '192.168.1.1', '10.0.0.1', '172.16.0.1',
      '2001:db8::1', '::1'
    ]},
    { type: 'credit_card', patterns: [
      '4111111111111111', '5555555555554444', '378282246310005'
    ]}
  ]
  
  const manager = new GroundTruthManager()
  
  // Generate synthetic entries
  let entryId = 1
  for (const { type, patterns: typePatterns } of patterns) {
    for (const pattern of typePatterns) {
      const entry = TestDatasetBuilder.createSyntheticEntry(
        `synthetic-${type}-${entryId}`,
        [{ type, pattern }]
      )
      manager.addEntry(entry)
      entryId++
    }
  }
  
  // Generate mixed entries
  for (let i = 0; i < 5; i++) {
    const mixedPatterns = []
    for (const { type, patterns: typePatterns } of patterns) {
      if (Math.random() > 0.6) { // 40% chance to include each type
        const randomPattern = typePatterns[Math.floor(Math.random() * typePatterns.length)]
        mixedPatterns.push({ type, pattern: randomPattern })
      }
    }
    
    if (mixedPatterns.length > 0) {
      const entry = TestDatasetBuilder.createSyntheticEntry(
        `synthetic-mixed-${i + 1}`,
        mixedPatterns
      )
      manager.addEntry(entry)
    }
  }
  
  const stats = manager.getDatasetStats()
  console.log('Synthetic Dataset Statistics:')
  console.log(`  Total Entries: ${stats.total_entries}`)
  console.log(`  Total Annotations: ${stats.total_annotations}`)
  console.log(`  Avg Annotations per Entry: ${stats.avg_annotations_per_entry.toFixed(2)}`)
  console.log()
  console.log('Type Distribution:')
  for (const [type, count] of Object.entries(stats.type_distribution)) {
    console.log(`  ${type}: ${count}`)
  }
  
  // Export dataset
  const jsonExport = manager.exportToJson()
  console.log(`\\nDataset exported (${jsonExport.length} characters)`)
  console.log('First entry preview:')
  const parsed = JSON.parse(jsonExport)
  if (parsed.entries.length > 0) {
    console.log(JSON.stringify(parsed.entries[0], null, 2))
  }
}

/**
 * Demo: Edge case testing
 */
async function edgeCaseTestingDemo() {
  console.log('\\n\\n=== Edge Case Testing Demo ===')
  
  const registry = new Registry({
    defaultAction: 'mask',
    enableContextualConfidence: true,
    contextualBoostEnabled: false, // Conservative settings
    contextualSuppressionEnabled: true
  })
  
  const manager = new GroundTruthManager()
  
  // Edge cases that might cause detection issues
  const edgeCases = [
    {
      id: 'edge-boundary',
      text: 'Email:test@example.com,Phone:090-1234-5678',
      annotations: [
        { start: 6, end: 22, type: 'email', value: 'test@example.com' },
        { start: 29, end: 42, type: 'phone', value: '090-1234-5678' }
      ]
    },
    {
      id: 'edge-partial-overlap',
      text: 'contact@company-support.com',
      annotations: [
        { start: 0, end: 27, type: 'email', value: 'contact@company-support.com' }
      ]
    },
    {
      id: 'edge-formatting',
      text: 'Email: <support@example.com> or call [090-1234-5678]',
      annotations: [
        { start: 8, end: 27, type: 'email', value: 'support@example.com' },
        { start: 38, end: 51, type: 'phone', value: '090-1234-5678' }
      ]
    }
  ]
  
  for (const entry of edgeCases) {
    manager.addEntry(entry)
  }
  
  const detectionResults = {}
  
  for (const entry of edgeCases) {
    const result = await registry.detect(entry.text)
    detectionResults[entry.id] = result.hits.map(hit => ({
      start: hit.start,
      end: hit.end, 
      type: hit.type,
      value: hit.value,
      confidence: hit.confidence || 0.8
    }))
    
    console.log(`\\nEdge case: "${entry.text}"`)
    console.log(`  Expected: ${entry.annotations.length} annotations`)
    console.log(`  Detected: ${result.hits.length} hits`)
    for (const hit of result.hits) {
      console.log(`    ${hit.type}: "${hit.value}" at ${hit.start}-${hit.end}`)
    }
  }
  
  const engine = new EvaluationEngine(manager)
  const metrics = engine.evaluateDataset(detectionResults)
  
  console.log('\\nEdge Case Evaluation Results:')
  console.log(`  Precision: ${(metrics.precision * 100).toFixed(2)}%`)
  console.log(`  Recall: ${(metrics.recall * 100).toFixed(2)}%`)
  console.log(`  F1-Score: ${(metrics.f1_score * 100).toFixed(2)}%`)
}

/**
 * Main demo runner
 */
async function main() {
  try {
    await basicEvaluationDemo()
    syntheticDatasetDemo()
    await edgeCaseTestingDemo()
    console.log('\\n✅ All evaluation demos completed successfully!')
  } catch (error) {
    console.error('❌ Demo failed:', error)
    process.exit(1)
  }
}

// Run the demo
main()