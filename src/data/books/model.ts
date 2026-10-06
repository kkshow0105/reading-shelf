import type { BookDraft, Profile, Route } from '../../types/index.ts'
import type { StoredBook } from '../remote/contracts.ts'
import { DataAccessError, draftColumns } from '../remote/contracts.ts'
import type { createRepositories } from '../remote/repositories.ts'
import { toDraft } from '../../lib/books.ts'
import { errorCode } from '../auth/policies.ts'

export type BooksRepository = ReturnType<typeof createRepositories>['books']
export class BookConflictError extends Error {
  constructor() { super('这条记录已经发生变化，请重新载入。'); this.name = 'BookConflictError' }
}
export class RequestSequence {
  private revision = 0
  private active = true
  begin() { this.active = true; return ++this.revision }
  current(token: number) { return this.active && token === this.revision }
  cancel() { this.active = false; ++this.revision }
}
export class MutationGate {
  busy = false
  async run<T>(action: () => Promise<T>): Promise<T | undefined> {
    if (this.busy) return undefined
    this.busy = true
    try { return await action() } finally { this.busy = false }
  }
}
export interface DraftEnvelope { draft: BookDraft; baseline: StoredBook | null; createId: string }
// Session-memory only. Auth expiry hides drafts; only the SAME user/household can recover them.
export class ReadingDrafts {
  private entries = new Map<string, DraftEnvelope>()
  key(userId: string, householdId: string, profileId: string, recordId: string) {
    return `${userId}:${householdId}:${profileId}:${recordId}`
  }
  get(key: string) { return this.entries.get(key) }
  set(key: string, value: DraftEnvelope) { this.entries.set(key, { ...value, draft: { ...value.draft, cropPosition: value.draft.cropPosition ? { ...value.draft.cropPosition } : undefined } }) }
  delete(key: string) { this.entries.delete(key) }
  hasUser(userId: string) { return [...this.entries.keys()].some(key => key.startsWith(`${userId}:`)) }
  clearUser(userId: string) { for (const key of this.entries.keys()) if (key.startsWith(`${userId}:`)) this.entries.delete(key) }
}
export function parseBookRoute(path: string, profiles: Profile[]): Route {
  const parts = path.split('/').filter(Boolean)
  if (parts[0] !== 'p' || !profiles.some(p => p.id === parts[1])) return { page: 'profiles' }
  const profileId = parts[1]
  if (parts.length === 3 && parts[2] === 'new') return { page: 'new', profileId }
  if (parts[2] === 'books' && parts[3] && (parts.length === 4 || parts.length === 5 && parts[4] === 'edit'))
    return { page: parts[4] === 'edit' ? 'edit' : 'detail', profileId, bookId: parts[3] }
  return parts.length === 3 && parts[2] === 'shelf' ? { page: 'shelf', profileId } : { page: 'profiles' }
}
export function bookMessage(error: unknown, action: 'load' | 'save' | 'delete' | 'restore' = 'load') {
  if (error instanceof BookConflictError) return error.message
  const code = errorCode(error)
  if (['PGRST301', 'bad_jwt', 'jwt_expired', 'session_expired', 'refresh_token_not_found'].includes(code)) return '登录已失效，请重新登录；未保存内容暂留在本次会话。'
  if (code === '42501') return '无法访问这条记录，请核对书房权限后重试。'
  if (code.startsWith('invalid_')) return '请检查书名、作者、评分和阅读日期。'
  return action === 'save' ? '暂时无法保存，请稍后重试。' : action === 'delete' ? '暂时无法移除，请稍后重试。' : action === 'restore' ? '暂时无法恢复，请稍后重试。' : '暂时无法连接书房，请稍后重试。'
}
export function createBooksService(repository: BooksRepository, householdId: string, profileId: string) {
  const scoped = (record: StoredBook) => {
    if (record.householdId !== householdId || record.book.profileId !== profileId) throw new DataAccessError('invalid_scope', '记录归属不符。')
    return record
  }
  return {
    async list(current: () => boolean = () => true) {
      const records: StoredBook[] = []
      let offset: number | null = 0
      do {
        if (!current()) return []
        const page = await repository.listBooks(profileId, offset, 100)
        records.push(...page.books.map(scoped)); offset = page.nextOffset
      } while (offset !== null)
      return records
    },
    async get(id: string, includeDeleted = false) {
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(id)) return null
      const record = await repository.getBook(id, includeDeleted, profileId)
      return record ? scoped(record) : null
    },
    async create(draft: BookDraft, id: string) {
      try { return { kind: 'saved' as const, record: scoped(await repository.createBook(profileId, draft, id)) } }
      catch (error) {
        if (errorCode(error) !== '23505') throw error
        // Stable request UUID prevents duplicate books after a committed response is lost.
        const existing = await repository.getBook(id, true, profileId)
        if (existing && !existing.deletedAt && JSON.stringify(draftColumns(toDraft(scoped(existing).book))) === JSON.stringify(draftColumns(draft)))
          return { kind: 'saved' as const, record: existing }
        return { kind: 'conflict' as const }
      }
    },
    update(record: StoredBook, draft: BookDraft) { scoped(record); return repository.updateBook(record.book.id, profileId, record.updatedAt, draft) },
    remove(record: StoredBook) { scoped(record); return repository.softDeleteBook(record.book.id, profileId, record.updatedAt) },
    restore(record: StoredBook) { scoped(record); return repository.restoreBook(record.book.id, profileId, record.updatedAt) },
  }
}
export type BooksService = ReturnType<typeof createBooksService>
