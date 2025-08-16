/**
 * Detection Rate Evaluation Script
 *
 * Evaluates the detection accuracy of noren Core and Security plugins
 * using ground truth datasets and generates comprehensive reports.
 */

import { readFileSync, writeFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

// Import noren packages
import { Registry, redactText } from '../packages/noren-core/dist/index.js'
import {
  detectors as securityDetectors,
  maskers as securityMaskers,
} from '../packages/noren-plugin-security/dist/index.js'
import {
  GroundTruthManager,
  EvaluationEngine,
  createEvaluationReport,
  printReport,
} from '../packages/noren-devtools/dist/index.js'

const __dirname = dirname(fileURLToPath(import.meta.url))

// Configuration
const DATASETS_DIR = join(__dirname, '../packages/noren-devtools/datasets/ground-truth')
const OUTPUT_DIR = join(__dirname, '../docs/evaluation')

const DATASET_FILES = [
  { file: 'core-email.json', category: 'Core', type: 'Email' },
  { file: 'core-credit-card.json', category: 'Core', type: 'Credit Card' },
  { file: 'security-jwt.json', category: 'Security', type: 'JWT' },
  { file: 'security-api-keys.json', category: 'Security', type: 'API Keys' },
  { file: 'security-auth-headers.json', category: 'Security', type: 'Auth Headers' },
  { file: 'security-cookies.json', category: 'Security', type: 'Cookies & Sessions' },
  { file: 'security-url-tokens.json', category: 'Security', type: 'URL Tokens' },
  { file: 'security-misc-tokens.json', category: 'Security', type: 'Misc Tokens' },
]

/**
 * Load ground truth dataset from JSON file
 */
function loadDataset(filePath) {
  try {
    const content = readFileSync(filePath, 'utf-8')
    return JSON.parse(content)
  } catch (error) {
    console.error(`Failed to load dataset: ${filePath}`, error)
    return []
  }
}

/**
 * Run detection on text using noren registry
 */
async function runDetection(registry, text) {
  const results = []

  try {
    // Use the detect method to get hits
    const detection = await registry.detect(text)

    // Extract hits from detection result
    if (detection.hits) {
      for (const hit of detection.hits) {
        results.push({
          start: hit.start,
          end: hit.end,
          type: hit.type,
          value: hit.value,
          confidence: hit.confidence || 1.0,
          risk: hit.risk,
        })
      }
    }
  } catch (error) {
    console.warn(`Detection failed for text: ${text.substring(0, 50)}...`, error.message)
  }

  return results
}

/**
 * Convert noren detection results to evaluation format
 */
function convertToDetectionResults(hits) {
  return hits.map((hit) => ({
    start: hit.start,
    end: hit.end,
    type: hit.type,
    value: hit.value,
    confidence: hit.confidence || 1.0,
    risk: hit.risk,
  }))
}

/**
 * Evaluate a single dataset
 */
async function evaluateDataset(registry, datasetInfo) {
  console.log(`Evaluating ${datasetInfo.category} - ${datasetInfo.type}...`)

  const datasetPath = join(DATASETS_DIR, datasetInfo.file)
  const groundTruthEntries = loadDataset(datasetPath)

  if (groundTruthEntries.length === 0) {
    console.warn(`No data found in ${datasetInfo.file}`)
    return null
  }

  // Create ground truth manager
  const gtManager = new GroundTruthManager()

  // Add all entries to ground truth manager
  for (const entry of groundTruthEntries) {
    try {
      gtManager.addEntry(entry)
    } catch (error) {
      console.warn(`Skipping invalid entry ${entry.id}: ${error.message}`)
    }
  }

  // Create evaluation engine
  const evalEngine = new EvaluationEngine(gtManager)

  // Run evaluation
  const results = []
  for (const entry of groundTruthEntries) {
    try {
      const detections = await runDetection(registry, entry.text)
      const detectionResults = convertToDetectionResults(detections)

      const evalResult = evalEngine.evaluateEntry(entry.id, detectionResults)
      results.push(evalResult)
    } catch (error) {
      console.warn(`Failed to evaluate entry ${entry.id}: ${error.message}`)
    }
  }

  // Calculate aggregate metrics
  const aggregate = evalEngine.aggregateResults(results)

  return {
    category: datasetInfo.category,
    type: datasetInfo.type,
    results,
    aggregate,
    totalEntries: groundTruthEntries.length,
  }
}

/**
 * Generate markdown report
 */
function generateMarkdownReport(evaluationResults, timestamp) {
  const lines = [
    '# Detection Rate Evaluation Report',
    '',
    `**Generated:** ${new Date(timestamp).toISOString()}`,
    `**Library Version:** @himorishige/noren-core v0.6.2`,
    '',
    '## Summary',
    '',
    '| Category | Type | Entries | Precision | Recall | F1 Score | TP | FP | FN |',
    '|----------|------|---------|-----------|--------|----------|----|----|----| ',
  ]

  let totalEntries = 0
  let weightedPrecision = 0
  let weightedRecall = 0
  let weightedF1 = 0

  for (const result of evaluationResults) {
    if (!result) continue

    const { aggregate, totalEntries: entries } = result
    totalEntries += entries
    weightedPrecision += aggregate.precision * entries
    weightedRecall += aggregate.recall * entries
    weightedF1 += aggregate.f1_score * entries

    lines.push(
      `| ${result.category} | ${result.type} | ${entries} | ` +
        `${(aggregate.precision * 100).toFixed(1)}% | ` +
        `${(aggregate.recall * 100).toFixed(1)}% | ` +
        `${(aggregate.f1_score * 100).toFixed(1)}% | ` +
        `${aggregate.true_positives} | ` +
        `${aggregate.false_positives} | ` +
        `${aggregate.false_negatives} |`,
    )
  }

  // Add overall weighted averages
  if (totalEntries > 0) {
    lines.push(
      `| **Overall** | **Weighted Avg** | **${totalEntries}** | ` +
        `**${((weightedPrecision / totalEntries) * 100).toFixed(1)}%** | ` +
        `**${((weightedRecall / totalEntries) * 100).toFixed(1)}%** | ` +
        `**${((weightedF1 / totalEntries) * 100).toFixed(1)}%** | ` +
        `**${evaluationResults.reduce((sum, r) => sum + (r?.aggregate.true_positives || 0), 0)}** | ` +
        `**${evaluationResults.reduce((sum, r) => sum + (r?.aggregate.false_positives || 0), 0)}** | ` +
        `**${evaluationResults.reduce((sum, r) => sum + (r?.aggregate.false_negatives || 0), 0)}** |`,
    )
  }

  lines.push('', '## Detailed Results', '')

  // Add detailed results for each category
  for (const result of evaluationResults) {
    if (!result) continue

    lines.push(`### ${result.category} - ${result.type}`, '')
    lines.push(`**Dataset:** ${result.totalEntries} test cases`)
    lines.push(`**True Positives:** ${result.aggregate.true_positives}`)
    lines.push(`**False Positives:** ${result.aggregate.false_positives}`)
    lines.push(`**False Negatives:** ${result.aggregate.false_negatives}`)
    lines.push(`**Precision:** ${(result.aggregate.precision * 100).toFixed(2)}%`)
    lines.push(`**Recall:** ${(result.aggregate.recall * 100).toFixed(2)}%`)
    lines.push(`**F1 Score:** ${(result.aggregate.f1_score * 100).toFixed(2)}%`)

    // Add type-specific metrics if available
    if (result.aggregate.type_metrics && Object.keys(result.aggregate.type_metrics).length > 0) {
      lines.push('', '**By Detection Type:**', '')
      for (const [type, metrics] of Object.entries(result.aggregate.type_metrics)) {
        lines.push(
          `- **${type}**: P=${(metrics.precision * 100).toFixed(1)}%, R=${(metrics.recall * 100).toFixed(1)}%, F1=${(metrics.f1_score * 100).toFixed(1)}%`,
        )
      }
    }

    lines.push('')
  }

  lines.push('## Methodology', '')
  lines.push('- **Ground Truth**: Manually curated synthetic datasets')
  lines.push('- **Evaluation**: Overlap-based matching with 0.5 threshold')
  lines.push('- **Metrics**: Standard precision, recall, and F1 score')
  lines.push('- **Coverage**: Core PII (email, credit card) and Security tokens (JWT, API keys)')
  lines.push('')
  lines.push('Generated with @himorishige/noren-devtools evaluation framework')

  return lines.join('\n')
}

/**
 * Main evaluation function
 */
async function main() {
  console.log('Starting detection rate evaluation...')

  // Create registry with core and security plugins
  const registry = new Registry({
    validationStrictness: 'fast', // Use faster/less strict validation for evaluation
    detectSensitivity: 'relaxed', // Use more sensitive detection for comprehensive evaluation
    enableJsonDetection: true, // Enable JSON detection for better coverage
  })
  // Register security detectors and maskers
  registry.use(securityDetectors, securityMaskers)

  console.log('Registry created with Security plugin')

  // Ensure output directory exists
  try {
    await import('fs').then((fs) => fs.promises.mkdir(OUTPUT_DIR, { recursive: true }))
  } catch (error) {
    console.warn('Could not create output directory:', error.message)
  }

  const timestamp = Date.now()
  const evaluationResults = []

  // Evaluate each dataset
  for (const datasetInfo of DATASET_FILES) {
    const result = await evaluateDataset(registry, datasetInfo)
    evaluationResults.push(result)
  }

  // Generate reports
  const markdownReport = generateMarkdownReport(evaluationResults, timestamp)
  const jsonReport = {
    timestamp,
    version: '0.6.2',
    results: evaluationResults.filter((r) => r !== null),
  }

  // Save reports
  try {
    const reportPath = join(OUTPUT_DIR, `v0.6.2-report.md`)
    writeFileSync(reportPath, markdownReport)
    console.log(`Markdown report saved: ${reportPath}`)

    const jsonPath = join(OUTPUT_DIR, `v0.6.2-report.json`)
    writeFileSync(jsonPath, JSON.stringify(jsonReport, null, 2))
    console.log(`JSON report saved: ${jsonPath}`)
  } catch (error) {
    console.error('Failed to save reports:', error)
  }

  // Print summary to console
  console.log('\n=== EVALUATION SUMMARY ===')
  for (const result of evaluationResults) {
    if (!result) continue

    console.log(`${result.category} - ${result.type}:`)
    console.log(`  Precision: ${(result.aggregate.precision * 100).toFixed(1)}%`)
    console.log(`  Recall: ${(result.aggregate.recall * 100).toFixed(1)}%`)
    console.log(`  F1 Score: ${(result.aggregate.f1_score * 100).toFixed(1)}%`)
    console.log(`  Cases: ${result.totalEntries}`)
    console.log('')
  }

  console.log('Evaluation completed successfully!')
}

// Run evaluation
main().catch(console.error)
