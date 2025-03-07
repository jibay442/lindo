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
        // Create a browser view for authentication if it doesn't exist
        if (!this._authBrowserView) {
          this._authBrowserView = new BrowserView({
            webPreferences: {
              partition: 'persist:auth_' + this._index,
              backgroundThrottling: false
            }
          })
          
          // Set the bounds to fill the window
          const bounds = this._win.getBounds()
          const contentBounds = this._win.getContentBounds()
          this._win.setBrowserView(this._authBrowserView)
          this._authBrowserView.setBounds({ 
            x: 0, 
            y: 0, 
            width: contentBounds.width, 
            height: contentBounds.height 
          })
          
          // Set Android tablet user agent - use a more specific and complete user agent
          this._authBrowserView.webContents.setUserAgent(
            'Mozilla/5.0 (Linux; Android 10; SM-T510) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/94.0.4606.85 Safari/537.36'
          )
          
          // Enable debugging
          this._authBrowserView.webContents.on('did-finish-load', () => {
            logger.info(`Auth browser loaded: ${this._authBrowserView?.webContents.getURL()}`)
          })
          
          // Log all redirects for debugging
          this._authBrowserView.webContents.on('did-redirect-navigation', (event, url, isInPlace, isMainFrame) => {
            logger.info(`Auth browser redirected to: ${url}`)
          })
          
          // Log all responses for debugging
          this._authBrowserView.webContents.session.webRequest.onCompleted({ urls: ['*://*/*'] }, (details) => {
            logger.info(`Auth request completed: ${details.url}, status: ${details.statusCode}`)
          })
          
          // Set extra headers to make it look more like an Android tablet
          this._authBrowserView.webContents.session.webRequest.onBeforeSendHeaders(
            { urls: ['*://*/*'] },
            (details, callback) => {
              const headers = details.requestHeaders;
              
              // Add Android-specific headers
              headers['X-Requested-With'] = 'com.ankamagames.dofustouch';
              headers['Accept-Language'] = 'en-US,en;q=0.9';
              headers['Accept'] = 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9';
              
              // Remove desktop-specific headers
              delete headers['sec-ch-ua'];
              delete headers['sec-ch-ua-mobile'];
              delete headers['sec-ch-ua-platform'];
              
              callback({ requestHeaders: headers });
            }
          );
          
          // Add a close button to the browser view
          const closeButtonScript = `
            // Create a button element
            const closeButton = document.createElement('button');
            closeButton.style.position = 'fixed';
            closeButton.style.top = '10px';
            closeButton.style.right = '10px';
            closeButton.style.width = '40px';
            closeButton.style.height = '40px';
            closeButton.style.backgroundColor = 'rgba(255, 0, 0, 0.8)';
            closeButton.style.color = 'white';
            closeButton.style.border = 'none';
            closeButton.style.borderRadius = '50%';
            closeButton.style.fontSize = '20px';
            closeButton.style.fontWeight = 'bold';
            closeButton.style.zIndex = '9999999';
            closeButton.style.cursor = 'pointer';
            closeButton.textContent = 'X';
            
            // Add hover effect
            closeButton.onmouseover = function() {
              this.style.backgroundColor = 'rgba(255, 0, 0, 1)';
            };
            closeButton.onmouseout = function() {
              this.style.backgroundColor = 'rgba(255, 0, 0, 0.8)';
            };
            
            // Add click handler
            closeButton.onclick = function() {
              console.log('close-auth-browser-requested');
            };
            
            // Add to document
            document.body.appendChild(closeButton);
          `;
          
          // Inject the close button when the page loads
          this._authBrowserView.webContents.on('dom-ready', () => {
            this._authBrowserView?.webContents.executeJavaScript(closeButtonScript);
          });
          
          // Listen for console messages to detect close button clicks
          this._authBrowserView.webContents.on('console-message', (event, level, message) => {
            if (message.includes('close-auth-browser-requested')) {
              if (this._authBrowserView) {
                this._win.removeBrowserView(this._authBrowserView);
                this._authBrowserView = null;
              }
            }
          });

          // Handle navigation events
          this._authBrowserView.webContents.on('did-navigate', (event, url) => {
            // Check if we've returned to the game URL or a specific success URL
            // This is where you'd detect when authentication is complete
            if (url.includes('game.dofus-touch.com') || url.includes('auth-success')) {
              logger.info(`Authentication successful, navigated to: ${url}`)
              
              // Transfer cookies from the auth browser to the game browser
              this._transferCookies().then(() => {
                // Remove the browser view when authentication is complete
                if (this._authBrowserView) {
                  this._win.removeBrowserView(this._authBrowserView)
                  this._authBrowserView = null
                }
                
                // Reload the game window to apply the new cookies
                this._win.webContents.reload()
              })
            }
          })

          // Handle custom URL schemes (dofustouch://)
          this._authBrowserView.webContents.on('will-navigate', (event, url) => {
            if (url.startsWith('dofustouch://') || 
                url.startsWith('ankama://') || 
                !url.startsWith('http')) {
              // Prevent the default navigation
              event.preventDefault()
              
              // Handle the custom URL scheme here
              logger.info(`Intercepted custom URL scheme: ${url}`)
              
              // Remove the browser view
              if (this._authBrowserView) {
                this._win.removeBrowserView(this._authBrowserView)
                this._authBrowserView = null
              }
              
              // Reload the game window to complete the authentication
              this._win.webContents.reload()
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
      return { action: 'deny' }
    })

    attachTitlebarToWindow(this._win)

    // Listen for window resize events to update the browser view size
    this._win.on('resize', this._updateAuthBrowserViewBounds.bind(this))
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
  
  reload = () => this._win.webContents.reload()

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
            expirationDate: cookie.expirationDate
          }
          
          // Set the cookie in the main window
          await this._win.webContents.session.cookies.set(cookieDetails)
          logger.info(`Transferred cookie: ${cookie.name}`)
        } catch (err) {
          logger.error(`Failed to transfer cookie ${cookie.name}: ${err}`)
        }
      }
      
      return true
    } catch (err) {
      logger.error(`Failed to transfer cookies: ${err}`)
      return false
    }
  }
}
