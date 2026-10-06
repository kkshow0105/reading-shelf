import type { Book, BookDraft, CropPosition, Profile, ReadingStatus } from '../../types/index.ts'

// Domain/service contracts, not fabricated generated Database types.
// SQL migrations are authoritative until real Supabase introspection is available.
export interface BookScope { householdId: string; profileId: string; bookId: string }
export interface OriginalCover { path: string; filename: string; mimeType: string }
export interface StoredBook {
  book: Book
  householdId: string
  updatedAt: string // Preserve Postgres timestamp precision; never round-trip through Date.
  deletedAt: string | null
  deletedBy: string | null
  originalCover: OriginalCover | null
}
export interface StoredProfile { profile: Profile; householdId: string; sortOrder: number; createdAt: string; updatedAt: string; archivedAt: string | null }
export type MutationResult = { kind: 'saved'; record: StoredBook } | { kind: 'conflict' }
export class DataAccessError extends Error {
  code: string
  constructor(code: string, message: string) { super(message); this.code = code; this.name = 'DataAccessError' }
}
export const statusToDatabase = {
  想读: 'want_to_read', 在读: 'reading', 读完: 'finished', 暂停: 'paused', 弃读: 'abandoned',
} as const satisfies Record<ReadingStatus, string>
export function fromDatabaseStatus(value: unknown): ReadingStatus {
  const status = (Object.keys(statusToDatabase) as ReadingStatus[]).find(key => statusToDatabase[key] === value)
  if (!status) throw new DataAccessError('invalid_status', '数据库阅读状态无法识别。')
  return status
}
export function uuid(value: string) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(value)) throw new DataAccessError('invalid_id', '请使用正式记录的 UUID，不能直接使用 mock 标识。')
  return value
}
export function assertPosition(position: CropPosition) {
  if (![position.x, position.y].every(v => Number.isFinite(v) && v >= 0 && v <= 1)) throw new DataAccessError('invalid_position', '封面位置必须在 0～1 之间。')
  return position
}
export function assertRating(value: unknown): asserts value is number | null {
  if (value !== null && !(typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 5)) throw new DataAccessError('invalid_rating', '评分必须为空或 1～5 的整数。')
}
function date(value: string) {
  if (!value) return null
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(Date.parse(`${value}T00:00:00Z`)) || new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) !== value) throw new DataAccessError('invalid_date', '阅读日期无效。')
  return value
}
export function draftColumns(draft: BookDraft) {
  const title = draft.title.trim(), author = draft.author.trim()
  if (!title || !author || title.length > 200 || author.length > 200 || draft.translator.length > 200 || draft.note.length > 5000) throw new DataAccessError('invalid_book', '请检查书名、作者及字段长度。')
  const status = statusToDatabase[draft.status]
  if (typeof status !== 'string') throw new DataAccessError('invalid_status', '阅读状态无效。')
  assertRating(draft.rating)
  const started = date(draft.startedOn), finished = date(draft.finishedOn)
  if (started && finished && started > finished) throw new DataAccessError('invalid_date', '结束日期不能早于开始日期。')
  if (finished && ['在读', '暂停'].includes(draft.status)) throw new DataAccessError('invalid_date', '在读或暂停记录不能保留结束日期。')
  const position = draft.cropPosition ? assertPosition(draft.cropPosition) : undefined
  return { title, author, translator: draft.translator || null, status, started_on: started,
    finished_on: finished, rating: draft.rating, notes: draft.note || null,
    ...(position ? { cover_position_x: position.x, cover_position_y: position.y } : {}) }
}
export function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new DataAccessError('invalid_response', '数据返回格式无效。')
  return value as Record<string, unknown>
}
export function text(row: Record<string, unknown>, key: string, nullable = false): string {
  const value = row[key]
  if (nullable && value === null) return ''
  if (typeof value !== 'string') throw new DataAccessError('invalid_response', `数据字段 ${key} 无效。`)
  return value
}
export function revision(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(value) || !Number.isFinite(Date.parse(value))) throw new DataAccessError('invalid_revision', '更新必须提供原始 updated_at 版本。')
  return value
}
