import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, MoreHorizontal } from 'lucide-react'
import type { Book, Profile } from '@/types'
import { BookCover } from '@/components/BookCover'
import { ReadingProgress } from '@/components/ReadingProgress'
import { Stars } from '@/components/Stars'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { AlertDialog, AlertDialogContent, AlertDialogTitle, AlertDialogDescription, AlertDialogCancel, AlertDialogAction } from '@/components/ui/alert-dialog'
import { formatDate } from '@/lib/books'
import { BookConflictError, bookMessage } from '@/data/books/model'
import type { CoverSource } from '@/data/covers/url-cache'
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog'
export function DetailPage({ profile, book, coverSource, onNavigate, onDelete, onReload, preview = false }: { profile: Profile; book: Book; coverSource?: CoverSource; onNavigate: (path: string) => void; onDelete: (book: Book) => void | Promise<void>; onReload?: () => void; preview?: boolean }) {
  const [deleting, setDeleting] = useState(false)
  const [busy, setBusy] = useState(false), [error, setError] = useState<string | null>(null), [conflict, setConflict] = useState(false)
  const gate = useRef(false)
  const coverTrigger = useRef<HTMLButtonElement>(null)
  const [largeCover, setLargeCover] = useState(''), [largeError, setLargeError] = useState(false)
  const mounted = useRef(true)
  useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])
  return <main id="main-content" className="detail-page page-shell page-enter" tabIndex={-1}>
    <div className="page-nav"><Button onClick={() => onNavigate(`/p/${profile.id}/shelf`)}><ArrowLeft size={18} aria-hidden="true" />返回书架</Button><Button onClick={() => onNavigate(`/p/${profile.id}/books/${book.id}/edit`)}>编辑</Button></div>
    <article className="book-detail"><BookCover title={book.title} author={book.author} cover={book.cover} remote={coverSource} className="detail-cover" presentation="detail" viewRef={coverTrigger} onView={source => { setLargeError(false); setLargeCover(source) }} />
      <div className="detail-copy"><p className="editorial-label">阅读札记 / READING NOTES</p><h1>{book.title}</h1><dl className="book-metadata"><div><dt>作者</dt><dd>{book.author}</dd></div>{book.translator && <div><dt>译者</dt><dd>{book.translator}</dd></div>}</dl>
        <div className="reading-metadata"><span className="reading-status">{book.status}</span>{book.startedOn || book.finishedOn ? <span>{book.startedOn && <time dateTime={book.startedOn}>{formatDate(book.startedOn)}</time>}{book.startedOn && book.finishedOn && ' — '}{book.finishedOn && <time dateTime={book.finishedOn}>{formatDate(book.finishedOn)}</time>}</span> : <span>阅读日期未记录</span>}</div>
        {['在读', '暂停'].includes(book.status) ? <div className="detail-progress"><p>阅读进度</p><ReadingProgress value={book.progressPercent} /></div> : <div className="detail-rating">{book.rating === null ? <span>尚未评分</span> : <><Stars value={book.rating} size={17} /><span>{book.rating} / 5</span></>}</div>}
        <section className="reading-note"><h2>留在书页之外</h2>{book.note ? book.note.split('\n\n').map((paragraph, i) => <p key={i}>{paragraph}</p>) : <><p className="quiet-copy">还没有写下这本书的记忆。</p><Button className="text-link" onClick={() => onNavigate(`/p/${profile.id}/books/${book.id}/edit`)}>写短评</Button></>}</section>
        <div className="detail-bottom"><span>来自{profile.name}的书架</span><DropdownMenu><DropdownMenuTrigger asChild><Button className="icon-button" aria-label="这本书的更多操作"><MoreHorizontal size={20} aria-hidden="true" /></Button></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuItem className="danger-text" onSelect={() => setDeleting(true)}>移除这本书</DropdownMenuItem></DropdownMenuContent></DropdownMenu></div>
      </div>
    </article>
    <Dialog open={!!largeCover} onOpenChange={open => { if (!open) setLargeCover('') }}><DialogContent className="cover-lightbox" onCloseAutoFocus={event => { event.preventDefault(); coverTrigger.current?.focus() }}><DialogTitle className="sr-only">《{book.title}》完整封面</DialogTitle><DialogDescription className="sr-only">关闭后返回阅读记录。</DialogDescription>{largeError ? <p className="field-error" role="alert">暂时无法显示大图，请关闭后重新打开。</p> : largeCover && <img src={largeCover} alt={`《${book.title}》完整封面`} onError={() => setLargeError(true)} />}</DialogContent></Dialog>
    <AlertDialog open={deleting} onOpenChange={open => { if (!busy) setDeleting(open) }}><AlertDialogContent><AlertDialogTitle className="overlay-title">从{profile.name}的书架移除《{book.title}》？</AlertDialogTitle><AlertDialogDescription className="overlay-description">{preview ? '仅影响这一条示例记录，可立即撤销。' : '仅移除这一条阅读记录，不影响其他档案，也不删除原始封面。移除后可立即撤销。'}</AlertDialogDescription>{error && <p className="field-error" role="alert">{error}</p>}<div className="dialog-actions"><AlertDialogCancel disabled={busy}>保留这本书</AlertDialogCancel>{conflict && <Button variant="outline" onClick={() => { setDeleting(false); onReload?.() }}>重新载入</Button>}<AlertDialogAction disabled={busy || conflict} onClick={async event => {
      event.preventDefault(); if (gate.current) return; gate.current = true; setBusy(true); setError(null)
      try { await onDelete(book); if (mounted.current) setDeleting(false) } catch (reason) { if (mounted.current) { setError(bookMessage(reason, 'delete')); setConflict(reason instanceof BookConflictError) } }
      finally { gate.current = false; if (mounted.current) setBusy(false) }
    }}>{busy ? '正在移除…' : '移除'}</AlertDialogAction></div></AlertDialogContent></AlertDialog>
  </main>
}
