/**
 * Common statistical functions for noren-devtools
 * Unified implementation to eliminate code duplication across modules
 */

// ===== Basic Statistics =====

export function mean(values: number[]): number {
  return values.length === 0 ? 0 : values.reduce((sum, val) => sum + val, 0) / values.length
}

export function median(values: number[]): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid]
}

export function standardDeviation(values: number[]): number {
  if (values.length <= 1) return 0
  const avg = mean(values)
  const variance = values.reduce((sum, val) => sum + (val - avg) ** 2, 0) / (values.length - 1)
  return Math.sqrt(variance)
}

export function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const index = (p / 100) * (sorted.length - 1)
  const lower = Math.floor(index)
  const upper = Math.ceil(index)

  if (lower === upper) return sorted[lower]
  return sorted[lower] * (upper - index) + sorted[upper] * (index - lower)
}

// ===== Confidence Intervals =====

export interface ConfidenceInterval {
  lower: number
  upper: number
  level: number
}

export function confidenceInterval(values: number[], confidenceLevel = 0.95): ConfidenceInterval {
  if (values.length < 2) {
    const val = values[0] || 0
    return { lower: val, upper: val, level: confidenceLevel }
  }

  const avg = mean(values)
  const stdErr = standardDeviation(values) / Math.sqrt(values.length)
  const tValue = getTCriticalValue(values.length - 1, confidenceLevel)
  const margin = tValue * stdErr

  return {
    lower: avg - margin,
    upper: avg + margin,
    level: confidenceLevel,
  }
}

// Simple t-critical value approximation
function getTCriticalValue(degreesOfFreedom: number, confidenceLevel: number): number {
  const alpha = 1 - confidenceLevel

  // Common values for quick lookup
  if (degreesOfFreedom >= 30) {
    return alpha <= 0.01 ? 2.576 : alpha <= 0.05 ? 1.96 : 1.645
  }

  // Simplified approximation for smaller samples
  const tTable: Record<number, Record<number, number>> = {
    1: { 0.1: 6.314, 0.05: 12.706, 0.01: 63.657 },
    2: { 0.1: 2.92, 0.05: 4.303, 0.01: 9.925 },
    5: { 0.1: 2.015, 0.05: 2.571, 0.01: 4.032 },
    10: { 0.1: 1.812, 0.05: 2.228, 0.01: 3.169 },
    20: { 0.1: 1.725, 0.05: 2.086, 0.01: 2.845 },
  }

  const df = Math.min(20, Math.max(1, degreesOfFreedom))
  const closestDf = Object.keys(tTable)
    .map(Number)
    .reduce((prev, curr) => (Math.abs(curr - df) < Math.abs(prev - df) ? curr : prev))

  return tTable[closestDf][alpha] || 1.96
}

// ===== Statistical Tests =====

export interface TTestResult {
  tStatistic: number
  pValue: number
  significant: boolean
  degreesOfFreedom: number
}

export function tTest(sample1: number[], sample2: number[], alpha = 0.05): TTestResult {
  if (sample1.length < 2 || sample2.length < 2) {
    return {
      tStatistic: 0,
      pValue: 1,
      significant: false,
      degreesOfFreedom: Math.max(0, sample1.length + sample2.length - 2),
    }
  }

  const mean1 = mean(sample1)
  const mean2 = mean(sample2)
  const std1 = standardDeviation(sample1)
  const std2 = standardDeviation(sample2)

  const n1 = sample1.length
  const n2 = sample2.length

  // Pooled standard error
  const pooledSE =
    Math.sqrt(((n1 - 1) * std1 * std1 + (n2 - 1) * std2 * std2) / (n1 + n2 - 2)) *
    Math.sqrt(1 / n1 + 1 / n2)

  const tStat = (mean1 - mean2) / pooledSE
  const df = n1 + n2 - 2

  // Simplified p-value approximation
  const pValue = approximatePValue(Math.abs(tStat), df)

  return {
    tStatistic: tStat,
    pValue: pValue,
    significant: pValue < alpha,
    degreesOfFreedom: df,
  }
}

// Simple p-value approximation
function approximatePValue(tStat: number, df: number): number {
  if (tStat < 1) return 0.5
  if (tStat > 4) return 0.001

  // Very rough approximation
  const factor = df > 10 ? 1 : 1 + (10 - df) * 0.1
  return Math.max(0.001, 0.5 * Math.exp(-tStat * factor))
}

// ===== Correlation =====

export function pearsonCorrelation(x: number[], y: number[]): number {
  if (x.length !== y.length || x.length < 2) return 0

  const n = x.length
  const meanX = mean(x)
  const meanY = mean(y)

  let numerator = 0
  let sumXSq = 0
  let sumYSq = 0

  for (let i = 0; i < n; i++) {
    const deltaX = x[i] - meanX
    const deltaY = y[i] - meanY
    numerator += deltaX * deltaY
    sumXSq += deltaX * deltaX
    sumYSq += deltaY * deltaY
  }

  const denominator = Math.sqrt(sumXSq * sumYSq)
  return denominator === 0 ? 0 : numerator / denominator
}

// ===== Formatting Utilities =====

export function formatNumber(value: number, decimals = 2): string {
  if (Math.abs(value) >= 1000000) {
    return `${(value / 1000000).toFixed(decimals)}M`
  }
  if (Math.abs(value) >= 1000) {
    return `${(value / 1000).toFixed(decimals)}K`
  }
  return value.toFixed(decimals)
}

export function formatPercentage(value: number, decimals = 1): string {
  return `${(value * 100).toFixed(decimals)}%`
}

export function formatDuration(ms: number): string {
  if (ms >= 1000) {
    return `${(ms / 1000).toFixed(2)}s`
  }
  return `${ms.toFixed(2)}ms`
}

// ===== Summary Statistics =====

export interface SummaryStats {
  count: number
  mean: number
  median: number
  standardDeviation: number
  min: number
  max: number
  p25: number
  p75: number
  p95: number
}

export function calculateSummaryStats(values: number[]): SummaryStats {
  if (values.length === 0) {
    return {
      count: 0,
      mean: 0,
      median: 0,
      standardDeviation: 0,
      min: 0,
      max: 0,
      p25: 0,
      p75: 0,
      p95: 0,
    }
  }

  const sorted = [...values].sort((a, b) => a - b)

  return {
    count: values.length,
    mean: mean(values),
    median: median(values),
    standardDeviation: standardDeviation(values),
    min: sorted[0],
    max: sorted[sorted.length - 1],
    p25: percentile(values, 25),
    p75: percentile(values, 75),
    p95: percentile(values, 95),
  }
}
