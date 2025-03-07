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
              backgroundThrottling: false,
              // Enable devTools for debugging
              devTools: true
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
          
          // Set Android tablet user agent - use a very specific Dofus Touch mobile user agent with the correct version
          this._authBrowserView.webContents.setUserAgent(
            'Mozilla/5.0 (Linux; Android 11; SM-T510) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/96.0.4664.104 Mobile Safari/537.36 DofusTouch/3.7.1'
          )
          
          // Enable debugging
          this._authBrowserView.webContents.on('did-finish-load', () => {
            logger.info(`Auth browser loaded: ${this._authBrowserView?.webContents.getURL()}`)
            
            // Open devTools for debugging if needed
            // this._authBrowserView?.webContents.openDevTools({ mode: 'detach' })
            
            // Inject Android environment emulation
            this._authBrowserView?.webContents.executeJavaScript(`
              // Emulate Android environment
              window.navigator.userAgent = 'Mozilla/5.0 (Linux; Android 11; SM-T510) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/96.0.4664.104 Mobile Safari/537.36 DofusTouch/3.7.1';
              
              // Add Android-specific properties
              window.navigator.platform = 'Android';
              window.navigator.appVersion = '5.0 (Linux; Android 11; SM-T510) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/96.0.4664.104 Mobile Safari/537.36 DofusTouch/3.7.1';
              
              // Mock Android APIs
              window.Android = {
                getVersion: function() { return '3.7.1'; },
                getDeviceId: function() { return '${crypto.randomUUID()}'; },
                getDeviceModel: function() { return 'SM-T510'; },
                getDeviceManufacturer: function() { return 'Samsung'; },
                getDeviceProduct: function() { return 'gta3xlwifi'; },
                getDeviceSdk: function() { return '30'; }, // Android 11
                isTablet: function() { return true; }
              };
              
              // Mock Cordova environment if needed
              window.cordova = {
                version: '10.0.0',
                platformId: 'android'
              };
              
              // Monitor for login success
              setInterval(() => {
                // Check for auth tokens in localStorage
                const hasAuthToken = localStorage.getItem('access_token') || 
                                    localStorage.getItem('authToken') || 
                                    localStorage.getItem('ankama_token');
                
                if (hasAuthToken) {
                  console.log('AUTH_SUCCESS_DETECTED: ' + hasAuthToken);
                }
              }, 1000);
              
              // Override touch events to make them work better
              const originalTouch = window.ontouchstart;
              window.ontouchstart = function(e) {
                console.log('Touch event intercepted');
                if (originalTouch) originalTouch.call(this, e);
              };
              
              // Log any authentication errors
              const originalFetch = window.fetch;
              window.fetch = function(...args) {
                const url = args[0];
                if (typeof url === 'string' && (url.includes('auth') || url.includes('login'))) {
                  console.log('AUTH_FETCH: ' + url);
                  return originalFetch.apply(this, args)
                    .then(response => {
                      console.log('AUTH_RESPONSE: ' + response.status);
                      return response;
                    })
                    .catch(error => {
                      console.error('AUTH_ERROR: ' + error);
                      throw error;
                    });
                }
                return originalFetch.apply(this, args);
              };
              
              console.log('Android environment emulation injected');
            `);
          })
          
          // Log all redirects for debugging
          this._authBrowserView.webContents.on('did-redirect-navigation', (event, url, isInPlace, isMainFrame) => {
            logger.info(`Auth browser redirected to: ${url}`)
            
            // Check for specific Dofus Touch authentication URLs
            if (url.includes('account.ankama.com/auth/dofus-touch')) {
              logger.info('Detected Dofus Touch specific authentication URL')
              
              // Inject additional Dofus Touch specific code
              this._authBrowserView?.webContents.executeJavaScript(`
                // Add Dofus Touch specific objects
                window.DofusTouch = {
                  version: '3.7.1',
                  build: '${Date.now()}',
                  platform: 'android',
                  getDeviceInfo: function() {
                    return {
                      model: 'SM-T510',
                      manufacturer: 'Samsung',
                      platform: 'Android',
                      version: '11',
                      uuid: '${crypto.randomUUID()}',
                      isVirtual: false
                    };
                  }
                };
                
                // Try to auto-fill login form if present
                setTimeout(() => {
                  const loginForm = document.querySelector('form[action*="login"]');
                  if (loginForm) {
                    console.log('Login form detected, attempting to enhance it');
                    
                    // Add hidden fields that might be expected from the mobile app
                    const hiddenFields = [
                      { name: 'client_id', value: 'dofus_touch' },
                      { name: 'response_type', value: 'code' },
                      { name: 'redirect_uri', value: 'dofustouch://auth' },
                      { name: 'scope', value: 'openid dofus_touch' },
                      { name: 'state', value: '${crypto.randomUUID()}' },
                      { name: 'code_challenge_method', value: 'S256' },
                      { name: 'platform', value: 'android' },
                      { name: 'app_version', value: '3.7.1' }
                    ];
                    
                    hiddenFields.forEach(field => {
                      if (!loginForm.querySelector('input[name="' + field.name + '"]')) {
                        const input = document.createElement('input');
                        input.type = 'hidden';
                        input.name = field.name;
                        input.value = field.value;
                        loginForm.appendChild(input);
                        console.log('Added hidden field: ' + field.name);
                      }
                    });
                  }
                }, 1000);
              `);
            }
          })
          
          // Log all responses for debugging
          this._authBrowserView.webContents.session.webRequest.onCompleted({ urls: ['*://*/*'] }, (details) => {
            logger.info(`Auth request completed: ${details.url}, status: ${details.statusCode}`)
            
            // Check for API responses that might contain auth tokens
            if (details.url.includes('/api/auth') || 
                details.url.includes('/oauth') || 
                details.url.includes('/login')) {
              logger.info(`Potential auth response detected: ${details.url}`)
            }
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
              headers['Cache-Control'] = 'no-cache';
              headers['Pragma'] = 'no-cache';
              
              // Add mobile-specific headers
              headers['X-DofusTouch-Version'] = '3.7.1';
              headers['X-Android-Version'] = '11';
              headers['X-Android-SDK'] = '30';
              headers['X-Android-Device'] = 'SM-T510';
              headers['X-Android-Manufacturer'] = 'Samsung';
              
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
          
          // Listen for console messages to detect close button clicks and auth success
          this._authBrowserView.webContents.on('console-message', (event, level, message) => {
            if (message.includes('close-auth-browser-requested')) {
              if (this._authBrowserView) {
                this._win.removeBrowserView(this._authBrowserView);
                this._authBrowserView = null;
              }
            }
            
            // Check for auth success message
            if (message.includes('AUTH_SUCCESS_DETECTED')) {
              logger.info(`Authentication success detected: ${message}`)
              
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
          });
          
          // Handle navigation events
          this._authBrowserView.webContents.on('did-navigate', (event, url) => {
            // Check if we've returned to the game URL or a specific success URL
            if (url.includes('game.dofus-touch.com') || 
                url.includes('auth-success') || 
                url.includes('account.ankama.com/en/ankama/success')) {
              logger.info(`Authentication successful navigation detected: ${url}`)
              
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
