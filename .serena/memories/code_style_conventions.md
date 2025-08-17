# Code Style and Conventions

## Biome Configuration
The project uses Biome for linting and formatting (configured in `biome.json`):

### Formatting Rules
- **Line Width**: 100 characters
- **Indent**: 2 spaces (not tabs)
- **Quote Style**: Single quotes (`'`) preferred
- **Semicolons**: As needed (ASI-friendly)

### File Patterns
- Includes: `**/*.ts`, `**/*.js`, `**/*.mjs`, `**/*.tsx`, `**/*.jsx`, `**/*.json`
- Excludes: `**/dist`, `**/dist-test`, `**/coverage`, `**/node_modules`

## TypeScript Configuration
Based on `tsconfig.base.json`:
- **Target**: ES2022
- **Module**: ES2022 with Node resolution
- **Strict**: True (strict typing throughout)
- **Lib**: ES2022, DOM, DOM.Iterable

## Naming Conventions
Based on codebase analysis:

### Files and Exports
- **Source files**: kebab-case (`json-detector.ts`, `mcp-utils.ts`)
- **Type exports**: PascalCase (`DetectUtils`, `JsonHit`)
- **Function exports**: camelCase (`redactText`, `createMCPRedactionTransform`)
- **Constant exports**: SCREAMING_SNAKE_CASE (`PATTERN_TYPES`, `SECURITY_LIMITS`)

### Code Structure
- **ES Modules**: All packages use `"type": "module"`
- **Explicit imports**: Always use `.js` extension in imports (for ESM compatibility)
- **Barrel exports**: Use `index.ts` for clean package exports

## Documentation Style
- **JSDoc**: Used for public APIs and complex functions
- **Comment Style**: 
  - `//` for single-line explanations
  - `/** */` for JSDoc blocks
  - `/* */` for multi-line explanations

## Function and Variable Naming
- **Functions**: Descriptive camelCase (`extractSurroundingText`, `calculateContextScore`)
- **Variables**: camelCase with meaningful names
- **Constants**: SCREAMING_SNAKE_CASE for module-level constants
- **Types**: PascalCase with descriptive names

## Import/Export Patterns
```typescript
// Named imports with explicit file extensions
import { extractSurroundingText } from './context-scoring.js'
import type { DetectUtils } from './types.js'

// Barrel exports from index.ts
export { Registry, redactText } from './core.js'
export type { RegistryConfig } from './types.js'
```

## Error Handling
- Use explicit error types when possible
- Prefer early returns for error conditions
- Validate inputs at function boundaries

## Performance Considerations
- Pre-compile regex patterns at module level
- Use object pooling for frequently created objects
- Minimize allocations in hot paths
- Use `const` for immutable values