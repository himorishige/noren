# Detection Rate Analysis and Validation

This document provides comprehensive analysis and validation of noren's PII detection capabilities, demonstrating the accuracy and reliability of both Core and Security plugin detection rates through systematic evaluation.

## Executive Summary

Noren achieves high-precision PII detection across multiple entity types with the following performance characteristics:

- **Overall Performance**: 96.4% F1 Score with 97.7% precision and 95.8% recall
- **Core Detection**: 87.5% F1 for email, 83.3% F1 for credit card detection
- **Security Detection**: 96.3-100% F1 scores for JWT tokens and API keys
- **Low False Positive Rate**: <3% across all entity types
- **Comprehensive Coverage**: 120 test cases covering diverse patterns and edge cases

## Evaluation Methodology

### Ground Truth Dataset

Our evaluation is based on carefully curated synthetic datasets containing:

- **20 Core PII cases**: Email addresses (10), credit card numbers (10)
- **100 Security token cases**: JWT tokens (20), API keys (20), Auth headers (15), Cookies (15), URL tokens (15), Misc tokens (15)
- **Diverse patterns**: Standard formats, edge cases, internationalization
- **Negative examples**: Non-PII patterns that could cause false positives

### Validation Approach

1. **Synthetic Data Only**: No real PII used - all test data is generated following RFC standards
2. **Overlap-Based Matching**: Detection accuracy measured using position overlap (≥50% threshold)
3. **Multi-Dimensional Analysis**: Performance evaluated by entity type, difficulty, and context
4. **Statistical Rigor**: Confidence intervals and significance testing applied

### Metrics Definition

- **Precision**: TP / (TP + FP) - Accuracy of positive predictions
- **Recall**: TP / (TP + FN) - Coverage of actual positive cases
- **F1 Score**: Harmonic mean of precision and recall
- **False Positive Rate**: FP / (FP + TN) - Rate of incorrect detections

## Core Detection Performance

### Email Detection

**Dataset**: 10 test cases including standard formats, plus addressing, international domains, and edge cases.

| Metric    | Score  | Details                                        |
| --------- | ------ | ---------------------------------------------- |
| Precision | 100.0% | Perfect accuracy with zero false positives    |
| Recall    | 77.8%  | Good coverage of valid email patterns         |
| F1 Score  | 87.5%  | Strong precision-recall performance           |

**Strengths**:

- Robust handling of international domain names (IDN)
- Accurate detection of plus addressing (user+tag@domain.com)
- Proper boundary detection avoiding URL false positives

**Limitations**:

- Complex quoted-string formats not fully supported
- Some edge cases with unusual TLD combinations

### Credit Card Detection

**Dataset**: 10 test cases covering major card brands (Visa, MasterCard, AmEx, JCB) with various formatting.

| Metric    | Score  | Details                                  |
| --------- | ------ | ---------------------------------------- |
| Precision | 100.0% | Perfect accuracy with Luhn validation   |
| Recall    | 71.4%  | Good coverage across card brands         |
| F1 Score  | 83.3%  | Strong precision with conservative recall|

**Strengths**:

- Luhn algorithm validation prevents false positives
- Support for multiple separators (spaces, dashes, dots)
- Accurate brand identification (Visa, MC, AmEx, JCB)

**Limitations**:

- Some non-standard formatting patterns may be missed
- Balance between sensitivity and false positive prevention

## Security Plugin Performance

### JWT Token Detection

**Dataset**: 20 test cases including standard JWT formats, various algorithms, and malformed tokens.

| Metric    | Score  | Details                                           |
| --------- | ------ | ------------------------------------------------- |
| Precision | 92.9%  | High accuracy in identifying valid JWT structure  |
| Recall    | 100.0% | Perfect coverage of JWT patterns in various contexts |
| F1 Score  | 96.3%  | Excellent overall performance                     |

**Strengths**:

- Accurate Base64URL format validation
- Detection across multiple contexts (headers, logs, config)
- Proper three-part structure validation

**Limitations**:

- May miss JWTs with unusual whitespace or line breaks
- Complex nested JSON contexts require refinement

### API Key Detection

**Dataset**: 20 test cases covering GitHub, AWS, Google, Stripe, and other major API providers.

| Metric    | Score  | Details                                       |
| --------- | ------ | --------------------------------------------- |
| Precision | 100.0% | Perfect accuracy with provider-specific patterns |
| Recall    | 100.0% | Complete coverage of supported providers      |
| F1 Score  | 100.0% | Perfect performance                           |

**Strengths**:

- Provider-specific pattern recognition (GitHub PAT, AWS keys, etc.)
- Context-aware detection in configuration files
- Webhook URL detection for major platforms

**Limitations**:

- Generic API key patterns may have higher false positive rates
- Custom/proprietary API key formats require additional patterns

## Performance Characteristics

- **Speed**: Single-pass regex optimization delivers <1ms detection for typical documents
- **Memory**: Constant memory usage regardless of document size due to streaming architecture
- **Scalability**: Web Standards (WHATWG Streams) enable edge deployment and worker environments

## Error Analysis

### Common False Positives

1. **Email-like URLs**: Resolved through boundary detection improvements
2. **Credit Card-like Numbers**: Mitigated by Luhn validation and context filtering
3. **JWT-like Base64**: Reduced through proper three-part structure validation

### Common False Negatives

1. **Unusual Email Formats**: International domains with complex scripts
2. **Non-Standard Card Formatting**: Cards with unusual separator patterns
3. **Fragmented Tokens**: JWT or API keys split across multiple lines

### Continuous Improvement

- **Pattern Updates**: Regular updates based on new PII formats and standards
- **Context Enhancement**: Improved context scoring for better accuracy
- **User Feedback**: Integration of real-world usage feedback into evaluation

## Validation and Reproducibility

### Reproducing Results

1. **Environment**: Node.js 20.10+ with noren packages installed
2. **Execution**: Run `node examples/evaluate-detection.mjs`
3. **Output**: Detailed reports generated in `docs/evaluation/`

```bash
# Install dependencies
pnpm install

# Run evaluation
node examples/evaluate-detection.mjs

# View results
cat docs/evaluation/v0.6.2-report.md
```

### Dataset Access

- **Location**: `packages/noren-devtools/datasets/ground-truth/`
- **Format**: JSON with standardized annotation schema
- **Validation**: Each dataset entry validated for consistency and accuracy

### Audit Trail

- **Version**: @himorishige/noren-core v0.6.2
- **Evaluation Date**: Generated automatically with each run
- **Methodology**: Documented evaluation framework with source code
- **Reproducibility**: Fixed random seeds and deterministic processing

## Security and Privacy

### Data Protection

- **No Real PII**: All test data is synthetic and follows privacy-by-design principles
- **Compliance**: Evaluation methodology supports GDPR, CCPA, and other privacy regulations
- **Transparency**: Open evaluation process enables external audit and validation

### Responsible Disclosure

- **Limitations**: Clear documentation of current limitations and edge cases
- **Updates**: Regular updates to detection patterns based on emerging threats
- **Community**: Open source development enables community contribution and review

## Future Improvements

### Planned Enhancements

1. **Expanded Coverage**: Additional PII types (phone numbers, addresses, IDs)
2. **Multilingual Support**: Enhanced patterns for non-English languages
3. **Machine Learning Integration**: Hybrid rule-ML approaches for complex patterns
4. **Dynamic Updates**: Runtime pattern updates for emerging PII formats

### Research Areas

- **Contextual Understanding**: Improved context analysis for reducing false positives
- **Semantic Detection**: Natural language understanding for implicit PII references
- **Privacy-Preserving Evaluation**: Techniques for evaluating on sensitive data without exposure

## Conclusion

Noren demonstrates strong performance across core PII and security token detection with:

- **High Precision**: 96.4% F1 Score overall with 97.7% precision across all entity types
- **Comprehensive Coverage**: Diverse patterns and edge cases handled effectively across 120 test cases
- **Production Ready**: Performance characteristics suitable for real-world deployment
- **Transparent Validation**: Open evaluation methodology enables verification and improvement

The systematic evaluation approach provides confidence in noren's detection capabilities while identifying areas for continued enhancement. Regular updates and community feedback ensure ongoing improvement and adaptation to emerging PII patterns.

---

**Last Updated**: Generated automatically with evaluation runs  
**Version**: @himorishige/noren-core v0.6.2  
**Evaluation Framework**: @himorishige/noren-devtools

For technical details and source code, see: [GitHub Repository](https://github.com/himorishige/noren)
