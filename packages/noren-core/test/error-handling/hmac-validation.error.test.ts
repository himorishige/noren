import { importHmacKey } from '@himorishige/noren-core'
import { describe, expect, it } from 'vitest'

/**
 * HMAC Key Validation Error Tests
 * Tests security-critical key validation logic for tokenization features.
 * Part of Phase 1: Critical Security & Error Handling
 */

describe('HMAC Key Validation', () => {
  it('should throw error for keys shorter than 16 characters', async () => {
    const shortKeys = [
      '',
      'a',
      'short-key',
      'exactly-15-char', // exactly 15 chars
    ]

    for (const shortKey of shortKeys) {
      await expect(importHmacKey(shortKey)).rejects.toThrow(
        /HMAC key must be at least 16 characters long/,
      )
    }
  })

  it('should accept exactly 16 character keys', async () => {
    const validKey = 'a'.repeat(16) // exactly 16 chars
    const key = await importHmacKey(validKey)

    expect(key instanceof CryptoKey).toBeTruthy()
    expect(key.type).toBe('secret')
    expect(key.algorithm.name).toBe('HMAC')
    expect((key.algorithm as HmacKeyAlgorithm).hash.name).toBe('SHA-256')
  })

  it('should accept keys longer than 16 characters', async () => {
    const longKeys = [
      'a'.repeat(17), // 17 chars
      'a'.repeat(32), // 32 chars
      'a'.repeat(64), // 64 chars
      'this-is-a-very-long-secret-key-with-more-than-32-characters-for-testing', // 73 chars
    ]

    for (const longKey of longKeys) {
      const key = await importHmacKey(longKey)
      expect(key instanceof CryptoKey, `Key with length ${longKey.length} should be accepted`)
    }
  })

  it('should handle unicode characters in keys', async () => {
    // 32 unicode characters (may be more than 32 bytes)
    const unicodeKey = '🔐'.repeat(8) + 'a'.repeat(24) // 8 emojis + 24 chars = 32 chars
    const key = await importHmacKey(unicodeKey)

    expect(key instanceof CryptoKey).toBeTruthy()
  })

  it('should reject null and undefined inputs', async () => {
    await expect(importHmacKey(null as never)).rejects.toThrow(
      /HMAC key must be at least 16 characters long/,
    )

    await expect(importHmacKey(undefined as never)).rejects.toThrow(
      /HMAC key must be at least 16 characters long/,
    )
  })

  it('should handle CryptoKey inputs without validation', async () => {
    // First create a valid CryptoKey
    const validKeyString = 'a'.repeat(16)
    const cryptoKey = await importHmacKey(validKeyString)

    // Pass the CryptoKey back to importHmacKey (should return as-is)
    const result = await importHmacKey(cryptoKey)
    expect(result).toBe(cryptoKey)
  })

  it('should handle special characters and spaces', async () => {
    const specialKey = '!@#$%^&*()_+-=[]' // 16 chars with special chars
    const key = await importHmacKey(specialKey)

    expect(key instanceof CryptoKey).toBeTruthy()
  })

  it('should be consistent with key generation', async () => {
    const keyString = 'consistent-test-key-16ch'
    const key1 = await importHmacKey(keyString)
    const key2 = await importHmacKey(keyString)

    // Keys should have the same properties (though may be different objects)
    expect(key1.algorithm.name).toBe(key2.algorithm.name)
    expect((key1.algorithm as HmacKeyAlgorithm).hash.name).toBe(
      (key2.algorithm as HmacKeyAlgorithm).hash.name,
    )
  })
})
