import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: {
      '@himorishige/noren-core': new URL('../noren-core/src/index.ts', import.meta.url).pathname,
    },
  },
  test: {
    environment: 'node',
    testTimeout: 10000, // Extend timeout for heavy benchmarks
  },
})
