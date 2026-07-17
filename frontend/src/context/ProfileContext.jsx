import { createContext, useContext, useEffect, useState } from 'react'
import { useAuth } from './AuthContext.jsx'

// NOTE: The backend's User model has no "class/year" field, so this stays a
// local-only convenience value -- but it is namespaced per user (by email)
// so it can never leak between accounts on a shared device, and it clears
// itself when nobody's logged in. The display NAME, by contrast, always
// comes from AuthContext's real `user` (fetched fresh from the backend on
// every login) -- never from here.
const ProfileContext = createContext(null)
const DEFAULT_CLASS_YEAR = 'Add your class'

function storageKeyFor(email) {
  return email ? `studyflow_classyear:${email}` : null
}

export function ProfileProvider({ children }) {
  const { user } = useAuth()
  const storageKey = storageKeyFor(user?.email)
  const [classYear, setClassYearState] = useState(DEFAULT_CLASS_YEAR)

  // Reload (or reset) whenever the logged-in user changes, so switching
  // accounts on the same device never shows the previous account's value.
  useEffect(() => {
    if (!storageKey) {
      setClassYearState(DEFAULT_CLASS_YEAR)
      return
    }
    setClassYearState(localStorage.getItem(storageKey) || DEFAULT_CLASS_YEAR)
  }, [storageKey])

  const setClassYear = (value) => {
    const next = value.trim() || DEFAULT_CLASS_YEAR
    setClassYearState(next)
    if (storageKey) localStorage.setItem(storageKey, next)
  }

  return (
    <ProfileContext.Provider value={{ classYear, setClassYear }}>
      {children}
    </ProfileContext.Provider>
  )
}

export function useProfile() {
  const ctx = useContext(ProfileContext)
  if (!ctx) throw new Error('useProfile must be used within a ProfileProvider')
  return ctx
}
