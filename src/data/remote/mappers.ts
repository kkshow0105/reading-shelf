import { record, text, uuid, revision, fromDatabaseStatus, assertPosition, assertRating } from './contracts.ts'
import type { StoredBook, StoredProfile } from './contracts.ts'
import { assertCoverPath, coverColumns } from './cover-path.ts'

export function mapBook(value: unknown, householdId: string, profileId?: string): StoredBook {
  const row = record(value)
  const id = uuid(text(row, 'id')), household = uuid(text(row, 'household_id')), profile = uuid(text(row, 'profile_id'))
  if (household !== uuid(householdId) || (profileId && profile !== uuid(profileId))) throw new Error('返回记录的家庭或档案归属不符。')
  const path = text(row, 'cover_original_path', true)
  const originalCover = path ? { path: assertCoverPath(path, { householdId: household, profileId: profile, bookId: id }),
    filename: text(row, 'cover_original_filename'), mimeType: text(row, 'cover_mime_type') } : null
  if (originalCover) coverColumns(originalCover, { householdId: household, profileId: profile, bookId: id })
  const position = assertPosition({ x: row.cover_position_x as number, y: row.cover_position_y as number })
  assertRating(row.rating)
  return { householdId: household, updatedAt: revision(text(row, 'updated_at')),
    deletedAt: text(row, 'deleted_at', true) || null, deletedBy: text(row, 'deleted_by', true) || null, originalCover,
    book: { id, profileId: profile, title: text(row, 'title'), author: text(row, 'author'),
      translator: text(row, 'translator', true), status: fromDatabaseStatus(row.status),
      startedOn: text(row, 'started_on', true), finishedOn: text(row, 'finished_on', true), rating: row.rating,
      note: text(row, 'notes', true), cover: '', cropPosition: position, createdAt: text(row, 'created_at') } }
}
export function mapProfile(value: unknown, householdId: string): StoredProfile {
  const row = record(value)
  const household = uuid(text(row, 'household_id'))
  if (household !== uuid(householdId)) throw new Error('返回档案的家庭归属不符。')
  return { householdId: household, updatedAt: revision(text(row, 'updated_at')), archivedAt: text(row, 'archived_at', true) || null,
    profile: { id: uuid(text(row, 'id')), name: text(row, 'name'), description: '' } }
}
