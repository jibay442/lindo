import { DofusWindow, HTMLIFrameElementWithDofus } from '@/dofus-window'
import { useGameContext } from '@/providers'
import { useStores } from '@/store'
import { Game } from '@/store/game-store/game'
import { useI18nContext } from '@lindo/i18n'
import { reaction } from 'mobx'
import React, { memo, useEffect, useRef } from 'react'
import { useGameManager } from './use-game-manager'
import { injectGooglePlayServices } from '@/utils'

export interface GameScreenProps {
  game: Game
}

// eslint-disable-next-line react/display-name
export const GameScreen = memo(({ game }: GameScreenProps) => {
  const gameContext = useGameContext()
  const rootStore = useStores()
  const { LL } = useI18nContext()
  const gameManager = useGameManager({
    game,
    rootStore,
    LL
  })
  const iframeGameRef = useRef<HTMLIFrameElementWithDofus>(null)

  useEffect(() => {
    return reaction(
      () => rootStore.gameStore.selectedGame,
      (selectedGame) => {
        if (selectedGame?.id === game.id) {
          setTimeout(() => {
            iframeGameRef.current?.focus()
          }, 100)
        }
      },
      { fireImmediately: true }
    )
  }, [])

  const handleLoad = () => {
    if (iframeGameRef.current) {
      const gameWindow = iframeGameRef.current.contentWindow

      // only for debug purpose
      gameWindow.findSingleton = (searchKey: string, window: DofusWindow) => {
        const singletons = Object.values(window.singletons.c)

        const results = singletons.filter(({ exports }) => {
          if (!!exports.prototype && searchKey in exports.prototype) {
            return true
          } else if (searchKey in exports) {
            return true
          } else return false
        })

        if (results.length > 1) {
          window.lindoAPI.logger.error(
            `[MG] Singleton searcher found multiple results for key "${searchKey}". Returning all of them.`
          )()
          return results
        }

        return results.pop()
      }

      // can't use SQL Database in modern iframe
      gameWindow.openDatabase = undefined
      gameWindow.initDofus(() => {
        window.lindoAPI.logger.info('initDofus done')()
        
        // Update the game client version to match the version we're spoofing
        try {
          // Access the document of the game window
          const gameDocument = gameWindow.document;
          
          // Create a script element for version update
          const versionScript = gameDocument.createElement('script');
          versionScript.textContent = `
            // Try to find and update version information
            if (window.gui && window.gui.version) {
              console.log('Original version: ' + window.gui.version);
              window.gui.version = '3.7.1';
              console.log('Updated version to: ' + window.gui.version);
            }
            
            // Update build version if available
            if (window.gui && window.gui.buildVersion) {
              console.log('Original build version: ' + window.gui.buildVersion);
              window.gui.buildVersion = '1.87.16';
              console.log('Updated build version to: ' + window.gui.buildVersion);
            }
            
            // Update any version display elements
            setTimeout(() => {
              const versionElements = document.querySelectorAll('*[class*="version"], *[id*="version"]');
              versionElements.forEach(el => {
                if (el.textContent && el.textContent.includes('3.7.0')) {
                  el.textContent = el.textContent.replace('3.7.0', '3.7.1');
                  console.log('Updated version text in DOM element');
                }
              });
            }, 5000);
          `;
          
          // Create a script element for mobile device emulation
          const mobileScript = gameDocument.createElement('script');
          mobileScript.textContent = `
            // Add Android environment
            window.navigator.userAgent = 'Mozilla/5.0 (Linux; Android 11; SM-T510) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/96.0.4664.104 Mobile Safari/537.36 DofusTouch/3.7.1';
            
            // Add Android-specific properties
            window.navigator.platform = 'Android';
            window.navigator.appVersion = '5.0 (Linux; Android 11; SM-T510) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/96.0.4664.104 Mobile Safari/537.36 DofusTouch/3.7.1';
            
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
            
            console.log('Mobile device emulation injected');
          `;
          
          // Append the scripts to the document to execute them
          gameDocument.head.appendChild(versionScript);
          gameDocument.head.appendChild(mobileScript);
          
          // Remove the script elements after execution
          gameDocument.head.removeChild(versionScript);
          gameDocument.head.removeChild(mobileScript);
          
          // Inject Google Play Services emulation
          injectGooglePlayServices(gameWindow);
          
          // Log success
          console.log('All emulation scripts injected successfully');
        } catch (error) {
          window.lindoAPI.logger.error('Failed to update game client version: ' + error)();
        }
        
        gameManager.init(gameWindow)
      })
    }
  }

  return (
    <iframe
      id={`iframe-game-${game.id}`}
      ref={iframeGameRef}
      onLoad={handleLoad}
      style={{ border: 'none', width: '100%', height: '100%' }}
      src={gameContext.gameSrc}
    />
  )
})
