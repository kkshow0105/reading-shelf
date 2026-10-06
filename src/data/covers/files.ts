import { DataAccessError } from '../remote/contracts.ts'
import { MAX_COVER_BYTES, coverMimeExtensions } from '../remote/cover-path.ts'

export function validateCoverMetadata(file: File) {
  if (!file.size) throw new DataAccessError('invalid_cover_decode', '无法读取这张图片，请选择 JPEG、PNG 或 WebP 文件。')
  if (file.size > MAX_COVER_BYTES) throw new DataAccessError('invalid_cover_size', '这张图片超过 10 MB，请换一张更小的图片。')
  if (!Object.hasOwn(coverMimeExtensions, file.type) || !file.name || file.name.length > 255)
    throw new DataAccessError('invalid_cover_type', '请选择 JPEG、PNG 或 WebP 图片。')
}
export async function validateOriginalFile(file: File) {
  validateCoverMetadata(file)
  const bytes = new Uint8Array(await file.slice(0, 12).arrayBuffer())
  const jpeg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
  const png = [137, 80, 78, 71, 13, 10, 26, 10].every((v, i) => bytes[i] === v)
  const webp = String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF' && String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP'
  if (!(file.type === 'image/jpeg' && jpeg || file.type === 'image/png' && png || file.type === 'image/webp' && webp))
    throw new DataAccessError('invalid_cover_decode', '无法读取这张图片，请选择 JPEG、PNG 或 WebP 文件。')
}
export interface ObjectUrls { createObjectURL: (file: Blob) => string; revokeObjectURL: (url: string) => void }
export function localPreview(file: File, urls: ObjectUrls = URL) {
  const url = urls.createObjectURL(file)
  let released = false
  return { url, release() { if (!released) { released = true; urls.revokeObjectURL(url) } } }
}
export async function validateBrowserCover(file: File, decode: (url: string) => Promise<{ width: number; height: number }> = async url => {
  const image = new Image()
  image.src = url
  await image.decode()
  return { width: image.naturalWidth, height: image.naturalHeight }
}, urls: ObjectUrls = URL) {
  await validateOriginalFile(file)
  const preview = localPreview(file, urls)
  try {
    const size = await decode(preview.url)
    if (!(size.width > 0 && size.height > 0)) throw new Error('decode')
    return size
  } catch { throw new DataAccessError('invalid_cover_decode', '无法读取这张图片，请选择 JPEG、PNG 或 WebP 文件。') }
  finally { preview.release() }
}
export type CoverChoice = { kind: 'keep' } | { kind: 'file'; file: File } | { kind: 'remove' }
export function coverMessage(error: unknown) {
  if (error instanceof DataAccessError && error.code.startsWith('invalid_cover_')) return error.message
  return '暂时未能确认保存结果。当前输入和封面预览仍然保留，请稍后重试。'
}
