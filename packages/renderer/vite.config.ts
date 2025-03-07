import { join } from 'path'
import { builtinModules } from 'module'
import { defineConfig, Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import optimizer from 'vite-plugin-optimizer'
import resolve, { lib2esm } from 'vite-plugin-resolve'
import pkg from '../../package.json'

/**
 * @see https://vitejs.dev/config/
 */
export default defineConfig({
  mode: process.env.NODE_ENV,
  root: __dirname,
  plugins: [
    react({
      jsxImportSource: '@emotion/react',
      babel: {
        plugins: ['@emotion/babel-plugin']
      }
    }),
    electron(),
    resolve({
      /**
       * Here you can resolve some CommonJs module.
       * Or some Node.js native modules they may not be built correctly by vite.
       * At the same time, these modules should be put in `dependencies`,
       * because they will not be built by vite, but will be packaged into `app.asar` by electron-builder
       */

      // ESM format code snippets
      'electron-store': 'export default require("electron-store");',
      /**
       * Node.js native module
       * Use lib2esm() to easy to convert ESM
       * Equivalent to
       *
       * ```js
       * sqlite3: () => `
       * const _M_ = require('sqlite3');
       * const _D_ = _M_.default || _M_;
       * export { _D_ as default }
       * `
       * ```
       */
      sqlite3: lib2esm('sqlite3', { format: 'cjs' }),
      serialport: lib2esm(
        // CJS lib name
        'serialport',
        // export memebers
        ['SerialPort', 'SerialPortMock'],
        { format: 'cjs' }
      )
    })
  ],
  // cf issue: https://github.com/vitejs/vite/issues/8644
  esbuild: {
    logOverride: { 'this-is-undefined-in-esm': 'silent' }
  },
  base: './',
  build: {
    outDir: '../../dist/renderer',
    emptyOutDir: true,
    sourcemap: true,
    // Increase the chunk size warning limit
    chunkSizeWarningLimit: 1000, // 1000 KiB
    // Optimize build performance
    minify: 'terser',
    terserOptions: {
      compress: {
        // Remove console.log in production
        drop_console: process.env.NODE_ENV === 'production',
        // Remove debugger statements in production
        drop_debugger: process.env.NODE_ENV === 'production'
      }
    },
    // Configure manual chunking for better code splitting
    rollupOptions: {
      output: {
        manualChunks: {
          // Split React and related libraries into a separate chunk
          'react-vendor': [
            'react',
            'react-dom',
            'react-router-dom',
            '@emotion/react',
            '@emotion/styled'
          ],
          // Split Material UI into a separate chunk
          'mui-vendor': [
            '@mui/material',
            '@mui/icons-material',
            '@mui/x-date-pickers'
          ],
          // Split MobX into a separate chunk
          'mobx-vendor': [
            'mobx',
            'mobx-react-lite',
            'mobx-state-tree'
          ],
          // Split other large dependencies
          'utils-vendor': [
            'eventemitter3',
            'rxjs',
            'uuid',
            'axios',
            'crypto-js'
          ]
        }
      }
    },
    // Enable build caching for faster rebuilds
    commonjsOptions: {
      transformMixedEsModules: true
    }
  },
  resolve: {
    alias: {
      '@lindo/shared': join(__dirname, '../../packages/shared'),
      '@lindo/i18n': join(__dirname, '../../packages/i18n'),
      '@': join(__dirname, 'src')
    }
  },
  server: {
    host: pkg.env.VITE_DEV_SERVER_HOST,
    port: pkg.env.VITE_DEV_SERVER_PORT
  }
})

/**
 * For usage of Electron and NodeJS APIs in the Renderer process
 * @see https://github.com/caoxiemeihao/electron-vue-vite/issues/52
 */
export function electron(entries: Parameters<typeof optimizer>[0] = {}): Plugin {
  // Filter out problematic modules like 'node:test' that cause issues with vite-plugin-optimizer
  const builtins = builtinModules.filter((t) => !t.startsWith('_') && t !== 'test' && !t.includes(':'))

  /**
   * @see https://github.com/caoxiemeihao/vite-plugins/tree/main/packages/resolve#readme
   */
  return optimizer({
    electron: electronExport(),
    ...builtinModulesExport(builtins),
    ...entries
  })

  function electronExport() {
    return `
/**
 * For all exported modules see https://www.electronjs.org/docs/latest/api/clipboard -> Renderer Process Modules
 */
const electron = require("electron");
const {
  clipboard,
  nativeImage,
  shell,
  contextBridge,
  crashReporter,
  ipcRenderer,
  webFrame,
  desktopCapturer,
  deprecate,
} = electron;

export {
  electron as default,
  clipboard,
  nativeImage,
  shell,
  contextBridge,
  crashReporter,
  ipcRenderer,
  webFrame,
  desktopCapturer,
  deprecate,
}
`
  }

  function builtinModulesExport(modules: string[]) {
    return modules
      .map((moduleId) => {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const nodeModule = require(moduleId)
        const requireModule = `const M = require("${moduleId}");`
        const exportDefault = 'export default M;'
        const exportMembers =
          Object.keys(nodeModule)
            .map((attr) => `export const ${attr} = M.${attr}`)
            .join(';\n') + ';'
        const nodeModuleCode = `
${requireModule}

${exportDefault}

${exportMembers}
`

        return { [moduleId]: nodeModuleCode }
      })
      .reduce((memo, item) => Object.assign(memo, item), {})
  }
}
