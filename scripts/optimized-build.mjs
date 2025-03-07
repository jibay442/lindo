/**
 * Optimized build script for Lindo
 * 
 * This script builds the application in parallel for faster builds
 * and includes build caching for even better performance.
 */

import { build } from 'vite'
import { cpus } from 'os'
import { performance } from 'perf_hooks'
import { fileURLToPath } from 'url'
import { dirname, resolve } from 'path'
import fs from 'fs'

// Get the current directory
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Configuration for each package
const packages = [
  { name: 'main', configFile: 'packages/main/vite.config.ts' },
  { name: 'preload', configFile: 'packages/preload/vite.config.ts' },
  { name: 'renderer', configFile: 'packages/renderer/vite.config.ts' }
]

// Create a cache directory if it doesn't exist
const cacheDir = resolve(__dirname, '../node_modules/.vite')
if (!fs.existsSync(cacheDir)) {
  fs.mkdirSync(cacheDir, { recursive: true })
}

// Start the build
console.log('🚀 Starting optimized build...')
const startTime = performance.now()

// Build all packages in parallel
await Promise.all(
  packages.map(async (pkg) => {
    console.log(`📦 Building ${pkg.name}...`)
    const pkgStartTime = performance.now()
    
    try {
      await build({
        configFile: pkg.configFile,
        // Use caching for faster builds
        build: {
          // Use the maximum number of CPUs for parallel processing
          minify: 'terser',
          terserOptions: {
            parallel: Math.max(cpus().length - 1, 1)
          }
        },
        // Enable caching
        cacheDir
      })
      
      const pkgEndTime = performance.now()
      console.log(`✅ Built ${pkg.name} in ${((pkgEndTime - pkgStartTime) / 1000).toFixed(2)}s`)
    } catch (error) {
      console.error(`❌ Error building ${pkg.name}:`, error)
      process.exit(1)
    }
  })
)

const endTime = performance.now()
console.log(`🎉 Build completed in ${((endTime - startTime) / 1000).toFixed(2)}s`) 