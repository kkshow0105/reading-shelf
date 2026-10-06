import { useState, useEffect, useRef } from 'react'
import { ArrowLeft, Upload, X } from 'lucide-react'
import type { Book, BookDraft, Profile, ReadingStatus } from '@/types'
import { statuses } from '@/types'
import { blankDraft, toDraft, validateDraft } from '@/lib/books'
import { defaultCropPosition } from '@/lib/covers'
import { BookCover } from '@/components/BookCover'
import { RatingInput } from '@/components/Stars'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { bookMessage } from '@/data/books/model'
export function BookFormPage({ profile, book, recoveredDraft, ownBooks, onNavigate, onSave, onDraftChange, onObjectURL, coverEnabled = true }: { profile: Profile; book?: Book; recoveredDraft?: BookDraft; ownBooks: Book[]; onNavigate: (path: string) => void; onSave: (draft: BookDraft) => void | Promise<void>; onDraftChange: (draft: BookDraft | null) => void; onObjectURL: (url: string) => void; coverEnabled?: boolean }) {
  const baseline = useRef(book ? toDraft(book) : blankDraft())
  const [draft, setDraft] = useState<BookDraft>(() => recoveredDraft || baseline.current)
  const restored = useRef(!!recoveredDraft)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [imageError, setImageError] = useState('')
  const [stateChange, setStateChange] = useState<ReadingStatus | null>(null)
  const [duplicate, setDuplicate] = useState(false)
  const [duplicateConfirmed, setDuplicateConfirmed] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const savingRef = useRef(false), mounted = useRef(true)
  const [saving, setSaving] = useState(false), [saveError, setSaveError] = useState<string | null>(null)
  useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])
  useEffect(() => { onDraftChange(JSON.stringify(draft) === JSON.stringify(baseline.current) ? null : draft) }, [draft, onDraftChange])
  const update = <K extends keyof BookDraft>(key: K, value: BookDraft[K]) => { if (key === 'title') setDuplicateConfirmed(false); setDraft(previous => ({ ...previous, [key]: value, ...(key === 'cover' ? { cropPosition: defaultCropPosition() } : {}) })); setErrors(previous => ({ ...previous, [key]: '' })) }
  const back = () => onNavigate(book ? `/p/${profile.id}/books/${book.id}` : `/p/${profile.id}/shelf`)
  const submit = async () => {
    if (savingRef.current) return
    savingRef.current = true; setSaving(true); setSaveError(null)
    try { await onSave({ ...draft, title: draft.title.trim(), author: draft.author.trim(), translator: draft.translator.trim() }) }
    catch (error) { if (mounted.current) setSaveError(bookMessage(error, 'save')) }
    finally { savingRef.current = false; if (mounted.current) setSaving(false) }
  }
  const save = () => {
    if (savingRef.current) return
    const found = validateDraft(draft)
    setErrors(found)
    if (Object.keys(found).length) { document.getElementById(Object.keys(found)[0])?.focus(); return }
    if (!book && !duplicateConfirmed && ownBooks.some(b => b.title.trim() === draft.title.trim())) { setDuplicate(true); return }
    void submit()
  }
  const fieldProps = (name: string) => ({ 'aria-invalid': !!errors[name] || undefined, 'aria-describedby': errors[name] ? `${name}-error` : undefined })
  const showDates = draft.status !== '想读' || !!draft.startedOn || !!draft.finishedOn
  const today = new Date().toLocaleDateString('en-CA')
  return <main id="main-content" className="form-page page-shell page-enter" tabIndex={-1}>
    <div className="page-nav"><Button disabled={saving} onClick={back}><ArrowLeft size={18} aria-hidden="true" />{book ? '返回详情' : '取消'}</Button><Button className="form-top-save" variant="primary" disabled={saving} onClick={save}>{saving ? '保存中…' : '保存'}</Button></div>
    <div className="form-intro"><span className="editorial-label">{book ? 'EDIT READING NOTES' : 'A NEW CHAPTER'}</span><h1>{book ? '编辑这本书' : '添一本书'}</h1><p>{book ? '记录属于' : '添加到'}{profile.name}的书架{restored.current && <span className="draft-restored"> · 已恢复本轮草稿</span>}</p></div>
    <form onSubmit={e => { e.preventDefault(); save() }} noValidate aria-busy={saving}><fieldset className="book-form" disabled={saving}>
      <aside className="cover-editor"><BookCover title={draft.title} author={draft.author} cover={draft.cover} className="form-cover" />
        <div className="cover-editor-actions"><input ref={fileRef} className="sr-only" tabIndex={-1} type="file" accept="image/jpeg,image/png,image/webp" aria-label="选择封面图片" onChange={e => {
          const file = e.target.files?.[0]; if (!file) return
          e.target.value = ''
          if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) { setImageError('请选择 JPEG、PNG 或 WebP 图片。'); return }
          if (file.size > 10 * 1024 * 1024) { setImageError('图片超过 10MB，请选择较小的文件。'); return }
          const url = URL.createObjectURL(file); onObjectURL(url); update('cover', url); setImageError('')
        }} disabled={!coverEnabled} /><Button variant="outline" disabled={!coverEnabled} onClick={() => fileRef.current?.click()}><Upload size={17} aria-hidden="true" />{draft.cover ? '更换封面' : '选择封面'}</Button>{draft.cover && coverEnabled && <Button onClick={() => update('cover', '')} aria-label="移除当前封面"><X size={16} aria-hidden="true" />移除封面</Button>}{coverEnabled ? <p>保留原图，书架居中显示。<br />JPEG、PNG、WebP，最多 10MB。</p> : <p>封面将在下一阶段启用。</p>}{imageError && <p className="field-error" role="alert">{imageError}</p>}</div>
      </aside>
      <div className="form-fields"><section className="form-section"><div className="form-section-heading"><span>01</span><h2>这本书</h2></div><p className="required-note">标有 * 的项目为必填</p>
        <div className="field"><label htmlFor="title">书名 *</label><Input id="title" value={draft.title} maxLength={200} onChange={e => update('title', e.target.value)} {...fieldProps('title')} required />{errors.title && <p id="title-error" className="field-error">{errors.title}</p>}</div>
        <div className="field"><label htmlFor="author">作者 *</label><Input id="author" value={draft.author} maxLength={200} onChange={e => update('author', e.target.value)} {...fieldProps('author')} required />{errors.author && <p id="author-error" className="field-error">{errors.author}</p>}</div>
        <div className="field"><label htmlFor="translator">译者 <span className="optional">可选</span></label><Input id="translator" value={draft.translator} maxLength={200} onChange={e => update('translator', e.target.value)} /></div>
      </section><section className="form-section"><div className="form-section-heading"><span>02</span><h2>阅读记录</h2></div>
        <div className="field"><label htmlFor="status">阅读状态</label><select id="status" className="input native-select" value={draft.status} onChange={e => { const next = e.target.value as ReadingStatus; if (draft.finishedOn && (next === '在读' || next === '暂停')) setStateChange(next); else update('status', next) }}>{statuses.map(status => <option key={status}>{status}</option>)}</select></div>
        {showDates && <div className="date-fields"><div className="field"><label htmlFor="startedOn">开始日期 <span className="optional">可选</span></label><Input id="startedOn" type="date" max={today} value={draft.startedOn} onInput={e => update('startedOn', e.currentTarget.value)} {...fieldProps('startedOn')} />{errors.startedOn && <p id="startedOn-error" className="field-error">{errors.startedOn}</p>}</div>{(draft.status === '读完' || draft.status === '弃读' || draft.finishedOn) && <div className="field"><label htmlFor="finishedOn">{draft.status === '弃读' ? '终止日期' : '完成日期'} <span className="optional">可选</span></label><Input id="finishedOn" type="date" max={today} value={draft.finishedOn} onInput={e => update('finishedOn', e.currentTarget.value)} {...fieldProps('finishedOn')} />{errors.finishedOn && <p id="finishedOn-error" className="field-error">{errors.finishedOn}</p>}</div>}</div>}
        <RatingInput value={draft.rating} onChange={value => update('rating', value)} />
      </section><section className="form-section"><div className="form-section-heading"><span>03</span><h2>留下一点记忆</h2></div><div className="field"><label htmlFor="note">短评 / 阅读笔记 <span className="optional">可选</span></label><Textarea id="note" rows={6} value={draft.note} maxLength={5000} placeholder="一些感受，一句话，或留给下次重读的自己。" onChange={e => update('note', e.target.value)} /><p className="character-count">{draft.note.length} / 5000</p></div></section>
        {saveError && <p className="field-error" role="alert">{saveError}</p>}
        <div className="form-actions"><Button onClick={back}>取消</Button><Button type="submit" variant="primary">{saving ? '正在保存…' : '保存这本书'}</Button></div>
      </div>
    </fieldset></form>
    <Dialog open={stateChange !== null} onOpenChange={open => { if (!open) setStateChange(null) }}><DialogContent><DialogTitle className="overlay-title">保留还是清除完成日期？</DialogTitle><DialogDescription className="overlay-description">改为“{stateChange}”后，这本书尚未结束阅读。确认后将清除已填写的结束日期，其他内容保留。</DialogDescription><div className="dialog-actions"><Button variant="outline" onClick={() => setStateChange(null)}>保留原状态</Button><Button variant="primary" onClick={() => { setDraft(previous => ({ ...previous, status: stateChange!, finishedOn: '' })); setStateChange(null) }}>清除日期并更改</Button></div></DialogContent></Dialog>
    <Dialog open={duplicate} onOpenChange={setDuplicate}><DialogContent><DialogTitle className="overlay-title">书架里已有同名书</DialogTitle><DialogDescription className="overlay-description">仍然添加《{draft.title}》吗？新记录将保留独立的日期、评分与短评。</DialogDescription><div className="dialog-actions"><Button variant="outline" onClick={() => setDuplicate(false)}>继续编辑</Button><Button variant="primary" disabled={saving} onClick={() => { setDuplicateConfirmed(true); setDuplicate(false); void submit() }}>仍然添加</Button></div></DialogContent></Dialog>
  </main>
}
