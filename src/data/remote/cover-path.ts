import { DataAccessError, uuid } from './contracts.ts'
import type { BookScope, OriginalCover } from './contracts.ts'

export const COVER_BUCKET = 'book-covers'
export const MAX_COVER_BYTES = 10 * 1024 * 1024
export const coverMimeExtensions = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' } as const
export function coverPath(scope: BookScope, mimeType: string, imageId: string) {
  const ext = coverMimeExtensions[mimeType as keyof typeof coverMimeExtensions]
  if (!ext) throw new DataAccessError('invalid_cover', '封面只支持 JPEG、PNG、WebP。')
  return `${uuid(scope.householdId)}/${uuid(scope.profileId)}/${uuid(scope.bookId)}/original/${uuid(imageId)}.${ext}`
}
export function assertCoverPath(path: string, scope: BookScope) {
  const parts = path.split('/')
  if (parts.length !== 5 || parts[3] !== 'original' || !/^([0-9a-f-]{36})\.(jpg|png|webp)$/.test(parts[4])) throw new DataAccessError('invalid_path', '封面路径格式无效。')
  const [imageId, ext] = parts[4].split('.')
  uuid(imageId)
  const expected = `${uuid(scope.householdId)}/${uuid(scope.profileId)}/${uuid(scope.bookId)}/original/`
  if (!path.startsWith(expected) || !['jpg', 'png', 'webp'].includes(ext)) throw new DataAccessError('invalid_path', '封面路径与家庭、档案或书籍归属不符。')
  return path
}
export function coverColumns(cover: OriginalCover | null, scope: BookScope) {
  if (cover === null) return { cover_original_path: null, cover_original_filename: null, cover_mime_type: null, cover_position_x: 0.5, cover_position_y: 0.5 }
  assertCoverPath(cover.path, scope)
  if (!cover.filename || cover.filename.length > 255 || cover.path !== coverPath(scope, cover.mimeType, cover.path.split('/')[4].split('.')[0])) throw new DataAccessError('invalid_cover', '封面元信息无效。')
  return { cover_original_path: cover.path, cover_original_filename: cover.filename, cover_mime_type: cover.mimeType, cover_position_x: 0.5, cover_position_y: 0.5 }
}
