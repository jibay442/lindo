/**
 * Google Play Services Emulation
 * 
 * This file contains code to emulate Google Play Services APIs that Dofus Touch might be checking for.
 * It implements the most commonly used Google Play Services interfaces and methods.
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

// Generate a random Google account ID
const generateGoogleAccountId = (): string => {
  return Math.floor(Math.random() * 1000000000).toString();
};

// Device information
const deviceInfo = {
  androidId: generateAndroidId(),
  deviceModel: 'SM-T510',
  deviceManufacturer: 'Samsung',
  deviceProduct: 'gta3xlwifi',
  deviceSdk: '30', // Android 11
  deviceVersion: '11',
  isTablet: true,
  googleAccountId: generateGoogleAccountId(),
  googleAccountName: 'user' + Math.floor(Math.random() * 1000) + '@gmail.com',
};

/**
 * Injects Google Play Services emulation into the given window
 */
export const injectGooglePlayServices = (targetWindow: Window): void => {
  // Create the base gapi object
  const gapi = {
    auth: {
      authorize: (params: any, callback: Function) => {
        console.log('Google Play Services: auth.authorize called with params', params);
        // Simulate successful authorization
        setTimeout(() => {
          callback({
            access_token: 'fake_access_token_' + Math.random().toString(36).substring(2),
            expires_in: 3600,
            token_type: 'Bearer',
            state: params.state || '',
            error: false
          });
        }, 500);
      },
      getToken: (params: any, callback: Function) => {
        console.log('Google Play Services: auth.getToken called with params', params);
        // Simulate successful token retrieval
        setTimeout(() => {
          callback({
            access_token: 'fake_access_token_' + Math.random().toString(36).substring(2),
            expires_in: 3600,
            token_type: 'Bearer'
          });
        }, 300);
      }
    },
    client: {
      init: (params: any) => {
        console.log('Google Play Services: client.init called with params', params);
        return Promise.resolve();
      },
      load: (apiName: string, version: string, callback: Function) => {
        console.log(`Google Play Services: client.load called for ${apiName} v${version}`);
        setTimeout(() => {
          callback();
        }, 200);
      }
    },
    signin2: {
      render: (elementId: string, options: any) => {
        console.log('Google Play Services: signin2.render called for element', elementId, 'with options', options);
        // Find the element and add a fake sign-in button
        const element = document.getElementById(elementId);
        if (element) {
          element.innerHTML = '<div class="g-signin2-button">Google Sign In</div>';
          element.addEventListener('click', () => {
            // Simulate successful sign-in
            if (options.onsuccess) {
              const user = {
                getBasicProfile: () => ({
                  getId: () => deviceInfo.googleAccountId,
                  getName: () => 'Test User',
                  getEmail: () => deviceInfo.googleAccountName,
                  getImageUrl: () => 'https://example.com/profile.jpg'
                }),
                getAuthResponse: () => ({
                  id_token: 'fake_id_token_' + Math.random().toString(36).substring(2),
                  access_token: 'fake_access_token_' + Math.random().toString(36).substring(2),
                  expires_in: 3600,
                  token_type: 'Bearer'
                })
              };
              options.onsuccess(user);
            }
          });
        }
      }
    }
  };

  // Create the Google Play Games API
  const games = {
    Player: {
      getCurrentPlayer: (callback: Function) => {
        console.log('Google Play Games: Player.getCurrentPlayer called');
        setTimeout(() => {
          callback({
            getDisplayName: () => 'Player' + Math.floor(Math.random() * 1000),
            getPlayerId: () => 'gp_' + Math.floor(Math.random() * 1000000000),
            getAvatarImageUrl: () => 'https://example.com/avatar.jpg'
          });
        }, 300);
      }
    },
    Achievements: {
      unlock: (achievementId: string) => {
        console.log('Google Play Games: Achievements.unlock called for', achievementId);
        return Promise.resolve({ result: true });
      },
      increment: (achievementId: string, steps: number) => {
        console.log('Google Play Games: Achievements.increment called for', achievementId, 'with steps', steps);
        return Promise.resolve({ result: true });
      },
      show: () => {
        console.log('Google Play Games: Achievements.show called');
        return Promise.resolve({ result: true });
      }
    },
    Leaderboards: {
      submitScore: (leaderboardId: string, score: number) => {
        console.log('Google Play Games: Leaderboards.submitScore called for', leaderboardId, 'with score', score);
        return Promise.resolve({ result: true });
      },
      show: (leaderboardId?: string) => {
        console.log('Google Play Games: Leaderboards.show called for', leaderboardId || 'all leaderboards');
        return Promise.resolve({ result: true });
      }
    }
  };

  // Create the Google Play Services object
  const googlePlayServices = {
    isAvailable: true,
    isConnected: true,
    connect: (callback: Function) => {
      console.log('Google Play Services: connect called');
      setTimeout(() => {
        callback({ result: true });
      }, 300);
    },
    getVersion: () => {
      console.log('Google Play Services: getVersion called');
      return '23.18.19';
    },
    isUserResolvableError: (errorCode: number) => {
      console.log('Google Play Services: isUserResolvableError called with code', errorCode);
      return false;
    },
    getErrorString: (errorCode: number) => {
      console.log('Google Play Services: getErrorString called with code', errorCode);
      return 'No error';
    }
  };

  // Create the Firebase object
  const firebase = {
    initializeApp: (config: any) => {
      console.log('Firebase: initializeApp called with config', config);
      return {
        auth: () => ({
          signInWithCredential: (credential: any) => {
            console.log('Firebase: auth.signInWithCredential called with credential', credential);
            return Promise.resolve({
              user: {
                uid: 'firebase_' + Math.floor(Math.random() * 1000000000),
                displayName: 'Firebase User',
                email: deviceInfo.googleAccountName,
                emailVerified: true,
                phoneNumber: null,
                photoURL: 'https://example.com/firebase_avatar.jpg',
                providerData: []
              }
            });
          },
          signInAnonymously: () => {
            console.log('Firebase: auth.signInAnonymously called');
            return Promise.resolve({
              user: {
                uid: 'firebase_anon_' + Math.floor(Math.random() * 1000000000),
                isAnonymous: true
              }
            });
          }
        }),
        database: () => ({
          ref: (path: string) => ({
            set: (value: any) => {
              console.log('Firebase: database.ref(' + path + ').set called with value', value);
              return Promise.resolve();
            },
            update: (value: any) => {
              console.log('Firebase: database.ref(' + path + ').update called with value', value);
              return Promise.resolve();
            },
            once: (eventType: string) => {
              console.log('Firebase: database.ref(' + path + ').once called for event', eventType);
              return Promise.resolve({ val: () => ({}) });
            },
            on: (eventType: string, callback: Function) => {
              console.log('Firebase: database.ref(' + path + ').on called for event', eventType);
              callback({ val: () => ({}) });
            }
          })
        })
      };
    }
  };

  // Inject all the objects into the window
  (targetWindow as any).gapi = gapi;
  (targetWindow as any).games = games;
  (targetWindow as any).googlePlayServices = googlePlayServices;
  (targetWindow as any).firebase = firebase;

  // Inject Android device information
  (targetWindow as any).Android = {
    getVersion: () => deviceInfo.deviceVersion,
    getDeviceId: () => deviceInfo.androidId,
    getDeviceModel: () => deviceInfo.deviceModel,
    getDeviceManufacturer: () => deviceInfo.deviceManufacturer,
    getDeviceProduct: () => deviceInfo.deviceProduct,
    getDeviceSdk: () => deviceInfo.deviceSdk,
    isTablet: () => deviceInfo.isTablet,
    getGoogleAccountId: () => deviceInfo.googleAccountId,
    getGoogleAccountName: () => deviceInfo.googleAccountName,
    isGooglePlayServicesAvailable: () => true,
    getGooglePlayServicesVersion: () => '23.18.19'
  };

  // Inject Google Play Store API
  (targetWindow as any).PlayStore = {
    getPackageInfo: (packageName: string) => {
      console.log('PlayStore: getPackageInfo called for', packageName);
      return {
        versionName: '3.7.1',
        versionCode: 371,
        packageName: packageName || 'com.ankamagames.dofustouch',
        firstInstallTime: Date.now() - 30 * 24 * 60 * 60 * 1000, // 30 days ago
        lastUpdateTime: Date.now() - 2 * 24 * 60 * 60 * 1000 // 2 days ago
      };
    },
    isInstalled: (packageName: string) => {
      console.log('PlayStore: isInstalled called for', packageName);
      return packageName === 'com.ankamagames.dofustouch';
    }
  };

  console.log('Google Play Services emulation injected successfully');
};

export default injectGooglePlayServices; 