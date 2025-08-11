import { nodeResolve } from '@rollup/plugin-node-resolve'
import terser from '@rollup/plugin-terser'

export default [
  // Development build
  {
    input: 'dist/index.js',
    output: {
      file: 'dist/index.min.js',
      format: 'es',
      sourcemap: true,
    },
    plugins: [
      nodeResolve(),
      terser({
        mangle: {
          // Preserve public API names
          reserved: ['Registry', 'redactText', 'normalize'],
        },
        compress: {
          // Aggressive compression for size
          drop_console: false,
          drop_debugger: true,
          passes: 2,
        },
        format: {
          // Preserve comments for licensing
          comments: /^!|license|copyright/i,
        },
      }),
    ],
    external: [], // Bundle everything for single-file distribution
  },

  // Tree-shakeable modules build (individual files)
  {
    input: [
      'dist/index.js',
      'dist/types.js',
      'dist/utils.js',
      'dist/patterns.js',
      'dist/detection.js',
      'dist/masking.js',
      'dist/pool.js',
      'dist/lazy.js',
    ],
    output: {
      dir: 'dist/esm',
      format: 'es',
      preserveModules: true,
      sourcemap: true,
    },
    plugins: [
      terser({
        mangle: false, // Keep names for tree-shaking
        compress: {
          drop_console: false,
          drop_debugger: true,
        },
      }),
    ],
  },
]
