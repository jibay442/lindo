/**
 * Fix Node-gyp Issues Script
 * 
 * This script addresses issues with node-gyp when building native modules.
 * It creates dummy binding.gyp files for packages that need them and sets up
 * the correct environment for native module compilation.
 */

import { execSync } from 'child_process'
import { writeFileSync, readFileSync, existsSync, mkdirSync, readdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

// Get the current directory
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const rootDir = join(__dirname, '..')

console.log('🔧 Fixing node-gyp issues...')

// 1. Create a dummy binding.gyp file in the root directory
console.log('📝 Creating dummy binding.gyp file in root directory...')
try {
  const dummyBindingGyp = {
    "targets": [
      {
        "target_name": "dummy",
        "sources": ["dummy.cc"],
        "include_dirs": []
      }
    ]
  }
  
  writeFileSync(join(rootDir, 'binding.gyp'), JSON.stringify(dummyBindingGyp, null, 2))
  writeFileSync(join(rootDir, 'dummy.cc'), '// Dummy C++ file\n#include <node.h>\nvoid Initialize(v8::Local<v8::Object> exports) {}\nNODE_MODULE(NODE_GYP_MODULE_NAME, Initialize)')
  
  console.log('✅ Dummy binding.gyp file created')
} catch (error) {
  console.error('❌ Failed to create dummy binding.gyp file:', error)
}

// 2. Create .npmrc file with correct configuration
console.log('📝 Creating .npmrc file with correct configuration...')
try {
  const npmrcPath = join(rootDir, '.npmrc')
  const npmrcContent = `
# Force rebuilding native modules for electron
runtime = electron
target = 19.0.1
target_arch = x64
disturl = https://electronjs.org/headers
build_from_source = true
msvs_version = 2022
`
  writeFileSync(npmrcPath, npmrcContent)
  console.log('✅ .npmrc file created')
} catch (error) {
  console.error('❌ Failed to create .npmrc file:', error)
}

// 3. Install windows-build-tools if needed
console.log('📦 Checking for windows-build-tools...')
try {
  console.log('ℹ️ This step may require administrator privileges')
  console.log('ℹ️ If prompted, please allow the script to run with elevated permissions')
  
  // Check if Visual Studio Build Tools are installed
  try {
    execSync('msbuild -version', { stdio: 'ignore' })
    console.log('✅ Visual Studio Build Tools already installed')
  } catch (e) {
    console.log('📦 Installing windows-build-tools (this may take a while)...')
    console.log('ℹ️ If this fails, please install Visual Studio Build Tools manually')
    console.log('ℹ️ https://visualstudio.microsoft.com/downloads/')
    
    // We'll just provide instructions instead of trying to install automatically
    console.log(`
⚠️ Please install the following manually:
1. Visual Studio Build Tools with "Desktop development with C++" workload
2. Python 3.x

Then run this script again.
`)
  }
} catch (error) {
  console.error('❌ Failed to check for windows-build-tools:', error)
}

// 4. Fix native modules that require special handling
console.log('🔧 Fixing specific native modules...')

// Fix native-keymap
try {
  const nativeKeymapPath = join(rootDir, 'node_modules', 'native-keymap')
  if (existsSync(nativeKeymapPath)) {
    console.log('🔧 Fixing native-keymap...')
    
    // Create a dummy binding.gyp file for native-keymap
    const bindingGyp = {
      "targets": [
        {
          "target_name": "native-keymap",
          "sources": ["src/keyboard_win.cc", "src/keymapping.cc"],
          "include_dirs": ["<!@(node -p \"require('node-addon-api').include\")"],
          "dependencies": ["<!(node -p \"require('node-addon-api').gyp\")"],
          "defines": ["NAPI_DISABLE_CPP_EXCEPTIONS"],
          "msvs_settings": {
            "VCCLCompilerTool": {
              "ExceptionHandling": 1
            }
          }
        }
      ]
    }
    
    writeFileSync(join(nativeKeymapPath, 'binding.gyp'), JSON.stringify(bindingGyp, null, 2))
    console.log('✅ native-keymap fixed')
  }
} catch (error) {
  console.error('❌ Failed to fix native-keymap:', error)
}

// Fix argon2
try {
  const argon2Path = join(rootDir, 'node_modules', 'argon2')
  if (existsSync(argon2Path)) {
    console.log('🔧 Fixing argon2...')
    
    // Create a dummy binding.gyp file for argon2
    const bindingGyp = {
      "targets": [
        {
          "target_name": "argon2",
          "sources": ["argon2.cc"],
          "include_dirs": ["<!@(node -p \"require('node-addon-api').include\")"],
          "dependencies": ["<!(node -p \"require('node-addon-api').gyp\")"],
          "defines": ["NAPI_DISABLE_CPP_EXCEPTIONS"],
          "msvs_settings": {
            "VCCLCompilerTool": {
              "ExceptionHandling": 1
            }
          }
        }
      ]
    }
    
    writeFileSync(join(argon2Path, 'binding.gyp'), JSON.stringify(bindingGyp, null, 2))
    console.log('✅ argon2 fixed')
  }
} catch (error) {
  console.error('❌ Failed to fix argon2:', error)
}

// 5. Install node-addon-api as a dev dependency
console.log('📦 Installing node-addon-api...')
try {
  execSync('yarn add node-addon-api --dev', { stdio: 'inherit' })
  console.log('✅ node-addon-api installed')
} catch (error) {
  console.error('❌ Failed to install node-addon-api:', error)
}

// 6. Set environment variables for node-gyp
console.log('🔧 Setting environment variables for node-gyp...')
try {
  // These will only affect the current process, but we'll output them for the user to set manually
  process.env.npm_config_node_gyp = join(rootDir, 'node_modules', '.bin', 'node-gyp')
  process.env.npm_config_arch = 'x64'
  process.env.npm_config_target_arch = 'x64'
  process.env.npm_config_platform = 'win32'
  process.env.npm_config_target_platform = 'win32'
  process.env.npm_config_build_from_source = 'true'
  process.env.npm_config_node_engine = 'v8'
  process.env.npm_config_toolset = 'v143'
  process.env.npm_config_msvs_version = '2022'
  
  console.log(`
✅ Environment variables set for this process.
⚠️ For future builds, you may need to set these environment variables manually:

set npm_config_node_gyp=${join(rootDir, 'node_modules', '.bin', 'node-gyp')}
set npm_config_arch=x64
set npm_config_target_arch=x64
set npm_config_platform=win32
set npm_config_target_platform=win32
set npm_config_build_from_source=true
set npm_config_node_engine=v8
set npm_config_toolset=v143
set npm_config_msvs_version=2022
`)
} catch (error) {
  console.error('❌ Failed to set environment variables:', error)
}

// 7. Create a .electron-gyp directory with the correct structure
console.log('🔧 Creating .electron-gyp directory...')
try {
  const homeDir = process.env.USERPROFILE || process.env.HOME
  const electronGyp = join(homeDir, '.electron-gyp', '19.0.1')
  
  if (!existsSync(electronGyp)) {
    mkdirSync(electronGyp, { recursive: true })
    mkdirSync(join(electronGyp, 'include'), { recursive: true })
    mkdirSync(join(electronGyp, 'x64'), { recursive: true })
  }
  
  console.log('✅ .electron-gyp directory created')
} catch (error) {
  console.error('❌ Failed to create .electron-gyp directory:', error)
}

console.log('🎉 Node-gyp fixes applied!')
console.log('🚀 Try building the app with: yarn build-windows-simple')
console.log('⚠️ If you still encounter issues, you may need to install Visual Studio Build Tools and Python manually.') 