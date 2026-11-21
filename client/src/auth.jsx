import { createContext, useContext, useEffect, useState } from 'react'
import { loadSession, saveSession, setUnauthorizedHandler } from './api.js'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(loadSession)

  const login = (s) => {
    saveSession(s)
    setSession(s)
  }
  const logout = () => {
    saveSession(null)
    setSession(null)
  }

  // Any API call answered with 401 (expired token) logs the user out
  useEffect(() => setUnauthorizedHandler(logout), [])

  return <AuthContext.Provider value={{ user: session?.user ?? null, login, logout }}>{children}</AuthContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => useContext(AuthContext)
