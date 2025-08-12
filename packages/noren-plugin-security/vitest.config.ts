import path from 'node:path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['test/**/*.test.ts'],
    exclude: ['**/node_modules/**', '**/dist/**', '**/dist-test/**'],
    timeout: 10000,
    poolOptions: {
      threads: {
        singleThread: true,
      },
    },
    coverage: {
      enabled: true,
      provider: 'v8',
    },
  },
  resolve: {
    alias: {
      '@himorishige/noren-plugin-security': path.resolve(__dirname, 'src/index.ts'),
    },
  },
})
