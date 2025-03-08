/**
 * Simple Windows Build Script
 * 
 * This script builds the application for Windows using a simplified approach
 * without external configuration files.
 */

import { build } from 'vite'
import { performance } from 'perf_hooks'
import { execSync } from 'child_process'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs'

// Get the current directory
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const rootDir = join(__dirname, '..')

console.log('🚀 Starting simplified Windows build...')
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

// Run electron-builder with direct configuration
console.log('📦 Running electron-builder with direct configuration...')
try {
  // Install app dependencies first
  console.log('📦 Installing app dependencies...')
  execSync('electron-builder install-app-deps', { 
    stdio: 'inherit',
    cwd: rootDir
  })
  
  // Update package.json with build configuration
  console.log('📦 Updating package.json with build configuration...')
  const packageJsonPath = join(rootDir, 'package.json')
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'))
  
  // Backup original package.json
  fs.writeFileSync(`${packageJsonPath}.bak`, JSON.stringify(packageJson, null, 2))
  
  // Add build configuration directly to package.json
  packageJson.build = {
    appId: "com.lindo.app",
    productName: "Lindo",
    copyright: "Copyright © 2022 Zenox, Prixe",
    asar: true,
    directories: {
      output: "release/${version}",
      buildResources: "resources"
    },
    files: [
      "dist",
      "CHANGELOG.md",
      "LICENCE"
    ],
    extraResources: [
      {
        from: "resources/icon.png",
        to: "icon.png"
      }
    ],
    win: {
      icon: "resources/icon.ico",
      target: [
        {
          target: "portable",
          arch: [
            "x64"
          ]
        }
      ],
      extraResources: [
        {
          from: "resources/icon.ico",
          to: "icon.ico"
        }
      ],
      requestedExecutionLevel: "asInvoker",
      artifactName: "${productName}-${version}-${arch}.${ext}"
    },
    portable: {
      artifactName: "${productName}-Portable-${version}-${arch}.${ext}"
    },
    nsis: {
      oneClick: false,
      perMachine: false,
      allowToChangeInstallationDirectory: true,
      deleteAppDataOnUninstall: false,
      artifactName: "${productName}-Setup-${version}-${arch}.${ext}"
    },
    npmRebuild: true,
    nodeGypRebuild: true,
    buildDependenciesFromSource: true,
    publish: null
  }
  
  fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2))
  
  // Run electron-builder with simple command
  console.log('📦 Building Windows application...')
  execSync('electron-builder --win --x64', { 
    stdio: 'inherit',
    cwd: rootDir
  })
  
  // Restore original package.json
  fs.copyFileSync(`${packageJsonPath}.bak`, packageJsonPath)
  fs.unlinkSync(`${packageJsonPath}.bak`)
  
  console.log('✅ Electron-builder completed successfully')
} catch (error) {
  console.error('❌ Electron-builder failed:', error)
  
  // Try to restore package.json if it exists
  try {
    const packageJsonPath = join(rootDir, 'package.json')
    if (fs.existsSync(`${packageJsonPath}.bak`)) {
      fs.copyFileSync(`${packageJsonPath}.bak`, packageJsonPath)
      fs.unlinkSync(`${packageJsonPath}.bak`)
    }
  } catch (restoreError) {
    console.error('Failed to restore package.json:', restoreError)
  }
  
  process.exit(1)
}

const endTime = performance.now()
console.log(`🎉 Windows build completed in ${((endTime - startTime) / 1000).toFixed(2)}s`)
console.log('📂 The build output is in the release folder') 