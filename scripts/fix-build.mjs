/**
 * Fix Build Script
 * 
 * This script fixes the build process by ensuring the correct version of Terser is installed
 * and updates the build configuration to work with the installed version.
 */

import { execSync } from 'child_process'
import { writeFileSync, readFileSync } from 'fs'
import { join } from 'path'
import { fileURLToPath } from 'url'
import { dirname } from 'path'

// Get the current directory
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

console.log('🔧 Fixing build configuration...')

// Install the correct version of Terser
console.log('📦 Installing compatible version of Terser...')
try {
  execSync('yarn add terser@5.16.0 --dev', { stdio: 'inherit' })
  console.log('✅ Terser installed successfully')
} catch (error) {
  console.error('❌ Failed to install Terser:', error)
  process.exit(1)
}

// Update the build script
console.log('📝 Updating build script...')
const buildScriptPath = join(__dirname, 'build.mjs')
const buildScript = `
import { build } from 'vite'
import { performance } from 'perf_hooks'

console.log('🚀 Starting build...')
const startTime = performance.now()

// Build main process
console.log('📦 Building main process...')
const mainStartTime = performance.now()
await build({ configFile: 'packages/main/vite.config.ts' })
const mainEndTime = performance.now()
console.log(\`✅ Built main process in \${((mainEndTime - mainStartTime) / 1000).toFixed(2)}s\`)

// Build preload process
console.log('📦 Building preload process...')
const preloadStartTime = performance.now()
await build({ 
  configFile: 'packages/preload/vite.config.ts',
  build: {
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: process.env.NODE_ENV === 'production',
        drop_debugger: process.env.NODE_ENV === 'production'
      }
    }
  }
})
const preloadEndTime = performance.now()
console.log(\`✅ Built preload process in \${((preloadEndTime - preloadStartTime) / 1000).toFixed(2)}s\`)

// Build renderer process
console.log('📦 Building renderer process...')
const rendererStartTime = performance.now()
await build({ configFile: 'packages/renderer/vite.config.ts' })
const rendererEndTime = performance.now()
console.log(\`✅ Built renderer process in \${((rendererEndTime - rendererStartTime) / 1000).toFixed(2)}s\`)

const endTime = performance.now()
console.log(\`🎉 Build completed in \${((endTime - startTime) / 1000).toFixed(2)}s\`)
`

writeFileSync(buildScriptPath, buildScript)
console.log('✅ Build script updated successfully')

// Update the preload Vite config
console.log('📝 Updating preload Vite config...')
const preloadConfigPath = join(__dirname, '..', 'packages', 'preload', 'vite.config.ts')
const preloadConfig = `import { join } from 'path'
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
`

writeFileSync(preloadConfigPath, preloadConfig)
console.log('✅ Preload Vite config updated successfully')

console.log('🎉 Build configuration fixed successfully!')
console.log('🚀 You can now run the build with: yarn build') 