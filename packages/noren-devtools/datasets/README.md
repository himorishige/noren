# Detection Rate Evaluation Datasets

This directory contains ground truth datasets for evaluating the detection rates of noren's PII detection capabilities.

## Structure

- `ground-truth/` - Manually curated and validated datasets for accuracy evaluation
  - `core-email.json` - Email detection test cases
  - `core-credit-card.json` - Credit card detection test cases  
  - `security-jwt.json` - JWT token detection test cases
  - `security-api-keys.json` - API key detection test cases

## Dataset Format

Each JSON file contains an array of test cases with the following structure:

```json
{
  "id": "unique-test-case-id",
  "text": "Sample text containing john@example.com as email",
  "annotations": [
    {
      "start": 23,
      "end": 38,
      "type": "email",
      "value": "john@example.com",
      "confidence": 1.0,
      "metadata": {
        "difficulty": "easy",
        "source": "synthetic"
      }
    }
  ],
  "metadata": {
    "language": "en",
    "domain": "text",
    "created_at": 1692000000000
  }
}
```

## Data Sources

- **Synthetic Data**: Generated following RFC standards and real-world patterns
- **Public Examples**: Anonymized examples from documentation and tutorials
- **No Real PII**: All datasets contain only synthetic or dummy data

## Usage

Use with the evaluation framework:

```javascript
import { GroundTruthManager, EvaluationEngine } from '@himorishige/noren-devtools'

const gtManager = new GroundTruthManager()
gtManager.loadFromFile('./ground-truth/core-email.json')

const engine = new EvaluationEngine(gtManager)
const results = await engine.evaluate(registry)
```

## Contributing

When adding new test cases:

1. Ensure no real PII is included
2. Follow the annotation format strictly
3. Include diverse difficulty levels
4. Add appropriate metadata for analysis