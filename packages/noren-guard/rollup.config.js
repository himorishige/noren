import json from '@rollup/plugin-json'
import { nodeResolve } from '@rollup/plugin-node-resolve'
import terser from '@rollup/plugin-terser'

export default {
  // Optimized build for noren-guard
  input: 'dist/index.js',
  output: {
    file: 'dist/index.min.js',
    format: 'es',
    sourcemap: false, // No sourcemap for smaller size
    inlineDynamicImports: false, // Don't inline JSON imports for smaller size
  },
  plugins: [
    nodeResolve(),
    json(),
    terser({
      mangle: {
        // More aggressive mangling for size reduction
        reserved: [
          'PromptGuard',
          'MCPGuard',
          'scanPrompt',
          'isPromptSafe',
          'PIIGuard',
          'DictionaryLoader',
        ],
      },
      compress: {
        drop_console: true, // Remove console for production
        drop_debugger: true,
        passes: 3, // More passes for better compression
        pure_funcs: ['console.log', 'console.info', 'console.warn'], // Remove specific console calls
        dead_code: true,
        unused: true,
      },
      format: {
        comments: false, // Remove all comments for smaller size
      },
    }),
  ],
  // Externalize dictionary JSON files for on-demand loading
  external: [/^\.\.\/dictionaries\/.*\.json$/],
}
