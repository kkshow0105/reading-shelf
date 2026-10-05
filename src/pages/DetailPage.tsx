import { useState } from 'react'
import { ArrowLeft, MoreHorizontal } from 'lucide-react'
import type { Book, Profile } from '@/types'
import { BookCover } from '@/components/BookCover'
import { Stars } from '@/components/Stars'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { AlertDialog, AlertDialogContent, AlertDialogTitle, AlertDialogDescription, AlertDialogCancel, AlertDialogAction } from '@/components/ui/alert-dialog'
import { formatDate } from '@/lib/books'
export function DetailPage({ profile, book, onNavigate, onDelete }: { profile: Profile; book: Book; onNavigate: (path: string) => void; onDelete: (book: Book) => void }) {
  const [deleting, setDeleting] = useState(false)
  return <main id="main-content" className="detail-page page-shell page-enter" tabIndex={-1}>
    <div className="page-nav"><Button onClick={() => onNavigate(`/p/${profile.id}/shelf`)}><ArrowLeft size={18} aria-hidden="true" />返回书架</Button><Button onClick={() => onNavigate(`/p/${profile.id}/books/${book.id}/edit`)}>编辑</Button></div>
    <article className="book-detail"><BookCover title={book.title} author={book.author} cover={book.cover} className="detail-cover" presentation="detail" />
      <div className="detail-copy"><p className="editorial-label">阅读札记 / READING NOTES</p><h1>{book.title}</h1><dl className="book-metadata"><div><dt>作者</dt><dd>{book.author}</dd></div>{book.translator && <div><dt>译者</dt><dd>{book.translator}</dd></div>}</dl>
        <div className="reading-metadata"><span className="reading-status">{book.status}</span>{book.startedOn || book.finishedOn ? <span>{book.startedOn && <time dateTime={book.startedOn}>{formatDate(book.startedOn)}</time>}{book.startedOn && book.finishedOn && ' — '}{book.finishedOn && <time dateTime={book.finishedOn}>{formatDate(book.finishedOn)}</time>}</span> : <span>阅读日期未记录</span>}</div>
        <div className="detail-rating">{book.rating === null ? <span>尚未评分</span> : <><Stars value={book.rating} size={17} /><span>{book.rating} / 5</span></>}</div>
        <section className="reading-note"><h2>留在书页之外</h2>{book.note ? book.note.split('\n\n').map((paragraph, i) => <p key={i}>{paragraph}</p>) : <><p className="quiet-copy">还没有写下这本书的记忆。</p><Button className="text-link" onClick={() => onNavigate(`/p/${profile.id}/books/${book.id}/edit`)}>写短评</Button></>}</section>
        <div className="detail-bottom"><span>来自{profile.name}的书架</span><DropdownMenu><DropdownMenuTrigger asChild><Button className="icon-button" aria-label="这本书的更多操作"><MoreHorizontal size={20} aria-hidden="true" /></Button></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuItem className="danger-text" onSelect={() => setDeleting(true)}>移除这本书</DropdownMenuItem></DropdownMenuContent></DropdownMenu></div>
      </div>
    </article>
    <AlertDialog open={deleting} onOpenChange={setDeleting}><AlertDialogContent><AlertDialogTitle className="overlay-title">从{profile.name}的书架移除《{book.title}》？</AlertDialogTitle><AlertDialogDescription className="overlay-description">仅影响这一条示例记录，不会改变其他人的书架。可立即撤销，刷新后示例也会恢复。</AlertDialogDescription><div className="dialog-actions"><AlertDialogCancel>保留这本书</AlertDialogCancel><AlertDialogAction onClick={() => onDelete(book)}>移除</AlertDialogAction></div></AlertDialogContent></AlertDialog>
  </main>
}
