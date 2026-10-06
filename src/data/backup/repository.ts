import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../remote/database.types.ts'
import { checkApiError } from '../remote/repositories.ts'
import { uuid } from '../remote/contracts.ts'
import { COVER_BUCKET, assertCoverPath } from '../remote/cover-path.ts'
import { BACKUP_LIMITS, BackupError } from './types.ts'
import type { CoverMime, StructuredBackupV1 } from './types.ts'
import { validateStructured } from './validation.ts'

export type ProfileRow = Database['public']['Tables']['profiles']['Row']
export type BookRow = Database['public']['Tables']['books']['Row']
export interface BackupObject { path: string; profileId: string; bookId: string; size: number; mimeType: CoverMime }
export function createBackupRepository(client: SupabaseClient<Database>, householdId: string) {
  uuid(householdId)
  async function profiles() {
    const { data, error } = await client.from('profiles').select('*').eq('household_id', householdId).order('sort_order').order('id')
    checkApiError(error)
    if (!data?.length || data.length > BACKUP_LIMITS.profiles) throw new BackupError('无法读取全部阅读档案。')
    return data
  }
  async function books() {
    const result: BookRow[] = []
    for (let offset = 0; ; offset += 100) {
      const { data, error } = await client.from('books').select('*').eq('household_id', householdId).order('id').range(offset, offset + 99)
      checkApiError(error); result.push(...(data || []))
      if (result.length > BACKUP_LIMITS.books) throw new BackupError('书籍数量超过当前备份上限。')
      if ((data?.length || 0) < 100) return result
    }
  }
  async function objects(): Promise<BackupObject[]> {
    const result: BackupObject[] = []
    async function walk(prefix: string, depth: number) {
      for (let offset = 0; ; offset += 100) {
        const { data, error } = await client.storage.from(COVER_BUCKET).list(prefix, { limit: 100, offset, sortBy: { column: 'name', order: 'asc' } })
        checkApiError(error)
        for (const entry of data || []) {
          const path = `${prefix}/${entry.name}`
          if (!entry.id) {
            if (depth >= 3 || (depth < 2 ? !/^[0-9a-f-]{36}$/.test(entry.name) : entry.name !== 'original')) throw new BackupError('封面目录结构异常，无法生成完整备份。')
            if (depth < 2) uuid(entry.name)
            await walk(path, depth + 1)
          } else {
            const parts = path.split('/'), profileId = parts[1], bookId = parts[2]
            assertCoverPath(path, { householdId, profileId, bookId })
            const mimeType = ({ jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp' } as const)[path.split('.').pop() as 'jpg']
            const size = Number(entry.metadata?.size)
            if (!mimeType || !Number.isSafeInteger(size) || size < 1 || size > BACKUP_LIMITS.coverBytes) throw new BackupError('原始封面大小或格式异常。')
            result.push({ path, profileId, bookId, size, mimeType })
            if (result.length > BACKUP_LIMITS.entries - 2) throw new BackupError('原始封面数量超过备份上限。')
          }
        }
        if ((data?.length || 0) < 100) break
      }
    }
    await walk(householdId, 0)
    return result.sort((a, b) => a.path.localeCompare(b.path))
  }
  async function household() {
    const { data, error } = await client.from('households').select('*').eq('id', householdId).single()
    checkApiError(error)
    if (!data) throw new BackupError('书房暂时无法读取。')
    return data
  }
  return { householdId, client, profiles, books, objects, household,
    async snapshot(): Promise<StructuredBackupV1> {
      const hh = await household(), pp = await profiles(), bb = await books()
      // Explicit allowlist: never serialize an SDK session, membership or signed URL.
      return validateStructured({ format: 'reading-shelf-structured-export', formatVersion: 1, createdAt: new Date().toISOString(), coverFilesIncluded: false,
        household: { id: hh.id, name: hh.name, originalCreatedAt: hh.created_at, originalUpdatedAt: hh.updated_at },
        profiles: pp.map(p => ({ id: p.id, name: p.name, sortOrder: p.sort_order, archivedAt: p.archived_at, originalCreatedAt: p.created_at, originalUpdatedAt: p.updated_at })),
        books: bb.map(b => ({ id: b.id, profileId: b.profile_id, title: b.title, author: b.author, translator: b.translator || '', status: b.status,
          startedOn: b.started_on, finishedOn: b.finished_on, rating: b.rating, notes: b.notes || '', cropPosition: { x: b.cover_position_x, y: b.cover_position_y },
          cover: b.cover_original_path ? { originalPath: b.cover_original_path, originalFilename: b.cover_original_filename, mimeType: b.cover_mime_type } : null,
          originalCreatedAt: b.created_at, originalUpdatedAt: b.updated_at, deletedAt: b.deleted_at, deletedByOriginal: b.deleted_by })) })
    },
    async target(userId: string) {
      const { data, error } = await client.from('household_members').select('role').eq('household_id', householdId).eq('user_id', uuid(userId)).single()
      checkApiError(error)
      const pp = await profiles(), bb = await books(), oo = await objects()
      return { allowed: data?.role === 'owner' && bb.length === 0 && oo.length === 0 && pp.every(p => p.archived_at === null),
        profiles: pp, bookCount: bb.length, objectCount: oo.length }
    },
  }
}
export type BackupRepository = ReturnType<typeof createBackupRepository>
