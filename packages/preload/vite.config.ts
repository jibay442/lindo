import { join } from 'path'
import { builtinModules } from 'module'
import { defineConfig } from 'vite'
// import pkg from '../../package.json'

export default defineConfig({
  root: __dirname,
  build: {
    outDir: '../../dist/preload',
    emptyOutDir: true,
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: process.env.NODE_ENV === 'production',
        drop_debugger: process.env.NODE_ENV === 'production'
      }
    },
    // https://github.com/caoxiemeihao/electron-vue-vite/issues/61
    sourcemap: 'inline',
    // Increase the chunk size warning limit
    chunkSizeWarningLimit: 1000, // 1000 KiB
    rollupOptions: {
      input: {
        // multiple entry
        index: join(__dirname, 'index.ts')
      },
      output: {
        format: 'cjs',
        entryFileNames: '[name].cjs',
        manualChunks: {}
      },
      external: [
        'electron',
        ...builtinModules
        // ...Object.keys(pkg.dependencies || {}),
      ]
    },
    // Enable build caching for faster rebuilds
    commonjsOptions: {
      transformMixedEsModules: true
    }
  },
  resolve: {
    alias: {
      '@lindo/shared': join(__dirname, '../../packages/shared')
    }
  }
})
