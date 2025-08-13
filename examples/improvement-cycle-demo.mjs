/**
 * P3-3: Improvement cycle demonstration
 * Shows the complete continuous improvement workflow
 */

import { 
  Registry,
  ImprovementCycleEngine,
  VariantGenerator,
  GroundTruthManager,
  BENCHMARK_CONFIGS
} from '../packages/noren-core/dist/index.js'

/**
 * Demo: Complete improvement cycle workflow
 */
async function demonstrateImprovementCycle() {
  console.log('🔄 Improvement Cycle Demo')
  console.log('='.repeat(50))
  
  // Setup ground truth for evaluation
  const groundTruth = new GroundTruthManager()
  
  groundTruth.addEntry({
    id: 'sample-1',
    text: 'Contact john.doe@example.com or call 555-123-4567 for support.',
    annotations: [
      { start: 8, end: 27, type: 'email', value: 'john.doe@example.com' },
      { start: 36, end: 48, type: 'phone', value: '555-123-4567' }
    ]
  })
  
  groundTruth.addEntry({
    id: 'sample-2',
    text: 'Payment card 4532-1234-5678-9012 expires 12/25.',
    annotations: [
      { start: 13, end: 32, type: 'credit_card', value: '4532-1234-5678-9012' }
    ]
  })
  
  groundTruth.addEntry({
    id: 'sample-3',
    text: 'Server logs show access from 192.168.1.100 at 10:30 AM.',
    annotations: [
      { start: 32, end: 46, type: 'ip', value: '192.168.1.100' }
    ]
  })
  
  // Configure improvement cycle
  const config = {
    baseline_variant: {
      id: 'current-production',
      name: 'Current Production Config',
      registry_factory: () => new Registry({
        defaultAction: 'mask',
        enableContextualConfidence: true,
        contextualSuppressionEnabled: true,
        contextualBoostEnabled: false,
        confidenceThreshold: 0.5,
        contextHints: ['email', 'phone', 'credit_card', 'ip']
      })
    },
    
    auto_generate_variants: true,
    max_variants_per_cycle: 3,
    min_effect_size_threshold: 0.1,
    
    cycle_duration_ms: 300000, // 5 minutes
    min_data_points_per_variant: 8,
    significance_threshold: 0.1,
    
    max_performance_degradation: 0.3, // Max 30% slower
    min_accuracy_threshold: 0.7, // Min 70% F1 score
    
    ground_truth_manager: groundTruth,
    benchmark_config: {
      iterations: 8,
      warmup_iterations: 2,
      text_sizes: [2000],
      pii_densities: [15],
      collect_memory: true,
      collect_gc: false
    }
  }
  
  // Run improvement cycle
  const engine = new ImprovementCycleEngine(config)
  
  try {
    console.log('\n🚀 Starting improvement cycle...')
    const cycleState = await engine.startCycle()
    
    console.log('\n📊 Cycle Results:')
    console.log(`Cycle ID: ${cycleState.cycle_id}`)
    console.log(`Baseline Performance: ${cycleState.baseline_results.performance_baseline.toFixed(2)}ms`)
    if (cycleState.baseline_results.accuracy_baseline) {
      console.log(`Baseline Accuracy: ${cycleState.baseline_results.accuracy_baseline.toFixed(3)} F1`)
    }
    
    console.log(`\nTests Run: ${cycleState.test_results.length}`)
    
    if (cycleState.selected_improvement) {
      console.log('\n🎯 Selected Improvement:')
      console.log(`Variant: ${cycleState.selected_improvement.variant_id}`)
      console.log(`Expected Improvement: ${cycleState.selected_improvement.expected_improvement.toFixed(1)}%`)
      console.log(`Deployment Ready: ${new Date(cycleState.selected_improvement.deployment_timestamp).toISOString()}`)
    } else {
      console.log('\n📝 No significant improvement found in this cycle')
    }
    
    return cycleState
    
  } catch (error) {
    console.error('❌ Improvement cycle failed:', error.message)
    return null
  }
}

/**
 * Demo: Variant generation capabilities
 */
async function demonstrateVariantGeneration() {
  console.log('\n\n🧬 Variant Generation Demo')
  console.log('='.repeat(50))
  
  // Baseline factory
  const baselineFactory = () => new Registry({
    defaultAction: 'mask',
    enableContextualConfidence: true,
    contextHints: ['email', 'phone', 'credit_card', 'ip', 'address']
  })
  
  // Generate exploratory variants
  console.log('\n🔍 Generating exploratory variants...')
  const exploratoryVariants = VariantGenerator.generateExploratoryVariants(baselineFactory)
  
  for (const variant of exploratoryVariants) {
    console.log(`\n${variant.name}:`)
    console.log(`  ID: ${variant.id}`)
    console.log(`  Description: ${variant.description}`)
    
    // Test the variant
    const registry = variant.registryFactory()
    const policy = registry.getPolicy()
    console.log(`  Contextual Confidence: ${policy.enableContextualConfidence}`)
    console.log(`  Context Hints: ${policy.contextHints?.length || 0}`)
    console.log(`  Confidence Threshold: ${policy.confidenceThreshold || 'default'}`)
  }
  
  // Generate recommendation-based variants (mock recommendations)
  console.log('\n\n💡 Generating recommendation-based variants...')
  const mockRecommendations = [
    {
      type: 'performance',
      priority: 'high',
      title: 'Optimize slow configuration variants',
      description: 'Some variants are >100% slower than average',
      impact_estimate: { performance_improvement: '50-100%' },
      implementation_complexity: 'medium',
      estimated_effort: '2-3 days'
    },
    {
      type: 'accuracy',
      priority: 'medium',
      title: 'Improve detection accuracy',
      description: 'Some variants have lower F1 scores',
      impact_estimate: { accuracy_improvement: '10-20%' },
      implementation_complexity: 'medium',
      estimated_effort: '3-5 days'
    }
  ]
  
  const recommendationVariants = VariantGenerator.generateVariantsFromRecommendations(
    baselineFactory,
    mockRecommendations
  )
  
  for (const variant of recommendationVariants) {
    console.log(`\n${variant.name}:`)
    console.log(`  ID: ${variant.id}`)
    console.log(`  Description: ${variant.description}`)
  }
}

/**
 * Main demo runner
 */
async function main() {
  try {
    console.log('🔧 Noren Continuous Improvement System Demo')
    console.log('='.repeat(60))
    
    await demonstrateVariantGeneration()
    const cycleResult = await demonstrateImprovementCycle()
    
    console.log('\n' + '='.repeat(60))
    console.log('✅ Improvement system demo completed!')
    
    console.log('\n🎯 Key Capabilities Demonstrated:')
    console.log('- Automatic baseline establishment')
    console.log('- Intelligent variant generation')
    console.log('- Safety constraint enforcement')
    console.log('- Statistical significance testing')
    console.log('- Performance vs accuracy trade-offs')
    console.log('- Actionable improvement recommendations')
    
    if (cycleResult?.selected_improvement) {
      console.log('\n🚀 Ready for Production Deployment:')
      console.log(`- Improvement: ${cycleResult.selected_improvement.expected_improvement.toFixed(1)}%`)
      console.log('- Safety checks passed')
      console.log('- Statistical significance confirmed')
    }
    
  } catch (error) {
    console.error('❌ Demo failed:', error)
    process.exit(1)
  }
}

// Run the demo
main()