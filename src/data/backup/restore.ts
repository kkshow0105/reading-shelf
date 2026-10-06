import type { BackupRepository, BookRow, ProfileRow } from './repository.ts'
import type { BackupBook, BackupProgress, RestoreResult, ValidatedBackup } from './types.ts'
import { BackupError } from './types.ts'
import { bookDraft } from './validation.ts'
import { bytesBlob, sha256 } from './archive.ts'
import { createRepositories, checkApiError } from '../remote/repositories.ts'
import { createCoverService } from '../remote/cover-service.ts'
import { coverColumns, coverPath, COVER_BUCKET } from '../remote/cover-path.ts'
import { draftColumns } from '../remote/contracts.ts'
import type { OriginalCover } from '../remote/contracts.ts'

const emptyMessage = '完整恢复需要在空书房中进行。'
export async function inspectTarget(repo: BackupRepository, userId: string, backup: ValidatedBackup) {
  const target = await repo.target(userId)
  const allowed = target.allowed && target.profiles.length === backup.data.profiles.length && repo.householdId !== backup.data.household.id
  return { ...target, allowed, reason: !target.allowed ? emptyMessage : target.profiles.length !== backup.data.profiles.length
    ? '请在新书房中建立与备份数量相同的空阅读档案。' : repo.householdId === backup.data.household.id ? '请在另一个新的空书房中恢复。' : '' }
}
function sameFields(row: BookRow, source: BackupBook, profileId: string) {
  const columns = draftColumns(bookDraft(source))
  return row.profile_id === profileId && Object.entries(columns).every(([key, value]) => row[key as keyof BookRow] === value)
}
// A session checkpoint is intentionally memory-only. It belongs to this validated ZIP, user and household.
// Refreshing discards the checkpoint; a partial target is then blocked rather than guessed/merged.
export class RestoreSession {
  backup: ValidatedBackup; repo: BackupRepository; userId: string
  profileMapping: Record<string, string> = {}; bookMapping: Record<string, string> = {}
  private profiles: ProfileRow[] = []; private rows = new Map<string, BookRow>()
  private uploads = new Map<string, OriginalCover>(); private initialized = false; private running = false; private complete = false
  private uploaded = new Set<string>()
  private householdRevision: string | null = null
  private expectedProfiles: { id: string; updatedAt: string }[] | undefined
  constructor(repo: BackupRepository, userId: string, backup: ValidatedBackup, expectedProfiles?: { id: string; updatedAt: string }[]) {
    this.repo = repo; this.userId = userId; this.backup = backup; this.expectedProfiles = expectedProfiles
  }
  private async guard() {
    const { data, error } = await this.repo.client.auth.getUser()
    checkApiError(error)
    if (data.user?.id !== this.userId) throw new BackupError('登录身份已变化，恢复已停止。')
    const member = await this.repo.client.from('household_members').select('role').eq('household_id', this.repo.householdId).eq('user_id', this.userId).single()
    checkApiError(member.error)
    if (member.data?.role !== 'owner') throw new BackupError('书房管理权限已变化，恢复已停止。')
    const books = await this.repo.books(), objects = await this.repo.objects()
    const ids = new Set(Object.values(this.bookMapping)), paths = new Set(Array.from(this.uploads.values(), c => c.path))
    if (books.some(b => !ids.has(b.id)) || objects.some(o => !paths.has(o.path))) throw new BackupError('目标书房出现其他数据，已停止恢复；不会合并或覆盖。')
    for (const oldId of Object.keys(this.bookMapping)) {
      const current = books.find(b => b.id === this.bookMapping[oldId]), source = this.backup.data.books.find(b => b.id === oldId)!
      if (!current) { if (this.rows.has(oldId)) throw new BackupError('恢复记录被其他设备修改，已停止。'); continue }
      const known = this.rows.get(oldId), upload = this.uploads.get(oldId)
      if (!sameFields(current, source, this.profileMapping[source.profileId]) || (current.cover_original_path && current.cover_original_path !== upload?.path)
        || (current.cover_original_path && (current.cover_original_filename !== upload?.filename || current.cover_mime_type !== upload?.mimeType))
        || (!source.deletedAt && current.deleted_at)) throw new BackupError('恢复记录被其他设备修改，已停止。')
      // Only reconcile our own uncertain create/link/delete responses, never arbitrary changes to an acknowledged row.
      if (known && current.updated_at !== known.updated_at) {
        const ownLink = known.cover_original_path === null && upload && current.cover_original_path === upload.path && current.deleted_at === known.deleted_at
        const ownDelete = source.deletedAt && known.deleted_at === null && current.deleted_at && current.cover_original_path === known.cover_original_path
        if (!ownLink && !ownDelete) throw new BackupError('恢复记录版本发生变化，已停止。')
      }
      this.rows.set(oldId, current)
    }
  }
  private async readBook(oldId: string) {
    const { data, error } = await this.repo.client.from('books').select('*').eq('household_id', this.repo.householdId).eq('id', this.bookMapping[oldId]).single()
    checkApiError(error); if (!data) throw new BackupError('恢复记录暂时无法读取。'); this.rows.set(oldId, data); return data
  }
  async run(progress: BackupProgress = () => {}, signal?: AbortSignal): Promise<RestoreResult> {
    const cancelled = () => { if (signal?.aborted) throw new BackupError('恢复已暂停；已完成项保留，可在当前页面重试。') }
    if (this.running || this.complete) throw new BackupError('这份恢复已在执行或已经完成，不能重复恢复。')
    this.running = true
    const failures: RestoreResult['failures'] = []
    const result = (): RestoreResult => ({ complete: this.complete, profileCount: this.profiles.filter(p => this.backup.data.profiles.some(s => this.profileMapping[s.id] === p.id && p.name === s.name && p.sort_order === s.sortOrder && p.archived_at === s.archivedAt)).length,
      bookCount: this.rows.size, softDeletedBookCount: Array.from(this.rows.values()).filter(b => b.deleted_at).length,
      coverCount: Array.from(this.rows.values()).filter(b => b.cover_original_path).length,
      historicalCoversKeptInZip: this.backup.manifest.historicalCoverFileCount,
      householdMapping: { oldId: this.backup.data.household.id, newId: this.repo.householdId }, profileMapping: { ...this.profileMapping }, bookMapping: { ...this.bookMapping }, failures,
      originalHistory: this.backup.data.books.map(b => ({ oldId: b.id, newId: this.bookMapping[b.id], originalCreatedAt: b.originalCreatedAt, originalUpdatedAt: b.originalUpdatedAt, originalDeletedAt: b.deletedAt })) })
    try {
      cancelled()
      if (!this.initialized) {
        const target = await inspectTarget(this.repo, this.userId, this.backup)
        if (!target.allowed) throw new BackupError(target.reason)
        if (this.expectedProfiles && (this.expectedProfiles.length !== target.profiles.length || this.expectedProfiles.some((p, i) => p.id !== target.profiles[i].id || p.updatedAt !== target.profiles[i].updated_at)))
          throw new BackupError('预览后的空档案发生变化，请重新选择备份并核对映射。')
        this.profiles = target.profiles
        this.backup.data.profiles.forEach((p, i) => { this.profileMapping[p.id] = target.profiles[i].id })
        this.backup.data.books.forEach(b => { this.bookMapping[b.id] = crypto.randomUUID() })
        this.initialized = true
      }
      await this.guard()
      const client = this.repo.client, hh = await this.repo.household()
      if (this.householdRevision && hh.updated_at !== this.householdRevision && hh.name !== this.backup.data.household.name) throw new BackupError('书房名称被其他设备修改，已停止；不会覆盖。')
      this.householdRevision = hh.updated_at
      if (hh.name !== this.backup.data.household.name) {
        const { data, error } = await client.from('households').update({ name: this.backup.data.household.name }).eq('id', hh.id).eq('updated_at', hh.updated_at).select('updated_at').maybeSingle()
        checkApiError(error); if (!data) throw new BackupError('书房名称版本冲突，已停止。')
        this.householdRevision = data.updated_at
      }
      const repository = createRepositories(client, this.repo.householdId)
      for (const [index, source] of this.backup.data.books.entries()) {
        cancelled()
        progress(`恢复阅读记录 ${index + 1} / ${this.backup.data.books.length}…`)
        let stage: 'books' | 'covers' | 'deletion' = 'books'
        try {
          await this.guard()
          const id = this.bookMapping[source.id], profileId = this.profileMapping[source.profileId]
          let row = this.rows.get(source.id)
          if (!row) { await repository.books.createBook(profileId, bookDraft(source), id); row = await this.readBook(source.id) }
          if (source.cover && !row.cover_original_path) {
            stage = 'covers'
            const fileEntry = this.backup.manifest.files.find(f => f.kind === 'cover' && f.referencedByBookId === source.id)!
            let upload = this.uploads.get(source.id)
            const scope = { householdId: this.repo.householdId, profileId, bookId: id }
            if (!upload) { upload = { path: coverPath(scope, source.cover.mimeType, crypto.randomUUID()), filename: source.cover.originalFilename, mimeType: source.cover.mimeType }; this.uploads.set(source.id, upload) }
            if (!this.uploaded.has(source.id)) {
              const found = await client.storage.from(COVER_BUCKET).download(upload.path)
              if (found.data) {
                if (await sha256(new Uint8Array(await found.data.arrayBuffer())) !== fileEntry.sha256) throw new BackupError('目标原图发生变化，已停止。')
              } else {
                const { error } = await client.storage.from(COVER_BUCKET).upload(upload.path, bytesBlob(this.backup.files.get(fileEntry.path)!, source.cover.mimeType), { upsert: false, contentType: source.cover.mimeType, cacheControl: '3600' })
                checkApiError(error)
              }
              this.uploaded.add(source.id)
            }
            const { data, error } = await client.from('books').update({ ...coverColumns(upload, { householdId: this.repo.householdId, profileId, bookId: id }), cover_position_x: source.cropPosition.x, cover_position_y: source.cropPosition.y })
              .eq('household_id', this.repo.householdId).eq('profile_id', profileId).eq('id', id).eq('updated_at', row.updated_at).is('deleted_at', null).select('*').maybeSingle()
            checkApiError(error); if (!data) throw new BackupError('封面关联版本冲突；书籍已保留。')
            this.rows.set(source.id, data); row = data
          }
          if (source.deletedAt && !row.deleted_at) {
            stage = 'deletion'
            const saved = await repository.books.softDeleteBook(id, profileId, row.updated_at)
            if (saved.kind !== 'saved') throw new BackupError('软删除状态恢复冲突；书籍已保留。')
            await this.readBook(source.id)
          }
        } catch { failures.push({ stage, oldId: source.id, message: stage === 'covers' ? '书籍已保留，封面未完成；可在本次会话重试。' : '此项未能确认完成；可在本次会话重试。' }) }
      }
      await this.guard()
      if (failures.length) return result()
      for (const source of this.backup.data.profiles) {
        cancelled()
        progress('恢复阅读档案…')
        const old = this.profiles.find(p => p.id === this.profileMapping[source.id])!
        const { data: current, error: readError } = await client.from('profiles').select('*').eq('household_id', this.repo.householdId).eq('id', old.id).single()
        checkApiError(readError)
        if (!current) throw new BackupError('目标档案暂时无法读取。')
        const matches = current.name === source.name && current.sort_order === source.sortOrder && current.archived_at === source.archivedAt
        if (current.updated_at !== old.updated_at && !matches) throw new BackupError('空档案被其他设备修改，已停止。')
        if (!matches) {
          const { data, error } = await client.from('profiles').update({ name: source.name, sort_order: source.sortOrder, archived_at: source.archivedAt })
            .eq('household_id', this.repo.householdId).eq('id', old.id).eq('updated_at', current.updated_at).select('*').maybeSingle()
          checkApiError(error); if (!data) throw new BackupError('档案版本冲突，已停止。')
          this.profiles = this.profiles.map(p => p.id === data.id ? data : p)
        } else this.profiles = this.profiles.map(p => p.id === current.id ? current : p)
      }
      progress('核对恢复数量与封面原始字节…')
      await this.guard()
      if (this.rows.size !== this.backup.data.books.length) throw new BackupError('恢复数量不符。')
      if ((await this.repo.household()).name !== this.backup.data.household.name) throw new BackupError('恢复期间书房名称发生变化，不能确认完成。')
      if (this.backup.data.books.some(b => Boolean(this.rows.get(b.id)?.deleted_at) !== Boolean(b.deletedAt))) throw new BackupError('软删除状态恢复不完整。')
      for (const f of this.backup.manifest.files) if (f.kind === 'cover' && f.referencedByBookId) {
        const row = this.rows.get(f.referencedByBookId)!, upload = this.uploads.get(f.referencedByBookId)!
        if (!row.cover_original_path || !upload) throw new BackupError('恢复封面缺失。')
        const blob = await createCoverService(client).getCoverBlob({ householdId: this.repo.householdId, profileId: row.profile_id, bookId: row.id }, upload.path)
        if (await sha256(new Uint8Array(await blob.arrayBuffer())) !== f.sha256) throw new BackupError('恢复封面 SHA-256 不一致。')
      }
      this.complete = true; progress('完整恢复已完成。'); return result()
    } catch (reason) {
      if (!this.initialized) throw reason
      failures.push({ stage: 'verification', oldId: null, message: reason instanceof BackupError ? reason.message : '未能确认恢复结果，请保留 ZIP 和当前页面重试。' })
      return result()
    } finally { this.running = false }
  }
}
