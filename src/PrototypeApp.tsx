import { useState, useEffect, useLayoutEffect, useRef, useCallback } from 'react'
import { X } from 'lucide-react'
import { profiles } from './data/mock'
import { createMockBooks } from './data/mock'
import type { Book, BookDraft, Filters, Route, SortOrder, Theme } from './types'
import { emptyFilters } from './lib/books'
import { Header } from './components/Header'
import { ProfilesPage } from './pages/ProfilesPage'
import { ShelfPage } from './pages/ShelfPage'
import { DetailPage } from './pages/DetailPage'
import { BookFormPage } from './pages/BookFormPage'
import { Dialog, DialogContent, DialogTitle, DialogDescription } from './components/ui/dialog'
import { Button } from './components/ui/button'
import { useMediaQuery } from './lib/useMediaQuery'
import type { MobileShelfDensity } from './components/DisplayDensityMenu'

const getPath = () => window.location.hash.slice(1) || '/profiles'
function parseRoute(path: string): Route {
  const parts = path.split('/').filter(Boolean)
  if (parts[0] !== 'p' || !profiles.some(profile => profile.id === parts[1])) return { page: 'profiles' }
  const profileId = parts[1]
  if (parts[2] === 'new') return { page: 'new', profileId }
  if (parts[2] === 'books' && parts[3]) return { page: parts[4] === 'edit' ? 'edit' : 'detail', profileId, bookId: parts[3] }
  return { page: 'shelf', profileId }
}
interface ShelfView { query: string; filters: Filters; sort: SortOrder; scroll: number }
interface Toast { message: string; action?: () => void; actionLabel?: string }
export default function PrototypeApp() {
  const fixture = new URLSearchParams(window.location.search).get('preview')
  const [books, setBooks] = useState<Book[]>(() => createMockBooks().filter(book => fixture !== 'empty' || book.profileId !== 'chen'))
  const [path, setPath] = useState(getPath)
  const route = parseRoute(path)
  const [theme, setTheme] = useState<Theme>('system')
  const [mobileDensity, setMobileDensity] = useState<MobileShelfDensity>('compact')
  const systemDark = useMediaQuery('(prefers-color-scheme: dark)')
  const [views, setViews] = useState<Record<string, ShelfView>>(() => Object.fromEntries(profiles.map(p => [p.id, { query: '', filters: emptyFilters(), sort: 'recent', scroll: 0 }])))
  const scrolls = useRef<Record<string, number>>({})
  const [drafts, setDrafts] = useState<Record<string, BookDraft>>({})
  const dirty = useRef<BookDraft | null>(null)
  const [pendingPath, setPendingPath] = useState<string | null>(null)
  const pendingPathRef = useRef<string | null>(null)
  const continueRef = useRef<HTMLButtonElement>(null)
  const [toast, setToast] = useState<Toast | null>(null)
  const [toastPaused, setToastPaused] = useState(false)
  const [loading, setLoading] = useState(fixture === 'loading')
  const objectURLs = useRef(new Set<string>())
  const pathRef = useRef(path)
  const routeRef = useRef(route)
  pathRef.current = path; routeRef.current = route
  const active = route.page === 'profiles' ? undefined : profiles.find(p => p.id === route.profileId)!
  const selectedBook = route.page === 'detail' || route.page === 'edit' ? books.find(book => book.id === route.bookId && book.profileId === route.profileId) : undefined
  const formKey = route.page === 'new' ? `${route.profileId}:new` : route.page === 'edit' ? `${route.profileId}:${route.bookId}` : ''
  const rememberScroll = () => { const current = routeRef.current; if (current.page === 'shelf') scrolls.current[current.profileId] = window.scrollY }
  const requestNavigate = (next: string) => {
    if (next === pathRef.current) return
    if (dirty.current) { pendingPathRef.current = next; setPendingPath(next); return }
    rememberScroll(); window.location.hash = next
  }
  useEffect(() => {
    const onHash = () => {
      const next = getPath()
      if (dirty.current && next !== pathRef.current) { window.history.replaceState(null, '', `#${pathRef.current}`); pendingPathRef.current = next; setPendingPath(next); return }
      const current = routeRef.current
      if (current.page === 'shelf') scrolls.current[current.profileId] = window.scrollY
      setPath(next)
    }
    const beforeUnload = (event: BeforeUnloadEvent) => { if (dirty.current) { event.preventDefault(); event.returnValue = '' } }
    window.addEventListener('hashchange', onHash); window.addEventListener('beforeunload', beforeUnload)
    return () => { window.removeEventListener('hashchange', onHash); window.removeEventListener('beforeunload', beforeUnload) }
  }, [])
  useLayoutEffect(() => {
    document.documentElement.dataset.theme = theme === 'system' ? systemDark ? 'dark' : 'light' : theme
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', document.documentElement.dataset.theme === 'dark' ? '#211F1B' : '#F4F0E8')
  }, [theme, systemDark])
  useLayoutEffect(() => {
    window.scrollTo({ top: route.page === 'shelf' ? scrolls.current[route.profileId] || 0 : 0, behavior: 'instant' })
    dirty.current = null
    document.getElementById('main-content')?.focus({ preventScroll: true })
  }, [path])
  useEffect(() => { document.title = selectedBook ? `${selectedBook.title} · 私人书架` : active ? `${active.name}的书架 · 私人书架` : '私人书架 · Reading Shelf' }, [selectedBook, active])
  useEffect(() => setToastPaused(false), [toast])
  useEffect(() => { if (!toast || toastPaused) return; const timeout = window.setTimeout(() => setToast(null), toast.action ? 8000 : 4000); return () => window.clearTimeout(timeout) }, [toast, toastPaused])
  useEffect(() => { const urls = objectURLs.current; return () => { urls.forEach(url => URL.revokeObjectURL(url)) } }, [])
  const handleDraft = useCallback((draft: BookDraft | null) => { dirty.current = draft }, [])
  const changeView = (changes: Partial<ShelfView>) => { if (active) setViews(previous => ({ ...previous, [active.id]: { ...previous[active.id], ...changes } })) }
  const leaveForm = (keep: boolean) => {
    if (keep && dirty.current) setDrafts(previous => ({ ...previous, [formKey]: dirty.current! }))
    else setDrafts(previous => { const next = { ...previous }; delete next[formKey]; return next })
    dirty.current = null; const next = pendingPathRef.current; pendingPathRef.current = null; setPendingPath(null)
    if (next) requestNavigate(next)
  }
  const saveBook = (draft: BookDraft) => {
    if (!active) return
    const saved: Book = selectedBook ? { ...selectedBook, ...draft } : { ...draft, id: crypto.randomUUID(), profileId: active.id, createdAt: new Date().toISOString() }
    setBooks(previous => selectedBook ? previous.map(book => book.id === saved.id && book.profileId === saved.profileId ? saved : book) : [...previous, saved])
    setDrafts(previous => { const next = { ...previous }; delete next[formKey]; return next })
    dirty.current = null; setToast({ message: '已更新本轮预览，刷新后恢复示例。' }); requestNavigate(`/p/${saved.profileId}/books/${saved.id}`)
  }
  const deleteBook = (book: Book) => {
    setBooks(previous => previous.filter(item => item.id !== book.id || item.profileId !== book.profileId))
    setToast({ message: `已从${active?.name}的书架移除《${book.title}》。`, actionLabel: '撤销', action: () => { setBooks(previous => previous.some(item => item.id === book.id) ? previous : [...previous, book]); setToast({ message: '已放回原来的书架。' }) } })
    requestNavigate(`/p/${book.profileId}/shelf`)
  }
  return <>
    <Header profiles={profiles} profile={active} shelf={route.page === 'shelf'} query={active ? views[active.id].query : ''} onQuery={query => changeView({ query })} theme={theme} onTheme={setTheme} onNavigate={requestNavigate} />
    {route.page === 'profiles' ? <ProfilesPage profiles={profiles} books={books} onNavigate={requestNavigate} /> : route.page === 'shelf' ? <ShelfPage profile={active!} books={books} {...views[active!.id]} density={mobileDensity} onDensityChange={setMobileDensity} onQuery={query => changeView({ query })} onFilters={filters => changeView({ filters })} onSort={sort => changeView({ sort })} onNavigate={requestNavigate} loading={loading} onFinishLoading={() => setLoading(false)} /> : route.page === 'new' || route.page === 'edit' && selectedBook ? <BookFormPage key={formKey} profile={active!} book={selectedBook} recoveredDraft={drafts[formKey]} ownBooks={books.filter(book => book.profileId === active!.id)} onDraftChange={handleDraft} onNavigate={requestNavigate} onSave={saveBook} onObjectURL={url => objectURLs.current.add(url)} /> : selectedBook ? <DetailPage profile={active!} book={selectedBook} onNavigate={requestNavigate} onDelete={deleteBook} /> : <main id="main-content" className="page-shell empty-state"><h1>这本书暂时无法打开。</h1><Button onClick={() => requestNavigate(`/p/${active!.id}/shelf`)}>返回书架</Button></main>}
    <footer className="site-footer page-shell"><span>READING SHELF</span><span>示例书房 · 本轮修改仅用于预览</span></footer>
    <Dialog open={pendingPath !== null} onOpenChange={open => { if (!open) { setPendingPath(null); pendingPathRef.current = null } }}><DialogContent onOpenAutoFocus={event => { event.preventDefault(); continueRef.current?.focus() }}><DialogTitle className="overlay-title">这几行，还没有保存。</DialogTitle><DialogDescription className="overlay-description">可以保留本轮草稿再离开，也可以继续写。草稿只在本轮预览中保留，刷新后会消失。</DialogDescription><div className="draft-dialog-actions"><Button ref={continueRef} variant="outline" onClick={() => { setPendingPath(null); pendingPathRef.current = null }}>继续编辑</Button><Button onClick={() => leaveForm(false)}>放弃草稿</Button><Button variant="primary" onClick={() => leaveForm(true)}>保留草稿并离开</Button></div></DialogContent></Dialog>
    {toast && <div className="toast" role="status" onMouseEnter={() => setToastPaused(true)} onMouseLeave={() => setToastPaused(false)} onFocusCapture={() => setToastPaused(true)} onBlurCapture={event => { if (!event.currentTarget.contains(event.relatedTarget)) setToastPaused(false) }}><span>{toast.message}</span>{toast.action && <Button onClick={toast.action}>{toast.actionLabel}</Button>}<Button className="icon-button" aria-label="关闭提示" onClick={() => setToast(null)}><X size={16} aria-hidden="true" /></Button></div>}
  </>
}
