# Task Completion Checklist

## Before Committing Any Changes

### 1. Code Quality Checks
```bash
# Lint and format code
pnpm lint
pnpm format

# Check formatting (no changes)
pnpm format:check

# Full code quality check
pnpm check
```

### 2. Type Safety Validation
```bash
# Type checking for all packages
pnpm typecheck
```

### 3. Testing
```bash
# Run all tests
pnpm test

# For specific package changes, test individually
cd packages/[package-name]
pnpm test
```

### 4. Build Verification
```bash
# Ensure everything builds correctly
pnpm build

# Verify specific package builds
cd packages/[package-name]
pnpm build
```

### 5. Example Verification (if applicable)
```bash
# Test basic functionality
node examples/basic-redact.mjs

# Test specific examples related to changes
node examples/[relevant-example].mjs
```

## For Release Preparation

### 6. Changeset Management
```bash
# Create changeset for changes
pnpm changeset

# Check status
pnpm changeset:status
```

### 7. Documentation Updates
- Update README.md if API changes
- Update package-specific READMEs
- Update examples if new features added
- Update CLAUDE.md if development process changes

## Common Issues to Check

### Performance
- No performance regressions in core detection
- Bundle size doesn't increase unexpectedly
- Memory usage remains optimal

### Compatibility
- Web Standards compliance maintained
- No Node.js-specific APIs introduced
- Edge environment compatibility preserved

### Security
- No secrets or credentials in code
- Input validation for all public APIs
- Proper error handling without information leaks

## Final Verification
1. All tests pass
2. No lint errors
3. No type errors
4. Build succeeds
5. Examples run correctly
6. Documentation updated if needed
7. Changeset created for releases

## Notes
- Never commit with failing tests
- Always run full build before pushing
- Use `pnpm format` to auto-fix style issues
- Check `pnpm changeset:status` before releases