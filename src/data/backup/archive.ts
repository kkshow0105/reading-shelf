import { validateOriginalFile } from '../covers/files.ts'
import { BackupError, BACKUP_LIMITS } from './types.ts'
import type { BackupManifest, StructuredBackup, ValidatedBackup } from './types.ts'
import { parseJson, safeArchivePath, validateManifest, validateStructured } from './validation.ts'

export function bytesBlob(bytes: Uint8Array, type = 'application/octet-stream') { return new Blob([new Uint8Array(bytes).buffer], { type }) }
export async function sha256(bytes: Uint8Array) {
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new Uint8Array(bytes).buffer)), v => v.toString(16).padStart(2, '0')).join('')
}
export function jsonBytes(value: unknown) { return new TextEncoder().encode(JSON.stringify(value, null, 2)) }
export function crossCheck(manifest: BackupManifest, data: StructuredBackup) {
  const covers = manifest.files.filter(f => f.kind === 'cover'), referenced = covers.filter(f => f.referencedByBookId !== null)
  const fail = () => { throw new BackupError('备份清单、数量或封面引用不一致，无法恢复。') }
  if (manifest.formatVersion !== data.formatVersion || manifest.household.id !== data.household.id || manifest.household.name !== data.household.name || manifest.profileCount !== data.profiles.length
    || manifest.bookCount !== data.books.length || manifest.softDeletedBookCount !== data.books.filter(b => b.deletedAt).length
    || manifest.activeBookCount !== data.books.filter(b => !b.deletedAt).length || manifest.coverFileCount !== covers.length
    || manifest.referencedCoverFileCount !== referenced.length || manifest.historicalCoverFileCount !== covers.length - referenced.length) fail()
  const originals = new Set<string>()
  for (const f of covers) {
    const b = data.books.find(b => b.id === f.bookId)
    if (!b || b.profileId !== f.profileId || originals.has(f.originalStoragePath)) fail()
    originals.add(f.originalStoragePath)
    if ((b!.cover?.originalPath === f.originalStoragePath) !== (f.referencedByBookId === b!.id)) fail()
    if (f.referencedByBookId && (f.mimeType !== b!.cover!.mimeType || f.originalFilename !== b!.cover!.originalFilename)) fail()
  }
  if (data.books.filter(b => b.cover).length !== referenced.length) fail()
}
export async function packArchive(manifest: BackupManifest, files: Map<string, Uint8Array>) {
  const { zipSync } = await import('fflate')
  const input: Record<string, Uint8Array> = Object.create(null)
  input['manifest.json'] = jsonBytes(manifest)
  for (const [path, bytes] of files) input[safeArchivePath(path)] = bytes
  const total = Object.values(input).reduce((sum, b) => sum + b.length, 0)
  if (total > BACKUP_LIMITS.expandedBytes || input['manifest.json'].length > BACKUP_LIMITS.manifestBytes) throw new BackupError('备份超过 100 MB，请分批整理后再试。')
  // Original image bytes are stored unchanged. ZIP is supplied by the audited library.
  const bytes = zipSync(input, { level: 0 })
  if (bytes.length > BACKUP_LIMITS.zipBytes) throw new BackupError('ZIP 超过 100 MB，未生成下载。')
  return bytes
}
export async function openArchive(bytes: Uint8Array, decodeCover: (file: File) => Promise<unknown> = validateOriginalFile): Promise<ValidatedBackup> {
  if (bytes.length > BACKUP_LIMITS.zipBytes || bytes.length < 22) throw new BackupError('ZIP 大小无效或超过 100 MB。')
  const { unzipSync } = await import('fflate')
  const declared = new Map<string, number>(); let total = 0, entries = 0
  let extracted: Record<string, Uint8Array>
  try {
    extracted = unzipSync(bytes, { filter(info) {
      const path = safeArchivePath(info.name)
      if (declared.has(path) || ++entries > BACKUP_LIMITS.entries || ![0, 8].includes(info.compression)) throw new BackupError('ZIP 文件重复、数量过多或压缩方式不支持。')
      const limit = path === 'manifest.json' ? BACKUP_LIMITS.manifestBytes : path === 'data/structured-data.json' ? BACKUP_LIMITS.jsonBytes : BACKUP_LIMITS.coverBytes
      if (!Number.isSafeInteger(info.originalSize) || info.originalSize < 1 || info.originalSize > limit || info.size < 1 || info.size > bytes.length
        || (total += info.originalSize) > BACKUP_LIMITS.expandedBytes) throw new BackupError('ZIP 解压大小超过安全上限。')
      declared.set(path, info.originalSize); return true
    } })
  } catch (reason) { if (reason instanceof BackupError) throw reason; throw new BackupError('无法解压这个 ZIP，文件可能损坏。') }
  if (!extracted['manifest.json'] || !extracted['data/structured-data.json']) throw new BackupError('ZIP 缺少备份清单或结构化数据。')
  for (const [path, size] of declared) if (extracted[path]?.length !== size) throw new BackupError('ZIP 文件实际大小与声明不符。')
  const manifest = validateManifest(parseJson(extracted['manifest.json']))
  if (declared.size !== manifest.files.length + 1) throw new BackupError('ZIP 存在未声明或缺失的文件。')
  for (const f of manifest.files) {
    const file = extracted[f.path]
    if (!file || file.length !== f.size || await sha256(file) !== f.sha256) throw new BackupError('备份校验失败：文件缺失、大小或 SHA-256 不符。')
    if (f.kind === 'cover') {
      try { await decodeCover(new File([bytesBlob(file)], f.originalFilename || f.path.split('/').pop()!, { type: f.mimeType })) }
      catch { throw new BackupError('备份中有损坏或无法解码的原始封面。') }
    }
  }
  const data = validateStructured(parseJson(extracted['data/structured-data.json']))
  crossCheck(manifest, data)
  return { manifest, data, files: new Map(manifest.files.map(f => [f.path, extracted[f.path]])), identity: await sha256(extracted['manifest.json']) }
}
