import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from './database.types.ts'
import type { BookDraft } from '../../types/index.ts'
import { DataAccessError, draftColumns, revision, uuid } from './contracts.ts'
import type { MutationResult, OriginalCover } from './contracts.ts'
import { coverColumns } from './cover-path.ts'
import { mapBook, mapProfile } from './mappers.ts'

export function checkApiError(error: { code?: string; message?: string } | null) {
  if (error) throw new DataAccessError(error.code || 'request_failed', '数据请求失败；保留输入后重试。')
}
// Household is locked into each repository instance, never taken from mutable UI state.
export function createRepositories(client: SupabaseClient<Database>, householdId: string) {
  uuid(householdId)
  const bookQuery = () => client.from('books').select('*').eq('household_id', householdId)
  const write = async (id: string, profileId: string, previousUpdatedAt: string, columns: Database['public']['Tables']['books']['Update'], deleted = false): Promise<MutationResult> => {
    uuid(id); uuid(profileId); revision(previousUpdatedAt)
    let query = client.from('books').update(columns).eq('id', id).eq('household_id', householdId)
      .eq('profile_id', profileId).eq('updated_at', previousUpdatedAt)
    query = deleted ? query.not('deleted_at', 'is', null) : query.is('deleted_at', null)
    const { data, error } = await query.select('*').maybeSingle()
    checkApiError(error)
    // Zero rows also covers unavailable/deleted/unauthorized records; do not leak which.
    return data ? { kind: 'saved', record: mapBook(data, householdId, profileId) } : { kind: 'conflict' }
  }
  return {
    profiles: {
      async listProfiles() {
        const { data, error } = await client.from('profiles').select('*').eq('household_id', householdId)
          .is('archived_at', null).order('sort_order').order('created_at').order('id')
        checkApiError(error)
        return (data || []).map(row => mapProfile(row, householdId))
      },
    },
    books: {
      async listBooks(profileId: string, offset = 0, limit = 100) {
        uuid(profileId)
        if (!Number.isInteger(offset) || offset < 0 || !Number.isInteger(limit) || limit < 1 || limit > 200) throw new DataAccessError('invalid_page', '分页参数无效。')
        const { data, error } = await bookQuery().eq('profile_id', profileId).is('deleted_at', null)
          .order('created_at').order('id').range(offset, offset + limit - 1)
        checkApiError(error)
        const books = (data || []).map(row => mapBook(row, householdId, profileId))
        return { books, nextOffset: books.length === limit ? offset + limit : null }
      },
      async getBook(id: string, includeDeleted = false, profileId?: string) {
        let query = bookQuery().eq('id', uuid(id))
        if (profileId) query = query.eq('profile_id', uuid(profileId))
        if (!includeDeleted) query = query.is('deleted_at', null)
        const { data, error } = await query.maybeSingle()
        checkApiError(error)
        return data ? mapBook(data, householdId) : null
      },
      async createBook(profileId: string, draft: BookDraft, id: string = crypto.randomUUID()) {
        uuid(profileId); uuid(id)
        if (draft.cover) throw new DataAccessError('cover_upload_required', '请先建立记录，再通过封面服务上传原图；不能把 blob 或 URL 保存为 Storage 路径。')
        const { data, error } = await client.from('books').insert({ id, household_id: householdId, profile_id: profileId, ...draftColumns(draft) }).select('*').single()
        checkApiError(error)
        return mapBook(data, householdId, profileId)
      },
      updateBook(id: string, profileId: string, previousUpdatedAt: string, draft: BookDraft) {
        return write(id, profileId, previousUpdatedAt, draftColumns(draft))
      },
      replaceCover(id: string, profileId: string, previousUpdatedAt: string, cover: OriginalCover | null) {
        return write(id, profileId, previousUpdatedAt, coverColumns(cover, { householdId, profileId, bookId: id }))
      },
      softDeleteBook(id: string, profileId: string, previousUpdatedAt: string) {
        // Request marker only; the trigger stamps clock_timestamp() and auth.uid().
        return write(id, profileId, previousUpdatedAt, { deleted_at: new Date().toISOString() })
      },
      restoreBook(id: string, profileId: string, previousUpdatedAt: string) {
        return write(id, profileId, previousUpdatedAt, { deleted_at: null }, true)
      },
    },
  }
}
