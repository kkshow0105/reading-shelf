import { createContext, useContext, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { getSupabaseClient } from '../../lib/supabase.ts'
import { createAuthService } from './service.ts'
import { sessionState, saveActiveProfile, accessMessage } from './policies.ts'
import type { AuthState } from './policies.ts'

type AuthContextValue = { state: AuthState; error: string | null; retry: () => void;
  login: (email: string, password: string) => Promise<void>; logout: () => Promise<void> }
const AuthContext = createContext<AuthContextValue | null>(null)
export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ status: 'loading', user: null })
  const [error, setError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)
  const revision = useRef(0)
  useEffect(() => {
    let live = true
    let unsubscribe = () => {}
    setError(null); setState({ status: 'loading', user: null })
    const start = ++revision.current
    // Even SDK initialization / storage problems must not leave an endless spinner.
    const timeout = window.setTimeout(() => {
      if (live && revision.current === start) setError('暂时无法连接书房，请稍后重试。')
    }, 16000)
    try {
      const auth = createAuthService(getSupabaseClient())
      const subscription = auth.onAuthStateChange((event, session) => {
        if (!live || event === 'INITIAL_SESSION') return
        ++revision.current
        window.clearTimeout(timeout)
        if (event === 'SIGNED_OUT') saveActiveProfile(null)
        setError(null); setState(sessionState(session))
      })
      unsubscribe = () => subscription.unsubscribe()
      void auth.restore().then(session => {
        if (!live || start !== revision.current) return
        window.clearTimeout(timeout)
        if (!session) saveActiveProfile(null)
        setError(null); setState(sessionState(session))
      }).catch(reason => {
        if (live && start === revision.current) { window.clearTimeout(timeout); setError(accessMessage(reason)) }
      })
    } catch {
      window.clearTimeout(timeout)
      setError('书房连接尚未配置，请检查本机环境设置。')
    }
    return () => { live = false; window.clearTimeout(timeout); unsubscribe() }
  }, [attempt])
  const value: AuthContextValue = { state, error, retry: () => setAttempt(value => value + 1),
    async login(email, password) {
      const session = await createAuthService(getSupabaseClient()).signInWithPassword(email, password)
      setError(null); setState(sessionState(session))
    },
    async logout() {
      await createAuthService(getSupabaseClient()).signOut()
      saveActiveProfile(null); setError(null); setState({ status: 'unauthenticated', user: null })
      window.history.replaceState(null, '', `${window.location.pathname}#/login`)
    },
  }
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
export function useAuth() {
  const value = useContext(AuthContext)
  if (!value) throw new Error('AuthProvider 未挂载。')
  return value
}
