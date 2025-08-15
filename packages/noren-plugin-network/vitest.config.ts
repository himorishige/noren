import path from 'node:path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      reportsDirectory: './coverage',
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.d.ts', 'test/**/*'],
    },
  },
  resolve: {
    alias: {
      '@himorishige/noren-core': path.resolve(__dirname, '../noren-core/src/index.ts'),
      '@himorishige/noren-plugin-network': path.resolve(__dirname, 'src/index.ts'),
    },
  },
})
