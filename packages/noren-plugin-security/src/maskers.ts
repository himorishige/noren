import type { Masker } from '@himorishige/noren-core'
import type { SecurityConfig } from './types.js'
import {
  isCookieAllowed,
  logSecurityError,
  parseCookieHeader,
  parseSetCookieHeader,
} from './utils.js'

/**
 * Generic token masking with configurable preserve length
 */
function maskToken(token: string, preserveStart = 4, preserveEnd = 4, minLength = 8): string {
  if (token.length <= minLength) {
    return '*'.repeat(token.length)
  }

  const actualStart = Math.min(preserveStart, Math.floor(token.length / 3))
  const actualEnd = Math.min(preserveEnd, Math.floor(token.length / 3))
  const maskLength = Math.max(1, token.length - actualStart - actualEnd)

  return (
    token.substring(0, actualStart) +
    '*'.repeat(maskLength) +
    token.substring(token.length - actualEnd)
  )
}

/** Mask JWT while preserving structure */
function maskJwtStructure(jwt: string): string {
  const parts = jwt.split('.')
  if (parts.length !== 3) return '[REDACTED:JWT]'

  return parts.map((part) => maskToken(part, 3, 3, 6)).join('.')
}

/** Mask API key while preserving prefix */
function maskApiKey(apiKey: string): string {
  const prefixMatch = apiKey.match(/^([a-z]+_)(.+)$/i)
  if (prefixMatch) {
    const [, prefix, suffix] = prefixMatch
    return prefix + '*'.repeat(Math.max(4, suffix.length))
  }
  return maskToken(apiKey)
}

/** Mask tokens with standard pattern */
function maskStandardToken(token: string): string {
  return maskToken(token)
}

/** Mask session IDs */
function maskSessionId(sessionId: string): string {
  const equalIndex = sessionId.indexOf('=')
  if (equalIndex === -1) return '[REDACTED:SESSION]'

  const name = sessionId.substring(0, equalIndex + 1)
  const value = sessionId.substring(equalIndex + 1)

  return name + maskToken(value, 3, 3, 6)
}

// === NEW ENHANCED MASKING FUNCTIONS ===

/** Mask GitHub tokens while preserving prefix */
function maskGithubToken(token: string): string {
  const match = token.match(/^(gh[opusa]_)(.+)$/)
  if (match) {
    const [, prefix, suffix] = match
    return prefix + '*'.repeat(Math.max(8, suffix.length))
  }
  return '[REDACTED:GITHUB-TOKEN]'
}

/** Mask AWS Access Key while preserving prefix */
function maskAwsAccessKey(key: string): string {
  const match = key.match(/^((?:AKIA|ASIA|AGPA|AIDA|ANPA|AROA|AIPA))(.+)$/)
  if (match) {
    const [, prefix, suffix] = match
    return prefix + '*'.repeat(Math.max(6, suffix.length))
  }
  return '[REDACTED:AWS-ACCESS-KEY]'
}

/** Mask Google API Key while preserving prefix */
function maskGoogleApiKey(key: string): string {
  const match = key.match(/^(AIza)(.+)$/)
  if (match) {
    const [, prefix, suffix] = match
    return prefix + '*'.repeat(Math.max(8, suffix.length))
  }
  return '[REDACTED:GOOGLE-API-KEY]'
}

/** Mask Stripe API Key while preserving prefix and environment */
function maskStripeApiKey(key: string): string {
  const match = key.match(/^((sk|pk)_(live|test)_)(.+)$/)
  if (match) {
    const [, prefix, , , suffix] = match
    return prefix + '*'.repeat(Math.max(8, suffix.length))
  }
  return '[REDACTED:STRIPE-API-KEY]'
}

/** Mask Slack token while preserving prefix */
function maskSlackToken(token: string): string {
  const match = token.match(/^(xox[abps]-\d+-\d+-)(.+)$|^(xapp-)(.+)$/)
  if (match) {
    const prefix = match[1] || match[3]
    const suffix = match[2] || match[4]
    return prefix + '*'.repeat(Math.max(6, suffix.length))
  }
  return '[REDACTED:SLACK-TOKEN]'
}

/** Mask SendGrid API Key while preserving structure */
function maskSendGridApiKey(key: string): string {
  const match = key.match(/^(SG\.)([^.]+)\.(.+)$/)
  if (match) {
    const [, prefix, middle, suffix] = match
    return `${prefix}${'*'.repeat(Math.max(4, middle.length))}.${'*'.repeat(Math.max(4, suffix.length))}`
  }
  return '[REDACTED:SENDGRID-API-KEY]'
}

/** Mask OpenAI API Key while preserving prefix */
function maskOpenAiApiKey(key: string): string {
  const match = key.match(/^(sk-(?:proj-)?)(.+)$/)
  if (match) {
    const [, prefix, suffix] = match
    return prefix + '*'.repeat(Math.max(8, suffix.length))
  }
  return '[REDACTED:OPENAI-API-KEY]'
}

/** Mask Google OAuth tokens while preserving prefix */
function maskGoogleOAuthToken(token: string): string {
  const match = token.match(/^(ya29\.)(.+)$|^(1\/\/)(.+)$/)
  if (match) {
    const prefix = match[1] || match[3]
    const suffix = match[2] || match[4]
    return prefix + '*'.repeat(Math.max(8, suffix.length))
  }
  return '[REDACTED:GOOGLE-OAUTH-TOKEN]'
}

/** Mask Azure subscription key */
function maskAzureSubscriptionKey(key: string): string {
  return maskToken(key, 4, 4, 8)
}

/** Mask Webhook URLs while preserving domain */
function maskWebhookUrl(url: string): string {
  try {
    const urlObj = new URL(url)
    const path = urlObj.pathname
    const pathParts = path.split('/')

    // Mask the sensitive token parts while keeping structure
    if (pathParts.length >= 3) {
      const maskedParts = pathParts.map((part, index) => {
        if (index <= 2 || part.length < 8) return part
        return '*'.repeat(Math.min(12, part.length))
      })
      return `${urlObj.protocol}//${urlObj.host}${maskedParts.join('/')}`
    }
  } catch {
    // Fallback for invalid URLs
  }
  return '[REDACTED:WEBHOOK-URL]'
}

/** Mask signed URLs while preserving base URL */
function maskSignedUrl(url: string): string {
  try {
    const urlObj = new URL(url)
    return `${urlObj.protocol}//${urlObj.host}${urlObj.pathname}?[REDACTED:SIGNED-PARAMS]`
  } catch {
    return '[REDACTED:SIGNED-URL]'
  }
}

/**
 * Generic cookie header masker with error handling
 */
function maskCookieWithErrorHandling(
  headerValue: string,
  config: SecurityConfig | undefined,
  parseFunc: typeof parseCookieHeader | typeof parseSetCookieHeader,
  isSetCookie = false,
): string {
  try {
    if (isSetCookie) {
      const cookie = parseFunc(headerValue) as ReturnType<typeof parseSetCookieHeader>
      if (!cookie) return '[REDACTED:SET-COOKIE]'

      if (isCookieAllowed(cookie.name, config)) return headerValue

      const maskedValue = maskToken(cookie.value, 2, 2, 6)
      return headerValue.replace(/^(Set-Cookie\s*:\s*[^=]+=)([^;]+)(.*)$/i, `$1${maskedValue}$3`)
    } else {
      const cookies = parseFunc(headerValue) as ReturnType<typeof parseCookieHeader>
      const maskedPairs = cookies.map((cookie) =>
        isCookieAllowed(cookie.name, config)
          ? `${cookie.name}=${cookie.value}`
          : `${cookie.name}=${maskToken(cookie.value, 2, 2, 6)}`,
      )
      return `Cookie: ${maskedPairs.join('; ')}`
    }
  } catch (error) {
    const errorObj = error instanceof Error ? error : new Error(String(error))
    logSecurityError(`${isSetCookie ? 'Set-Cookie' : 'Cookie'} masking`, errorObj, headerValue)
    return `[REDACTED:${isSetCookie ? 'SET-COOKIE' : 'COOKIE'}]`
  }
}

/** Mask Cookie header with allowlist consideration */
function maskCookieHeader(cookieHeader: string, config?: SecurityConfig): string {
  return maskCookieWithErrorHandling(cookieHeader, config, parseCookieHeader, false)
}

/** Mask Set-Cookie header with allowlist consideration */
function maskSetCookieHeader(setCookieHeader: string, config?: SecurityConfig): string {
  return maskCookieWithErrorHandling(setCookieHeader, config, parseSetCookieHeader, true)
}

/** Create masker functions with configuration */
export function createSecurityMaskers(config?: SecurityConfig): Record<string, Masker> {
  return {
    // Existing maskers
    sec_jwt_token: (h) => maskJwtStructure(h.value),
    sec_api_key: (h) => maskApiKey(h.value),
    sec_uuid_token: (h) => maskStandardToken(h.value),
    sec_hex_token: (h) => maskStandardToken(h.value),
    sec_session_id: (h) => maskSessionId(h.value),
    sec_auth_header: () => '[REDACTED:AUTH]',
    sec_cookie: (h) => maskCookieHeader(h.value, config),
    sec_set_cookie: (h) => maskSetCookieHeader(h.value, config),
    sec_url_token: () => '[REDACTED:URL-TOKEN]',
    sec_client_secret: () => '[REDACTED:CLIENT-SECRET]',

    // === NEW ENHANCED MASKERS ===
    sec_github_token: (h) => maskGithubToken(h.value),
    sec_aws_access_key: (h) => maskAwsAccessKey(h.value),
    sec_google_api_key: (h) => maskGoogleApiKey(h.value),
    sec_stripe_api_key: (h) => maskStripeApiKey(h.value),
    sec_slack_token: (h) => maskSlackToken(h.value),
    sec_sendgrid_api_key: (h) => maskSendGridApiKey(h.value),
    sec_openai_api_key: (h) => maskOpenAiApiKey(h.value),
    sec_google_oauth_token: (h) => maskGoogleOAuthToken(h.value),
    sec_azure_subscription_key: (h) => maskAzureSubscriptionKey(h.value),
    sec_webhook_url: (h) => maskWebhookUrl(h.value),
    sec_signed_url: (h) => maskSignedUrl(h.value),
  }
}

/** Default security maskers without configuration */
export const maskers: Record<string, Masker> = createSecurityMaskers()
