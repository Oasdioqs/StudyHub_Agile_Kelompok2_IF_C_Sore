import * as SecureStore from 'expo-secure-store'
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { AuthUser } from './api'
import { loginWithPassword } from './api'

const TOKEN_KEY = 'studyhub_token'
const USER_KEY = 'studyhub_user_json'

type AuthState = {
  token: string | null
  user: AuthUser | null
  ready: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(null)
  const [user, setUser] = useState<AuthUser | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const [t, u] = await Promise.all([SecureStore.getItemAsync(TOKEN_KEY), SecureStore.getItemAsync(USER_KEY)])
        if (cancelled) return
        if (t && u) {
          setToken(t)
          setUser(JSON.parse(u) as AuthUser)
        }
      } catch {
        /* empty */
      } finally {
        if (!cancelled) setReady(true)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    const res = await loginWithPassword(email, password)
    await SecureStore.setItemAsync(TOKEN_KEY, res.token)
    await SecureStore.setItemAsync(USER_KEY, JSON.stringify(res.user))
    setToken(res.token)
    setUser(res.user)
  }, [])

  const logout = useCallback(async () => {
    await SecureStore.deleteItemAsync(TOKEN_KEY)
    await SecureStore.deleteItemAsync(USER_KEY)
    setToken(null)
    setUser(null)
  }, [])

  const value = useMemo(
    () => ({ token, user, ready, login, logout }),
    [token, user, ready, login, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
