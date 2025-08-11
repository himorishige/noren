# Dictionary Files Example

This directory contains sample dictionary files that demonstrate how to use Noren's custom dictionary feature for domain-specific PII detection.

## File Structure

- **`manifest.json`** - Lists all available dictionaries with their URLs
- **`policy.json`** - Defines redaction rules and behavior for each PII type  
- **`company-dict.json`** - Company-specific patterns (employee IDs, project codes, etc.)
- **`product-dict.json`** - Product-related patterns (SKUs, part numbers, etc.)
- **`financial-dict.json`** - Financial patterns (account numbers, customer IDs, etc.)

## Usage

### 1. Static Dictionary Usage

```js
import { Registry, redactText } from '@himorishige/noren-core';

// Load dictionary files directly
const policy = JSON.parse(fs.readFileSync('./policy.json', 'utf8'));
const companyDict = JSON.parse(fs.readFileSync('./company-dict.json', 'utf8'));

// Create registry with custom detectors
const registry = createRegistryFromDict(policy, [companyDict]);
const result = await redactText(registry, input);
```

### 2. Hot-Reloading Dictionary Usage  

```js
import { PolicyDictReloader } from '@himorishige/noren-dict-reloader';

const reloader = new PolicyDictReloader({
  policyUrl: 'https://your-server.com/policy.json',
  dictManifestUrl: 'https://your-server.com/manifest.json', 
  compile: createRegistryFromDict,
  onSwap: (newRegistry, changes) => {
    console.log('Updated:', changes);
    // Use newRegistry for subsequent operations
  }
});

await reloader.start();
const registry = reloader.getCompiled();
```

## Dictionary Entry Format

Each dictionary contains an `entries` array with the following structure:

```json
{
  "pattern": "EMP\\d{5}",     // Regex pattern to match
  "type": "employee_id",      // PII type identifier  
  "risk": "high",            // Risk level: "low" | "medium" | "high"
  "description": "..."       // Human-readable description
}
```

## Policy Configuration

The policy file defines how each PII type should be handled:

```json
{
  "defaultAction": "mask",
  "rules": {
    "employee_id": { "action": "tokenize" },
    "project_code": { "action": "remove" },
    "product_code": { "action": "mask" }
  }
}
```

### Available Actions

- **`mask`** - Replace with `[REDACTED:TYPE]` or custom masker
- **`remove`** - Remove completely from text
- **`tokenize`** - Replace with HMAC-based token (requires `hmacKey`)
- **`ignore`** - Leave unchanged

## Testing

Run the dictionary demo to see these files in action:

```bash
node examples/dictionary-demo.mjs
```

## Production Notes

1. **Host dictionary files** on a reliable web server with ETag support
2. **Update manifest.json** with actual URLs pointing to your dictionary files
3. **Secure your HMAC key** - use environment variables or secure key management
4. **Test patterns thoroughly** - invalid regex patterns will be ignored with warnings
5. **Monitor performance** - complex patterns can impact detection speed

## Pattern Examples

### Employee IDs
- `EMP\\d{5}` → Matches EMP12345
- `社員番号[：:]?\\s*[A-Z0-9]{6,}` → Matches 社員番号: ABC123

### Financial
- `ACC-\\d{8,12}` → Matches ACC-123456789
- `口座番号[：:]?\\s*\\d{7,8}` → Matches 口座番号: 1234567

### Products
- `PRD-\\d{4}-[A-Z]{2}` → Matches PRD-2024-XY
- `品番[：:]?\\s*[A-Z0-9]{6,10}` → Matches 品番: PART123