export type UpdateStatus = 'idle' | 'checking' | 'updateAvailable' | 'updating' | 'error'
export interface UpdateState { status: UpdateStatus; supported: boolean; dismissed: boolean }
export const CHECK_INTERVAL = 60 * 60 * 1000
export const UPDATE_ERROR = '暂时无法更新，请稍后再试。'
export function isStandalone(displayMode: boolean, iosStandalone?: boolean) { return displayMode || iosStandalone === true }
export function installAvailable(standalone: boolean, hasPrompt: boolean, ios: boolean) { return !standalone && (hasPrompt || ios) }
export function shouldCheck(last: number, now: number) { return now - last >= CHECK_INTERVAL }
export type UpdateSafety = 'safe' | 'confirm' | 'busy'
export function combineSafety(checks: UpdateSafety[]): UpdateSafety {
  return checks.includes('busy') ? 'busy' : checks.includes('confirm') ? 'confirm' : 'safe'
}

interface UpdateDependencies {
  container?: ServiceWorkerContainer
  registerUrl: string
  reload: () => void
  now: () => number
  timeout: (callback: () => void, delay: number) => ReturnType<typeof setTimeout>
  clearTimeout: (id: ReturnType<typeof setTimeout>) => void
}

// Native lifecycle is centralized here. No version-string comparisons, data caches,
// storage tokens, or automatic reloads, including controller changes in other tabs.
export function createPwaUpdate(deps: UpdateDependencies) {
  let state: UpdateState = { status: 'idle', supported: !!deps.container, dismissed: false }
  let registration: ServiceWorkerRegistration | undefined
  let startPromise: Promise<void> | undefined
  let consent: ServiceWorker | undefined
  let timer: ReturnType<typeof setTimeout> | undefined
  let reloaded = false, lastCheck = -Infinity, checking = false
  const subscribers = new Set<() => void>()
  const set = (status: UpdateStatus) => { state = { ...state, status }; subscribers.forEach(fn => fn()) }
  const waiting = () => {
    // First installation can briefly appear as waiting before activation. It is
    // an update only when an older active/controller worker already exists.
    if (registration?.waiting && (deps.container?.controller || registration.active && registration.active !== registration.waiting) && state.status !== 'updating') set('updateAvailable')
  }
  const clear = () => { if (timer !== undefined) deps.clearTimeout(timer); timer = undefined }
  const changed = () => {
    // Only this page's explicit approval permits its single reload. First install,
    // another tab's update and duplicate events all leave the page/input intact.
    if (!consent) {
      if (state.status === 'updateAvailable' && !registration?.waiting) set('idle')
      return
    }
    if (reloaded || deps.container?.controller !== consent) return
    reloaded = true; clear(); deps.reload()
  }
  const start = () => startPromise ??= (async () => {
    if (!deps.container) return
    deps.container.addEventListener('controllerchange', changed)
    try {
      registration = await deps.container.register(deps.registerUrl, { scope: '/', updateViaCache: 'none' })
      const watch = () => {
        const worker = registration?.installing
        worker?.addEventListener('statechange', () => {
          if (worker.state === 'installed') waiting()
          if (worker.state === 'redundant') set('error')
        })
      }
      registration.addEventListener('updatefound', watch); watch(); waiting()
      await check(true)
    } catch { set('error') }
  })()
  const check = async (force = false) => {
    if (!registration || checking || state.status === 'updating' || (!force && !shouldCheck(lastCheck, deps.now()))) return
    checking = true; lastCheck = deps.now()
    if (!registration.waiting) set('checking')
    try { await registration.update(); if (registration.waiting) waiting(); else if (state.status !== 'updateAvailable') set('idle') }
    catch { set('error') }
    finally { checking = false }
  }
  const update = () => {
    const worker = registration?.waiting
    if (!worker || state.status === 'updating' || reloaded) return false
    consent = worker; set('updating')
    clear(); timer = deps.timeout(() => { consent = undefined; set('error') }, 15000)
    try { worker.postMessage({ type: 'SKIP_WAITING' }); return true }
    catch { consent = undefined; clear(); set('error'); return false }
  }
  return {
    snapshot: () => state,
    subscribe: (fn: () => void) => { subscribers.add(fn); return () => { subscribers.delete(fn) } },
    start, check, update,
    dismiss: () => { state = { ...state, dismissed: true }; subscribers.forEach(fn => fn()) },
    // A failed registration can be retried without touching auth or app data.
    retry: async () => {
      state = { ...state, dismissed: false }
      if (!registration) { startPromise = undefined; await start() }
      else { await check(true); waiting() }
    },
  }
}
