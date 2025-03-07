/**
 * WSA App Manager
 * 
 * This module provides utilities to manage Dofus Touch on Windows Subsystem for Android.
 */

import { exec } from 'child_process'
import { promisify } from 'util'
import { join } from 'path'
import { app } from 'electron'
import { createWriteStream, existsSync, mkdirSync } from 'fs'
import { get } from 'https'
import { logger } from '../logger'

const execAsync = promisify(exec)
const DOFUS_TOUCH_PACKAGE = 'com.ankamagames.dofustouch'
const APK_DOWNLOAD_URL = 'https://download.ankama.com/dofustouch/android/latest'

/**
 * Download a file from a URL
 */
async function downloadFile(url: string, destination: string): Promise<void> {
  return new Promise((resolve, reject) => {
    // Ensure the directory exists
    const dir = destination.substring(0, destination.lastIndexOf('/'))
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true })
    }
    
    const file = createWriteStream(destination)
    
    get(url, (response) => {
      if (response.statusCode === 302 || response.statusCode === 301) {
        // Handle redirects
        if (response.headers.location) {
          downloadFile(response.headers.location, destination)
            .then(resolve)
            .catch(reject)
          return
        }
      }
      
      response.pipe(file)
      
      file.on('finish', () => {
        file.close()
        resolve()
      })
    }).on('error', (err) => {
      reject(err)
    })
  })
}

/**
 * Check if Dofus Touch is installed on WSA
 */
export async function isDofusTouchInstalled(): Promise<boolean> {
  try {
    const { stdout } = await execAsync(`adb shell pm list packages ${DOFUS_TOUCH_PACKAGE}`)
    return stdout.includes(DOFUS_TOUCH_PACKAGE)
  } catch (error) {
    logger.error('Error checking if Dofus Touch is installed:', error)
    return false
  }
}

/**
 * Install Dofus Touch on WSA
 */
export async function installDofusTouch(): Promise<boolean> {
  try {
    // Download the APK
    const apkPath = join(app.getPath('temp'), 'dofustouch.apk')
    logger.info(`Downloading Dofus Touch APK to ${apkPath}...`)
    
    await downloadFile(APK_DOWNLOAD_URL, apkPath)
    logger.info('Download complete, installing...')
    
    // Install the APK
    await execAsync(`adb install -r "${apkPath}"`)
    logger.info('Dofus Touch installed successfully')
    
    return true
  } catch (error) {
    logger.error('Failed to install Dofus Touch:', error)
    return false
  }
}

/**
 * Launch Dofus Touch on WSA
 */
export async function launchDofusTouch(): Promise<boolean> {
  try {
    await execAsync(`adb shell monkey -p ${DOFUS_TOUCH_PACKAGE} -c android.intent.category.LAUNCHER 1`)
    logger.info('Dofus Touch launched successfully')
    return true
  } catch (error) {
    logger.error('Failed to launch Dofus Touch:', error)
    return false
  }
}

/**
 * Stop Dofus Touch on WSA
 */
export async function stopDofusTouch(): Promise<boolean> {
  try {
    await execAsync(`adb shell am force-stop ${DOFUS_TOUCH_PACKAGE}`)
    logger.info('Dofus Touch stopped successfully')
    return true
  } catch (error) {
    logger.error('Failed to stop Dofus Touch:', error)
    return false
  }
}

/**
 * Get Dofus Touch version
 */
export async function getDofusTouchVersion(): Promise<string> {
  try {
    const { stdout } = await execAsync(`adb shell dumpsys package ${DOFUS_TOUCH_PACKAGE} | grep versionName`)
    const match = stdout.match(/versionName=([0-9.]+)/)
    return match ? match[1] : 'Unknown'
  } catch (error) {
    logger.error('Failed to get Dofus Touch version:', error)
    return 'Unknown'
  }
}

/**
 * Clear Dofus Touch data
 */
export async function clearDofusTouchData(): Promise<boolean> {
  try {
    await execAsync(`adb shell pm clear ${DOFUS_TOUCH_PACKAGE}`)
    logger.info('Dofus Touch data cleared successfully')
    return true
  } catch (error) {
    logger.error('Failed to clear Dofus Touch data:', error)
    return false
  }
}

/**
 * Take screenshot of Dofus Touch
 */
export async function takeDofusTouchScreenshot(): Promise<string> {
  try {
    const screenshotPath = join(app.getPath('temp'), 'dofustouch_screenshot.png')
    
    // Take screenshot on device
    await execAsync('adb shell screencap -p /sdcard/screenshot.png')
    
    // Pull screenshot to local machine
    await execAsync(`adb pull /sdcard/screenshot.png "${screenshotPath}"`)
    
    // Remove screenshot from device
    await execAsync('adb shell rm /sdcard/screenshot.png')
    
    return screenshotPath
  } catch (error) {
    logger.error('Failed to take Dofus Touch screenshot:', error)
    return ''
  }
} 