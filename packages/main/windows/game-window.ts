import { FollowInstruction, GameTeam, GameTeamWindow, IPCEvents, MultiAccountContext, RootStore } from '@lindo/shared'
import { app, BeforeSendResponse, BrowserWindow, BrowserView, shell } from 'electron'
import { attachTitlebarToWindow } from 'custom-electron-titlebar/main'
import { join } from 'path'
import { EventEmitter } from 'stream'
import TypedEmitter from 'typed-emitter'
import { generateUserArgent } from '../utils'
import { logger } from '../logger'
import { observe } from 'mobx'
import { electronLocalshortcut } from '@hfelix/electron-localshortcut'
import { platform } from 'os'

type GameWindowEvents = {
  close: (event: Event) => void
}
export class GameWindow extends (EventEmitter as new () => TypedEmitter<GameWindowEvents>) {
  private readonly _win: BrowserWindow
  private readonly _store: RootStore
  private readonly _teamWindow?: GameTeamWindow
  private readonly _team?: GameTeam
  private _isMuted = false
  private readonly _index: number
  private readonly _shortcutStoreDisposer: () => void
  private _authBrowserView: BrowserView | null = null

  get id() {
    return this._win.webContents.id!
  }

  get multiAccount(): MultiAccountContext | undefined {
    if (this._teamWindow && this._team) {
      return {
        teamWindowId: this._teamWindow.id,
        teamId: this._team.id
      }
    }
  }

  private constructor({
    index,
    userAgent,
    store,
    team,
    url,
    teamWindow
  }: {
    index: number
    userAgent: string
    store: RootStore
    url: string
    team?: GameTeam
    teamWindow?: GameTeamWindow
  }) {
    super()
    this._index = index
    this._store = store
    this._teamWindow = teamWindow
    this._team = team
    this._win = new BrowserWindow({
      show: false,
      resizable: true,
      frame: platform() !== 'linux',
      title: 'Lindo',
      fullscreenable: true,
      fullscreen: this._store.optionStore.window.fullScreen,
      width: this._store.optionStore.window.resolution.width,
      height: this._store.optionStore.window.resolution.height,
      titleBarStyle: 'hidden',
      webPreferences: {
        preload: join(__dirname, '../preload/index.cjs'),
        backgroundThrottling: false,
        partition: 'persist:' + this._index,
        sandbox: false,
        allowRunningInsecureContent: true,
        webviewTag: true,
        webSecurity: false // require to load dofus files
      }
    })

    // when Referer is send to the ankama server, the request can be blocked
    this._win.webContents.session.webRequest.onBeforeSendHeaders(
      {
        urls: ['https://static.ankama.com/*']
      },
      (details, callback) => {
        const requestHeaders = { ...(details.requestHeaders ?? {}) }
        delete requestHeaders.Referer
        const beforeSendResponse: BeforeSendResponse = { requestHeaders }
        callback(beforeSendResponse)
      }
    )

    // remove sec headers on requests
    this._win.webContents.session.webRequest.onBeforeSendHeaders((details, callback) => {
      const requestHeaders = { ...(details.requestHeaders ?? {}) }
      delete requestHeaders['sec-ch-ua']
      delete requestHeaders['sec-ch-ua-mobile']
      delete requestHeaders['sec-ch-ua-platform']
      delete requestHeaders['Sec-Fetch-Site']
      delete requestHeaders['Sec-Fetch-Mode']
      delete requestHeaders['Sec-Fetch-Dest']
      const beforeSendResponse: BeforeSendResponse = { requestHeaders }
      callback(beforeSendResponse)
    })

    // Show window when page is ready
    this._win.webContents.on('ipc-message', (event, channel) => {
      if (channel === IPCEvents.APP_READY_TO_SHOW) {
        setTimeout(() => {
          this._win.show()
        }, 100)
      }
    })

    this._win.webContents.setUserAgent(userAgent)

    this._win.webContents.setAudioMuted(this._store.optionStore.window.audioMuted)

    this._win.on('close', (event) => {
      logger.debug('GameWindow -> close')
      this._close(event)
    })

    this._win.on('focus', () => {
      if (this._store.optionStore.window.audioMuted || this._isMuted) {
        this._win.webContents.setAudioMuted(true)
        return
      }
      this._win.webContents.setAudioMuted(false)
    })

    this._win.on('blur', () => {
      if (this._store.optionStore.window.audioMuted || this._isMuted) {
        this._win.webContents.setAudioMuted(true)
        return
      }
      if (this._store.optionStore.window.soundOnFocus) {
        this._win.webContents.setAudioMuted(true)
      }
    })

    this._shortcutStoreDisposer = observe(
      this._store.hotkeyStore.window.tabs,
      () => {
        electronLocalshortcut.unregisterAll(this._win)
        this._store.hotkeyStore.window.tabs.forEach((tab, index) => {
          if (tab) {
            electronLocalshortcut.register(this._win, tab, () => {
              this._win.webContents.send(IPCEvents.SELECT_TAB, index)
            })
          }
        })
      },
      true
    )

    if (app.isPackaged) {
      this._win.loadURL(url)
    } else {
      // 🚧 Use ['ENV_NAME'] avoid vite:define plugin

      // eslint-disable-next-line dot-notation
      const url = `http://${process.env['VITE_DEV_SERVER_HOST']}:${process.env['VITE_DEV_SERVER_PORT']}`

      this._win.loadURL(url)
      if (process.env.NODE_ENV === 'development') {
        this._win.webContents.openDevTools({ mode: 'detach' })
      }
    }
    // Make all links open with the browser, not with the application
    this._win.webContents.setWindowOpenHandler(({ url }) => {
      if (url.startsWith('https:')) {
        // If it's an authentication URL, open it in a browser view
        if (url.includes('account.ankama.com') || 
            url.includes('auth.ankama.com') || 
            url.includes('login.ankama.com')) {
          
          logger.info(`Opening auth URL in browser view: ${url}`)
          
          // Create a browser view for authentication if it doesn't exist
          if (!this._authBrowserView) {
            this._authBrowserView = new BrowserView({
              webPreferences: {
                nodeIntegration: false,
                contextIsolation: true,
                sandbox: true,
                webSecurity: true,
                partition: 'auth'
              }
            })
            
            const bounds = this._win.getBounds()
            this._authBrowserView.setBounds({ 
              x: 0, 
              y: 0, 
              width: bounds.width, 
              height: bounds.height 
            })
            
            this._win.setBrowserView(this._authBrowserView)
            
            // Handle window resize
            this._win.on('resize', () => {
              if (this._authBrowserView) {
                const newBounds = this._win.getBounds()
                this._authBrowserView.setBounds({ 
                  x: 0, 
                  y: 0, 
                  width: newBounds.width, 
                  height: newBounds.height 
                })
              }
            })

            // Handle new window events in the auth browser view
            this._authBrowserView.webContents.setWindowOpenHandler(({ url }) => {
              logger.info(`Auth browser attempted to open new window: ${url}`)
              
              // If it's a custom URL scheme, handle it
              if (url.startsWith('dofustouch://') || 
                  url.startsWith('ankama://') || 
                  !url.startsWith('http')) {
                
                // Remove the browser view
                if (this._authBrowserView) {
                  this._win.removeBrowserView(this._authBrowserView)
                  this._authBrowserView = null
                }
                
                // Reload the game window to complete the authentication
                this._win.webContents.reload()
              }
              
              return { action: 'deny' }
            })
          }
          
          // Load the URL in the browser view
          this._authBrowserView.webContents.loadURL(url)
          return { action: 'deny' }
        }
        
        // For other HTTPS URLs, open in external browser
        shell.openExternal(url)
        return { action: 'deny' }
      }
      return { action: 'deny' }
    })

    attachTitlebarToWindow(this._win)
  }

  static async init({
    index,
    store,
    team,
    url,
    teamWindow
  }: {
    index: number
    store: RootStore
    url: string
    team?: GameTeam
    teamWindow?: GameTeamWindow
  }): Promise<GameWindow> {
    const userAgent = await generateUserArgent(store.appStore.appVersion)
    return new GameWindow({ index, url, userAgent, store, team, teamWindow })
  }

  private _close(event: Event) {
    // Clean up the auth browser view if it exists
    if (this._authBrowserView) {
      this._win.removeBrowserView(this._authBrowserView)
      this._authBrowserView = null
    }
    
    this._win.removeAllListeners()
    electronLocalshortcut.unregisterAll(this._win)
    this._shortcutStoreDisposer()
    this.emit('close', event)
  }

  focus = () => this._win.focus()
  isMinimized = () => this._win.isMinimized()
  restore = () => this._win.restore()
  
  reload() {
    logger.info(`Reloading game window ${this._index}`)
    this._win.webContents.reload()
  }

  toggleMaximize() {
    return this._win.isMaximized() ? this._win.unmaximize() : this._win.maximize()
  }

  setAudioMute(value: boolean) {
    this._isMuted = value
    this._win.webContents.setAudioMuted(value)
  }

  sendAutoGroupInstruction(instruction: FollowInstruction) {
    this._win.webContents.send(IPCEvents.AUTO_GROUP_PUSH_PATH, instruction)
  }

  clearCache() {
    return this._win.webContents.session.clearCache()
  }

  // Method to update the browser view bounds when the window is resized
  private _updateAuthBrowserViewBounds() {
    if (this._authBrowserView) {
      const contentBounds = this._win.getContentBounds()
      this._authBrowserView.setBounds({
        x: 0,
        y: 0,
        width: contentBounds.width,
        height: contentBounds.height
      })
    }
  }

  // Add a new method to transfer cookies
  private async _transferCookies() {
    if (!this._authBrowserView) return
    
    try {
      // Get all cookies from the auth browser
      const cookies = await this._authBrowserView.webContents.session.cookies.get({})
      logger.info(`Transferring ${cookies.length} cookies from auth browser to game browser`)
      
      // Set each cookie in the game browser
      for (const cookie of cookies) {
        try {
          // Format the cookie for setting in the main window
          const cookieDetails = {
            url: cookie.secure ? 'https://' + cookie.domain : 'http://' + cookie.domain,
            name: cookie.name,
            value: cookie.value,
            domain: cookie.domain,
            path: cookie.path,
            secure: cookie.secure,
            httpOnly: cookie.httpOnly,
            expirationDate: cookie.expirationDate,
            sameSite: cookie.sameSite
          }
          
          // Set the cookie in the main window
          await this._win.webContents.session.cookies.set(cookieDetails)
          logger.info(`Transferred cookie: ${cookie.name}`)
        } catch (err) {
          logger.error(`Failed to transfer cookie ${cookie.name}: ${err}`)
        }
      }
      
      // Also transfer localStorage data
      if (this._authBrowserView.webContents && this._win.webContents) {
        try {
          // Get localStorage data from auth browser
          const localStorageData = await this._authBrowserView.webContents.executeJavaScript(`
            Object.keys(localStorage).reduce((result, key) => {
              result[key] = localStorage.getItem(key);
              return result;
            }, {});
          `);
          
          // Set localStorage data in game browser
          if (localStorageData && Object.keys(localStorageData).length > 0) {
            logger.info(`Transferring ${Object.keys(localStorageData).length} localStorage items`);
            
            const setLocalStorageScript = `
              const data = ${JSON.stringify(localStorageData)};
              Object.keys(data).forEach(key => {
                try {
                  localStorage.setItem(key, data[key]);
                  console.log('Set localStorage item: ' + key);
                } catch (e) {
                  console.error('Failed to set localStorage item: ' + key, e);
                }
              });
            `;
            
            await this._win.webContents.executeJavaScript(setLocalStorageScript);
          }
        } catch (err) {
          logger.error(`Failed to transfer localStorage data: ${err}`);
        }
      }
      
      return true
    } catch (err) {
      logger.error(`Failed to transfer cookies: ${err}`)
      return false
    }
  }
}
