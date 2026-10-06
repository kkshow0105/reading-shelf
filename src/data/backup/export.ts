import { createCoverService } from '../remote/cover-service.ts'
import type { BackupRepository } from './repository.ts'
import type { BackupManifestV1, BackupProgress, StructuredBackupV1 } from './types.ts'
import { BACKUP_LIMITS, BackupError } from './types.ts'
import { crossCheck, jsonBytes, packArchive, sha256 } from './archive.ts'
import { validateManifest } from './validation.ts'
import { fromDatabaseStatus } from '../remote/contracts.ts'
export function snapshotIdentity(data: StructuredBackupV1) { return JSON.stringify({ ...data, createdAt: '' }) }
export async function exportComplete(repo: BackupRepository, progress: BackupProgress = () => {}, signal?: AbortSignal) {
  const cancelled = () => { if (signal?.aborted) throw new BackupError('已取消导出，未生成不完整的 ZIP。') }
  const started = new Date().toISOString()
  progress('读取全部档案与阅读记录…')
  const data = await repo.snapshot(), objects = await repo.objects()
  const files = new Map<string, Uint8Array>([['data/structured-data.json', jsonBytes(data)]])
  const entries: BackupManifestV1['files'] = [{ kind: 'data', path: 'data/structured-data.json', size: files.get('data/structured-data.json')!.length, sha256: await sha256(files.get('data/structured-data.json')!) }]
  let total = entries[0].size
  for (const [i, obj] of objects.entries()) {
    cancelled()
    progress(`读取原始封面 ${i + 1} / ${objects.length}…`)
    if ((total += obj.size) > BACKUP_LIMITS.expandedBytes) throw new BackupError('全部原图超过 100 MB，未生成不完整的 ZIP。')
    const blob = await createCoverService(repo.client).getCoverBlob({ householdId: repo.householdId, profileId: obj.profileId, bookId: obj.bookId }, obj.path)
    const bytes = new Uint8Array(await blob.arrayBuffer())
    if (bytes.length !== obj.size) throw new BackupError('原始封面在备份中发生变化，请重新导出。')
    const path = `covers/${obj.path.split('/').slice(1).join('/')}`, book = data.books.find(b => b.id === obj.bookId)
    const ref = book?.cover?.originalPath === obj.path
    files.set(path, bytes)
    entries.push({ kind: 'cover', path, size: bytes.length, sha256: await sha256(bytes), profileId: obj.profileId, bookId: obj.bookId,
      originalStoragePath: obj.path, originalFilename: ref ? book!.cover!.originalFilename : null, mimeType: obj.mimeType, referencedByBookId: ref ? obj.bookId : null })
  }
  // REST and Storage cannot share a database snapshot: reject a changing household instead of silently exporting a mixed state.
  progress('复核数据与封面目录…')
  cancelled()
  if (snapshotIdentity(data) !== snapshotIdentity(await repo.snapshot()) || JSON.stringify(objects) !== JSON.stringify(await repo.objects())) throw new BackupError('备份期间书房发生变化，请停止编辑后重新导出。')
  const referenced = entries.filter(e => e.kind === 'cover' && e.referencedByBookId).length
  const manifest = validateManifest({ format: 'reading-shelf-backup', formatVersion: 1, createdAt: started, backupStartedAt: started, backupCompletedAt: new Date().toISOString(),
    source: 'supabase', household: { id: data.household.id, name: data.household.name }, profileCount: data.profiles.length, bookCount: data.books.length,
    activeBookCount: data.books.filter(b => !b.deletedAt).length, softDeletedBookCount: data.books.filter(b => b.deletedAt).length,
    coverFileCount: objects.length, referencedCoverFileCount: referenced, historicalCoverFileCount: objects.length - referenced,
    backupIncludes: ['structuredData', 'covers', 'softDeletedRecords', 'historicalOriginals'], hashAlgorithm: 'SHA-256', restoreHistoricalCovers: 'keep-in-zip', files: entries })
  crossCheck(manifest, data); progress('打包完整 ZIP…')
  const bytes = await packArchive(manifest, files); cancelled(); return { bytes, manifest }
}
export function csvCell(value: string) {
  // Excel formula prefixes can be hidden behind whitespace or control characters.
  const safe = /^[\s\u0000-\u001f]*[=+\-@]/.test(value) ? `'${value}` : value
  return `"${safe.replaceAll('"', '""')}"`
}
export function exportCsv(data: StructuredBackupV1) {
  const rows = [['档案', '书名', '作者', '译者', '状态', '开始日期', '结束日期', '评分', '短评', '软删除', '创建时间', '更新时间', '有封面'],
    ...data.books.map(b => [data.profiles.find(p => p.id === b.profileId)!.name, b.title, b.author, b.translator, fromDatabaseStatus(b.status), b.startedOn || '', b.finishedOn || '',
      b.rating === null ? '' : String(b.rating), b.notes, b.deletedAt ? '是' : '否', b.originalCreatedAt, b.originalUpdatedAt, b.cover ? '是' : '否'])]
  return '\uFEFF' + rows.map(row => row.map(csvCell).join(',')).join('\r\n') + '\r\n'
}
export function downloadBackup(blob: Blob, extension: 'zip' | 'json' | 'csv') {
  const date = new Date(), pad = (n: number) => String(n).padStart(2, '0')
  const stamp = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}_${pad(date.getHours())}-${pad(date.getMinutes())}-${pad(date.getSeconds())}`
  const url = URL.createObjectURL(blob), link = document.createElement('a')
  link.href = url; link.download = `reading-shelf-${extension === 'zip' ? 'backup' : 'export'}-${stamp}.${extension}`
  document.body.append(link); link.click(); link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}
