import type { CoverSource } from '@/data/covers/url-cache'
import { Plus } from 'lucide-react'
import type { Book, Profile, Filters as FilterState, SortOrder } from '@/types'
import { BookCover } from '@/components/BookCover'
import { ReadingProgress } from '@/components/ReadingProgress'
import { Stars } from '@/components/Stars'
import { Filters } from '@/components/Filters'
import { DisplayDensityMenu, type MobileShelfDensity } from '@/components/DisplayDensityMenu'
import { Button } from '@/components/ui/button'
import { formatDate, readingDate, selectBooks } from '@/lib/books'
function compactDate(date: string) {
  return date.startsWith(`${new Date().getFullYear()}-`) ? date.slice(5).replace('-', '.') : date.slice(2).replaceAll('-', '.')
}
export function ShelfPage({ profile, books, query, filters, sort, onFilters, onSort, onQuery, onNavigate, loading, onFinishLoading, density, onDensityChange, error, onRetry, coverSources, active = true, animate = true }: { profile: Profile; books: Book[]; query: string; filters: FilterState; sort: SortOrder; onFilters: (filters: FilterState) => void; onSort: (sort: SortOrder) => void; onQuery: (query: string) => void; onNavigate: (path: string) => void; loading: boolean; onFinishLoading?: () => void; density: MobileShelfDensity; onDensityChange: (density: MobileShelfDensity) => void; error?: string | null; onRetry?: () => void; coverSources?: Record<string, CoverSource>; active?: boolean; animate?: boolean }) {
  const own = books.filter(book => book.profileId === profile.id)
  const visible = selectBooks(books, profile.id, query, filters, sort)
  const years = [...new Set(own.map(readingDate).filter(Boolean).map(date => date.slice(0, 4)))].sort().reverse()
  const filtered = filters.statuses.length + filters.ratings.length + filters.years.length > 0
  return <main id={active ? "main-content" : undefined} className={`shelf-page page-shell${animate ? " page-enter" : ""}`} data-density={density} tabIndex={-1}>
    <div className="shelf-heading"><div><span className="editorial-label">藏书 / COLLECTION</span><h1>{profile.name}的书架</h1></div><Button className="compact-add" variant="primary" onClick={() => onNavigate(`/p/${profile.id}/new`)}><Plus size={16} aria-hidden="true" />添一本书</Button></div>
    <div className="shelf-toolbar"><p className="shelf-count" role="status">{loading ? '正在打开书架' : error ? '书架尚未载入' : query || filtered ? `找到 ${visible.length} 本 · 共 ${own.length} 本` : `共 ${own.length} 本藏书`}</p><div className="shelf-toolbar-actions">{active && <><DisplayDensityMenu value={density} onChange={onDensityChange} /><Filters value={filters} onChange={onFilters} sort={sort} onSort={onSort} years={years} /></>}</div></div>
    {loading ? <><div className="book-grid skeleton-grid" aria-label="正在读取书架" aria-busy="true">{Array.from({ length: 6 }, (_, i) => <div className="skeleton-book" key={i}><div className="skeleton-cover" /><div className="skeleton-line" /><div className="skeleton-line short" /></div>)}</div>{onFinishLoading && <Button className="loading-preview-exit" onClick={onFinishLoading}>查看示例书架</Button>}</> : error ? <div className="empty-state"><p role="alert">{error}</p><Button variant="outline" onClick={onRetry}>重试</Button></div> : visible.length ? <div className="book-grid">{visible.map(book => <a className="book-entry" key={book.id} href={`#/p/${profile.id}/books/${book.id}`} onClick={e => { e.preventDefault(); onNavigate(`/p/${profile.id}/books/${book.id}`) }} aria-label={`《${book.title}》，${book.author}，${book.status}，${['在读', '暂停'].includes(book.status) ? book.progressPercent === null ? '进度未记录' : `进度 ${book.progressPercent}%` : book.rating === null ? '未评分' : `${book.rating} 星`}`}>
      <BookCover title={book.title} author={book.author} cover={book.cover} remote={coverSources?.[book.id]} decorative presentation="shelf" cropPosition={book.cropPosition} />
      <div className="book-caption"><h2 title={book.title}>{book.title}</h2><p className="book-author" title={book.author}>{book.author}</p>{['在读', '暂停'].includes(book.status) ? <ReadingProgress value={book.progressPercent} /> : <Stars value={book.rating} />}<p className="book-date"><span className="book-status">{book.status}</span>{readingDate(book) && <><span className="date-separator" aria-hidden="true"> · </span><time dateTime={readingDate(book)} aria-label={formatDate(readingDate(book))}><span className="date-full">{formatDate(readingDate(book))}</span><span className="date-compact">{compactDate(readingDate(book))}</span></time></>}</p></div>
    </a>)}</div> : <div className="empty-state"><span className="empty-rule" /><h2>{own.length === 0 ? '这里还没有书。' : query ? '这间书房里，还没有找到这本书。' : '这些条件下，暂时没有书。'}</h2><p>{own.length === 0 ? '把读过的第一本书，或一直想读的那一本，放进来。' : '换一个书名，或放宽一点条件，再找找看。'}</p>{own.length === 0 ? <Button variant="primary" onClick={() => onNavigate(`/p/${profile.id}/new`)}>添一本书</Button> : <div className="empty-actions">{query && <Button variant="outline" onClick={() => onQuery('')}>清除搜索</Button>}{filtered && <Button variant="outline" onClick={() => onFilters({ statuses: [], ratings: [], years: [] })}>清除筛选</Button>}</div>}</div>}
  </main>
}
