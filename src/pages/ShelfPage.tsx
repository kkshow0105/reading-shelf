import { Plus } from 'lucide-react'
import type { Book, Profile, Filters as FilterState, SortOrder } from '@/types'
import { BookCover } from '@/components/BookCover'
import { Stars } from '@/components/Stars'
import { Filters } from '@/components/Filters'
import { Button } from '@/components/ui/button'
import { formatDate, readingDate, selectBooks } from '@/lib/books'
export function ShelfPage({ profile, books, query, filters, sort, onFilters, onSort, onQuery, onNavigate, loading, onFinishLoading }: { profile: Profile; books: Book[]; query: string; filters: FilterState; sort: SortOrder; onFilters: (filters: FilterState) => void; onSort: (sort: SortOrder) => void; onQuery: (query: string) => void; onNavigate: (path: string) => void; loading: boolean; onFinishLoading: () => void }) {
  const own = books.filter(book => book.profileId === profile.id)
  const visible = selectBooks(books, profile.id, query, filters, sort)
  const years = [...new Set(own.map(readingDate).filter(Boolean).map(date => date.slice(0, 4)))].sort().reverse()
  const filtered = filters.statuses.length + filters.ratings.length + filters.years.length > 0
  return <main id="main-content" className="shelf-page page-shell page-enter" tabIndex={-1}>
    <div className="shelf-heading"><div><span className="editorial-label">藏书 / COLLECTION</span><h1>{profile.name}的书架</h1></div><Button className="compact-add" variant="primary" onClick={() => onNavigate(`/p/${profile.id}/new`)}><Plus size={16} aria-hidden="true" />添一本书</Button></div>
    <div className="shelf-toolbar"><p className="shelf-count" role="status">{loading ? '正在打开书架' : query || filtered ? `找到 ${visible.length} 本 · 共 ${own.length} 本` : `共 ${own.length} 本藏书`}</p><Filters value={filters} onChange={onFilters} sort={sort} onSort={onSort} years={years} /></div>
    {loading ? <><div className="book-grid skeleton-grid" aria-label="正在读取书架" aria-busy="true">{Array.from({ length: 6 }, (_, i) => <div className="skeleton-book" key={i}><div className="skeleton-cover" /><div className="skeleton-line" /><div className="skeleton-line short" /></div>)}</div><Button className="loading-preview-exit" onClick={onFinishLoading}>查看示例书架</Button></> : visible.length ? <div className="book-grid">{visible.map(book => <a className="book-entry" key={book.id} href={`#/p/${profile.id}/books/${book.id}`} onClick={e => { e.preventDefault(); onNavigate(`/p/${profile.id}/books/${book.id}`) }} aria-label={`《${book.title}》，${book.author}，${book.status}，${book.rating === null ? '未评分' : `${book.rating} 星`}`}>
      <BookCover title={book.title} author={book.author} cover={book.cover} decorative />
      <div className="book-caption"><h2 title={book.title}>{book.title}</h2><p className="book-author" title={book.author}>{book.author}</p><Stars value={book.rating} /><p className="book-date">{book.status}{readingDate(book) && <><span aria-hidden="true"> · </span><time dateTime={readingDate(book)}>{formatDate(readingDate(book))}</time></>}</p></div>
    </a>)}</div> : <div className="empty-state"><span className="empty-rule" /><h2>{own.length === 0 ? '这里还没有书。' : query ? '这间书房里，还没有找到这本书。' : '这些条件下，暂时没有书。'}</h2><p>{own.length === 0 ? '把读过的第一本书，或一直想读的那一本，放进来。' : '换一个书名，或放宽一点条件，再找找看。'}</p>{own.length === 0 ? <Button variant="primary" onClick={() => onNavigate(`/p/${profile.id}/new`)}>添一本书</Button> : <div className="empty-actions">{query && <Button variant="outline" onClick={() => onQuery('')}>清除搜索</Button>}{filtered && <Button variant="outline" onClick={() => onFilters({ statuses: [], ratings: [], years: [] })}>清除筛选</Button>}</div>}</div>}
  </main>
}
