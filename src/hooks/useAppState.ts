import { useCallback, useEffect, useRef, useState } from 'react'
import { EMPTY_STATE } from '../domain/defaults'
import type { AppState } from '../domain/types'
import {
  getAuthToken,
  loadAppState,
  loginAdmin,
  logoutAdmin,
  saveAppState,
  type AdminUser,
  type StorageMode,
} from '../storage/appStore'

export function useAppState() {
  const [state, setState] = useState<AppState>(EMPTY_STATE)
  const [loading, setLoading] = useState(true)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [storageMode, setStorageMode] = useState<StorageMode>('local')
  const [user, setUser] = useState<AdminUser | null>(null)
  const [authRequired, setAuthRequired] = useState(false)
  const [authError, setAuthError] = useState('')
  const loadedRef = useRef(false)

  const refreshState = useCallback(async () => {
    const loaded = await loadAppState()
    setState(loaded.state)
    setStorageMode(loaded.storageMode)
    setUser(loaded.user)
    setAuthRequired(loaded.authRequired)
    loadedRef.current = true
  }, [])

  useEffect(() => {
    let mounted = true

    refreshState()
      .catch(() => {
        if (mounted) {
          setSaveStatus('error')
        }
      })
      .finally(() => {
        if (mounted) {
          setLoading(false)
        }
      })

    return () => {
      mounted = false
    }
  }, [refreshState])

  useEffect(() => {
    if (!loadedRef.current) {
      return
    }

    if (storageMode === 'server' && !user) {
      setSaveStatus('idle')
      return
    }

    setSaveStatus('saving')
    const timer = window.setTimeout(() => {
      saveAppState(state, { storageMode, token: getAuthToken() })
        .then(() => setSaveStatus('saved'))
        .catch(() => setSaveStatus('error'))
    }, 250)

    return () => window.clearTimeout(timer)
  }, [state, storageMode, user])

  const login = useCallback(
    async (username: string, password: string) => {
      setAuthError('')
      const result = await loginAdmin(username, password).catch((error: Error) => {
        setAuthError(error.message)
        throw error
      })
      setUser(result.user)
      await refreshState()
    },
    [refreshState],
  )

  const logout = useCallback(async () => {
    await logoutAdmin()
    setUser(null)
    await refreshState()
  }, [refreshState])

  return {
    state,
    setState,
    loading,
    saveStatus,
    storageMode,
    user,
    canEdit: storageMode !== 'server' || Boolean(user),
    authRequired,
    authError,
    login,
    logout,
    refreshState,
  }
}
