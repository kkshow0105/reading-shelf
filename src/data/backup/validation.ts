import { assertCoverPath, coverColumns } from '../remote/cover-path.ts'
import { draftColumns, fromDatabaseStatus, revision, uuid } from '../remote/contracts.ts'
import type { BackupBook, BackupManifestV1, StructuredBackupV1 } from './types.ts'
import { BACKUP_LIMITS, BackupError } from './types.ts'

const fail = (): never => { throw new BackupError('备份结构不符合要求，无法恢复。') }
export function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return fail()
  return value as Record<string, unknown>
}
function keys(row: Record<string, unknown>, expected: string) {
  const names = expected.split(' ')
  if (Object.keys(row).length !== names.length || names.some(n => !Object.hasOwn(row, n))) fail()
}
function string(value: unknown, max: number, min = 0): string {
  if (typeof value !== 'string' || value.length > max || value.trim().length < min) return fail()
  return value
}
function id(value: unknown) { try { return uuid(string(value, 36, 36)) } catch { return fail() } }
function time(value: unknown, nullable = false): string | null {
  if (nullable && value === null) return null
  try { return revision(string(value, 80, 1)) } catch { return fail() }
}
function array(value: unknown, max: number): unknown[] { if (!Array.isArray(value) || value.length > max) return fail(); return value }
function integer(value: unknown, max: number, min = 0): number {
  if (!Number.isSafeInteger(value) || (value as number) < min || (value as number) > max) return fail()
  return value as number
}
export function safeArchivePath(value: string) {
  if (!value || value.length > 240 || /[\\:\x00-\x1f\x7f]/.test(value) || value.startsWith('/')
    || value.split('/').some(p => p === '' || p === '.' || p === '..') || !/^[A-Za-z0-9_./-]+$/.test(value))
    throw new BackupError('备份包含不安全的文件路径，无法恢复。')
  return value
}
export function bookDraft(book: BackupBook) {
  return { title: book.title, author: book.author, translator: book.translator, status: fromDatabaseStatus(book.status),
    startedOn: book.startedOn || '', finishedOn: book.finishedOn || '', rating: book.rating, note: book.notes, cover: '', cropPosition: { ...book.cropPosition } }
}
export function validateStructured(value: unknown): StructuredBackupV1 {
  const root = object(value)
  keys(root, 'format formatVersion createdAt coverFilesIncluded household profiles books')
  if (root.format !== 'reading-shelf-structured-export' || root.formatVersion !== 1 || root.coverFilesIncluded !== false)
    throw new BackupError('不支持这个备份格式或版本。')
  time(root.createdAt)
  const hh = object(root.household); keys(hh, 'id name originalCreatedAt originalUpdatedAt')
  id(hh.id); string(hh.name, 80, 1); time(hh.originalCreatedAt); time(hh.originalUpdatedAt)
  const profileIds = new Set<string>()
  const profiles = array(root.profiles, BACKUP_LIMITS.profiles)
  if (!profiles.length) fail()
  for (const value of profiles) {
    const p = object(value); keys(p, 'id name sortOrder archivedAt originalCreatedAt originalUpdatedAt')
    const pid = id(p.id); if (profileIds.has(pid)) fail(); profileIds.add(pid)
    string(p.name, 20, 1); if (!Number.isInteger(p.sortOrder) || Math.abs(p.sortOrder as number) > 2147483647) fail()
    time(p.archivedAt, true); time(p.originalCreatedAt); time(p.originalUpdatedAt)
  }
  const bookIds = new Set<string>()
  for (const value of array(root.books, BACKUP_LIMITS.books)) {
    const b = object(value)
    keys(b, 'id profileId title author translator status startedOn finishedOn rating notes cropPosition cover originalCreatedAt originalUpdatedAt deletedAt deletedByOriginal')
    const bid = id(b.id), pid = id(b.profileId); if (bookIds.has(bid) || !profileIds.has(pid)) fail(); bookIds.add(bid)
    string(b.title, 200, 1); string(b.author, 200, 1); string(b.translator, 200); string(b.notes, 5000)
    for (const key of ['startedOn', 'finishedOn']) if (b[key] !== null) string(b[key], 10, 10)
    const pos = object(b.cropPosition); keys(pos, 'x y')
    if (typeof pos.x !== 'number' || typeof pos.y !== 'number') fail()
    time(b.originalCreatedAt); time(b.originalUpdatedAt); time(b.deletedAt, true)
    if (b.deletedByOriginal !== null) id(b.deletedByOriginal)
    if (b.deletedAt === null && b.deletedByOriginal !== null) fail()
    try { draftColumns(bookDraft(b as unknown as BackupBook)) } catch { fail() }
    if (b.cover !== null) {
      const c = object(b.cover); keys(c, 'originalPath originalFilename mimeType')
      const path = string(c.originalPath, 240, 1), filename = string(c.originalFilename, 255, 1), mimeType = string(c.mimeType, 30, 1)
      try { coverColumns({ path, filename, mimeType }, { householdId: hh.id as string, profileId: pid, bookId: bid }) } catch { fail() }
    }
  }
  return root as unknown as StructuredBackupV1
}
export function validateManifest(value: unknown): BackupManifestV1 {
  const m = object(value)
  keys(m, 'format formatVersion createdAt backupStartedAt backupCompletedAt source household profileCount bookCount activeBookCount softDeletedBookCount coverFileCount referencedCoverFileCount historicalCoverFileCount backupIncludes hashAlgorithm restoreHistoricalCovers files')
  if (m.format !== 'reading-shelf-backup' || m.formatVersion !== 1) throw new BackupError('不支持这个完整备份格式或版本。')
  if (m.source !== 'supabase' || m.hashAlgorithm !== 'SHA-256' || m.restoreHistoricalCovers !== 'keep-in-zip'
    || JSON.stringify(m.backupIncludes) !== JSON.stringify(['structuredData', 'covers', 'softDeletedRecords', 'historicalOriginals'])) fail()
  for (const key of ['createdAt', 'backupStartedAt', 'backupCompletedAt']) time(m[key])
  const hh = object(m.household); keys(hh, 'id name'); id(hh.id); string(hh.name, 80, 1)
  integer(m.profileCount, BACKUP_LIMITS.profiles, 1)
  for (const key of ['bookCount', 'activeBookCount', 'softDeletedBookCount']) integer(m[key], BACKUP_LIMITS.books)
  for (const key of ['coverFileCount', 'referencedCoverFileCount', 'historicalCoverFileCount']) integer(m[key], BACKUP_LIMITS.entries)
  const paths = new Set<string>()
  for (const value of array(m.files, BACKUP_LIMITS.entries - 1)) {
    const f = object(value)
    keys(f, f.kind === 'data' ? 'kind path size sha256' : 'kind path size sha256 profileId bookId originalStoragePath originalFilename mimeType referencedByBookId')
    const path = safeArchivePath(string(f.path, 240, 1)); if (paths.has(path)) fail(); paths.add(path)
    integer(f.size, f.kind === 'data' ? BACKUP_LIMITS.jsonBytes : BACKUP_LIMITS.coverBytes, 1)
    if (!/^[0-9a-f]{64}$/.test(string(f.sha256, 64, 64))) fail()
    if (f.kind === 'data') { if (path !== 'data/structured-data.json') fail() }
    else if (f.kind === 'cover') {
      const pid = id(f.profileId), bid = id(f.bookId), original = string(f.originalStoragePath, 240, 1)
      if (f.originalFilename !== null) string(f.originalFilename, 255, 1)
      const mime = string(f.mimeType, 30, 1)
      try {
        assertCoverPath(original, { householdId: hh.id as string, profileId: pid, bookId: bid })
        coverColumns({ path: original, filename: (f.originalFilename || 'original') as string, mimeType: mime }, { householdId: hh.id as string, profileId: pid, bookId: bid })
      } catch { fail() }
      if (path !== `covers/${original.split('/').slice(1).join('/')}`) fail()
      if (f.referencedByBookId !== null && id(f.referencedByBookId) !== bid) fail()
    } else fail()
  }
  if (!paths.has('data/structured-data.json')) fail()
  return m as unknown as BackupManifestV1
}
export function parseJson(bytes: Uint8Array): unknown {
  try { return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)) as unknown }
  catch { throw new BackupError('备份中的 JSON 无法读取，文件可能损坏。') }
}
