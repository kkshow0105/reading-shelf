import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from './database.types.ts'
import type { BookScope, OriginalCover } from './contracts.ts'
import { DataAccessError } from './contracts.ts'
import { COVER_BUCKET, assertCoverPath, coverPath } from './cover-path.ts'
import { validateOriginalFile } from '../covers/files.ts'
import { COVER_URL_TTL_SECONDS } from '../covers/url-cache.ts'
import { createRepositories, checkApiError } from './repositories.ts'

export function createCoverService(client: SupabaseClient<Database>) {
  return {
    async uploadOriginalCover(scope: BookScope, file: File): Promise<OriginalCover> {
      const path = coverPath(scope, file.type, crypto.randomUUID())
      await validateOriginalFile(file)
      const record = await createRepositories(client, scope.householdId).books.getBook(scope.bookId)
      if (!record || record.book.profileId !== scope.profileId) throw new DataAccessError('invalid_scope', '请先建立对应档案的书籍记录。')
      const { error } = await client.storage.from(COVER_BUCKET).upload(path, file, { upsert: false, contentType: file.type, cacheControl: '3600' })
      checkApiError(error)
      return { path, filename: file.name, mimeType: file.type }
    },
    async getCoverBlob(scope: BookScope, path: string) {
      const { data, error } = await client.storage.from(COVER_BUCKET).download(assertCoverPath(path, scope))
      checkApiError(error)
      if (!data) throw new DataAccessError('missing_cover', '原始封面暂时无法读取。')
      return data
    },
    async getCoverDisplayUrl(scope: BookScope, path: string) {
      const { data, error } = await client.storage.from(COVER_BUCKET).createSignedUrl(assertCoverPath(path, scope), COVER_URL_TTL_SECONDS)
      checkApiError(error)
      if (!data?.signedUrl) throw new DataAccessError('missing_cover', '封面链接暂时无法生成。')
      // Ephemeral bearer URL, never persisted in a Book or logged.
      return { url: data.signedUrl, expiresIn: COVER_URL_TTL_SECONDS }
    },
    async replaceOriginalCover(scope: BookScope, previousUpdatedAt: string, file: File) {
      const cover = await this.uploadOriginalCover(scope, file)
      const result = await createRepositories(client, scope.householdId).books.replaceCover(scope.bookId, scope.profileId, previousUpdatedAt, cover)
      // On conflict/error the new file remains; never delete either original here.
      return { result, uploadedCover: cover }
    },
  }
}
