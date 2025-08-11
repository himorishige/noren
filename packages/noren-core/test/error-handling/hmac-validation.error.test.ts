import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { importHmacKey } from '@himorishige/noren-core'

/**
 * HMAC Key Validation Error Tests
 * Tests security-critical key validation logic for tokenization features.
 * Part of Phase 1: Critical Security & Error Handling
 */

describe('HMAC Key Validation', () => {
  it('should throw error for keys shorter than 32 characters', async () => {
    const shortKeys = [
      '',
      'a',
      'short-key',
      'this-is-only-31-chars-long-key!', // exactly 31 chars
    ]

    for (const shortKey of shortKeys) {
      await assert.rejects(
        importHmacKey(shortKey),
        {
          name: 'Error',
          message: /HMAC key must be at least 32 characters long/,
        },
        `Key with length ${shortKey.length} should be rejected`,
      )
    }
  })

  it('should accept exactly 32 character keys', async () => {
    const validKey = 'a'.repeat(32) // exactly 32 chars
    const key = await importHmacKey(validKey)

    assert.ok(key instanceof CryptoKey, 'Should return a CryptoKey instance')
    assert.equal(key.type, 'secret', 'Key type should be secret')
    assert.equal(key.algorithm.name, 'HMAC', 'Algorithm should be HMAC')
    assert.equal((key.algorithm as HmacKeyAlgorithm).hash.name, 'SHA-256', 'Hash should be SHA-256')
  })

  it('should accept keys longer than 32 characters', async () => {
    const longKeys = [
      'a'.repeat(33), // 33 chars
      'a'.repeat(64), // 64 chars
      'this-is-a-very-long-secret-key-with-more-than-32-characters-for-testing', // 73 chars
    ]

    for (const longKey of longKeys) {
      const key = await importHmacKey(longKey)
      assert.ok(key instanceof CryptoKey, `Key with length ${longKey.length} should be accepted`)
    }
  })

  it('should handle unicode characters in keys', async () => {
    // 32 unicode characters (may be more than 32 bytes)
    const unicodeKey = '🔐'.repeat(8) + 'a'.repeat(24) // 8 emojis + 24 chars = 32 chars
    const key = await importHmacKey(unicodeKey)

    assert.ok(key instanceof CryptoKey, 'Should handle unicode characters')
  })

  it('should reject null and undefined inputs', async () => {
    await assert.rejects(
      importHmacKey(null as never),
      /HMAC key must be at least 32 characters long/,
      'Should reject null input',
    )

    await assert.rejects(
      importHmacKey(undefined as never),
      /HMAC key must be at least 32 characters long/,
      'Should reject undefined input',
    )
  })

  it('should handle CryptoKey inputs without validation', async () => {
    // First create a valid CryptoKey
    const validKeyString = 'a'.repeat(32)
    const cryptoKey = await importHmacKey(validKeyString)

    // Pass the CryptoKey back to importHmacKey (should return as-is)
    const result = await importHmacKey(cryptoKey)
    assert.equal(result, cryptoKey, 'Should return the same CryptoKey instance')
  })

  it('should handle special characters and spaces', async () => {
    const specialKey = '!@#$%^&*()_+-=[]{}|;:,.<>?/~`' + 'abc!' // 32 chars with special chars
    const key = await importHmacKey(specialKey)

    assert.ok(key instanceof CryptoKey, 'Should accept keys with special characters')
  })

  it('should be consistent with key generation', async () => {
    const keyString = 'consistent-test-key-for-hmac-generation-32chars'
    const key1 = await importHmacKey(keyString)
    const key2 = await importHmacKey(keyString)

    // Keys should have the same properties (though may be different objects)
    assert.equal(key1.algorithm.name, key2.algorithm.name)
    assert.equal(
      (key1.algorithm as HmacKeyAlgorithm).hash.name,
      (key2.algorithm as HmacKeyAlgorithm).hash.name,
    )
  })
})
