/**
 * Android Environment Emulation
 * 
 * This file contains code to emulate the Android environment that Dofus Touch expects.
 * It implements the most commonly used Android interfaces and methods.
 */

// Generate a random Android device ID
const generateAndroidId = (): string => {
  const chars = 'abcdef0123456789';
  let id = '';
  for (let i = 0; i < 16; i++) {
    id += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return id;
};

// Device information
export const deviceInfo = {
  androidId: generateAndroidId(),
  deviceModel: 'SM-T510',
  deviceManufacturer: 'Samsung',
  deviceProduct: 'gta3xlwifi',
  deviceSdk: '30', // Android 11
  deviceVersion: '11',
  isTablet: true,
  buildId: 'RP1A.200720.012',
  buildFingerprint: 'samsung/gta3xlwifi/gta3xlwifi:11/RP1A.200720.012/T510XXU5CUJ1:user/release-keys'
};

/**
 * Injects Android environment emulation into the given window
 */
export const injectAndroidEnvironment = (targetWindow: Window): void => {
  // Add Android environment
  const androidScript = `
    // Override navigator properties
    Object.defineProperty(navigator, 'userAgent', {
      get: function() { 
        return 'Mozilla/5.0 (Linux; Android 11; SM-T510) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/96.0.4664.104 Mobile Safari/537.36 DofusTouch/3.7.1'; 
      }
    });
    
    Object.defineProperty(navigator, 'platform', {
      get: function() { return 'Android'; }
    });
    
    Object.defineProperty(navigator, 'appVersion', {
      get: function() { 
        return '5.0 (Linux; Android 11; SM-T510) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/96.0.4664.104 Mobile Safari/537.36 DofusTouch/3.7.1'; 
      }
    });
    
    // Add Android object
    window.Android = {
      getVersion: function() { return '${deviceInfo.deviceVersion}'; },
      getDeviceId: function() { return '${deviceInfo.androidId}'; },
      getDeviceModel: function() { return '${deviceInfo.deviceModel}'; },
      getDeviceManufacturer: function() { return '${deviceInfo.deviceManufacturer}'; },
      getDeviceProduct: function() { return '${deviceInfo.deviceProduct}'; },
      getDeviceSdk: function() { return '${deviceInfo.deviceSdk}'; },
      isTablet: function() { return ${deviceInfo.isTablet}; },
      getBuildId: function() { return '${deviceInfo.buildId}'; },
      getBuildFingerprint: function() { return '${deviceInfo.buildFingerprint}'; },
      
      // Add methods that Dofus Touch might call
      getNetworkType: function() { return 'wifi'; },
      getNetworkOperator: function() { return ''; },
      getNetworkOperatorName: function() { return ''; },
      getSimOperator: function() { return ''; },
      getSimOperatorName: function() { return ''; },
      getSimCountryIso: function() { return 'us'; },
      getNetworkCountryIso: function() { return 'us'; },
      getLocale: function() { return 'en_US'; },
      getLanguage: function() { return 'en'; },
      getCountry: function() { return 'US'; },
      getTimezone: function() { return 'America/Los_Angeles'; },
      
      // File system methods
      getExternalStorageDirectory: function() { return '/storage/emulated/0'; },
      getExternalFilesDir: function() { return '/storage/emulated/0/Android/data/com.ankamagames.dofustouch/files'; },
      getFilesDir: function() { return '/data/data/com.ankamagames.dofustouch/files'; },
      getCacheDir: function() { return '/data/data/com.ankamagames.dofustouch/cache'; },
      
      // Device capabilities
      hasCamera: function() { return true; },
      hasMicrophone: function() { return true; },
      hasGps: function() { return true; },
      hasAccelerometer: function() { return true; },
      hasGyroscope: function() { return true; },
      
      // Battery info
      getBatteryLevel: function() { return 85; },
      isBatteryCharging: function() { return true; },
      
      // Screen properties
      getScreenWidth: function() { return window.innerWidth; },
      getScreenHeight: function() { return window.innerHeight; },
      getScreenDensity: function() { return 2.0; },
      
      // Package info
      getPackageName: function() { return 'com.ankamagames.dofustouch'; },
      getVersionName: function() { return '3.7.1'; },
      getVersionCode: function() { return 371; },
      getInstallerPackageName: function() { return 'com.android.vending'; },
      
      // App-specific methods
      getAppSignature: function() { return 'a1b2c3d4e5f6g7h8i9j0'; },
      getAppCertificates: function() { return ['a1b2c3d4e5f6g7h8i9j0']; },
      
      // System properties
      getSystemProperty: function(key) {
        const properties = {
          'ro.build.version.release': '11',
          'ro.build.version.sdk': '30',
          'ro.product.manufacturer': 'Samsung',
          'ro.product.model': 'SM-T510',
          'ro.product.name': 'gta3xlwifi',
          'ro.build.id': '${deviceInfo.buildId}',
          'ro.build.fingerprint': '${deviceInfo.buildFingerprint}'
        };
        return properties[key] || '';
      }
    };
    
    // Add DofusTouch object
    window.DofusTouch = {
      version: '3.7.1',
      buildVersion: '1.87.16',
      platform: 'android',
      getDeviceInfo: function() {
        return {
          model: '${deviceInfo.deviceModel}',
          manufacturer: '${deviceInfo.deviceManufacturer}',
          platform: 'Android',
          version: '${deviceInfo.deviceVersion}',
          uuid: '${deviceInfo.androidId}',
          isVirtual: false
        };
      }
    };
    
    // Intercept fetch and XMLHttpRequest to add mobile headers
    const originalFetch = window.fetch;
    window.fetch = function(...args) {
      // Add mobile headers to fetch requests
      if (args[1] && typeof args[1] === 'object') {
        if (!args[1].headers) {
          args[1].headers = {};
        }
        args[1].headers['X-DofusTouch-Version'] = '3.7.1';
        args[1].headers['X-Android-Version'] = '11';
        args[1].headers['User-Agent'] = 'Mozilla/5.0 (Linux; Android 11; SM-T510) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/96.0.4664.104 Mobile Safari/537.36 DofusTouch/3.7.1';
      }
      return originalFetch.apply(this, args);
    };
    
    // Intercept XMLHttpRequest
    const originalXHROpen = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function(...args) {
      const result = originalXHROpen.apply(this, args);
      this.setRequestHeader('X-DofusTouch-Version', '3.7.1');
      this.setRequestHeader('X-Android-Version', '11');
      this.setRequestHeader('User-Agent', 'Mozilla/5.0 (Linux; Android 11; SM-T510) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/96.0.4664.104 Mobile Safari/537.36 DofusTouch/3.7.1');
      return result;
    };
    
    console.log('Android environment emulation injected');
  `;
  
  // Create a script element and inject the Android environment
  const scriptElement = document.createElement('script');
  scriptElement.textContent = androidScript;
  
  // Append the script to the document to execute it
  (targetWindow as any).document.head.appendChild(scriptElement);
  
  // Remove the script element after execution
  (targetWindow as any).document.head.removeChild(scriptElement);
  
  console.log('Android environment emulation injected successfully');
};

export default injectAndroidEnvironment; 