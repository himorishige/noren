import { describe, it } from 'node:test'
import { Registry, redactText } from '@himorishige/noren-core'

/**
 * Performance benchmark test for optimizations
 */

describe('Performance Benchmarks', () => {
  it('processes large text with multiple detections efficiently', async () => {
    const reg = new Registry({ defaultAction: 'mask' })
    
    // Generate test data with multiple PII types
    const testData = []
    for (let i = 0; i < 100; i++) {
      testData.push(`
        Email: user${i}@example.com
        Phone: +1-555-${String(i).padStart(3, '0')}-${String(i * 2).padStart(4, '0')}
        Card: 4242 4242 4242 ${String(4242 + i).padStart(4, '0')}
        IP: 192.168.${i % 256}.${(i * 2) % 256}
        MAC: 00:11:22:33:44:${String(i % 256).padStart(2, '0').replace(/(\d)(\d)/, '$1$2')}
      `)
    }
    const input = testData.join('\n')
    
    console.time('Large text processing')
    const result = await redactText(reg, input)
    console.timeEnd('Large text processing')
    
    // Verify detection worked
    if (!result.includes('[REDACTED:email]')) {
      throw new Error('Email detection failed')
    }
    if (!result.includes('[REDACTED:credit_card]')) {
      throw new Error('Credit card detection failed')
    }
  })

  it('handles repeated detection calls efficiently', async () => {
    const reg = new Registry({ 
      defaultAction: 'mask',
      contextHints: ['Email', 'Phone', 'Address', 'SSN']
    })
    
    const testInput = 'Contact: john@example.com, Phone: +1-555-123-4567, SSN: 123-45-6789'
    
    console.time('1000 iterations')
    for (let i = 0; i < 1000; i++) {
      await redactText(reg, testInput)
    }
    console.timeEnd('1000 iterations')
  })

  it('efficiently processes text with context hints', async () => {
    const reg = new Registry({ 
      defaultAction: 'mask',
      // Many context hints to test Set optimization
      contextHints: [
        'Email', 'Phone', 'Address', 'SSN', 'ZIP', 'Postal',
        'TEL', '電話', '住所', '〒', 'マイナンバー', '個人番号',
        'Name', 'FirstName', 'LastName', 'DOB', 'DateOfBirth',
        'Account', 'AccountNumber', 'ID', 'CustomerID', 'UserID'
      ]
    })
    
    const testData = `
      Email: test@example.com
      Phone: 555-123-4567
      Address: 123 Main St, ZIP: 12345
      住所: 〒150-0001 東京都渋谷区
      TEL: 090-1234-5678
    `
    
    console.time('Context hint processing')
    for (let i = 0; i < 500; i++) {
      await redactText(reg, testData)
    }
    console.timeEnd('Context hint processing')
  })
})