# Noren Code Examples

This directory contains a collection of sample code demonstrating the various features and use cases of the `Noren` library.

## Prerequisites

Before running any of the examples, please install the dependencies and build the project from the root directory.

```sh
# Install dependencies
pnpm i

# Build all packages
pnpm build
```

---

## 1. Basic Masking (`basic-redact.mjs`)

**Overview:**
This example demonstrates the most basic usage of `Noren`. It uses the core library and the JP/US plugins to mask personal information (phone numbers, credit card numbers, etc.) in a text string with default rules.

**How to run:**
```sh
node examples/basic-redact.mjs
```

## 2. HMAC-based Tokenization (`tokenize.mjs`)

**Overview:**
This example shows how to perform "tokenization," which converts PII into a unique, deterministic token string. By using HMAC, the same input value will always be converted to the same token, allowing for data analysis while maintaining anonymity.

**How to run:**
```sh
node examples/tokenize.mjs
```

## 3. Dumping Detected PII (`detect-dump.mjs`)

**Overview:**
Instead of masking the text, this script outputs a detailed list of which parts of the text were identified as what type of PII. This is useful for debugging masking rules and checking detection accuracy.

**How to run:**
```sh
node examples/detect-dump.mjs
```

## 4. Stream Processing (`stream-redact.mjs`)

**Overview:**
This example demonstrates how to process large files efficiently using the WHATWG Streams API. It processes data in chunks without loading the entire file into memory, which reduces memory consumption. It correctly detects PII that spans across chunk boundaries.

**How to run:**
```sh
# Process a sample text file and print the result to standard output
node examples/stream-redact.mjs examples/basic-sample.txt

# Save the result to a file
node examples/stream-redact.mjs examples/basic-sample.txt > redacted-output.txt
```

## 5. Masking Security-related Information (`security-demo.mjs`)

**Overview:**
This example uses the `@himorishige/noren-plugin-security` plugin to mask sensitive technical information such as JWTs, API keys, and cookies in HTTP headers.

**How to run:**
```sh
node examples/security-demo.mjs
```

## 6. Custom Dictionaries and Hot-Reloading (`dictionary-demo.mjs`)

**Overview:**
This example demonstrates how to use `@himorishige/noren-dict-reloader` to load custom detection rules from a "custom dictionary." You can define patterns for project-specific sensitive information, such as employee IDs or product codes. It also showcases the "hot-reloading" feature, which uses ETags to dynamically update dictionaries without restarting the server.

Sample dictionary files are located in `examples/dictionary-files/`.

**How to run:**
```sh
node examples/dictionary-demo.mjs
```

## 7. Web Server Integration (Hono) (`hono-server.mjs`)

**Overview:**
This example shows how to build a working API server using the lightweight web framework `Hono`. It creates a `/redact` endpoint that processes a POST request body as a stream and returns the result with PII redacted.

**Prerequisites:**
You need to install `Hono` packages to run this example.
```sh
pnpm add hono @hono/node-server
```

**How to run:**
1.  First, start the API server with the following command:
    ```sh
    node examples/hono-server.mjs
    # > Listening on http://localhost:8787
    ```
2.  Next, open another terminal and send a request to the server using `curl`.
    ```sh
    curl -sS http://localhost:8787/redact -X POST --data-binary @examples/basic-sample.txt
    ```
