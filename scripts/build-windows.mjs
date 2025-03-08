/**
 * Windows-specific Build Script
 * 
 * This script builds the application specifically for Windows.
 */

import { build } from 'vite'
import { performance } from 'perf_hooks'
import { execSync } from 'child_process'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

// Get the current directory
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const rootDir = join(__dirname, '..')

console.log('🚀 Starting Windows-specific build...')
const startTime = performance.now()

// Build main process
console.log('📦 Building main process...')
const mainStartTime = performance.now()
await build({ configFile: 'packages/main/vite.config.ts' })
const mainEndTime = performance.now()
console.log(`✅ Built main process in ${((mainEndTime - mainStartTime) / 1000).toFixed(2)}s`)

// Build preload process
console.log('📦 Building preload process...')
const preloadStartTime = performance.now()
await build({ 
  configFile: 'packages/preload/vite.config.ts',
  build: {
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: false,
        drop_debugger: false
      }
    }
  }
})
const preloadEndTime = performance.now()
console.log(`✅ Built preload process in ${((preloadEndTime - preloadStartTime) / 1000).toFixed(2)}s`)

// Build renderer process
console.log('📦 Building renderer process...')
const rendererStartTime = performance.now()
await build({ configFile: 'packages/renderer/vite.config.ts' })
const rendererEndTime = performance.now()
console.log(`✅ Built renderer process in ${((rendererEndTime - rendererStartTime) / 1000).toFixed(2)}s`)

// Run electron-builder with Windows-specific config
console.log('📦 Running electron-builder with Windows-specific config...')
try {
  // Install app dependencies first
  console.log('📦 Installing app dependencies...')
  execSync('electron-builder install-app-deps', { 
    stdio: 'inherit',
    cwd: rootDir
  })
  
  // Run electron-builder with the correct configuration format
  console.log('📦 Building Windows application...')
  execSync('electron-builder -c electron-builder-windows.json --win --x64 --publish never', { 
    stdio: 'inherit',
    cwd: rootDir
  })
  console.log('✅ Electron-builder completed successfully')
} catch (error) {
  console.error('❌ Electron-builder failed:', error)
  process.exit(1)
}

const endTime = performance.now()
console.log(`🎉 Windows build completed in ${((endTime - startTime) / 1000).toFixed(2)}s`)
console.log('📂 The build output is in the release folder') 