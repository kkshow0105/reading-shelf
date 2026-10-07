import type { Book, Filters, SortOrder, BookDraft } from '../types/index.ts'
import { defaultCropPosition, normalizeCropPosition } from './covers.ts'

export const emptyFilters = (): Filters => ({ statuses: [], ratings: [], years: [] })
export const blankDraft = (): BookDraft => ({ title: '', author: '', translator: '', status: '想读', startedOn: '', finishedOn: '', rating: null, progressPercent: null, note: '', cover: '', cropPosition: defaultCropPosition() })
export function toDraft(book: Book): BookDraft {
  const { title, author, translator, status, startedOn, finishedOn, rating, progressPercent, note, cover } = book
  return { title, author, translator, status, startedOn, finishedOn, rating, progressPercent, note, cover, cropPosition: normalizeCropPosition(book.cropPosition) }
}
export function readingDate(book: Pick<Book, 'status' | 'finishedOn' | 'startedOn'>): string {
  return (book.status === '读完' || book.status === '弃读') ? book.finishedOn || book.startedOn : book.startedOn
}
export function formatDate(date: string) { return date.replaceAll('-', '.') }
export function selectBooks(books: Book[], profileId: string, query: string, filters: Filters, sort: SortOrder): Book[] {
  const term = query.trim().toLocaleLowerCase('zh-CN')
  const collator = new Intl.Collator('zh-CN', { numeric: true, sensitivity: 'base' })
  const result = books.filter(book => {
    const date = readingDate(book)
    return book.profileId === profileId && (!term || [book.title, book.author, book.translator].some(text => text.toLocaleLowerCase('zh-CN').includes(term))) &&
      (!filters.statuses.length || filters.statuses.includes(book.status)) &&
      (!filters.ratings.length || filters.ratings.includes(book.rating === null ? 'unrated' : String(book.rating))) &&
      (!filters.years.length || filters.years.includes(date ? date.slice(0, 4) : 'undated'))
  })
  const byDate = (a: Book, b: Book, ascending = false) => {
    const ad = readingDate(a), bd = readingDate(b)
    if (!ad && bd) return 1
    if (ad && !bd) return -1
    return (ascending ? 1 : -1) * ad.localeCompare(bd)
  }
  return result.sort((a, b) => {
    let order = 0
    if (sort === 'recent') {
      const group = { 在读: 0, 读完: 1, 暂停: 2, 弃读: 2, 想读: 3 }
      order = group[a.status] - group[b.status]
      if (!order) {
        if (a.status === '在读' && b.status === '在读') {
          order = Number(!!b.startedOn) - Number(!!a.startedOn) || b.startedOn.localeCompare(a.startedOn)
        } else if (a.status === '读完' && b.status === '读完') {
          order = Date.parse(b.finishedOn || b.createdAt) - Date.parse(a.finishedOn || a.createdAt)
        }
        order ||= b.createdAt.localeCompare(a.createdAt)
      }
    }
    else if (sort === 'title') order = collator.compare(a.title, b.title)
    else if (sort === 'added') order = b.createdAt.localeCompare(a.createdAt)
    else if (sort === 'rating') order = (b.rating ?? -1) - (a.rating ?? -1) || byDate(a, b)
    else order = byDate(a, b, sort === 'earliest') || (sort === 'earliest' ? a.createdAt.localeCompare(b.createdAt) : b.createdAt.localeCompare(a.createdAt))
    return order || a.id.localeCompare(b.id)
  })
}
export function validateDraft(draft: BookDraft): Record<string, string> {
  const errors: Record<string, string> = {}
  if (!draft.title.trim()) errors.title = '请写下书名。'
  if (!draft.author.trim()) errors.author = '请填写作者，不详时可填写“佚名”。'
  if (draft.progressPercent !== null && !(Number.isInteger(draft.progressPercent) && draft.progressPercent >= 0 && draft.progressPercent <= 100)) errors.progressPercent = '阅读进度应为 0～100 的整数，或留空。'
  const today = new Date().toLocaleDateString('en-CA')
  if (draft.startedOn && draft.startedOn > today) errors.startedOn = '实际阅读日期不能在未来。'
  if (draft.finishedOn && draft.finishedOn > today) errors.finishedOn = '实际阅读日期不能在未来。'
  if (draft.startedOn && draft.finishedOn && draft.startedOn > draft.finishedOn) errors.finishedOn = '结束日期不能早于开始日期。'
  return errors
}
