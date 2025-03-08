/**
 * Complete Windows Build Script
 * 
 * This script runs all the necessary steps to build the application for Windows:
 * 1. Fixes native modules
 * 2. Applies Windows-specific fixes
 * 3. Builds the application
 */

import { execSync } from 'child_process'
import { performance } from 'perf_hooks'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

// Get the current directory
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const rootDir = join(__dirname, '..')

console.log('🚀 Starting complete Windows build process...')
const startTime = performance.now()

// Step 1: Fix native modules
console.log('🔧 Step 1: Fixing native modules...')
try {
  execSync('node scripts/fix-native-modules.mjs', { 
    stdio: 'inherit',
    cwd: rootDir
  })
  console.log('✅ Native modules fixed successfully')
} catch (error) {
  console.error('❌ Failed to fix native modules:', error)
  process.exit(1)
}

// Step 2: Apply Windows-specific fixes
console.log('🔧 Step 2: Applying Windows-specific fixes...')
try {
  execSync('node scripts/fix-windows-launch.mjs', { 
    stdio: 'inherit',
    cwd: rootDir
  })
  console.log('✅ Windows-specific fixes applied successfully')
} catch (error) {
  console.error('❌ Failed to apply Windows-specific fixes:', error)
  process.exit(1)
}

// Step 3: Install app dependencies
console.log('📦 Step 3: Installing app dependencies...')
try {
  execSync('electron-builder install-app-deps', { 
    stdio: 'inherit',
    cwd: rootDir
  })
  console.log('✅ App dependencies installed successfully')
} catch (error) {
  console.error('❌ Failed to install app dependencies:', error)
  process.exit(1)
}

// Step 4: Build the application
console.log('📦 Step 4: Building the application...')
try {
  execSync('node scripts/build-windows.mjs', { 
    stdio: 'inherit',
    cwd: rootDir
  })
  console.log('✅ Application built successfully')
} catch (error) {
  console.error('❌ Failed to build the application:', error)
  process.exit(1)
}

const endTime = performance.now()
console.log(`🎉 Complete Windows build process completed in ${((endTime - startTime) / 1000).toFixed(2)}s`)
console.log('📂 The build output is in the release folder') 