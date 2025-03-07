/**
 * Window Finder
 * 
 * This module provides utilities to find and capture windows on the system.
 * It's primarily used to find the WSA window for embedding in Lindo.
 */

import { exec } from 'child_process'
import { promisify } from 'util'
import { logger } from '../logger'

const execAsync = promisify(exec)

/**
 * Find a window by its title
 * @param title The title of the window to find
 * @returns The window handle if found, null otherwise
 */
export async function findWindowByTitle(title: string): Promise<string | null> {
  try {
    // This PowerShell command finds windows by title
    const command = `
      Add-Type @"
      using System;
      using System.Runtime.InteropServices;
      public class WindowFinder {
        [DllImport("user32.dll")]
        public static extern IntPtr FindWindow(string lpClassName, string lpWindowName);
        
        [DllImport("user32.dll")]
        public static extern int GetWindowText(IntPtr hWnd, System.Text.StringBuilder text, int count);
        
        [DllImport("user32.dll")]
        public static extern IntPtr GetWindow(IntPtr hWnd, uint uCmd);
        
        [DllImport("user32.dll")]
        public static extern bool EnumWindows(EnumWindowsProc enumProc, IntPtr lParam);
        
        [DllImport("user32.dll")]
        public static extern bool IsWindowVisible(IntPtr hWnd);
        
        public delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);
        
        public static string FindWindowByPartialTitle(string partialTitle) {
          string result = null;
          
          EnumWindows(delegate(IntPtr hWnd, IntPtr lParam) {
            int length = GetWindowTextLength(hWnd);
            if (length > 0 && IsWindowVisible(hWnd)) {
              System.Text.StringBuilder sb = new System.Text.StringBuilder(length + 1);
              GetWindowText(hWnd, sb, sb.Capacity);
              string windowTitle = sb.ToString();
              
              if (windowTitle.Contains(partialTitle)) {
                result = hWnd.ToString();
                return false; // Stop enumeration
              }
            }
            return true; // Continue enumeration
          }, IntPtr.Zero);
          
          return result;
        }
        
        [DllImport("user32.dll")]
        public static extern int GetWindowTextLength(IntPtr hWnd);
      }
"@

      [WindowFinder]::FindWindowByPartialTitle("${title}")
    `
    
    const { stdout } = await execAsync(`powershell -Command "${command}"`)
    const handle = stdout.trim()
    
    return handle && handle !== 'null' ? handle : null
  } catch (error) {
    logger.error('Error finding window by title:', error)
    return null
  }
}

/**
 * Get window position and size
 * @param handle The window handle
 * @returns The window position and size
 */
export async function getWindowRect(handle: string): Promise<{ 
  x: number, 
  y: number, 
  width: number, 
  height: number 
} | null> {
  try {
    const command = `
      Add-Type @"
      using System;
      using System.Runtime.InteropServices;
      
      public class WindowRect {
        [DllImport("user32.dll")]
        [return: MarshalAs(UnmanagedType.Bool)]
        public static extern bool GetWindowRect(IntPtr hWnd, out RECT lpRect);
        
        [StructLayout(LayoutKind.Sequential)]
        public struct RECT {
          public int Left;
          public int Top;
          public int Right;
          public int Bottom;
        }
      }
"@

      $handle = [IntPtr]::new(${handle})
      $rect = New-Object WindowRect+RECT
      
      if ([WindowRect]::GetWindowRect($handle, [ref]$rect)) {
        $width = $rect.Right - $rect.Left
        $height = $rect.Bottom - $rect.Top
        
        [PSCustomObject]@{
          X = $rect.Left
          Y = $rect.Top
          Width = $width
          Height = $height
        } | ConvertTo-Json
      } else {
        "null"
      }
    `
    
    const { stdout } = await execAsync(`powershell -Command "${command}"`)
    const result = stdout.trim()
    
    if (result && result !== 'null') {
      return JSON.parse(result)
    }
    
    return null
  } catch (error) {
    logger.error('Error getting window rect:', error)
    return null
  }
}

/**
 * Check if a window is the WSA window
 * @param handle The window handle
 * @returns True if the window is the WSA window, false otherwise
 */
export async function isWSAWindow(handle: string): Promise<boolean> {
  try {
    const command = `
      Add-Type @"
      using System;
      using System.Runtime.InteropServices;
      using System.Text;
      
      public class WindowInfo {
        [DllImport("user32.dll", SetLastError = true, CharSet = CharSet.Auto)]
        public static extern int GetClassName(IntPtr hWnd, StringBuilder lpClassName, int nMaxCount);
        
        [DllImport("user32.dll")]
        public static extern int GetWindowText(IntPtr hWnd, StringBuilder text, int count);
        
        public static string GetWindowClassName(IntPtr hWnd) {
          StringBuilder sb = new StringBuilder(256);
          GetClassName(hWnd, sb, sb.Capacity);
          return sb.ToString();
        }
        
        public static string GetWindowTitle(IntPtr hWnd) {
          StringBuilder sb = new StringBuilder(256);
          GetWindowText(hWnd, sb, sb.Capacity);
          return sb.ToString();
        }
      }
"@

      $handle = [IntPtr]::new(${handle})
      $className = [WindowInfo]::GetWindowClassName($handle)
      $title = [WindowInfo]::GetWindowTitle($handle)
      
      [PSCustomObject]@{
        ClassName = $className
        Title = $title
      } | ConvertTo-Json
    `
    
    const { stdout } = await execAsync(`powershell -Command "${command}"`)
    const result = JSON.parse(stdout.trim())
    
    // WSA window typically has a class name containing "ApplicationFrameWindow"
    // and a title containing "Windows Subsystem for Android"
    return (
      result.ClassName.includes('ApplicationFrameWindow') &&
      result.Title.includes('Windows Subsystem for Android')
    )
  } catch (error) {
    logger.error('Error checking if window is WSA window:', error)
    return false
  }
} 