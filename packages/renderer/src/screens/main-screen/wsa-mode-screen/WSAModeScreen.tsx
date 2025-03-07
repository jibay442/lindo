import React, { useEffect, useState } from 'react'
import { Box, Button, Typography, CircularProgress, Alert, Paper, Divider, List, ListItem, ListItemText, ListItemIcon } from '@mui/material'
import { useI18nContext } from '@lindo/i18n'
import AndroidIcon from '@mui/icons-material/Android'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import ErrorIcon from '@mui/icons-material/Error'
import InfoIcon from '@mui/icons-material/Info'
import WarningIcon from '@mui/icons-material/Warning'

interface WSARequirements {
  meetsRequirements: boolean
  issues: string[]
}

export const WSAModeScreen: React.FC = () => {
  const { LL } = useI18nContext()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [wsaRequirements, setWsaRequirements] = useState<WSARequirements | null>(null)
  const [wsaWindowCreated, setWsaWindowCreated] = useState(false)
  
  // Check WSA requirements on component mount
  useEffect(() => {
    checkWSARequirements()
  }, [])
  
  // Check WSA requirements
  const checkWSARequirements = async () => {
    try {
      setLoading(true)
      setError(null)
      
      const requirements = await window.lindoAPI.checkWSARequirements()
      setWsaRequirements(requirements)
      
      if (!requirements.meetsRequirements) {
        setError('WSA requirements not met')
      }
    } catch (error) {
      setError('Failed to check WSA requirements: ' + (error as Error).message)
    } finally {
      setLoading(false)
    }
  }
  
  // Create WSA window
  const createWSAWindow = async () => {
    try {
      setLoading(true)
      setError(null)
      
      const created = await window.lindoAPI.createWSAWindow()
      setWsaWindowCreated(created)
      
      if (!created) {
        setError('Failed to create WSA window')
      }
    } catch (error) {
      setError('Failed to create WSA window: ' + (error as Error).message)
    } finally {
      setLoading(false)
    }
  }
  
  // Close WSA window
  const closeWSAWindow = async () => {
    try {
      setLoading(true)
      setError(null)
      
      await window.lindoAPI.closeWSAWindow()
      setWsaWindowCreated(false)
    } catch (error) {
      setError('Failed to close WSA window: ' + (error as Error).message)
    } finally {
      setLoading(false)
    }
  }
  
  return (
    <Box sx={{ p: 3, height: '100%', overflow: 'auto' }}>
      <Typography variant="h4" gutterBottom>
        <AndroidIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
        Windows Subsystem for Android Mode
      </Typography>
      
      <Typography variant="body1" paragraph>
        This mode uses Windows Subsystem for Android (WSA) to run the official Dofus Touch Android app.
      </Typography>
      
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}
      
      <Paper sx={{ p: 2, mb: 2 }}>
        <Typography variant="h6" gutterBottom>
          System Requirements
        </Typography>
        
        {loading && !wsaRequirements ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 2 }}>
            <CircularProgress />
          </Box>
        ) : wsaRequirements ? (
          <>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
              {wsaRequirements.meetsRequirements ? (
                <CheckCircleIcon color="success" sx={{ mr: 1 }} />
              ) : (
                <ErrorIcon color="error" sx={{ mr: 1 }} />
              )}
              <Typography>
                {wsaRequirements.meetsRequirements
                  ? 'Your system meets all requirements'
                  : 'Your system does not meet all requirements'}
              </Typography>
            </Box>
            
            {wsaRequirements.issues.length > 0 && (
              <List dense>
                {wsaRequirements.issues.map((issue, index) => (
                  <ListItem key={index}>
                    <ListItemIcon>
                      <WarningIcon color="warning" />
                    </ListItemIcon>
                    <ListItemText primary={issue} />
                  </ListItem>
                ))}
              </List>
            )}
            
            <Button
              variant="outlined"
              onClick={checkWSARequirements}
              disabled={loading}
              sx={{ mt: 1 }}
            >
              Refresh
            </Button>
          </>
        ) : (
          <Button
            variant="outlined"
            onClick={checkWSARequirements}
            disabled={loading}
          >
            Check Requirements
          </Button>
        )}
      </Paper>
      
      <Paper sx={{ p: 2 }}>
        <Typography variant="h6" gutterBottom>
          Dofus Touch (Android)
        </Typography>
        
        {wsaWindowCreated ? (
          <Box>
            <Alert severity="success" sx={{ mb: 2 }}>
              Dofus Touch is running in WSA mode
            </Alert>
            
            <Button
              variant="contained"
              color="error"
              onClick={closeWSAWindow}
              disabled={loading}
              fullWidth
            >
              {loading ? <CircularProgress size={24} /> : 'Stop Dofus Touch'}
            </Button>
          </Box>
        ) : (
          <Box>
            <Alert severity="info" sx={{ mb: 2 }}>
              <InfoIcon sx={{ mr: 1 }} />
              Click the button below to launch Dofus Touch using Windows Subsystem for Android
            </Alert>
            
            <Button
              variant="contained"
              color="primary"
              onClick={createWSAWindow}
              disabled={loading || (wsaRequirements ? !wsaRequirements.meetsRequirements : true)}
              fullWidth
            >
              {loading ? <CircularProgress size={24} color="inherit" /> : 'Launch Dofus Touch'}
            </Button>
          </Box>
        )}
      </Paper>
      
      <Box sx={{ mt: 2 }}>
        <Divider sx={{ mb: 2 }} />
        
        <Typography variant="body2" color="text.secondary">
          Note: Windows Subsystem for Android is only available on Windows 11. Make sure you have installed it from the Microsoft Store and set it up properly.
        </Typography>
      </Box>
    </Box>
  )
} 