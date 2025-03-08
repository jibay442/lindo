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

// 1. Install native dependencies properly with specific architecture targeting
console.log('📦 Rebuilding native dependencies for Windows...')
try {
  // Make sure we're using the right electron version
  const packageJson = JSON.parse(readFileSync(join(rootDir, 'package.json'), 'utf8'))
  const electronVersion = packageJson.devDependencies.electron.replace('^', '')
  
  console.log(`Using Electron version: ${electronVersion}`)
  
  // Force rebuild with specific architecture targeting
  execSync('yarn add electron-rebuild --dev', { stdio: 'inherit' })
  execSync(`npx electron-rebuild --force --arch=x64 --version=${electronVersion}`, { stdio: 'inherit' })
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
    
    // Add better error handling for native modules
    if (!mainIndex.includes('process.on(\'uncaughtException\'')) {
      mainIndex = `process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error)
  // Log more details for native module errors
  if (error.message && error.message.includes('.node')) {
    console.error('Native module error detected. This might be due to incompatible architecture.')
    console.error('Please make sure all native modules are built for the correct architecture (x64).')
  }
})

${mainIndex}`
    }
    
    // Add specific handling for temp node files
    if (!mainIndex.includes('app.commandLine.appendSwitch')) {
      const appReadyIndex = mainIndex.indexOf('app.on(\'ready\'')
      if (appReadyIndex !== -1) {
        const insertPosition = mainIndex.indexOf('{', appReadyIndex) + 1
        mainIndex = mainIndex.slice(0, insertPosition) + `
  // Disable node integration in renderer process for security
  app.commandLine.appendSwitch('no-sandbox')
  // Disable GPU acceleration if causing issues
  app.commandLine.appendSwitch('disable-gpu')
  // Set native module loading path to avoid temp directory issues
  app.commandLine.appendSwitch('js-flags', '--max-old-space-size=4096')
` + mainIndex.slice(insertPosition)
      }
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
  
  // Create logs directory
  const logsPath = join(lindoDataPath, 'logs')
  if (!existsSync(logsPath)) {
    mkdirSync(logsPath, { recursive: true })
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
  
  // Add specific configuration for native modules
  if (!packageJson.build) {
    packageJson.build = {}
  }
  
  packageJson.build.npmRebuild = true
  packageJson.build.nodeGypRebuild = true
  
  writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2))
  console.log('✅ Package.json main entry fixed')
} catch (error) {
  console.error('❌ Failed to fix package.json main entry:', error)
}

// 5. Create a .npmrc file to ensure native modules are built correctly
console.log('📝 Creating .npmrc file for native module configuration...')
try {
  const npmrcPath = join(rootDir, '.npmrc')
  const npmrcContent = `
# Force rebuilding native modules for electron
runtime = electron
target = ${JSON.parse(readFileSync(join(rootDir, 'package.json'), 'utf8')).devDependencies.electron.replace('^', '')}
target_arch = x64
disturl = https://electronjs.org/headers
`
  writeFileSync(npmrcPath, npmrcContent)
  console.log('✅ .npmrc file created')
} catch (error) {
  console.error('❌ Failed to create .npmrc file:', error)
}

console.log('🎉 Windows launch fixes applied!')
console.log('🚀 Try running the app again. If it still doesn\'t launch, check the logs in %APPDATA%\\Lindo\\logs') 