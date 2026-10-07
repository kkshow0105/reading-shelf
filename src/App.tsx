import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { AuthProvider, useAuth } from './data/auth/AuthProvider'
import { createHouseholdService } from './data/auth/service'
import type { HouseholdAccess } from './data/auth/service'
import { accessMessage, isInvalidSession, errorCode } from './data/auth/policies'
import { ReadingDrafts } from './data/books/model'
import { getSupabaseClient } from './lib/supabase'
import { LoginPage } from './pages/LoginPage'
import { HouseholdBootstrapPage } from './pages/HouseholdBootstrapPage'
import { Header } from './components/Header'
import { BooksWorkspace } from './components/BooksWorkspace'
import { Button } from './components/ui/button'
import { useMediaQuery } from './lib/useMediaQuery'
import type { Theme } from './types'
import { PwaProvider, usePwa, usePwaUpdateGuard } from './pwa/PwaProvider'

function AccessStatus({ message, retry }: { message?: string; retry?: () => void }) {
  return <main id="main-content" className="access-status page-shell" tabIndex={-1}>
    {message ? <><p role="alert">{message}</p>{retry && <Button variant="outline" onClick={retry}>重试</Button>}</> : <div role="status" aria-live="polite"><div className="quiet-loading" aria-hidden="true" /><p>正在打开书房…</p></div>}
  </main>
}
function HouseholdArea({ theme, onTheme, drafts }: { theme: Theme; onTheme: (theme: Theme) => void; drafts: ReadingDrafts }) {
  const { state, logout } = useAuth()
  const userId = state.user!.id
  const [household, setHousehold] = useState<HouseholdAccess | null>(null)
  const [ready, setReady] = useState(false), [error, setError] = useState<string | null>(null)
  const [logoutError, setLogoutError] = useState<string | null>(null), [logoutBusy, setLogoutBusy] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const live = useRef(false), requestRevision = useRef(0)
  const adopt = (result: HouseholdAccess | null) => { setHousehold(result); setReady(true); setError(null) }
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
  useEffect(() => { if (ready && !household) window.history.replaceState(null, '', `${window.location.pathname}#/setup`) }, [ready, household])
  const exit = async () => {
    if (logoutBusy) return
    if (drafts.hasUser(userId)) { setLogoutError('本次会话还有未保存草稿，请先打开书架处理草稿。'); return }
    setLogoutBusy(true); setLogoutError(null)
    try { await logout(); drafts.clearUser(userId) } catch (reason) { if (live.current) { setLogoutError(accessMessage(reason)); setLogoutBusy(false) } }
  }
  if (ready && household) return <BooksWorkspace userId={userId} household={household} theme={theme} onTheme={onTheme} logout={logout} drafts={drafts} />
  return <>
    <Header profiles={[]} theme={theme} onTheme={onTheme} onNavigate={() => {}} onLogout={() => void exit()} logoutBusy={logoutBusy} />
    {logoutError && <p className="page-shell access-error" role="alert">{logoutError}</p>}
    {error || !ready ? <AccessStatus message={error ?? undefined} retry={() => setAttempt(value => value + 1)} /> : <HouseholdBootstrapPage onCreate={async (name, names) => {
      const revision = requestRevision.current
      const result = await createHouseholdService(getSupabaseClient()).bootstrap(userId, name, names)
      if (live.current && revision === requestRevision.current) { window.history.replaceState(null, '', `${window.location.pathname}#/profiles`); adopt(result) }
    }} />}
  </>
}
function AuthenticatedApp() {
  const pwa = usePwa()
  const { state, error, retry, login } = useAuth()
  const [theme, setTheme] = useState<Theme>('system')
  const [drafts] = useState(() => new ReadingDrafts())
  const sessionUsers = useRef(new Set<string>())
  if (state.user) sessionUsers.current.add(state.user.id)
  // Auth expiry can unmount BooksWorkspace while its draft remains in memory.
  // Preserve refresh confirmation on the login page as well.
  usePwaUpdateGuard(() => [...sessionUsers.current].some(id => drafts.hasUser(id)) ? 'confirm' : 'safe')
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
    {state.status === 'authenticated' ? <HouseholdArea key={state.user.id} theme={theme} onTheme={setTheme} drafts={drafts} /> : <>
      <Header profiles={[]} theme={theme} onTheme={setTheme} onNavigate={() => {}} />
      {state.status === 'loading' ? <AccessStatus message={error ?? undefined} retry={retry} /> : <LoginPage onLogin={login} />}
    </>}
    <footer className="site-footer page-shell"><span>READING SHELF</span><span>各自的书单，共同的书房。</span>{pwa?.canInstall && <Button className="pwa-install-link" onClick={pwa.install}>安装私人书架</Button>}</footer>
  </>
}
// The separate PrototypeApp is not imported: production Profiles and Books are real.
export default function App() { return <PwaProvider><AuthProvider><AuthenticatedApp /></AuthProvider></PwaProvider> }
