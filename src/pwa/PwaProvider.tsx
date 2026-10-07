import { createContext, useContext, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react'
import type { ReactNode } from 'react'
import { Button } from '../components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '../components/ui/dialog'
import { CHECK_INTERVAL, combineSafety, createPwaUpdate, installAvailable, isStandalone, UPDATE_ERROR } from './update'
import type { UpdateSafety } from './update'

interface InstallPrompt extends Event { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> }
type PwaService = ReturnType<typeof createPwaUpdate>
interface PwaContextValue { install: () => void; canInstall: boolean; addGuard: (check: () => UpdateSafety) => () => void }
const PwaContext = createContext<PwaContextValue | null>(null)
let approvedReload = false
export function isPwaReloadApproved() { return approvedReload }
export function usePwa() { return useContext(PwaContext) }
export function usePwaUpdateGuard(check: () => UpdateSafety) {
  const pwa = usePwa(), latest = useRef(check); latest.current = check
  useEffect(() => pwa?.addGuard(() => latest.current()), [pwa?.addGuard])
}

export function PwaProvider({ children }: { children: ReactNode }) {
  const [service] = useState<PwaService>(() => createPwaUpdate({
    container: import.meta.env.PROD && window.isSecureContext ? navigator.serviceWorker : undefined,
    registerUrl: '/sw.js', reload: () => { approvedReload = true; window.location.reload() }, now: () => Date.now(),
    timeout: (fn, delay) => setTimeout(fn, delay), clearTimeout: id => clearTimeout(id),
  }))
  const state = useSyncExternalStore(service.subscribe, service.snapshot)
  const guards = useRef(new Set<() => UpdateSafety>())
  const [addGuard] = useState(() => (check: () => UpdateSafety) => { guards.current.add(check); return () => { guards.current.delete(check) } })
  const [standalone, setStandalone] = useState(() => isStandalone(matchMedia('(display-mode: standalone)').matches, (navigator as Navigator & { standalone?: boolean }).standalone))
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1
  useLayoutEffect(() => { document.documentElement.dataset.appleTouch = String(ios) }, [ios])
  const [prompt, setPrompt] = useState<InstallPrompt | null>(null)
  const [installOpen, setInstallOpen] = useState(false), [confirmOpen, setConfirmOpen] = useState(false)
  const [notice, setNotice] = useState('')
  const formTouched = useRef(false)
  const continueRef = useRef<HTMLButtonElement>(null)
  const updateRef = useRef<HTMLButtonElement>(null), installReturn = useRef<HTMLElement | null>(null)
  const noticeRef = useRef<HTMLElement>(null), [noticeHeight, setNoticeHeight] = useState(0)
  const safety = () => combineSafety([
    ...[...guards.current].map(check => check()),
    document.querySelector('form[aria-busy="true"]') ? 'busy' : formTouched.current ? 'confirm' : 'safe',
  ])
  const activate = (confirmed = false) => {
    const result = safety()
    if (result === 'busy') { setConfirmOpen(false); setNotice('当前操作尚未完成，请完成后再更新。'); return }
    if (result === 'confirm' && !confirmed) { setConfirmOpen(true); return }
    setConfirmOpen(false); setNotice(''); service.update()
  }
  useEffect(() => {
    void service.start()
    const visible = () => { if (document.visibilityState === 'visible') void service.check() }
    const interval = setInterval(visible, CHECK_INTERVAL)
    document.addEventListener('visibilitychange', visible)
    return () => { clearInterval(interval); document.removeEventListener('visibilitychange', visible) }
  }, [service])
  useEffect(() => {
    const mode = matchMedia('(display-mode: standalone)')
    const refresh = () => setStandalone(isStandalone(mode.matches, (navigator as Navigator & { standalone?: boolean }).standalone))
    const offered = (event: Event) => { event.preventDefault(); setPrompt(event as InstallPrompt) }
    const installed = () => { setPrompt(null); refresh() }
    const touched = (event: Event) => { if (event.target instanceof Element && event.target.closest('form')) formTouched.current = true }
    const route = () => { formTouched.current = false; setNotice('') }
    mode.addEventListener('change', refresh); window.addEventListener('beforeinstallprompt', offered)
    window.addEventListener('appinstalled', installed); document.addEventListener('input', touched); document.addEventListener('change', touched); window.addEventListener('hashchange', route)
    return () => { mode.removeEventListener('change', refresh); window.removeEventListener('beforeinstallprompt', offered); window.removeEventListener('appinstalled', installed); document.removeEventListener('input', touched); document.removeEventListener('change', touched); window.removeEventListener('hashchange', route) }
  }, [])
  useEffect(() => { document.documentElement.dataset.standalone = String(standalone) }, [standalone])
  const canInstall = import.meta.env.PROD && window.isSecureContext && installAvailable(standalone, !!prompt, ios)
  const visible = !state.dismissed && (state.status === 'updateAvailable' || state.status === 'updating' || state.status === 'error')
  useLayoutEffect(() => {
    if (!visible || !noticeRef.current) return
    const element = noticeRef.current
    const measure = () => setNoticeHeight(element.getBoundingClientRect().height + 40)
    measure(); const observer = new ResizeObserver(measure); observer.observe(element)
    return () => observer.disconnect()
  }, [visible])
  return <PwaContext.Provider value={{ canInstall, install: () => { installReturn.current = document.activeElement instanceof HTMLElement ? document.activeElement : null; setInstallOpen(true) }, addGuard }}>
    <div inert={state.status === 'updating'} style={visible ? { paddingBottom: noticeHeight } : undefined}>{children}</div>
    {notice && !visible && <p className="page-shell quiet-copy" role="status">{notice}</p>}
    {visible && <aside ref={noticeRef} className="pwa-notice" aria-label="应用更新">
      <p role="status" aria-live="polite">{state.status === 'error' ? UPDATE_ERROR : state.status === 'updating' ? '正在更新，请稍候…' : '新版本已准备好。'}</p>
      <div className="pwa-notice-actions"><Button ref={updateRef} variant="primary" disabled={state.status === 'updating'} onClick={() => state.status === 'error' ? void service.retry() : activate()}>{state.status === 'error' ? '重试' : '更新'}</Button><Button disabled={state.status === 'updating'} onClick={() => { service.dismiss(); setNotice('') }}>稍后</Button></div>
      {notice && <p className="quiet-copy" role="status">{notice}</p>}
    </aside>}
    <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}><DialogContent onCloseAutoFocus={e => { e.preventDefault(); updateRef.current?.focus() }} onOpenAutoFocus={e => { e.preventDefault(); continueRef.current?.focus() }}><DialogTitle className="overlay-title">更新前，留住这几行。</DialogTitle><DialogDescription className="overlay-description">更新会刷新页面。当前输入、本次会话的未保存草稿或恢复进度可能丢失，请先保存书籍或完成当前操作。</DialogDescription><div className="dialog-actions"><Button ref={continueRef} variant="outline" onClick={() => setConfirmOpen(false)}>继续当前操作</Button><Button variant="primary" onClick={() => activate(true)}>放弃未保存内容并更新</Button></div></DialogContent></Dialog>
    <Dialog open={installOpen} onOpenChange={setInstallOpen}><DialogContent onCloseAutoFocus={e => { e.preventDefault(); installReturn.current?.focus() }}><DialogTitle className="overlay-title">把书房放在主屏幕。</DialogTitle><DialogDescription className="overlay-description">{ios ? 'Safari → 分享 → 添加到主屏幕。名称保留“私人书架”。' : '安装后可在独立窗口打开。阅读记录与封面仍需要联网。'}</DialogDescription>{!ios && prompt && <Button variant="primary" onClick={async () => {
      try { await prompt.prompt(); const choice = await prompt.userChoice; setPrompt(null); if (choice.outcome === 'accepted') setInstallOpen(false) }
      catch { setNotice('暂时无法安装，请稍后从浏览器菜单重试。'); setInstallOpen(false) }
    }}>安装私人书架</Button>}<Button variant="outline" onClick={() => setInstallOpen(false)}>知道了</Button></DialogContent></Dialog>
  </PwaContext.Provider>
}
