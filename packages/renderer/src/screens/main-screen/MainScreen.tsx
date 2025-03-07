import React, { useEffect, useRef, useState } from 'react'
import { Box, Button, Tooltip } from '@mui/material'
import { SideBar } from './side-bar/SideBar'
import { Observer } from 'mobx-react-lite'
import { GameScreen } from './game-screen/GameScreen'
import { useStores } from '@/store'
import { TabManager } from './tab-manager'
import { useGameContext } from '@/providers'
import { WSAModeScreen } from './wsa-mode-screen'
import AndroidIcon from '@mui/icons-material/Android'
import DesktopWindowsIcon from '@mui/icons-material/DesktopWindows'

export const MainScreen = () => {
  const { gameStore } = useStores()
  const gameContext = useGameContext()
  const didLoadGames = useRef(false)
  const [wsaMode, setWsaMode] = useState(false)

  useEffect(() => {
    if (didLoadGames.current === true) {
      return
    }
    didLoadGames.current = true
    if (gameContext.multiAccount) {
      gameStore.gamesFromTeamWindow(gameContext.multiAccount)
    } else {
      gameStore.addGame()
    }
  }, [])

  const toggleWSAMode = () => {
    setWsaMode(!wsaMode)
  }

  return (
    <TabManager>
      <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', p: 1, borderBottom: '1px solid rgba(255, 255, 255, 0.12)' }}>
          <Tooltip title={wsaMode ? 'Switch to Standard Mode' : 'Switch to WSA Mode'}>
            <Button
              variant="outlined"
              size="small"
              onClick={toggleWSAMode}
              startIcon={wsaMode ? <DesktopWindowsIcon /> : <AndroidIcon />}
            >
              {wsaMode ? 'Standard Mode' : 'WSA Mode'}
            </Button>
          </Tooltip>
        </Box>
        
        {wsaMode ? (
          <WSAModeScreen />
        ) : (
          <Box sx={{ display: 'flex', flex: 1 }} height="100%" width="100vw">
            <SideBar />
            <Box sx={{ display: 'flex', position: 'relative', flex: 1 }}>
              <Observer>
                {() => (
                  <>
                    {gameStore.games.map((game) => {
                      const selected = gameStore.selectedGame?.id === game.id
                      return (
                        <div
                          style={{
                            display: 'block',
                            width: '100%',
                            height: '100%',
                            position: 'absolute',
                            overflow: 'hidden',
                            visibility: selected ? 'visible' : 'hidden'
                          }}
                          key={game.id}
                        >
                          <GameScreen key={game.id} game={game} />
                        </div>
                      )
                    })}
                  </>
                )}
              </Observer>
            </Box>
          </Box>
        )}
      </Box>
    </TabManager>
  )
}
