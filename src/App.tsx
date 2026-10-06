import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { AuthProvider, useAuth } from './data/auth/AuthProvider'
import { createHouseholdService } from './data/auth/service'
import type { HouseholdAccess } from './data/auth/service'
import { accessMessage, readActiveProfile, saveActiveProfile, validActiveProfile, isInvalidSession, errorCode } from './data/auth/policies'
import { getSupabaseClient } from './lib/supabase'
import { LoginPage } from './pages/LoginPage'
import { HouseholdBootstrapPage } from './pages/HouseholdBootstrapPage'
import { ProfilesPage } from './pages/ProfilesPage'
import { Header } from './components/Header'
import { Button } from './components/ui/button'
import { useMediaQuery } from './lib/useMediaQuery'
import type { Theme } from './types'

function AccessStatus({ message, retry }: { message?: string; retry?: () => void }) {
  return <main id="main-content" className="access-status page-shell" tabIndex={-1}>
    {message ? <><p role="alert">{message}</p>{retry && <Button variant="outline" onClick={retry}>重试</Button>}</> : <div role="status" aria-live="polite"><div className="quiet-loading" aria-hidden="true" /><p>正在打开书房…</p></div>}
  </main>
}
function HouseholdArea({ theme, onTheme }: { theme: Theme; onTheme: (theme: Theme) => void }) {
  const { state, logout } = useAuth()
  const userId = state.user!.id
  const [household, setHousehold] = useState<HouseholdAccess | null>(null)
  const [ready, setReady] = useState(false), [error, setError] = useState<string | null>(null)
  const [logoutError, setLogoutError] = useState<string | null>(null), [logoutBusy, setLogoutBusy] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [path, setPath] = useState(() => window.location.hash.slice(1))
  const live = useRef(false)
  const requestRevision = useRef(0)
  const profiles = household?.profiles.map(item => item.profile) ?? []
  const active = profiles.find(profile => profile.id === activeId)
  const navigate = (next: string) => { window.location.hash = next; setPath(next) }
  const adopt = (result: HouseholdAccess | null) => {
    setHousehold(result); setReady(true); setError(null)
    const selected = result ? validActiveProfile(readActiveProfile(), result.profiles, result.id) : null
    saveActiveProfile(selected); setActiveId(selected)
  }
  useEffect(() => {
    live.current = true
    const revision = ++requestRevision.current
    setReady(false); setError(null)
    void createHouseholdService(getSupabaseClient()).load(userId).then(result => {
      if (live.current && revision === requestRevision.current) adopt(result)
    }).catch(reason => {
      if (!live.current || revision !== requestRevision.current) return
      if (isInvalidSession(reason) || errorCode(reason) === 'PGRST301') {
        void logout().catch(() => { if (live.current) setError('登录已失效，请重新登录。') })
      } else setError(accessMessage(reason))
    })
    return () => { live.current = false; ++requestRevision.current }
  }, [userId, attempt])
  useEffect(() => {
    const changed = () => setPath(window.location.hash.slice(1))
    window.addEventListener('hashchange', changed)
    return () => window.removeEventListener('hashchange', changed)
  }, [])
  useEffect(() => {
    if (!ready) return
    if (!household) { if (path !== '/setup') navigate('/setup'); return }
    const match = /^\/p\/([^/]+)\/shelf$/.exec(path)
    if (match) {
      const id = validActiveProfile(match[1], household.profiles, household.id)
      if (id) { setActiveId(id); saveActiveProfile(id); return }
    }
    if (!path || path === '/login') {
      const id = validActiveProfile(readActiveProfile(), household.profiles, household.id)
      navigate(id ? `/p/${id}/shelf` : '/profiles')
    } else if (path === '/profiles') setActiveId(null)
    else navigate('/profiles')
  }, [path, household, ready])
  useLayoutEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' })
    document.getElementById('main-content')?.focus({ preventScroll: true })
  }, [path, ready])
  const exit = async () => {
    if (logoutBusy) return
    setLogoutBusy(true); setLogoutError(null)
    try { await logout() } catch (reason) { if (live.current) { setLogoutError(accessMessage(reason)); setLogoutBusy(false) } }
  }
  return <>
    <Header profiles={profiles} profile={ready && household ? active : undefined} theme={theme} onTheme={onTheme} onNavigate={navigate} onLogout={() => void exit()} logoutBusy={logoutBusy} />
    {logoutError && <p className="page-shell access-error" role="alert">{logoutError}</p>}
    {error || !ready ? <AccessStatus message={error ?? undefined} retry={() => setAttempt(value => value + 1)} /> : !household ? <HouseholdBootstrapPage onCreate={async (name, names) => {
      const revision = requestRevision.current
      const result = await createHouseholdService(getSupabaseClient()).bootstrap(userId, name, names)
      if (live.current && revision === requestRevision.current) { adopt(result); navigate('/profiles') }
    }} /> : !active ? <ProfilesPage profiles={profiles} onNavigate={navigate} /> : <main id="main-content" className="profiles-page page-shell page-enter" tabIndex={-1}>
      <div className="profiles-intro"><span className="editorial-label">EX LIBRIS · 私人藏书</span><h1>{active.name}的书房</h1><p>书房已准备好。阅读记录将在后续开放。</p></div>
      <Button className="selected-profile-back" onClick={() => navigate('/profiles')}>选择另一间书房</Button>
    </main>}
  </>
}
function AuthenticatedApp() {
  const { state, error, retry, login } = useAuth()
  const [theme, setTheme] = useState<Theme>('system')
  const dark = useMediaQuery('(prefers-color-scheme: dark)')
  useLayoutEffect(() => {
    document.documentElement.dataset.theme = theme === 'system' ? dark ? 'dark' : 'light' : theme
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', document.documentElement.dataset.theme === 'dark' ? '#211F1B' : '#F4F0E8')
  }, [theme, dark])
  useEffect(() => {
    document.title = '私人书架 · Reading Shelf'
    if (state.status === 'unauthenticated') window.history.replaceState(null, '', `${window.location.pathname}#/login`)
  }, [state.status])
  return <>
    {state.status === 'authenticated' ? <HouseholdArea key={state.user.id} theme={theme} onTheme={setTheme} /> : <>
      <Header profiles={[]} theme={theme} onTheme={setTheme} onNavigate={() => {}} />
      {state.status === 'loading' ? <AccessStatus message={error ?? undefined} retry={retry} /> : <LoginPage onLogin={login} />}
    </>}
    <footer className="site-footer page-shell"><span>READING SHELF</span><span>各自的书单，共同的书房。</span></footer>
  </>
}
// PrototypeApp preserves stage-3 books/forms; never bind its mock IDs to real Profiles.
export default function App() { return <AuthProvider><AuthenticatedApp /></AuthProvider> }
