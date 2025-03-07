/**
 * Fix Windows Launch Script
 * 
 * This script addresses common issues that prevent the app from launching on Windows.
 */

import { execSync } from 'child_process'
import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

// Get the current directory
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const rootDir = join(__dirname, '..')

console.log('🔧 Fixing Windows launch issues...')

// 1. Install native dependencies properly
console.log('📦 Rebuilding native dependencies for Windows...')
try {
  execSync('yarn add electron-rebuild --dev', { stdio: 'inherit' })
  execSync('npx electron-rebuild', { stdio: 'inherit' })
  console.log('✅ Native dependencies rebuilt successfully')
} catch (error) {
  console.error('❌ Failed to rebuild native dependencies:', error)
}

// 2. Fix main process entry point
console.log('📝 Fixing main process entry point...')
const mainIndexPath = join(rootDir, 'dist', 'main', 'index.cjs')
if (existsSync(mainIndexPath)) {
  try {
    let mainIndex = readFileSync(mainIndexPath, 'utf8')
    
    // Fix path separators for Windows
    mainIndex = mainIndex.replace(/\//g, '\\\\')
    
    // Ensure proper error handling
    if (!mainIndex.includes('process.on(\'uncaughtException\'')) {
      mainIndex = `process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error)
})

${mainIndex}`
    }
    
    writeFileSync(mainIndexPath, mainIndex)
    console.log('✅ Main process entry point fixed')
  } catch (error) {
    console.error('❌ Failed to fix main process entry point:', error)
  }
}

// 3. Ensure proper permissions for app data directory
console.log('📝 Ensuring proper app data directory permissions...')
try {
  const appDataPath = process.env.APPDATA || 
    (process.platform === 'darwin' ? 
      join(process.env.HOME, 'Library', 'Application Support') : 
      join(process.env.HOME, '.config'))
  
  const lindoDataPath = join(appDataPath, 'Lindo')
  
  if (!existsSync(lindoDataPath)) {
    mkdirSync(lindoDataPath, { recursive: true })
  }
  
  console.log('✅ App data directory permissions ensured')
} catch (error) {
  console.error('❌ Failed to ensure app data directory permissions:', error)
}

// 4. Fix package.json main entry
console.log('📝 Fixing package.json main entry...')
try {
  const packageJsonPath = join(rootDir, 'package.json')
  const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'))
  
  // Ensure main entry uses Windows path separators
  packageJson.main = packageJson.main.replace(/\//g, '\\\\')
  
  writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2))
  console.log('✅ Package.json main entry fixed')
} catch (error) {
  console.error('❌ Failed to fix package.json main entry:', error)
}

console.log('🎉 Windows launch fixes applied!')
console.log('🚀 Try running the app again. If it still doesn\'t launch, check the logs in %APPDATA%\\Lindo\\logs') 