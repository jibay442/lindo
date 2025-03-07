/**
 * WSA Window
 * 
 * This class manages the Windows Subsystem for Android window.
 */

import { BrowserWindow, app } from 'electron'
import { EventEmitter } from 'events'
import TypedEmitter from 'typed-emitter'
import { findWindowByTitle, getWindowRect, isWSAWindow } from '../utils/window-finder'
import { 
  isWSAInstalled, 
  isWSARunning, 
  startWSA, 
  connectToWSA 
} from '../utils/wsa-detector'
import { 
  isDofusTouchInstalled, 
  installDofusTouch, 
  launchDofusTouch, 
  stopDofusTouch,
  takeDofusTouchScreenshot
} from '../utils/wsa-app-manager'
import { logger } from '../logger'

type WSAWindowEvents = {
  ready: () => void
  error: (error: Error) => void
  closed: () => void
  screenshot: (path: string) => void
}

export class WSAWindow extends (EventEmitter as new () => TypedEmitter<WSAWindowEvents>) {
  private _wsaHandle: string | null = null
  private _window: BrowserWindow | null = null
  private _isReady = false
  private _checkInterval: NodeJS.Timeout | null = null
  private _screenshotInterval: NodeJS.Timeout | null = null
  
  constructor() {
    super()
  }
  
  /**
   * Initialize the WSA window
   */
  async init(): Promise<boolean> {
    try {
      // Check if WSA is installed
      const wsaInstalled = await isWSAInstalled()
      if (!wsaInstalled) {
        throw new Error('Windows Subsystem for Android is not installed')
      }
      
      // Check if WSA is running, if not start it
      const wsaRunning = await isWSARunning()
      if (!wsaRunning) {
        logger.info('Starting Windows Subsystem for Android...')
        const started = await startWSA()
        if (!started) {
          throw new Error('Failed to start Windows Subsystem for Android')
        }
      }
      
      // Connect to WSA via ADB
      logger.info('Connecting to Windows Subsystem for Android...')
      const connected = await connectToWSA()
      if (!connected) {
        throw new Error('Failed to connect to Windows Subsystem for Android')
      }
      
      // Check if Dofus Touch is installed, if not install it
      const dofusTouchInstalled = await isDofusTouchInstalled()
      if (!dofusTouchInstalled) {
        logger.info('Installing Dofus Touch...')
        const installed = await installDofusTouch()
        if (!installed) {
          throw new Error('Failed to install Dofus Touch')
        }
      }
      
      // Launch Dofus Touch
      logger.info('Launching Dofus Touch...')
      const launched = await launchDofusTouch()
      if (!launched) {
        throw new Error('Failed to launch Dofus Touch')
      }
      
      // Find the WSA window
      logger.info('Finding WSA window...')
      this._wsaHandle = await findWindowByTitle('Windows Subsystem for Android')
      if (!this._wsaHandle) {
        throw new Error('Failed to find WSA window')
      }
      
      // Verify it's the WSA window
      const isWSA = await isWSAWindow(this._wsaHandle)
      if (!isWSA) {
        throw new Error('Found window is not the WSA window')
      }
      
      // Get window position and size
      const rect = await getWindowRect(this._wsaHandle)
      if (!rect) {
        throw new Error('Failed to get WSA window position and size')
      }
      
      logger.info(`WSA window found at (${rect.x}, ${rect.y}) with size ${rect.width}x${rect.height}`)
      
      // Create a BrowserWindow to display the WSA window
      this._window = new BrowserWindow({
        width: rect.width,
        height: rect.height,
        x: rect.x,
        y: rect.y,
        frame: true,
        title: 'Lindo - Dofus Touch (WSA)',
        webPreferences: {
          nodeIntegration: true,
          contextIsolation: false
        }
      })
      
      // Load a blank page
      await this._window.loadURL('about:blank')
      
      // Set up event listeners
      this._window.on('closed', () => {
        this.cleanup()
        this.emit('closed')
      })
      
      // Start checking for WSA window changes
      this._startWindowChecking()
      
      // Start taking screenshots
      this._startScreenshotCapture()
      
      this._isReady = true
      this.emit('ready')
      
      return true
    } catch (error) {
      logger.error('Error initializing WSA window:', error)
      this.emit('error', error as Error)
      return false
    }
  }
  
  /**
   * Start checking for WSA window changes
   */
  private _startWindowChecking(): void {
    if (this._checkInterval) {
      clearInterval(this._checkInterval)
    }
    
    this._checkInterval = setInterval(async () => {
      if (!this._wsaHandle || !this._window) {
        return
      }
      
      // Check if the WSA window still exists
      const isWSA = await isWSAWindow(this._wsaHandle)
      if (!isWSA) {
        logger.warn('WSA window no longer exists')
        this.cleanup()
        this.emit('closed')
        return
      }
      
      // Update window position and size
      const rect = await getWindowRect(this._wsaHandle)
      if (rect && this._window) {
        this._window.setBounds(rect)
      }
    }, 1000)
  }
  
  /**
   * Start taking screenshots of the WSA window
   */
  private _startScreenshotCapture(): void {
    if (this._screenshotInterval) {
      clearInterval(this._screenshotInterval)
    }
    
    this._screenshotInterval = setInterval(async () => {
      if (!this._isReady) {
        return
      }
      
      const screenshotPath = await takeDofusTouchScreenshot()
      if (screenshotPath) {
        this.emit('screenshot', screenshotPath)
      }
    }, 5000)
  }
  
  /**
   * Clean up resources
   */
  cleanup(): void {
    if (this._checkInterval) {
      clearInterval(this._checkInterval)
      this._checkInterval = null
    }
    
    if (this._screenshotInterval) {
      clearInterval(this._screenshotInterval)
      this._screenshotInterval = null
    }
    
    // Stop Dofus Touch
    stopDofusTouch().catch(error => {
      logger.error('Error stopping Dofus Touch:', error)
    })
    
    if (this._window && !this._window.isDestroyed()) {
      this._window.close()
      this._window = null
    }
    
    this._wsaHandle = null
    this._isReady = false
  }
  
  /**
   * Check if the WSA window is ready
   */
  isReady(): boolean {
    return this._isReady
  }
  
  /**
   * Get the WSA window
   */
  getWindow(): BrowserWindow | null {
    return this._window
  }
  
  /**
   * Take a screenshot of the WSA window
   */
  async takeScreenshot(): Promise<string> {
    return takeDofusTouchScreenshot()
  }
  
  /**
   * Restart Dofus Touch
   */
  async restartDofusTouch(): Promise<boolean> {
    try {
      await stopDofusTouch()
      await launchDofusTouch()
      return true
    } catch (error) {
      logger.error('Error restarting Dofus Touch:', error)
      return false
    }
  }
} 