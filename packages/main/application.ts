import {
  GameContext,
  IPCEvents,
  RootStore,
  SaveCharacterImageArgs,
  GameTeamWindow,
  GameTeam,
  LANGUAGE_KEYS
} from '@lindo/shared'
import { app, BrowserWindow, dialog, ipcMain, Menu, BrowserView } from 'electron'
import crypto from 'crypto'
import express from 'express'
import getPort from 'get-port'
import { Server } from 'http'
import { observe } from 'mobx'
import { AddressInfo } from 'net'
import { APP_PATH, CHARACTER_IMAGES_PATH, GAME_PATH, LINDO_API } from './constants'
import fs from 'fs-extra'
// @vite-ignore
import originalFs from 'original-fs'
import { getAppMenu } from './menu'
import { MultiAccount } from './multi-account'
import { runUpdater } from './updater'
import { GameWindow, OptionWindow } from './windows'
import path, { join } from 'path'
import cors from 'cors'
import { I18n } from './utils'
import { logger, setupRendererLogger } from './logger'
import axios from 'axios'
import { Locales } from '@lindo/i18n'
import { platform } from 'os'
import { WSAWindow } from './windows/wsa-window'
import { checkWSARequirements } from './utils/wsa-detector'

export class Application {
  private static _instance: Application
  private readonly _multiAccount: MultiAccount
  private readonly _i18n: I18n
  private readonly _hash: string

  static async init(rootStore: RootStore) {
    if (Application._instance) {
      throw new Error('Application already initialized')
    }

    // generate a hash for the app for randomization
    let hash: string
    if (app.isPackaged) {
      const path = app.getAppPath()
      // Use a safer approach for hashing
      const hashSum = crypto.createHash('sha256')
      hashSum.update(app.name + path + Date.now())
      hash = hashSum.digest('hex')
    } else {
      const hashSum = crypto.createHash('sha256')
      hashSum.update(app.name)
      hash = hashSum.digest('hex')
    }

    // create express server to serve game file
    const serveGameServer = express()
    serveGameServer.use(
      cors({
        origin: '*'
      })
    )
    serveGameServer.use('/game', express.static(GAME_PATH))
    serveGameServer.use('/renderer', express.static(join(__dirname, '../renderer/')))
    serveGameServer.use('/character-images', express.static(CHARACTER_IMAGES_PATH))
    serveGameServer.use('/changelog', express.static(APP_PATH + '/CHANGELOG.md'))
    const gameServerPort = await getPort({ port: 3000 })
    const gameServer: Server = serveGameServer.listen(gameServerPort)

    // set default language
    if (!rootStore.appStore._language) {
      const userLocal = app.getLocale()
      const userLang = userLocal.split('-')[0] as Locales
      console.log(userLang)
      if (LANGUAGE_KEYS.includes(userLang)) {
        rootStore.appStore.setLanguageKey(userLang)
      }
    }

    Application._instance = new Application(rootStore, gameServer, hash)
  }

  static get instance(): Application {
    if (!Application._instance) {
      throw new Error('Application not initialized')
    }
    return Application._instance
  }

  private _gWindows: Array<GameWindow> = []
  private _optionWindow?: OptionWindow
  private _wsaWindow: WSAWindow | null = null

  private constructor(private _rootStore: RootStore, private _gameServer: Server, hash: string) {
    this._multiAccount = new MultiAccount(this._rootStore)
    this._i18n = new I18n(this._rootStore)
    this._hash = hash
  }

  async run() {
    // setup global IPC handlers
    this._setupIPCHandlers()

    // run updater
    await runUpdater(this._rootStore, this._i18n)

    // set the app menu
    this._setAppMenu()

    await this._initGameWindows()

    app.on('second-instance', () => {
      logger.debug('Application -> second-instance')
      if (this._gWindows.length) {
        // Focus on the main window if the user tried to open another
        if (this._gWindows[0].isMinimized()) this._gWindows[0].restore()
        this._gWindows[0].focus()
      }
    })

    app.on('activate', () => {
      logger.debug('Application -> activate')
      if (this._gWindows.length) {
        this._gWindows[0].focus()
      } else {
        this.createGameWindow()
      }
    })
  }

  private async _initGameWindows() {
    const multiAccountEnabled = await this._multiAccount.isEnabled()
    if (multiAccountEnabled) {
      try {
        const selectedTeamId = await this._multiAccount.unlockWithTeam()
        const team = this._rootStore.optionStore.gameMultiAccount.selectTeamById(selectedTeamId)
        if (!team) {
          throw new Error('Team not found')
        }
        for (const window of team.windows) {
          this.createGameWindow(team, window)
        }
      } catch (e) {
        console.log(e)
        logger.warn('MultiAccount canceled')

        this.createGameWindow()
      }
    } else {
      this.createGameWindow()
    }
    observe(
      this._rootStore.optionStore.window,
      'audioMuted',
      () => {
        for (const gWindow of this._gWindows) {
          gWindow.setAudioMute(this._rootStore.optionStore.window.audioMuted)
        }
      },
      true
    )
  }

  private _setAppMenu() {
    Menu.setApplicationMenu(getAppMenu(this._rootStore, this._i18n))
    logger.debug('Application -> _setAppMenu')
    observe(this._rootStore.hotkeyStore.window, (change) => {
      logger.debug('Application -> _setAppMenu')
      if (change.type === 'update') {
        Menu.setApplicationMenu(getAppMenu(this._rootStore, this._i18n))
      }
    })
    this._i18n.on('localeChanged', () => {
      Menu.setApplicationMenu(getAppMenu(this._rootStore, this._i18n))
    })
  }

  async createGameWindow(team?: GameTeam, teamWindow?: GameTeamWindow) {
    const index = this._gWindows.length
    logger.debug('Application -> _createGameWindow ' + index)
    const serverAddress: AddressInfo = this._gameServer.address() as AddressInfo
    const gWindow = await GameWindow.init({
      index,
      url: 'http://localhost:' + serverAddress.port + '/renderer/index.html',
      store: this._rootStore,
      team,
      teamWindow
    })

    gWindow.on('close', () => {
      this._gWindows.splice(this._gWindows.indexOf(gWindow), 1)
      if (this._gWindows.length === 0) {
        if (process.platform !== 'darwin') app.quit()
      }
    })
    this._gWindows.push(gWindow)
  }

  openOptionWindow() {
    logger.debug('Application -> openOptionWindow')
    if (this._optionWindow) {
      this._optionWindow.focus()
      return
    }
    this._optionWindow = new OptionWindow()
    this._optionWindow.on('close', () => {
      this._optionWindow = undefined
    })
  }

  // Add a method to reload all game windows
  reloadAllGameWindows() {
    logger.info('Reloading all game windows to complete authentication')
    for (const gWindow of this._gWindows) {
      gWindow.reload()
    }
  }

  // Add a method to get all game windows
  getGameWindows(): Array<GameWindow> {
    return this._gWindows
  }

  get wsaWindow(): WSAWindow | null {
    return this._wsaWindow
  }

  async createWSAWindow(): Promise<WSAWindow | null> {
    try {
      logger.info('Creating WSA window...')
      
      // Check if we're on Windows
      if (process.platform !== 'win32') {
        logger.error('WSA is only supported on Windows')
        return null
      }
      
      // Check if WSA window already exists
      if (this._wsaWindow) {
        logger.info('WSA window already exists')
        return this._wsaWindow
      }
      
      // Check WSA requirements
      const { meetsRequirements, issues } = await checkWSARequirements()
      if (!meetsRequirements) {
        logger.error('WSA requirements not met:', issues.join(', '))
        return null
      }
      
      // Create WSA window
      this._wsaWindow = new WSAWindow()
      
      // Initialize WSA window with timeout
      const initPromise = this._wsaWindow.init()
      const timeoutPromise = new Promise<boolean>((resolve) => {
        setTimeout(() => resolve(false), 30000) // 30 second timeout
      })
      
      const initialized = await Promise.race([initPromise, timeoutPromise])
      
      if (!initialized) {
        logger.error('Failed to initialize WSA window (timeout or error)')
        this._wsaWindow.cleanup()
        this._wsaWindow = null
        return null
      }
      
      // Set up event listeners
      this._wsaWindow.on('closed', () => {
        logger.info('WSA window closed')
        this._wsaWindow = null
      })
      
      this._wsaWindow.on('error', (error) => {
        logger.error('WSA window error:', error)
      })
      
      return this._wsaWindow
    } catch (error) {
      logger.error('Error creating WSA window:', error)
      
      // Clean up if there was an error
      if (this._wsaWindow) {
        this._wsaWindow.cleanup()
        this._wsaWindow = null
      }
      
      return null
    }
  }

  async closeWSAWindow(): Promise<void> {
    try {
      if (this._wsaWindow) {
        logger.info('Closing WSA window...')
        this._wsaWindow.cleanup()
        this._wsaWindow = null
        logger.info('WSA window closed successfully')
      }
    } catch (error) {
      logger.error('Error closing WSA window:', error)
      // Force cleanup
      this._wsaWindow = null
    }
  }

  private _setupIPCHandlers() {
    // Keep track of registered handlers to avoid duplicates
    const registeredHandlers = new Set<string>()

    // Helper function to safely register handlers
    const safeHandle = (channel: string, handler: (event: Electron.IpcMainInvokeEvent, ...args: any[]) => any) => {
      if (registeredHandlers.has(channel)) {
        logger.warn(`Handler for ${channel} already registered, skipping`)
        return
      }
      
      ipcMain.handle(channel, handler)
      registeredHandlers.add(channel)
    }
    
    const safeOn = (channel: string, handler: (event: Electron.IpcMainEvent, ...args: any[]) => void) => {
      // For 'on' handlers, we can have multiple listeners, but we'll still log it
      if (registeredHandlers.has(`on:${channel}`)) {
        logger.warn(`Handler for on:${channel} already registered, might cause duplicate events`)
      }
      
      ipcMain.on(channel, handler)
      registeredHandlers.add(`on:${channel}`)
    }

    // logger handler
    setupRendererLogger()

    // handlers
    safeHandle(IPCEvents.GET_GAME_CONTEXT, (event) => {
      const serverAddress: AddressInfo = this._gameServer.address() as AddressInfo
      const gWindow = this._gWindows.find((gWindow) => gWindow.id === event.sender.id)
      const context: GameContext = {
        gameSrc: 'http://localhost:' + serverAddress.port + '/game/index.html?delayed=true',
        characterImagesSrc: 'http://localhost:' + serverAddress.port + '/character-images/',
        changeLogSrc: 'http://localhost:' + serverAddress.port + '/changelog',
        windowId: event.sender.id,
        multiAccount: gWindow?.multiAccount,
        hash: this._hash,
        platform: platform()
      }
      return JSON.stringify(context)
    })

    safeOn(IPCEvents.OPEN_OPTION, () => {
      this.openOptionWindow()
    })

    safeOn(IPCEvents.CLOSE_OPTION, () => {
      if (this._optionWindow) {
        this._optionWindow.close()
      }
    })

    safeOn(IPCEvents.RESET_STORE, () => {
      this._rootStore.reset()
    })

    safeOn(IPCEvents.SAVE_CHARACTER_IMAGE, (event, { image, name }: SaveCharacterImageArgs) => {
      const base64Data = image.replace(/^data:image\/png;base64,/, '')
      fs.mkdirSync(CHARACTER_IMAGES_PATH, { recursive: true })
      fs.writeFile(path.join(CHARACTER_IMAGES_PATH, `${name}.png`), base64Data, 'base64', (err) => {
        logger.error(err)
      })
    })

    safeOn(IPCEvents.TOGGLE_MAXIMIZE_WINDOW, (event) => {
      logger.debug('Application -> TOGGLE_MAXIMIZE_WINDOW')
      const gWindow = this._gWindows.find((gWindow) => gWindow.id === event.sender.id)
      if (gWindow) {
        gWindow.toggleMaximize()
      }
    })

    safeOn(IPCEvents.AUTO_GROUP_PUSH_PATH, (event, instruction) => {
      logger.debug('Application -> AUTO_GROUP_PUSH_PATH')
      for (const gWindow of this._gWindows) {
        gWindow.sendAutoGroupInstruction(instruction)
      }
    })

    safeOn(IPCEvents.FOCUS_WINDOW, (event) => {
      logger.debug('Application -> FOCUS_WINDOW')
      const gWindow = this._gWindows.find((gWindow) => gWindow.id === event.sender.id)
      if (gWindow) {
        gWindow.focus()
      }
    })

    safeHandle(IPCEvents.FETCH_GAME_CONTEXT, (event, context: string) => {
      logger.debug('Application -> FETCH_GAME_CONTEXT')
      return axios
        .post(LINDO_API + 'stats/stats.php', context)
        .then((res) => {
          return !!res.data
        })
        .catch(() => true)
    })

    safeOn(IPCEvents.AUDIO_MUTE_WINDOW, (event, value) => {
      logger.debug('Application -> AUDIO_MUTE_WINDOW')
      const gWindow = this._gWindows.find((gWindow) => gWindow.id === event.sender.id)
      if (gWindow) {
        gWindow.setAudioMute(value)
      }
    })

    safeOn(IPCEvents.RESET_GAME_DATA, () => {
      logger.debug('Application -> RESET_GAME_DATA')
      fs.rmSync(GAME_PATH, { recursive: true, force: true })
      app.relaunch()
      app.quit()
    })

    safeOn(IPCEvents.CLEAR_CACHE, async () => {
      logger.debug('Application -> CLEAR_CACHE')
      Promise.all(this._gWindows.map((gWindow) => gWindow.clearCache())).finally(() => {
        dialog
          .showMessageBox(BrowserWindow.getFocusedWindow()!, {
            type: 'info',
            title: this._i18n.LL.main.dialogs.cacheCleared.title(),
            message: this._i18n.LL.main.dialogs.cacheCleared.message(),
            buttons: ['OK']
          })
          .then(() => {
            app.exit()
          })
      })
    })

    // WSA handlers - using string literals to avoid linter errors
    safeHandle('CREATE_WSA_WINDOW', async () => {
      try {
        logger.debug('Application -> CREATE_WSA_WINDOW')
        const wsaWindow = await this.createWSAWindow()
        return !!wsaWindow
      } catch (error) {
        logger.error('Error handling CREATE_WSA_WINDOW:', error)
        return false
      }
    })

    safeHandle('CLOSE_WSA_WINDOW', async () => {
      try {
        logger.debug('Application -> CLOSE_WSA_WINDOW')
        await this.closeWSAWindow()
        return true
      } catch (error) {
        logger.error('Error handling CLOSE_WSA_WINDOW:', error)
        return false
      }
    })

    safeHandle('CHECK_WSA_REQUIREMENTS', async () => {
      try {
        logger.debug('Application -> CHECK_WSA_REQUIREMENTS')
        const requirements = await checkWSARequirements()
        return JSON.stringify(requirements)
      } catch (error) {
        logger.error('Error handling CHECK_WSA_REQUIREMENTS:', error)
        return JSON.stringify({ meetsRequirements: false, issues: ['Error checking requirements'] })
      }
    })
  }
}
