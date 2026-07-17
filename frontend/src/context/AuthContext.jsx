import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { fetchCurrentUser } from '../services/api.js'

const AuthContext = createContext(null)

const TOKEN_KEY = 'ai_tutor_token'

export function AuthProvider({ children }) {
  const [token, setToken] = useState(null)
  const [user, setUser] = useState(null) // the REAL authenticated user, from the backend
  const [isLoading, setIsLoading] = useState(true)

  // Loads (or reloads) the current user from the backend using whatever
  // token is currently set. This is the only source of truth for "who is
  // logged in" -- we never trust cached/local data for identity.
  const loadUser = useCallback(async () => {
    try {
      const me = await fetchCurrentUser()
      setUser(me)
    } catch {
      // Token is invalid/expired -- treat as logged out rather than showing
      // stale or wrong user data.
      localStorage.removeItem(TOKEN_KEY)
      setToken(null)
      setUser(null)
    }
  }, [])

  useEffect(() => {
    const stored = localStorage.getItem(TOKEN_KEY)
    if (stored) {
      setToken(stored)
      loadUser().finally(() => setIsLoading(false))
    } else {
      setIsLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const login = async (newToken) => {
    localStorage.setItem(TOKEN_KEY, newToken)
    setToken(newToken)
    // Always fetch fresh user info on login rather than reusing anything
    // left over from a previous session in this tab.
    await loadUser()
  }

  const logout = () => {
    localStorage.removeItem(TOKEN_KEY)
    setToken(null)
    setUser(null)
    // Clears anything a previous version of the app may have left in
    // sessionStorage; this app doesn't use it today, but a stray value
    // here should never survive a logout regardless.
    sessionStorage.clear()
  }

  const value = {
    token,
    user, // { id, email, full_name } from the backend, or null
    isAuthenticated: Boolean(token && user),
    isLoading,
    login,
    logout
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider')
  return ctx
}
