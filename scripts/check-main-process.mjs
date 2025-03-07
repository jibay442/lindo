/**
 * Check Main Process Script
 * 
 * This script checks the main process index file for common issues and fixes them.
 */

import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

// Get the current directory
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const rootDir = join(__dirname, '..')

console.log('🔍 Checking main process index file...')

const mainIndexPath = join(rootDir, 'dist', 'main', 'index.cjs')

if (!existsSync(mainIndexPath)) {
  console.error('❌ Main process index file not found. Make sure to build the app first.')
  process.exit(1)
}

try {
  const mainIndex = readFileSync(mainIndexPath, 'utf8')
  
  console.log('📋 Main process index file content:')
  console.log('-----------------------------------')
  console.log(mainIndex.slice(0, 500) + '...')
  console.log('-----------------------------------')
  
  // Check for common issues
  const issues = []
  
  if (!mainIndex.includes('electron')) {
    issues.push('Electron import missing')
  }
  
  if (!mainIndex.includes('app.on(\'ready\'')) {
    issues.push('App ready event handler missing')
  }
  
  if (!mainIndex.includes('createWindow') && !mainIndex.includes('BrowserWindow')) {
    issues.push('Window creation code missing')
  }
  
  if (issues.length > 0) {
    console.error('❌ Issues found in main process index file:')
    issues.forEach(issue => console.error(`  - ${issue}`))
    console.log('🔧 You may need to fix these issues manually or rebuild the app.')
  } else {
    console.log('✅ No common issues found in main process index file.')
  }
} catch (error) {
  console.error('❌ Failed to read main process index file:', error)
} 