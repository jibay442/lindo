# Windows Troubleshooting Guide for Lindo

This guide provides solutions for common issues when running Lindo on Windows.

## Common Issues and Solutions

### 1. App Doesn't Launch

If the app doesn't launch at all, try these steps in order:

1. **Run the Windows fix script**:
   ```bash
   yarn fix-windows
   ```

2. **Rebuild the app**:
   ```bash
   yarn fix-build
   yarn build
   ```

3. **Check for error logs**:
   - Look in `%APPDATA%\Lindo\logs` for error logs
   - If there are no logs, try running the app from the command line:
     ```
     cd release\[version]\win-unpacked
     .\Lindo.exe
     ```

### 2. Native Module Errors

If you see errors related to native modules:

1. **Rebuild native modules**:
   ```bash
   yarn add electron-rebuild --dev
   npx electron-rebuild
   ```

2. **Install specific versions of problematic modules**:
   ```bash
   yarn add native-keymap@3.2.3 --dev
   yarn add @hfelix/electron-localshortcut@4.0.0 --dev
   ```

### 3. White Screen / Blank Window

If the app launches but shows a white screen:

1. **Check the DevTools console for errors**:
   - Press `Ctrl+Shift+I` to open DevTools
   - Look for errors in the Console tab

2. **Clear app data**:
   - Delete the `%APPDATA%\Lindo` folder
   - Restart the app

3. **Disable hardware acceleration**:
   - Create a file named `disable-acceleration.js` in the app's directory
   - Add the following content:
     ```js
     app.disableHardwareAcceleration();
     ```
   - Include this file in the main process

### 4. Authentication Issues

If you have problems with authentication:

1. **Clear browser data**:
   - Delete the `%APPDATA%\Lindo\Partitions` folder
   - Restart the app

2. **Use external browser for authentication**:
   - Set `useExternalBrowser: true` in the app's configuration

### 5. Game Loading Issues

If the game doesn't load properly:

1. **Check your internet connection**:
   - Make sure you can access `https://proxyconnection.touch.dofus.com/`

2. **Update game files**:
   - Delete the `%APPDATA%\Lindo\game` folder
   - Restart the app to download fresh game files

3. **Check for firewall/antivirus blocking**:
   - Add Lindo to your firewall/antivirus exceptions

## Advanced Troubleshooting

### Debugging the Main Process

To debug the main process:

1. **Enable main process logging**:
   ```bash
   set DEBUG=lindo:*
   .\Lindo.exe
   ```

2. **Check for specific errors**:
   ```bash
   yarn check-main
   ```

### Rebuilding from Scratch

If all else fails, try a complete rebuild:

1. **Clean the project**:
   ```bash
   rm -rf node_modules
   rm -rf dist
   rm -rf release
   ```

2. **Reinstall dependencies and rebuild**:
   ```bash
   yarn install
   yarn fix-build
   yarn build
   ```

## Still Having Issues?

If you're still experiencing problems after trying these solutions:

1. **Create an issue on GitHub**:
   - Include your Windows version
   - Include any error messages
   - Include steps to reproduce the issue

2. **Join the community Discord**:
   - Share your issue with the community
   - Check if others have experienced similar problems 