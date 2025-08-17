# Noren Development Commands

## Installation & Dependencies
```bash
# Install dependencies
pnpm i

# Clean all packages
pnpm clean
```

## Build Commands
```bash
# Build all packages (clean + build:manual)
pnpm build

# Build manually (ordered build for dependencies)
pnpm build:manual

# Build specific package (example for noren-core)
cd packages/noren-core
pnpm build

# Build with minification
pnpm build:min
```

## Testing Commands
```bash
# Run all tests
pnpm test

# Run tests for specific package
cd packages/noren-core
pnpm test

# Watch mode for specific package
cd packages/noren-core
pnpm test:watch

# Coverage for specific package (noren only)
cd packages/noren
pnpm test:coverage
```

## Code Quality Commands
```bash
# Lint with Biome
pnpm lint

# Format code with Biome (auto-fix)
pnpm format

# Check format without changes
pnpm format:check

# Run full check (lint + format)
pnpm check

# Type checking
pnpm typecheck
```

## Development & Examples
```bash
# Run basic PII redaction example
node examples/basic-redact.mjs

# Run tokenization example
node examples/tokenize.mjs

# Run stream processing example
node examples/stream-redact.mjs examples/basic-sample.txt

# Run security plugin example
node examples/security-demo.mjs

# Run custom dictionary example
node examples/dictionary-demo.mjs

# Run web server example (requires hono installation)
node examples/hono-server.mjs

# Run benchmarking (requires noren-devtools)
node examples/benchmark-demo.mjs

# Run evaluation demo (requires noren-devtools)
node examples/evaluation-demo.mjs
```

## Release Management (Changesets)
```bash
# Create a changeset for changes
pnpm changeset

# Check current changeset status
pnpm changeset:status

# Version packages (for maintainers)
pnpm changeset:version

# Publish packages (automated via GitHub Actions)
pnpm changeset:publish
```

## System Commands (Darwin)
```bash
# Common utils available on Darwin
which node pnpm git grep find ls cat pwd

# Git commands
git status
git diff
git log --oneline -10

# File operations
ls -la
find . -name "*.ts" -type f
grep -r "pattern" .
cat filename.txt
```

## Common Workflow
1. Make changes to packages
2. Run `pnpm lint` and `pnpm format` for code quality
3. Run `pnpm typecheck` for type validation
4. Run `pnpm test` for testing
5. Run `pnpm build` to ensure everything builds
6. Create changeset with `pnpm changeset` if publishing
7. Commit changes