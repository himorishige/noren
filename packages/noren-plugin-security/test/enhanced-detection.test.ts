/**
 * Enhanced Security Detection Tests
 * Tests for new patterns added to improve detection rate from 48.4% to 70%+
 */

import type { DetectUtils, Hit } from '@himorishige/noren-core'
import { describe, expect, it } from 'vitest'
import { detectors, maskers } from '../src/index.js'

function runDetect(src: string, ctxHints: string[] = []): Hit[] {
  const hits: Hit[] = []
  const u: DetectUtils = {
    src,
    hasCtx: (ws?: string[]) =>
      (ws ?? ctxHints).some((w) => src.toLowerCase().includes(w.toLowerCase())),
    push: (h: Hit) => hits.push(h),
    canPush: () => true,
  }
  for (const d of detectors) void d.match(u)
  return hits
}

describe('Enhanced Security Detection', () => {
  describe('GitHub Personal Access Tokens', () => {
    it('should detect GitHub personal access tokens', () => {
      const testCases = [
        'ghp_1234567890abcdef1234567890abcdef123456',
        'gho_1234567890abcdef1234567890abcdef123456',
        'ghu_1234567890abcdef1234567890abcdef123456',
        'ghs_1234567890abcdef1234567890abcdef123456',
      ]

      for (const token of testCases) {
        const hits = runDetect(`GitHub token: ${token}`, ['github', 'token'])
        const githubHit = hits.find((h) => h.type === 'sec_github_token')
        expect(githubHit).toBeTruthy()
        expect(githubHit?.value).toBe(token)
        expect(githubHit?.risk).toBe('high')

        // Test masking
        if (githubHit) {
          const masked = maskers.sec_github_token(githubHit)
          expect(masked).toMatch(/gh[opusa]_\*+/)
        }
      }
    })

    it('should not detect partial or invalid GitHub tokens', () => {
      const invalidCases = [
        'gh_short',
        'ghp_',
        'invalid_ghp_1234567890abcdef1234567890abcdef123456',
      ]

      for (const token of invalidCases) {
        const hits = runDetect(`Token: ${token}`)
        const githubHit = hits.find((h) => h.type === 'sec_github_token')
        expect(githubHit).toBeFalsy()
      }
    })
  })

  describe('AWS Access Keys', () => {
    it('should detect AWS access key IDs', () => {
      const testCases = [
        'AKIAIOSFODNN7EXAMPLE',
        'ASIAIOSFODNN7EXAMPLE',
        'AGPAIOSFODNN7EXAMPLE',
        'AIDAIOSFODNN7EXAMPLE',
      ]

      for (const key of testCases) {
        const hits = runDetect(`AWS_ACCESS_KEY_ID=${key}`, ['aws', 'access', 'key'])
        const awsHit = hits.find((h) => h.type === 'sec_aws_access_key')
        expect(awsHit).toBeTruthy()
        expect(awsHit?.value).toBe(key)
        expect(awsHit?.risk).toBe('high')

        // Test masking
        if (awsHit) {
          const masked = maskers.sec_aws_access_key(awsHit)
          expect(masked).toMatch(/^(AKIA|ASIA|AGPA|AIDA)\*+/)
        }
      }
    })
  })

  describe('Google/Firebase API Keys', () => {
    it('should detect Google API keys', () => {
      const key = 'AIzaSyDdI0hCZtE6vySjMm-WEfRq3CPzqKqqsHI'
      const hits = runDetect(`GOOGLE_API_KEY=${key}`, ['google', 'api', 'key'])
      const googleHit = hits.find((h) => h.type === 'sec_google_api_key')
      expect(googleHit).toBeTruthy()
      expect(googleHit?.value).toBe(key)

      // Test masking
      if (googleHit) {
        const masked = maskers.sec_google_api_key(googleHit)
        expect(masked).toMatch(/^AIza\*+/)
      }
    })
  })

  describe('Stripe API Keys', () => {
    it('should detect Stripe API keys', () => {
      const testCases = [
        'sk_live_51H2oKvB3K4y1234567890abcdef',
        'pk_live_51H2oKvB3K4y1234567890abcdef',
        'sk_test_51H2oKvB3K4y1234567890abcdef',
        'pk_test_51H2oKvB3K4y1234567890abcdef',
      ]

      for (const key of testCases) {
        const hits = runDetect(`STRIPE_KEY=${key}`, ['stripe', 'payment'])
        const stripeHit = hits.find((h) => h.type === 'sec_stripe_api_key')
        expect(stripeHit).toBeTruthy()
        expect(stripeHit?.value).toBe(key)

        // Test masking
        if (stripeHit) {
          const masked = maskers.sec_stripe_api_key(stripeHit)
          expect(masked).toMatch(/^(sk|pk)_(live|test)_\*+/)
        }
      }
    })
  })

  describe('Slack Tokens', () => {
    it('should detect Slack bot tokens', () => {
      const testCases = [
        'xoxb-1234567890-1234567890-abcdefghijklmnopqrstuvwx',
        'xoxp-1234567890-1234567890-abcdefghijklmnopqrstuvwx',
        'xapp-1-A1234567890-1234567890-abcdefghijklmnopqrstuvwx',
      ]

      for (const token of testCases) {
        const hits = runDetect(`SLACK_TOKEN=${token}`, ['slack', 'bot'])
        const slackHit = hits.find((h) => h.type === 'sec_slack_token')
        expect(slackHit).toBeTruthy()
        expect(slackHit?.value).toBe(token)

        // Test masking
        if (slackHit) {
          const masked = maskers.sec_slack_token(slackHit)
          expect(masked).toMatch(/^xox[abps]-.*\*+|^xapp-\*+/)
        }
      }
    })
  })

  describe('SendGrid API Keys', () => {
    it('should detect SendGrid API keys', () => {
      const key = 'SG.1234567890abcdef.1234567890abcdef1234567890abcdef'
      const hits = runDetect(`SENDGRID_API_KEY=${key}`, ['sendgrid', 'email'])
      const sendgridHit = hits.find((h) => h.type === 'sec_sendgrid_api_key')
      expect(sendgridHit).toBeTruthy()
      expect(sendgridHit?.value).toBe(key)

      // Test masking
      if (sendgridHit) {
        const masked = maskers.sec_sendgrid_api_key(sendgridHit)
        expect(masked).toMatch(/^SG\.\*+\.\*+/)
      }
    })
  })

  describe('OpenAI API Keys', () => {
    it('should detect OpenAI API keys', () => {
      const testCases = [
        'sk-1234567890abcdef1234567890abcdef1234567890abcdef',
        'sk-proj-1234567890abcdef1234567890abcdef1234567890',
      ]

      for (const key of testCases) {
        const hits = runDetect(`OPENAI_API_KEY=${key}`, ['openai', 'gpt'])
        const openaiHit = hits.find((h) => h.type === 'sec_openai_api_key')
        expect(openaiHit).toBeTruthy()
        expect(openaiHit?.value).toBe(key)

        // Test masking
        if (openaiHit) {
          const masked = maskers.sec_openai_api_key(openaiHit)
          expect(masked).toMatch(/^sk-(?:proj-)?\*+/)
        }
      }
    })
  })

  describe('Google OAuth Tokens', () => {
    it('should detect Google OAuth tokens', () => {
      const testCases = [
        'ya29.1234567890abcdef1234567890abcdef1234567890',
        '1//1234567890abcdef1234567890abcdef1234567890',
      ]

      for (const token of testCases) {
        const hits = runDetect(`access_token=${token}`, ['oauth', 'access'])
        const oauthHit = hits.find((h) => h.type === 'sec_google_oauth_token')
        expect(oauthHit).toBeTruthy()
        expect(oauthHit?.value).toBe(token)

        // Test masking
        if (oauthHit) {
          const masked = maskers.sec_google_oauth_token(oauthHit)
          expect(masked).toMatch(/^(ya29\.|1\/\/)\*+/)
        }
      }
    })
  })

  describe('Azure Subscription Keys', () => {
    it('should detect Azure subscription keys', () => {
      const key = '1234567890abcdef1234567890abcdef12345678'
      const hits = runDetect(`Ocp-Apim-Subscription-Key: ${key}`, ['azure', 'subscription'])
      const azureHit = hits.find((h) => h.type === 'sec_azure_subscription_key')
      expect(azureHit).toBeTruthy()
      expect(azureHit?.value).toBe(key)

      // Test masking
      if (azureHit) {
        const masked = maskers.sec_azure_subscription_key(azureHit)
        expect(masked).toContain('****')
      }
    })
  })

  describe('Performance impact', () => {
    it('should maintain reasonable performance with enhanced patterns', () => {
      const largeText = `
        API Keys and Tokens:
        - GitHub: ghp_1234567890abcdef1234567890abcdef123456
        - AWS: AKIAIOSFODNN7EXAMPLE
        - Google: AIzaSyDdI0hCZtE6vySjMm-WEfRq3CPzqKqqsHI
        - Stripe: sk_live_51H2oKvB3K4y1234567890abcdef
        - Slack: xoxb-1234567890-1234567890-abcdefghijklmnopqrstuvwx
        - SendGrid: SG.1234567890abcdef.1234567890abcdef1234567890abcdef
        - OpenAI: sk-proj-1234567890abcdef1234567890abcdef1234567890
      `.repeat(10)

      const start = performance.now()
      const hits = runDetect(largeText, [
        'github',
        'aws',
        'google',
        'stripe',
        'slack',
        'sendgrid',
        'openai',
      ])
      const elapsed = performance.now() - start

      // Should complete within reasonable time (< 50ms for this test)
      expect(elapsed).toBeLessThan(50)

      // Should detect multiple token types
      expect(hits.some((h) => h.type === 'sec_github_token')).toBeTruthy()
      expect(hits.some((h) => h.type === 'sec_aws_access_key')).toBeTruthy()
      expect(hits.some((h) => h.type === 'sec_google_api_key')).toBeTruthy()
    })
  })
})
