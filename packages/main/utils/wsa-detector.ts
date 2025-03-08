/**
 * Windows Subsystem for Android (WSA) Detector
 * 
 * This module provides utilities to detect, check status, and manage WSA.
 */

import { exec } from 'child_process'
import { promisify } from 'util'
import { logger } from '../logger'
import { app } from 'electron'
import { join } from 'path'
import { existsSync } from 'fs'

const execAsync = promisify(exec)

// Safer execution of PowerShell commands with timeout
async function safeExecPowerShell(command: string, timeoutMs = 5000): Promise<string> {
  try {
    // Add error handling and timeout to the PowerShell command
    const safeCommand = `
      $ErrorActionPreference = "Stop"
      try {
        ${command}
      } catch {
        Write-Output "ERROR: $_"
        exit 1
      }
    `
    
    // Create a promise that rejects after the timeout
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error(`Command timed out after ${timeoutMs}ms`)), timeoutMs)
    })
    
    // Create a promise for the command execution
    const execPromise = execAsync(`powershell -Command "${safeCommand}"`)
    
    // Race the command execution against the timeout
    const result = await Promise.race([execPromise, timeoutPromise])
    return result.stdout.trim()
  } catch (error) {
    logger.error('Error executing PowerShell command:', error)
    return ''
  }
}

/**
 * Check if Windows Subsystem for Android is installed
 */
export async function isWSAInstalled(): Promise<boolean> {
  try {
    // First check if we're on Windows
    if (process.platform !== 'win32') {
      logger.info('Not on Windows, WSA is not available')
      return false
    }
    
    // Multiple ways to check if WSA is installed
    
    // Method 1: Check for the WSA service
    const serviceResult = await safeExecPowerShell('Get-Service -Name WsaService -ErrorAction SilentlyContinue')
    if (serviceResult && !serviceResult.includes('ERROR')) {
      return true
    }
    
    // Method 2: Check for the WSA app package
    const appxResult = await safeExecPowerShell('Get-AppxPackage -Name MicrosoftCorporationII.WindowsSubsystemForAndroid -ErrorAction SilentlyContinue')
    if (appxResult && !appxResult.includes('ERROR')) {
      return true
    }
    
    // Method 3: Check for the WSA installation directory
    const programFilesPath = process.env['ProgramFiles'] || 'C:\\Program Files'
    const wsaPath = join(programFilesPath, 'WindowsApps', 'MicrosoftCorporationII.WindowsSubsystemForAndroid_*')
    const dirResult = await safeExecPowerShell(`Test-Path "${wsaPath}"`)
    if (dirResult && dirResult.toLowerCase() === 'true') {
      return true
    }
    
    return false
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
    // First check if we're on Windows
    if (process.platform !== 'win32') {
      return false
    }
    
    // Multiple ways to check if WSA is running
    
    // Method 1: Check the WSA service status
    const serviceResult = await safeExecPowerShell('(Get-Service -Name WsaService -ErrorAction SilentlyContinue).Status')
    if (serviceResult && serviceResult === 'Running') {
      return true
    }
    
    // Method 2: Check for WSA processes
    const processResult = await safeExecPowerShell('Get-Process -Name "WsaClient" -ErrorAction SilentlyContinue')
    if (processResult && !processResult.includes('ERROR')) {
      return true
    }
    
    // Method 3: Try to connect to ADB and check for WSA device
    try {
      const { stdout } = await execAsync('adb devices')
      if (stdout.includes('127.0.0.1:58526')) {
        return true
      }
    } catch (adbError) {
      // Ignore ADB errors, we'll try other methods
    }
    
    return false
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
    // First check if we're on Windows
    if (process.platform !== 'win32') {
      return false
    }
    
    // Check if WSA is already running
    const alreadyRunning = await isWSARunning()
    if (alreadyRunning) {
      return true
    }
    
    // Try multiple methods to start WSA
    
    // Method 1: Start the WSA service
    await safeExecPowerShell('Start-Service -Name WsaService -ErrorAction SilentlyContinue')
    
    // Method 2: Launch the WSA app
    await safeExecPowerShell('Start-Process shell:AppsFolder\\MicrosoftCorporationII.WindowsSubsystemForAndroid_8wekyb3d8bbwe!App -ErrorAction SilentlyContinue')
    
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
    // First check if we're on Windows
    if (process.platform !== 'win32') {
      return false
    }
    
    // Try to execute ADB
    await execAsync('adb version')
    return true
  } catch (error) {
    // Check if ADB is bundled with the app
    try {
      const adbPath = join(app.getAppPath(), 'resources', 'adb', 'adb.exe')
      if (existsSync(adbPath)) {
        process.env.PATH = `${process.env.PATH};${join(app.getAppPath(), 'resources', 'adb')}`
        await execAsync(`"${adbPath}" version`)
        return true
      }
    } catch (bundledError) {
      logger.error('Bundled ADB is not available:', bundledError)
    }
    
    logger.error('ADB is not available:', error)
    return false
  }
}

/**
 * Connect to WSA via ADB
 */
export async function connectToWSA(): Promise<boolean> {
  try {
    // First check if we're on Windows
    if (process.platform !== 'win32') {
      return false
    }
    
    // Check if ADB is available
    const adbAvailable = await isADBAvailable()
    if (!adbAvailable) {
      logger.error('ADB is not available, cannot connect to WSA')
      return false
    }
    
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
    // First check if we're on Windows
    if (process.platform !== 'win32') {
      return {}
    }
    
    const info: Record<string, string> = {}
    
    // Check if ADB is available
    const adbAvailable = await isADBAvailable()
    if (!adbAvailable) {
      info.error = 'ADB is not available'
      return info
    }
    
    // Check if connected to WSA
    const connected = await connectToWSA()
    if (!connected) {
      info.error = 'Not connected to WSA'
      return info
    }
    
    try {
      // Get Android version
      const { stdout: androidVersion } = await execAsync('adb shell getprop ro.build.version.release')
      info.androidVersion = androidVersion.trim()
    } catch (error) {
      info.androidVersion = 'Unknown'
    }
    
    try {
      // Get WSA version
      const { stdout: wsaVersion } = await execAsync('adb shell getprop ro.build.version.incremental')
      info.wsaVersion = wsaVersion.trim()
    } catch (error) {
      info.wsaVersion = 'Unknown'
    }
    
    try {
      // Get device model
      const { stdout: deviceModel } = await execAsync('adb shell getprop ro.product.model')
      info.deviceModel = deviceModel.trim()
    } catch (error) {
      info.deviceModel = 'Unknown'
    }
    
    return info
  } catch (error) {
    logger.error('Error getting WSA info:', error)
    return { error: 'Failed to get WSA info' }
  }
}

/**
 * Check if Windows 11 is running
 */
export async function isWindows11(): Promise<boolean> {
  try {
    // First check if we're on Windows
    if (process.platform !== 'win32') {
      return false
    }
    
    // Get Windows version
    const versionOutput = await safeExecPowerShell('(Get-CimInstance -ClassName Win32_OperatingSystem).Version')
    const version = versionOutput.trim()
    
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
  try {
    const issues: string[] = []
    
    // First check if we're on Windows
    if (process.platform !== 'win32') {
      issues.push('Windows is required for Windows Subsystem for Android')
      return { meetsRequirements: false, issues }
    }
    
    // Check if Windows 11
    try {
      const isWin11 = await isWindows11()
      if (!isWin11) {
        issues.push('Windows 11 is required for Windows Subsystem for Android')
      }
    } catch (error) {
      logger.error('Error checking Windows version:', error)
      issues.push('Error checking Windows version: ' + (error as Error).message)
    }
    
    // Check if WSA is installed
    try {
      const wsaInstalled = await isWSAInstalled()
      if (!wsaInstalled) {
        issues.push('Windows Subsystem for Android is not installed')
      }
    } catch (error) {
      logger.error('Error checking if WSA is installed:', error)
      issues.push('Error checking if WSA is installed: ' + (error as Error).message)
    }
    
    // Check if ADB is available
    try {
      const adbAvailable = await isADBAvailable()
      if (!adbAvailable) {
        issues.push('Android Debug Bridge (ADB) is not available')
      }
    } catch (error) {
      logger.error('Error checking if ADB is available:', error)
      issues.push('Error checking if ADB is available: ' + (error as Error).message)
    }
    
    return {
      meetsRequirements: issues.length === 0,
      issues
    }
  } catch (error) {
    logger.error('Error in checkWSARequirements:', error)
    return {
      meetsRequirements: false,
      issues: ['Unexpected error checking WSA requirements: ' + (error as Error).message]
    }
  }
} 