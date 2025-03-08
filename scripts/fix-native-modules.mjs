/**
 * Fix Native Modules Script
 * 
 * This script specifically addresses issues with native Node.js modules on Windows.
 * It rebuilds native modules to ensure they're compatible with the current Electron version.
 */

import { execSync } from 'child_process'
import { writeFileSync, readFileSync, existsSync, readdirSync, unlinkSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

// Get the current directory
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const rootDir = join(__dirname, '..')

console.log('🔧 Fixing native module issues for Windows...')

// 1. Get Electron version
let electronVersion
try {
  const packageJson = JSON.parse(readFileSync(join(rootDir, 'package.json'), 'utf8'))
  electronVersion = packageJson.devDependencies.electron.replace('^', '')
  console.log(`📊 Using Electron version: ${electronVersion}`)
} catch (error) {
  console.error('❌ Failed to read package.json:', error)
  process.exit(1)
}

// 2. Clean node_modules to ensure a fresh rebuild
console.log('🧹 Cleaning node_modules/.cache directory...')
try {
  const cacheDir = join(rootDir, 'node_modules', '.cache')
  if (existsSync(cacheDir)) {
    execSync(`rmdir /s /q "${cacheDir}"`, { stdio: 'inherit' })
  }
  console.log('✅ Cache directory cleaned')
} catch (error) {
  console.error('❌ Failed to clean cache directory:', error)
}

// 3. Remove any existing .node files in the dist directory
console.log('🧹 Removing existing .node files in dist directory...')
try {
  const distDir = join(rootDir, 'dist')
  if (existsSync(distDir)) {
    const removeNodeFiles = (dir) => {
      const entries = readdirSync(dir, { withFileTypes: true })
      for (const entry of entries) {
        const fullPath = join(dir, entry.name)
        if (entry.isDirectory()) {
          removeNodeFiles(fullPath)
        } else if (entry.name.endsWith('.node')) {
          console.log(`Removing: ${fullPath}`)
          unlinkSync(fullPath)
        }
      }
    }
    removeNodeFiles(distDir)
  }
  console.log('✅ Existing .node files removed')
} catch (error) {
  console.error('❌ Failed to remove existing .node files:', error)
}

// 4. Install electron-rebuild if not already installed
console.log('📦 Installing electron-rebuild...')
try {
  execSync('yarn add electron-rebuild --dev', { stdio: 'inherit' })
  console.log('✅ electron-rebuild installed')
} catch (error) {
  console.error('❌ Failed to install electron-rebuild:', error)
}

// 5. Rebuild native modules for the current Electron version
console.log('🔨 Rebuilding native modules for Windows...')
try {
  execSync(`npx electron-rebuild --force --arch=x64 --version=${electronVersion} --module-dir=${rootDir}`, { 
    stdio: 'inherit',
    env: {
      ...process.env,
      npm_config_arch: 'x64',
      npm_config_target_arch: 'x64',
      npm_config_platform: 'win32',
      npm_config_target_platform: 'win32'
    }
  })
  console.log('✅ Native modules rebuilt successfully')
} catch (error) {
  console.error('❌ Failed to rebuild native modules:', error)
}

// 6. Create .npmrc file with correct configuration
console.log('📝 Creating .npmrc file with correct configuration...')
try {
  const npmrcPath = join(rootDir, '.npmrc')
  const npmrcContent = `
# Force rebuilding native modules for electron
runtime = electron
target = ${electronVersion}
target_arch = x64
disturl = https://electronjs.org/headers
build_from_source = true
`
  writeFileSync(npmrcPath, npmrcContent)
  console.log('✅ .npmrc file created')
} catch (error) {
  console.error('❌ Failed to create .npmrc file:', error)
}

// 7. Update electron-builder configuration
console.log('📝 Updating electron-builder configuration...')
try {
  const builderConfigPath = join(rootDir, 'electron-builder-windows.json')
  if (existsSync(builderConfigPath)) {
    const builderConfig = JSON.parse(readFileSync(builderConfigPath, 'utf8'))
    
    // Ensure native modules are rebuilt during build
    builderConfig.npmRebuild = true
    builderConfig.nodeGypRebuild = true
    
    // Add specific configuration for native modules
    if (!builderConfig.extraMetadata) {
      builderConfig.extraMetadata = {}
    }
    
    builderConfig.extraMetadata.build = {
      npmRebuild: true,
      nodeGypRebuild: true
    }
    
    writeFileSync(builderConfigPath, JSON.stringify(builderConfig, null, 2))
    console.log('✅ electron-builder configuration updated')
  } else {
    console.warn('⚠️ electron-builder-windows.json not found, skipping configuration update')
  }
} catch (error) {
  console.error('❌ Failed to update electron-builder configuration:', error)
}

console.log('🎉 Native module fixes applied!')
console.log('🚀 Try rebuilding the app with: yarn build:windows') 