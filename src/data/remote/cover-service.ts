import type { SupabaseClient } from '@supabase/supabase-js'
import type { BookScope, OriginalCover } from './contracts.ts'
import { DataAccessError } from './contracts.ts'
import { COVER_BUCKET, MAX_COVER_BYTES, assertCoverPath, coverPath } from './cover-path.ts'
import { createRepositories, checkApiError } from './repositories.ts'

async function validateOriginal(file: File) {
  if (!file.size || file.size > MAX_COVER_BYTES || !file.name || file.name.length > 255) throw new DataAccessError('invalid_cover', '请选择 10MB 以内的原始封面图片。')
  const bytes = new Uint8Array(await file.slice(0, 12).arrayBuffer())
  const jpeg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
  const png = [137, 80, 78, 71, 13, 10, 26, 10].every((v, i) => bytes[i] === v)
  const webp = String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF' && String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP'
  if (!(file.type === 'image/jpeg' && jpeg || file.type === 'image/png' && png || file.type === 'image/webp' && webp)) throw new DataAccessError('invalid_cover', '封面类型和文件头不匹配。')
}
export function createCoverService(client: SupabaseClient) {
  return {
    async uploadOriginalCover(scope: BookScope, file: File): Promise<OriginalCover> {
      const path = coverPath(scope, file.type, crypto.randomUUID())
      await validateOriginal(file)
      const record = await createRepositories(client, scope.householdId).books.getBook(scope.bookId)
      if (!record || record.book.profileId !== scope.profileId) throw new DataAccessError('invalid_scope', '请先建立对应档案的书籍记录。')
      const { error } = await client.storage.from(COVER_BUCKET).upload(path, file, { upsert: false, contentType: file.type })
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
      const { data, error } = await client.storage.from(COVER_BUCKET).createSignedUrl(assertCoverPath(path, scope), 300)
      checkApiError(error)
      if (!data?.signedUrl) throw new DataAccessError('missing_cover', '封面链接暂时无法生成。')
      // Ephemeral bearer URL, never persisted or logged. Authenticated blob preferred.
      return { url: data.signedUrl, expiresIn: 300 }
    },
    async replaceOriginalCover(scope: BookScope, previousUpdatedAt: string, file: File) {
      const cover = await this.uploadOriginalCover(scope, file)
      const result = await createRepositories(client, scope.householdId).books.replaceCover(scope.bookId, scope.profileId, previousUpdatedAt, cover)
      // On conflict/error the new file remains; never delete either original here.
      return { result, uploadedCover: cover }
    },
  }
}
