import { useMemo, useRef, useState } from 'react'
import { ArrowLeft } from 'lucide-react'
import { getSupabaseClient } from '../lib/supabase'
import { createBackupRepository } from '../data/backup/repository'
import { bytesBlob, jsonBytes, openArchive } from '../data/backup/archive'
import { downloadBackup, exportComplete, exportCsv } from '../data/backup/export'
import { BackupError, BACKUP_LIMITS } from '../data/backup/types'
import type { ValidatedBackup, RestoreResult } from '../data/backup/types'
import { inspectTarget, RestoreSession } from '../data/backup/restore'
import { validateBrowserCover } from '../data/covers/files'
import { Button } from '../components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '../components/ui/dialog'
import { usePwaUpdateGuard } from '../pwa/PwaProvider'

export default function BackupPage({ householdId, userId, profileId, onNavigate, mutate }: {
  householdId: string; userId: string; profileId: string; onNavigate: (path: string) => void;
  mutate: <T>(action: () => Promise<T>) => Promise<T | undefined>;
}) {
  const repo = useMemo(() => createBackupRepository(getSupabaseClient(), householdId), [householdId])
  const [busy, setBusy] = useState(false), [message, setMessage] = useState(''), [error, setError] = useState('')
  const [preview, setPreview] = useState<{ backup: ValidatedBackup; allowed: boolean; reason: string; mapping: string[]; filename: string; slots: { id: string; updatedAt: string }[] } | null>(null)
  const [report, setReport] = useState<RestoreResult | null>(null)
  const input = useRef<HTMLInputElement>(null), cancel = useRef<HTMLButtonElement>(null), gate = useRef(false), session = useRef<RestoreSession | null>(null)
  const chooserButton = useRef<HTMLButtonElement>(null), controller = useRef<AbortController | null>(null)
  usePwaUpdateGuard(() => gate.current ? 'busy' : preview || report && !report.complete ? 'confirm' : 'safe')
  const work = async (action: () => Promise<void>) => {
    if (gate.current) return
    gate.current = true; setBusy(true); setError('')
    controller.current = new AbortController()
    try { await mutate(action) }
    catch (reason) { setError(reason instanceof BackupError ? reason.message : '操作暂时未完成，请保留原文件后重试。') }
    finally { gate.current = false; setBusy(false) }
  }
  const exportFile = (kind: 'zip' | 'json' | 'csv') => void work(async () => {
    setMessage('读取家庭所有档案，包括软删除记录…')
    let blob: Blob
    if (kind === 'zip') { const result = await exportComplete(repo, setMessage, controller.current?.signal); blob = bytesBlob(result.bytes, 'application/zip') }
    else { const data = await repo.snapshot(); blob = kind === 'json' ? bytesBlob(jsonBytes(data), 'application/json') : new Blob([exportCsv(data)], { type: 'text/csv;charset=utf-8' }) }
    if (controller.current?.signal.aborted) throw new BackupError('已取消导出，未下载文件。')
    downloadBackup(blob, kind); setMessage('已发起浏览器下载，请在下载文件夹确认文件。')
  })
  const choose = (file: File) => void work(async () => {
    if (report && !report.complete) throw new BackupError('请先完成当前恢复；未完成记录已保留，不能切换另一份备份。')
    setMessage('校验清单、原图与 SHA-256…'); setReport(null); session.current = null
    if (file.size > BACKUP_LIMITS.zipBytes) throw new BackupError('ZIP 超过 100 MB，未解压或写入。')
    const backup = await openArchive(new Uint8Array(await file.arrayBuffer()), validateBrowserCover)
    const target = await inspectTarget(repo, userId, backup)
    if (controller.current?.signal.aborted) throw new BackupError('已取消校验，未写入任何数据。')
    setPreview({ backup, allowed: target.allowed, reason: target.reason, filename: file.name, slots: target.profiles.map(p => ({ id: p.id, updatedAt: p.updated_at })), mapping: backup.data.profiles.map((p, i) => `${target.profiles[i]?.name || '无对应空档案'} → ${p.name}${p.archivedAt ? '（归档）' : ''}`) }); setMessage('备份校验通过，尚未写入任何数据。')
  })
  const restore = () => void work(async () => {
    if (!session.current) {
      if (!preview?.allowed) return
      session.current = new RestoreSession(repo, userId, preview.backup, preview.slots)
    }
    setPreview(null)
    const result = await session.current.run(setMessage, controller.current?.signal); setReport(result)
    setMessage(result.complete ? '恢复完成，请刷新页面载入新的档案名称与书架。' : '恢复尚未全部完成。已建立的记录和原图均已保留。')
  })
  return <main id="main-content" className="page-shell backup-page" tabIndex={-1}>
    <div className="page-nav"><Button onClick={() => onNavigate(`/p/${profileId}/shelf`)} disabled={busy}><ArrowLeft size={16} aria-hidden="true" />返回书架</Button></div>
    <header className="backup-heading"><span className="editorial-label">DATA & MEMORY</span><h1>数据与备份</h1><p>把这个家庭的阅读记忆，留一份在自己手中。</p></header>
    <p className="backup-scope">导出所有阅读档案与书籍，包括软删除记录。文件仅在本机生成，下载到浏览器默认文件夹。</p>
    <section className="backup-row"><div><h2>完整备份 <span>ZIP</span></h2><p>结构化数据与全部原始封面，包含历史替换原图。用于迁移与完整恢复。</p></div><Button variant="primary" disabled={busy} onClick={() => exportFile('zip')}>下载完整 ZIP</Button></section>
    <section className="backup-row"><div><h2>结构化导出 <span>JSON</span></h2><p>档案、阅读记录与封面引用。没有图片字节，不是完整备份。</p></div><Button variant="outline" disabled={busy} onClick={() => exportFile('json')}>下载 JSON</Button></section>
    <section className="backup-row"><div><h2>阅读记录 <span>CSV</span></h2><p>表格查看，含中文表头与软删除标记。不能用于完整恢复。</p></div><Button variant="outline" disabled={busy} onClick={() => exportFile('csv')}>下载 CSV</Button></section>
    <section className="backup-row backup-restore"><div><h2>从完整备份恢复</h2><p>先校验 ZIP，再确认范围。完整恢复仅支持空书房，不会合并或覆盖已有记录。</p><p>历史原图留在 ZIP 中；仅当前引用封面重新上传。</p></div><Button ref={chooserButton} variant="outline" disabled={busy || !!report && !report.complete} onClick={() => input.current?.click()}>选择备份 ZIP</Button><input ref={input} tabIndex={-1} className="visually-hidden" type="file" accept=".zip,application/zip" aria-label="选择完整备份 ZIP" disabled={busy} onChange={e => { const file = e.target.files?.[0]; e.target.value = ''; if (file) choose(file) }} /></section>
    <p className="backup-note">第一版上限：ZIP 与展开后总量各 100 MB，2,000 本书、2,500 个文件，单张原图 10 MB。备份时请暂停其他设备编辑。</p>
    {message && <p className="backup-status" role="status" aria-live="polite">{message}</p>}{busy && <Button onClick={() => { controller.current?.abort(); setMessage('正在停止，当前请求完成后暂停…') }}>停止本次操作</Button>}{error && <p className="field-error" role="alert">{error}</p>}
    {report && <section className="backup-report"><h2>{report.complete ? '恢复完成' : '恢复进度'}</h2><p>档案 {report.profileCount} · 书籍 {report.bookCount} · 软删除 {report.softDeletedBookCount} · 已关联封面 {report.coverCount}</p><p>历史原图 {report.historicalCoversKeptInZip} 张留在 ZIP。原始时间与删除人历史保留在备份；新技术时间与删除人由服务器生成。</p>{report.failures.map((f, i) => <p key={i} className="field-error">{f.oldId ? `${f.stage} · ${f.oldId}：` : ''}{f.message}</p>)}<div className="dialog-actions"><Button variant="outline" disabled={busy} onClick={() => downloadBackup(bytesBlob(jsonBytes(report), 'application/json'), 'json')}>下载恢复报告</Button>{!report.complete && <Button variant="primary" disabled={busy} onClick={restore}>重试未完成项</Button>}</div></section>}
    <Dialog open={!!preview} onOpenChange={open => { if (!open && !busy) setPreview(null) }}><DialogContent className="backup-dialog" onCloseAutoFocus={e => { e.preventDefault(); chooserButton.current?.focus() }} onOpenAutoFocus={e => { e.preventDefault(); cancel.current?.focus() }}><DialogTitle className="overlay-title">恢复前，核对这份备份。</DialogTitle><DialogDescription className="overlay-description">清单、文件大小和 SHA-256 已通过校验。确认前不会写入书房。</DialogDescription>
      {preview && <><p className="backup-note backup-filename">文件：{preview.filename}</p><dl className="backup-summary"><div><dt>备份书房</dt><dd>{preview.backup.manifest.household.name}</dd></div><div><dt>阅读档案</dt><dd>{preview.backup.manifest.profileCount}</dd></div><div><dt>书籍 / 软删除</dt><dd>{preview.backup.manifest.bookCount} / {preview.backup.manifest.softDeletedBookCount}</dd></div><div><dt>原图 / 历史原图</dt><dd>{preview.backup.manifest.coverFileCount} / {preview.backup.manifest.historicalCoverFileCount}</dd></div></dl>{preview.allowed && <div className="backup-note" aria-label="空档案映射">{preview.mapping.map((item, i) => <p key={i}>{item}</p>)}</div>}<p className="backup-note">空档案按顺序映射为备份档案，名称会恢复。书籍使用新 UUID 与新封面路径；历史原图不重新上传。原始时间保留作历史，新技术时间由服务器生成。</p>{!preview.allowed && <p className="field-error" role="alert">{preview.reason}</p>}<div className="dialog-actions"><Button ref={cancel} variant="outline" disabled={busy} onClick={() => setPreview(null)}>取消</Button><Button variant="primary" disabled={busy || !preview.allowed} onClick={restore}>确认恢复到空书房</Button></div></>}
    </DialogContent></Dialog>
  </main>
}
