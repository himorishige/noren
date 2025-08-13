/**
 * Common report generation utilities for noren-devtools
 * Unified formatting and output generation to eliminate duplication
 */

import type { ConfidenceInterval, SummaryStats } from './stats-common.js'
import { formatDuration, formatNumber, formatPercentage } from './stats-common.js'

// ===== Report Sections =====

export interface ReportSection {
  title: string
  content: string
  metadata?: Record<string, unknown>
}

export interface PerformanceMetrics {
  duration: number
  throughput: number
  memoryUsage: number
  errorRate?: number
}

export interface AccuracyMetrics {
  precision: number
  recall: number
  f1Score: number
  truePositives: number
  falsePositives: number
  falseNegatives: number
}

// ===== Formatters =====

export function formatPerformanceSection(
  name: string,
  metrics: PerformanceMetrics,
  confidence?: ConfidenceInterval,
): ReportSection {
  const lines = [
    `⚡ Avg Duration: ${formatDuration(metrics.duration)}`,
    `🚀 Throughput: ${formatNumber(metrics.throughput)}K chars/sec`,
    `💾 Memory Efficiency: ${formatNumber(metrics.memoryUsage, 3)} MB/KB`,
  ]

  if (metrics.errorRate !== undefined) {
    lines.push(`❌ Error Rate: ${formatPercentage(metrics.errorRate)}`)
  }

  if (confidence) {
    lines.push(
      `📈 Confidence: [${formatDuration(confidence.lower)}, ${formatDuration(confidence.upper)}]`,
    )
  }

  return {
    title: name,
    content: lines.map((line) => `    ${line}`).join('\n'),
    metadata: { type: 'performance', metrics },
  }
}

export function formatAccuracySection(name: string, metrics: AccuracyMetrics): ReportSection {
  const lines = [
    `🎯 F1 Score: ${formatNumber(metrics.f1Score, 3)}`,
    `✅ Precision: ${formatNumber(metrics.precision, 3)}, Recall: ${formatNumber(metrics.recall, 3)}`,
  ]

  if (metrics.truePositives || metrics.falsePositives || metrics.falseNegatives) {
    lines.push(
      `📊 TP: ${metrics.truePositives}, FP: ${metrics.falsePositives}, FN: ${metrics.falseNegatives}`,
    )
  }

  return {
    title: name,
    content: lines.map((line) => `    ${line}`).join('\n'),
    metadata: { type: 'accuracy', metrics },
  }
}

export function formatSummaryStatsSection(name: string, stats: SummaryStats): ReportSection {
  const lines = [
    `📊 Count: ${stats.count}`,
    `📈 Mean: ${formatNumber(stats.mean)} (±${formatNumber(stats.standardDeviation)})`,
    `📉 Range: ${formatNumber(stats.min)} - ${formatNumber(stats.max)}`,
    `📊 Percentiles: P25=${formatNumber(stats.p25)}, P75=${formatNumber(stats.p75)}, P95=${formatNumber(stats.p95)}`,
  ]

  return {
    title: name,
    content: lines.map((line) => `    ${line}`).join('\n'),
    metadata: { type: 'summary', stats },
  }
}

// ===== Report Builders =====

export class ReportBuilder {
  private sections: ReportSection[] = []

  title(text: string): this {
    this.sections.push({
      title: 'header',
      content: this.formatHeader(text),
    })
    return this
  }

  section(section: ReportSection): this {
    this.sections.push(section)
    return this
  }

  performance(name: string, metrics: PerformanceMetrics, confidence?: ConfidenceInterval): this {
    return this.section(formatPerformanceSection(name, metrics, confidence))
  }

  accuracy(name: string, metrics: AccuracyMetrics): this {
    return this.section(formatAccuracySection(name, metrics))
  }

  summaryStats(name: string, stats: SummaryStats): this {
    return this.section(formatSummaryStatsSection(name, stats))
  }

  comparison(winner: string, improvement: number, significance: number): this {
    const lines = [
      `🏆 Winner: ${winner}`,
      `📈 Improvement: ${formatPercentage(improvement / 100)}`,
      `📊 Significance: ${formatPercentage(significance / 100)}`,
    ]

    this.sections.push({
      title: 'comparison',
      content: lines.map((line) => `  ${line}`).join('\n'),
      metadata: { winner, improvement, significance },
    })

    return this
  }

  summary(testName: string, sampleCount: number, duration: number, completed: string): this {
    const lines = [
      `Test Name: ${testName}`,
      `Total Samples: ${sampleCount}`,
      `Duration: ${formatDuration(duration)}`,
      `Completed: ${completed}`,
    ]

    this.sections.push({
      title: 'summary',
      content: lines.map((line) => `  ${line}`).join('\n'),
      metadata: { testName, sampleCount, duration, completed },
    })

    return this
  }

  text(content: string): this {
    this.sections.push({
      title: 'text',
      content,
    })
    return this
  }

  build(): string {
    return this.sections.map((section) => section.content).join('\n')
  }

  private formatHeader(text: string): string {
    const separator = '='.repeat(60)
    return `\n${separator}\n🎯 ${text}\n${separator}`
  }
}

// ===== Predefined Templates =====

export function createBenchmarkReport(
  name: string,
  results: Array<{ name: string; metrics: PerformanceMetrics; confidence?: ConfidenceInterval }>,
): string {
  const builder = new ReportBuilder().title(`Benchmark Results: ${name}`)

  results.forEach((result) => {
    builder.performance(result.name, result.metrics, result.confidence)
  })

  return builder.build()
}

export function createABTestReport(
  testName: string,
  variantA: { name: string; performance: PerformanceMetrics; accuracy?: AccuracyMetrics },
  variantB: { name: string; performance: PerformanceMetrics; accuracy?: AccuracyMetrics },
  winner: string,
  improvement: number,
  significance: number,
  sampleCount: number,
  duration: number,
): string {
  const builder = new ReportBuilder()
    .title(`A/B Test Results: ${testName}`)
    .text('\n📊 Variant Performance:\n')

  builder.performance(variantA.name, variantA.performance)
  if (variantA.accuracy) {
    builder.accuracy(variantA.name, variantA.accuracy)
  }

  builder.text('') // Add spacing
  builder.performance(variantB.name, variantB.performance)
  if (variantB.accuracy) {
    builder.accuracy(variantB.name, variantB.accuracy)
  }

  builder
    .text('')
    .comparison(winner, improvement, significance)
    .text('\n📋 Test Summary:')
    .summary(testName, sampleCount, duration, new Date().toISOString())

  return builder.build()
}

export function createEvaluationReport(
  name: string,
  accuracy: AccuracyMetrics,
  performanceStats?: SummaryStats,
): string {
  const builder = new ReportBuilder()
    .title(`Evaluation Results: ${name}`)
    .accuracy('Detection Accuracy', accuracy)

  if (performanceStats) {
    builder.summaryStats('Performance Statistics', performanceStats)
  }

  return builder.build()
}

// ===== Console Output Utilities =====

export function printReport(
  report: string,
  options: { timestamp?: boolean; prefix?: string } = {},
): void {
  const timestamp = options.timestamp ? `[${new Date().toISOString()}] ` : ''
  const prefix = options.prefix ? `${options.prefix} ` : ''

  console.log(`${timestamp}${prefix}${report}`)
}

export function printProgress(current: number, total: number, operation = 'Processing'): void {
  const percentage = ((current / total) * 100).toFixed(1)
  console.log(`  Progress: ${percentage}% (${current}/${total}) - ${operation}`)
}
