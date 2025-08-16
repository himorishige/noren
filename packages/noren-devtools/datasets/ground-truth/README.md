# Ground Truth Test Datasets

⚠️ **IMPORTANT: ALL DATA IN THESE FILES IS SYNTHETIC/DUMMY DATA** ⚠️

This directory contains test datasets used for evaluating noren's PII detection accuracy. **All data is artificially generated for testing purposes only and does not represent real personal information, API keys, or credentials.**

## Data Categories

- **core-email.json** - Synthetic email addresses following RFC standards
- **core-credit-card.json** - Test credit card numbers using Luhn-valid dummy sequences
- **security-jwt.json** - Mock JWT tokens with fake payloads and signatures
- **security-api-keys.json** - Dummy API key patterns for major providers
- **security-auth-headers.json** - Test authentication headers with synthetic tokens
- **security-cookies.json** - Mock session IDs and cookie values
- **security-url-tokens.json** - Dummy URL parameters and tokens
- **security-misc-tokens.json** - Various synthetic token formats

## Security Notice

🔒 **No Real Credentials**: These datasets contain NO real:
- Personal email addresses
- Valid credit card numbers
- Working API keys or tokens
- Actual authentication credentials
- Real session identifiers

## Purpose

These datasets are used by `examples/evaluate-detection.mjs` to:
1. Measure detection accuracy (precision/recall/F1)
2. Validate PII detection patterns
3. Generate evaluation reports in `docs/evaluation/`

## Usage

```bash
# Run evaluation using these datasets
node examples/evaluate-detection.mjs
```

For more information, see the [Detection Rate Documentation](../../../docs/DETECTION_RATES.md).