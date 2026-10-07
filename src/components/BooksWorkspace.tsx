import { lazy, Suspense, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { X } from 'lucide-react'
import type { BookDraft, Filters, Profile, Route, SortOrder, Theme } from '../types'
import type { HouseholdAccess } from '../data/auth/service'
import type { StoredBook } from '../data/remote/contracts'
import { createRepositories } from '../data/remote/repositories'
import { getSupabaseClient } from '../lib/supabase'
import { emptyFilters } from '../lib/books'
import { errorCode, isInvalidSession, readActiveProfile, saveActiveProfile, validActiveProfile } from '../data/auth/policies'
import { createBooksService, parseBookRoute, ReadingDrafts, RequestSequence, MutationGate, BookConflictError, bookMessage } from '../data/books/model'
import type { DraftEnvelope } from '../data/books/model'
import { useBooks } from '../data/books/useBooks'
import { Header } from './Header'
import { ProfilesPage } from '../pages/ProfilesPage'
import { ShelfPage } from '../pages/ShelfPage'
import { ShelfDetailView } from './ShelfDetailView'
import { DetailPage } from '../pages/DetailPage'
import { BookFormPage } from '../pages/BookFormPage'
import { Button } from './ui/button'
import { Dialog, DialogContent, DialogTitle, DialogDescription } from './ui/dialog'
import type { MobileShelfDensity } from './DisplayDensityMenu'
import { createCoverService } from '../data/remote/cover-service'
import { CoverUrlCache } from '../data/covers/url-cache'
import type { CoverSource } from '../data/covers/url-cache'
import { CoverDisplayContext } from '../data/covers/display'
import { createBookCoverMutations } from '../data/covers/mutations'
import type { CoverChoice } from '../data/covers/files'
import { isPwaReloadApproved, usePwaUpdateGuard } from '../pwa/PwaProvider'
import { useHouseholdSuggestions } from '../data/books/useSuggestions'

function coverSource(record: StoredBook | null): CoverSource | undefined {
  return record?.originalCover ? { path: record.originalCover.path, scope: { householdId: record.householdId, profileId: record.book.profileId, bookId: record.book.id } } : undefined
}

interface ShelfView { query: string; filters: Filters; sort: SortOrder; scroll: number }
const BackupPage = lazy(() => import('../pages/BackupPage'))
interface Toast { message: string; action?: () => Promise<void>; actionLabel?: string; reload?: () => Promise<void> }
type ProfileRoute = Exclude<Route, { page: 'profiles' }>
export function BooksWorkspace({ userId, household, theme, onTheme, logout, drafts }: {
  userId: string; household: HouseholdAccess; theme: Theme; onTheme: (theme: Theme) => void;
  logout: () => Promise<void>; drafts: ReadingDrafts;
}) {
  const profiles = household.profiles.map(item => item.profile)
  const coverCache = useMemo(() => {
    const covers = createCoverService(getSupabaseClient())
    return new CoverUrlCache(source => covers.getCoverDisplayUrl(source.scope, source.path))
  }, [userId, household.id])
  useEffect(() => () => coverCache.clear(), [coverCache])
  const [path, setPath] = useState(() => {
    const requested = window.location.hash.slice(1)
    if (requested && !['/login', '/setup'].includes(requested)) return requested
    const id = validActiveProfile(readActiveProfile(), household.profiles, household.id)
    return id ? `/p/${id}/shelf` : '/profiles'
  })
  const route = parseBookRoute(path, profiles)
  const active = route.page === 'profiles' ? undefined : profiles.find(item => item.id === route.profileId)!
  const [views, setViews] = useState<Record<string, ShelfView>>(() => Object.fromEntries(profiles.map(p => [p.id, { query: '', filters: emptyFilters(), sort: 'recent', scroll: 0 }])))
  const [density, setDensity] = useState<MobileShelfDensity>('compact')
  const dirty = useRef<{ key: string; value: DraftEnvelope } | null>(null)
  const current = useRef({ path, route }); current.current = { path, route }
  const viewsRef = useRef(views); viewsRef.current = views
  const [pending, setPending] = useState<{ path?: string; logout?: boolean } | null>(null)
  const [busy, setBusy] = useState(false), [logoutBusy, setLogoutBusy] = useState(false)
  const mutation = useRef(new MutationGate()), live = useRef(true)
  const [toast, setToast] = useState<Toast | null>(null), [toastPaused, setToastPaused] = useState(false), [undoBusy, setUndoBusy] = useState(false)
  const undoGate = useRef(false)
  const continueRef = useRef<HTMLButtonElement>(null)
  usePwaUpdateGuard(() => mutation.current.busy || logoutBusy || undoGate.current ? 'busy' : dirty.current || drafts.hasUser(userId) ? 'confirm' : 'safe')
  const remember = () => {
    const old = current.current.route
    if (old.page === 'shelf') setViews(previous => ({ ...previous, [old.profileId]: { ...previous[old.profileId], scroll: window.scrollY } }))
  }
  const navigate = (next: string) => {
    if (mutation.current.busy || logoutBusy || next === current.current.path) return
    if (dirty.current) { setPending({ path: next }); return }
    remember(); window.location.hash = next; setPath(next)
  }
  const exit = async () => {
    if (mutation.current.busy || logoutBusy) return
    if (dirty.current || drafts.hasUser(userId)) { setPending({ logout: true }); return }
    setLogoutBusy(true)
    try { await logout(); drafts.clearUser(userId) }
    catch (reason) { if (live.current) { setToast({ message: bookMessage(reason) }); setLogoutBusy(false) } }
  }
  useEffect(() => {
    live.current = true
    if (window.location.hash.slice(1) !== path) window.history.replaceState(null, '', `${window.location.pathname}#${path}`)
    const changed = () => {
      const next = window.location.hash.slice(1)
      if (next === current.current.path) return
      if (mutation.current.busy || dirty.current) {
        window.history.replaceState(null, '', `#${current.current.path}`)
        if (!mutation.current.busy) setPending({ path: next })
      } else { remember(); setPath(next) }
    }
    const unloading = (event: BeforeUnloadEvent) => {
      // Only after the PWA's explicit discard confirmation and activation.
      if (isPwaReloadApproved()) return
      if (dirty.current || mutation.current.busy || drafts.hasUser(userId)) { event.preventDefault(); event.returnValue = '' }
    }
    window.addEventListener('hashchange', changed); window.addEventListener('beforeunload', unloading)
    return () => { live.current = false; window.removeEventListener('hashchange', changed); window.removeEventListener('beforeunload', unloading) }
  }, [])
  useLayoutEffect(() => {
    if (active) saveActiveProfile(active.id)
    window.scrollTo({ top: route.page === 'shelf' ? viewsRef.current[route.profileId].scroll : 0, behavior: 'instant' })
    document.getElementById('main-content')?.focus({ preventScroll: true })
  }, [path])
  useEffect(() => { document.title = active ? `${active.name}的书架 · 私人书架` : '私人书架 · Reading Shelf' }, [active?.id])
  useEffect(() => { setToastPaused(false) }, [toast])
  useEffect(() => {
    if (!toast || toastPaused || undoBusy) return
    const timer = window.setTimeout(() => setToast(null), toast.action ? 8000 : 4000)
    return () => window.clearTimeout(timer)
  }, [toast, toastPaused, undoBusy])
  const mutate = async <T,>(action: () => Promise<T>) => mutation.current.run(async () => {
    setBusy(true)
    try { return await action() } finally { if (live.current) setBusy(false) }
  })
  const failure = (reason: unknown) => {
    if (isInvalidSession(reason) || errorCode(reason) === 'PGRST301') void logout().catch(() => {
      if (live.current) setToast({ message: bookMessage(reason) })
    })
  }
  const leave = async (keep: boolean) => {
    const target = pending
    if (!keep && dirty.current) drafts.delete(dirty.current.key)
    dirty.current = null; setPending(null)
    if (target?.logout) { drafts.clearUser(userId); await exit() }
    else if (target?.path) navigate(target.path)
  }
  return <CoverDisplayContext.Provider value={coverCache}><>
    <Header profiles={profiles} profile={active} shelf={route.page === 'shelf'} query={active ? views[active.id].query : ''} onQuery={query => { if (active) setViews(previous => ({ ...previous, [active.id]: { ...previous[active.id], query } })) }} theme={theme} onTheme={onTheme} onNavigate={navigate} onLogout={() => void exit()} logoutBusy={logoutBusy} />
    {route.page === 'profiles' ? <ProfilesPage profiles={profiles} onNavigate={navigate} /> : <ProfileBooks key={`${household.id}:${route.profileId}`} userId={userId} householdId={household.id} profile={active!} route={route} view={views[route.profileId]} density={density} onDensity={setDensity} onView={changes => setViews(previous => ({ ...previous, [route.profileId]: { ...previous[route.profileId], ...changes } }))} onNavigate={navigate} drafts={drafts} onDraft={value => { dirty.current = value }} mutate={mutate} busy={busy} onFailure={failure} notify={value => { if (live.current) setToast(value) }} />}
    <Dialog open={pending !== null} onOpenChange={open => { if (!open) setPending(null) }}><DialogContent onOpenAutoFocus={event => { event.preventDefault(); continueRef.current?.focus() }}><DialogTitle className="overlay-title">这几行，还没有保存。</DialogTitle><DialogDescription className="overlay-description">{pending?.logout ? '本次会话还有未保存草稿。继续编辑，或放弃这些草稿后退出；已经保存的书籍不会删除。' : '可以保留本次会话草稿再离开，也可以继续写。草稿没有保存到数据库，刷新后会丢失。'}</DialogDescription><div className="draft-dialog-actions"><Button ref={continueRef} variant="outline" onClick={() => setPending(null)}>继续编辑</Button><Button onClick={() => void leave(false)}>{pending?.logout ? '放弃草稿并退出' : '放弃草稿'}</Button>{!pending?.logout && <Button variant="primary" onClick={() => void leave(true)}>保留草稿并离开</Button>}</div></DialogContent></Dialog>
    {toast && <div className="toast" role="status" onMouseEnter={() => setToastPaused(true)} onMouseLeave={() => setToastPaused(false)} onFocusCapture={() => setToastPaused(true)} onBlurCapture={event => { if (!event.currentTarget.contains(event.relatedTarget)) setToastPaused(false) }}><span>{toast.message}</span>{toast.action && <Button disabled={undoBusy || busy} onClick={async () => {
      if (undoGate.current) return; undoGate.current = true; setUndoBusy(true)
      try { await toast.action!() } catch (reason) {
        if (live.current) { failure(reason); setToast({ message: bookMessage(reason, 'restore'), actionLabel: reason instanceof BookConflictError ? '重新载入' : '重试', action: reason instanceof BookConflictError ? toast.reload : toast.action }) }
      } finally { undoGate.current = false; if (live.current) setUndoBusy(false) }
    }}>{undoBusy ? '正在恢复…' : toast.actionLabel}</Button>}<Button className="icon-button" disabled={undoBusy} aria-label="关闭提示" onClick={() => setToast(null)}><X size={16} aria-hidden="true" /></Button></div>}
  </></CoverDisplayContext.Provider>
}

function ProfileBooks({ userId, householdId, profile, route, view, density, onDensity, onView, onNavigate, drafts, onDraft, mutate, busy, onFailure, notify }: {
  userId: string; householdId: string; profile: Profile; route: ProfileRoute; view: ShelfView; density: MobileShelfDensity;
  onDensity: (value: MobileShelfDensity) => void; onView: (changes: Partial<ShelfView>) => void; onNavigate: (path: string) => void;
  drafts: ReadingDrafts; onDraft: (value: { key: string; value: DraftEnvelope } | null) => void;
  mutate: <T>(action: () => Promise<T>) => Promise<T | undefined>; busy: boolean; onFailure: (error: unknown) => void; notify: (toast: Toast | null) => void;
}) {
  const service = useMemo(() => createBooksService(createRepositories(getSupabaseClient(), householdId).books, householdId, profile.id), [householdId, profile.id])
  const coverMutations = useMemo(() => createBookCoverMutations(createRepositories(getSupabaseClient(), householdId).books, createCoverService(getSupabaseClient()), householdId, profile.id), [householdId, profile.id])
  const books = useBooks(service, onFailure)
  const suggestions = useHouseholdSuggestions(householdId, route.page === 'new' ? 'new' : route.page === 'edit' ? `edit:${route.bookId}` : '', onFailure)
  const live = useRef(false), requests = useRef(new RequestSequence())
  const [detail, setDetail] = useState<{ id: string; record: StoredBook | null; loading: boolean; error: string | null }>({ id: '', record: null, loading: true, error: null })
  const [detailAttempt, setDetailAttempt] = useState(0), [formVersion, setFormVersion] = useState(0)
  const [conflict, setConflict] = useState<{ id: string; error?: string } | null>(null), [reloading, setReloading] = useState(false)
  const bookId = route.page === 'edit' || route.page === 'detail' ? route.bookId : ''
  const draftKey = drafts.key(userId, householdId, profile.id, route.page === 'new' ? 'new' : bookId)
  const recovered = route.page === 'new' || route.page === 'edit' ? drafts.get(draftKey) : undefined
  const createIds = useRef<Record<string, string>>({})
  const createId = recovered?.createId || (createIds.current[draftKey] ||= crypto.randomUUID())
  const failureRef = useRef(onFailure); failureRef.current = onFailure
  useEffect(() => { live.current = true; return () => { live.current = false; requests.current.cancel(); onDraft(null) } }, [])
  useEffect(() => {
    if (!bookId) return
    const token = requests.current.begin()
    setDetail({ id: bookId, record: null, loading: true, error: null })
    void service.get(bookId).then(record => { if (requests.current.current(token)) setDetail({ id: bookId, record, loading: false, error: null }) })
      .catch(reason => { if (requests.current.current(token)) { setDetail({ id: bookId, record: null, loading: false, error: bookMessage(reason) }); failureRef.current(reason) } })
    return () => requests.current.cancel()
  }, [bookId, service, detailAttempt])
  useLayoutEffect(() => { if (route.page === 'shelf' && !books.loading) window.scrollTo({ top: view.scroll, behavior: 'instant' }) }, [books.loading, route.page])
  const baseline = recovered?.baseline || (detail.id === bookId ? detail.record : null)
  const baselineRef = useRef(baseline); baselineRef.current = baseline
  const draftKeyRef = useRef(draftKey); draftKeyRef.current = draftKey
  const createIdRef = useRef(createId); createIdRef.current = createId
  const trackDraft = useCallback((draft: BookDraft | null, coverChoice: CoverChoice = { kind: 'keep' }) => {
    const key = draftKeyRef.current
    if (!draft) { drafts.delete(key); onDraft(null); return }
    const value = { draft, baseline: baselineRef.current, createId: createIdRef.current, coverChoice, notice: drafts.get(key)?.notice }
    drafts.set(key, value); onDraft({ key, value })
  }, [drafts])
  const save = async (draft: BookDraft, coverChoice: CoverChoice = { kind: 'keep' }) => {
    const origin = baseline
    trackDraft(draft, coverChoice)
    try {
      const result = await mutate(() => route.page === 'edit' && origin ? coverMutations.update(origin, draft, coverChoice) : coverMutations.create(draft, createId, coverChoice))
      if (!live.current || !result) return
      if (result.kind === 'conflict') { setConflict({ id: origin?.book.id || createId }); throw new BookConflictError() }
      books.accept(result.record)
      setDetail({ id: result.record.book.id, record: result.record, loading: false, error: null })
      // Retain an ID only while its create is unconfirmed, never reuse it for the NEXT book.
      if (route.page === 'new') delete createIds.current[draftKey]
      drafts.delete(draftKey); onDraft(null)
      if (result.coverIssue) {
        const notice = result.coverIssue === 'upload' ? '书籍已保存，但封面上传失败。当前预览尚未保存，可再次保存重试。' : '书籍已保存，但封面关联未完成。原始图片已保留，当前预览尚未保存。'
        const editKey = drafts.key(userId, householdId, profile.id, result.record.book.id)
        drafts.set(editKey, { draft: { ...draft, cover: '' }, baseline: result.record, createId, coverChoice, notice })
        notify({ message: '书籍已保存，封面尚未保存。' })
        onNavigate(`/p/${profile.id}/books/${result.record.book.id}/edit`)
        if (result.coverIssue === 'conflict') setConflict({ id: result.record.book.id })
        return
      }
      notify({ message: '已保存到书房。' }); onNavigate(`/p/${profile.id}/books/${result.record.book.id}`)
    } catch (reason) { if (live.current) onFailure(reason); throw reason }
  }
  const remove = async () => {
    if (!detail.record) return
    try {
      const result = await mutate(() => service.remove(detail.record!))
      if (!live.current || !result) return
      if (result.kind === 'conflict') throw new BookConflictError()
      books.accept(result.record)
      const deleted = result.record
      notify({ message: `已从${profile.name}的书架移除《${deleted.book.title}》。`, actionLabel: '撤销', reload: async () => {
        if (live.current) await books.reload(); else onNavigate(`/p/${profile.id}/shelf`)
      }, action: async () => {
        const restored = await mutate(() => service.restore(deleted))
        if (!restored) return
        if (restored.kind === 'conflict') throw new BookConflictError()
        if (live.current) books.accept(restored.record)
        // If another profile is open, restore the ORIGINAL scope without mixing its list.
        notify({ message: `已放回${profile.name}的书架。` })
      } })
      onNavigate(`/p/${profile.id}/shelf`)
    } catch (reason) { if (live.current) onFailure(reason); throw reason }
  }
  let page
  const renderShelf = (active: boolean, animate: boolean) => <ShelfPage active={active} animate={animate} profile={profile} books={books.records.map(item => item.book)} coverSources={Object.fromEntries(books.records.filter(item => item.originalCover).map(item => [item.book.id, coverSource(item)!]))} {...view} density={density} onDensityChange={onDensity} onQuery={query => onView({ query })} onFilters={filters => onView({ filters })} onSort={sort => onView({ sort })} onNavigate={onNavigate} loading={books.loading} error={books.error} onRetry={() => void books.reload()} />
  if (route.page === 'shelf') page = null
  else if (route.page === 'backup') page = <Suspense fallback={<main id="main-content" className="access-status page-shell" tabIndex={-1}><p role="status">正在打开备份页…</p></main>}><BackupPage householdId={householdId} userId={userId} profileId={profile.id} onNavigate={onNavigate} mutate={mutate} /></Suspense>
  else if (route.page !== 'new' && (detail.id !== bookId || detail.loading)) page = <main id="main-content" className="access-status page-shell" tabIndex={-1}><div className="quiet-loading" aria-hidden="true" /><p role="status">正在翻开这本书…</p></main>
  else if (route.page !== 'new' && (detail.error || !detail.record)) page = <main id="main-content" className="page-shell empty-state" tabIndex={-1}><h1>{detail.error ? '这本书暂时无法载入。' : '这本书暂时无法打开。'}</h1>{detail.error && <p role="alert">{detail.error}</p>}<div className="empty-actions"><Button onClick={() => onNavigate(`/p/${profile.id}/shelf`)}>返回书架</Button>{detail.error && <Button variant="outline" onClick={() => setDetailAttempt(value => value + 1)}>重试</Button>}</div></main>
  else if (route.page === 'new' || route.page === 'edit') page = <BookFormPage key={`${draftKey}:${formVersion}`} profile={profile} book={route.page === 'edit' ? baseline!.book : undefined} recoveredDraft={recovered?.draft} recoveredCover={recovered?.coverChoice} saveNotice={recovered?.notice} coverSource={coverSource(baseline)} remoteCovers ownBooks={books.records.map(item => item.book)} suggestions={suggestions.index} suggestionsUnavailable={suggestions.unavailable} onNavigate={onNavigate} onSave={save} onDraftChange={trackDraft} onObjectURL={() => {}} coverEnabled />
  else page = <DetailPage key={detail.record!.updatedAt} profile={profile} book={detail.record!.book} coverSource={coverSource(detail.record)} onNavigate={onNavigate} onDelete={remove} onReload={() => setDetailAttempt(value => value + 1)} />
  return <><ShelfDetailView page={route.page === 'shelf' ? 'shelf' : route.page === 'detail' ? 'detail' : 'other'} renderShelf={renderShelf}>{page}</ShelfDetailView><Dialog open={conflict !== null} onOpenChange={open => { if (!open && !reloading) setConflict(null) }}><DialogContent><DialogTitle className="overlay-title">这本书已在另一台设备被修改。</DialogTitle><DialogDescription className="overlay-description">当前输入仍然保留。重新载入最新内容会放弃这次尚未保存的修改；也可以取消，继续保留输入。</DialogDescription>{conflict?.error && <p className="field-error" role="alert">{conflict.error}</p>}<div className="dialog-actions"><Button variant="outline" disabled={reloading} onClick={() => setConflict(null)}>取消</Button><Button variant="primary" disabled={reloading || busy} onClick={async () => {
    if (!conflict) return; setReloading(true)
    try {
      const latest = await service.get(conflict.id)
      if (!live.current) return
      if (!latest) { setConflict({ ...conflict, error: '这本书暂时无法打开。当前输入仍然保留。' }); return }
      drafts.delete(draftKey); onDraft(null); books.accept(latest)
      setDetail({ id: latest.book.id, record: latest, loading: false, error: null }); setFormVersion(value => value + 1); setConflict(null)
      if (route.page === 'new') onNavigate(`/p/${profile.id}/books/${latest.book.id}/edit`)
    } catch (reason) { if (live.current) { setConflict({ ...conflict, error: bookMessage(reason) }); onFailure(reason) } }
    finally { if (live.current) setReloading(false) }
  }}>{reloading ? '正在载入…' : '重新载入最新内容'}</Button></div></DialogContent></Dialog></>
}
