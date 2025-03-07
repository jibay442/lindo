/**
 * Windows Subsystem for Android (WSA) Detector
 * 
 * This module provides utilities to detect, check status, and manage WSA.
 */

import { exec } from 'child_process'
import { promisify } from 'util'
import { logger } from '../logger'

const execAsync = promisify(exec)

/**
 * Check if Windows Subsystem for Android is installed
 */
export async function isWSAInstalled(): Promise<boolean> {
  try {
    // Check if WSA is installed by looking for the Windows Subsystem for Android service
    const { stdout } = await execAsync('powershell -Command "Get-Service -Name WsaService -ErrorAction SilentlyContinue"')
    return stdout.trim() !== ''
  } catch (error) {
    logger.error('Error checking if WSA is installed:', error)
    return false
  }
}

/**
 * Check if Windows Subsystem for Android is running
 */
export async function isWSARunning(): Promise<boolean> {
  try {
    const { stdout } = await execAsync('powershell -Command "(Get-Service -Name WsaService).Status"')
    return stdout.trim() === 'Running'
  } catch (error) {
    logger.error('Error checking if WSA is running:', error)
    return false
  }
}

/**
 * Start Windows Subsystem for Android
 */
export async function startWSA(): Promise<boolean> {
  try {
    await execAsync('powershell -Command "Start-Service -Name WsaService"')
    
    // Wait for WSA to fully start
    let attempts = 0
    const maxAttempts = 10
    
    while (attempts < maxAttempts) {
      const running = await isWSARunning()
      if (running) {
        return true
      }
      
      // Wait 1 second before checking again
      await new Promise(resolve => setTimeout(resolve, 1000))
      attempts++
    }
    
    return false
  } catch (error) {
    logger.error('Error starting WSA:', error)
    return false
  }
}

/**
 * Check if ADB (Android Debug Bridge) is available
 */
export async function isADBAvailable(): Promise<boolean> {
  try {
    await execAsync('adb version')
    return true
  } catch (error) {
    logger.error('ADB is not available:', error)
    return false
  }
}

/**
 * Connect to WSA via ADB
 */
export async function connectToWSA(): Promise<boolean> {
  try {
    // First check if already connected
    const { stdout: devices } = await execAsync('adb devices')
    if (devices.includes('127.0.0.1:58526')) {
      return true
    }
    
    // Connect to WSA's default ADB port
    await execAsync('adb connect 127.0.0.1:58526')
    
    // Verify connection
    const { stdout: devicesAfter } = await execAsync('adb devices')
    return devicesAfter.includes('127.0.0.1:58526')
  } catch (error) {
    logger.error('Error connecting to WSA via ADB:', error)
    return false
  }
}

/**
 * Get WSA system information
 */
export async function getWSAInfo(): Promise<Record<string, string>> {
  try {
    const info: Record<string, string> = {}
    
    // Get Android version
    const { stdout: androidVersion } = await execAsync('adb shell getprop ro.build.version.release')
    info.androidVersion = androidVersion.trim()
    
    // Get WSA version
    const { stdout: wsaVersion } = await execAsync('adb shell getprop ro.build.version.incremental')
    info.wsaVersion = wsaVersion.trim()
    
    // Get device model
    const { stdout: deviceModel } = await execAsync('adb shell getprop ro.product.model')
    info.deviceModel = deviceModel.trim()
    
    return info
  } catch (error) {
    logger.error('Error getting WSA info:', error)
    return {}
  }
}

/**
 * Check if Windows 11 is running
 */
export async function isWindows11(): Promise<boolean> {
  try {
    const { stdout } = await execAsync('powershell -Command "(Get-CimInstance -ClassName Win32_OperatingSystem).Version"')
    const version = stdout.trim()
    
    // Windows 11 versions start with 10.0.22000 or higher
    const versionParts = version.split('.')
    if (versionParts.length >= 3) {
      const buildNumber = parseInt(versionParts[2])
      return buildNumber >= 22000
    }
    
    return false
  } catch (error) {
    logger.error('Error checking Windows version:', error)
    return false
  }
}

/**
 * Check WSA requirements
 */
export async function checkWSARequirements(): Promise<{ 
  meetsRequirements: boolean, 
  issues: string[] 
}> {
  const issues: string[] = []
  
  // Check if Windows 11
  const isWin11 = await isWindows11()
  if (!isWin11) {
    issues.push('Windows 11 is required for Windows Subsystem for Android')
  }
  
  // Check if WSA is installed
  const wsaInstalled = await isWSAInstalled()
  if (!wsaInstalled) {
    issues.push('Windows Subsystem for Android is not installed')
  }
  
  // Check if ADB is available
  const adbAvailable = await isADBAvailable()
  if (!adbAvailable) {
    issues.push('Android Debug Bridge (ADB) is not available')
  }
  
  return {
    meetsRequirements: issues.length === 0,
    issues
  }
} 