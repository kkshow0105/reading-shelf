import { useState, useEffect, useRef } from 'react'
import { ArrowLeft, Upload, X } from 'lucide-react'
import type { Book, BookDraft, Profile, ReadingStatus } from '@/types'
import { statuses } from '@/types'
import { blankDraft, toDraft, validateDraft } from '@/lib/books'
import { BookCover } from '@/components/BookCover'
import { RatingInput } from '@/components/Stars'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog'
export function BookFormPage({ profile, book, recoveredDraft, ownBooks, onNavigate, onSave, onDraftChange, onObjectURL }: { profile: Profile; book?: Book; recoveredDraft?: BookDraft; ownBooks: Book[]; onNavigate: (path: string) => void; onSave: (draft: BookDraft) => void; onDraftChange: (draft: BookDraft | null) => void; onObjectURL: (url: string) => void }) {
  const baseline = useRef(book ? toDraft(book) : blankDraft())
  const [draft, setDraft] = useState<BookDraft>(() => recoveredDraft || baseline.current)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [imageError, setImageError] = useState('')
  const [stateChange, setStateChange] = useState<ReadingStatus | null>(null)
  const [duplicate, setDuplicate] = useState(false)
  const [duplicateConfirmed, setDuplicateConfirmed] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  useEffect(() => { onDraftChange(JSON.stringify(draft) === JSON.stringify(baseline.current) ? null : draft) }, [draft, onDraftChange])
  const update = <K extends keyof BookDraft>(key: K, value: BookDraft[K]) => { setDraft(previous => ({ ...previous, [key]: value })); setErrors(previous => ({ ...previous, [key]: '' })) }
  const back = () => onNavigate(book ? `/p/${profile.id}/books/${book.id}` : `/p/${profile.id}/shelf`)
  const save = () => {
    const found = validateDraft(draft)
    setErrors(found)
    if (Object.keys(found).length) { document.getElementById(Object.keys(found)[0])?.focus(); return }
    if (!book && !duplicateConfirmed && ownBooks.some(b => b.title.trim() === draft.title.trim())) { setDuplicate(true); return }
    onSave({ ...draft, title: draft.title.trim(), author: draft.author.trim(), translator: draft.translator.trim() })
  }
  const fieldProps = (name: string) => ({ 'aria-invalid': !!errors[name] || undefined, 'aria-describedby': errors[name] ? `${name}-error` : undefined })
  const showDates = draft.status !== '想读' || !!draft.startedOn || !!draft.finishedOn
  const today = new Date().toLocaleDateString('en-CA')
  return <main id="main-content" className="form-page page-shell page-enter" tabIndex={-1}>
    <div className="page-nav"><Button onClick={back}><ArrowLeft size={18} aria-hidden="true" />{book ? '返回详情' : '取消'}</Button><Button className="compact-form-save" variant="primary" onClick={save}>保存</Button></div>
    <div className="form-intro"><span className="editorial-label">{book ? 'EDIT READING NOTES' : 'A NEW CHAPTER'}</span><h1>{book ? '编辑这本书' : '添一本书'}</h1><p>{book ? '记录属于' : '添加到'}{profile.name}的书架{recoveredDraft && <span className="draft-restored"> · 已恢复本轮草稿</span>}</p></div>
    <form className="book-form" onSubmit={e => { e.preventDefault(); save() }} noValidate>
      <aside className="cover-editor"><BookCover title={draft.title} author={draft.author} cover={draft.cover} className="form-cover" />
        <div className="cover-editor-actions"><input ref={fileRef} className="sr-only" tabIndex={-1} type="file" accept="image/jpeg,image/png,image/webp" aria-label="选择封面图片" onChange={e => {
          const file = e.target.files?.[0]; if (!file) return
          e.target.value = ''
          if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) { setImageError('请选择 JPEG、PNG 或 WebP 图片。'); return }
          if (file.size > 10 * 1024 * 1024) { setImageError('图片超过 10MB，请选择较小的文件。'); return }
          const url = URL.createObjectURL(file); onObjectURL(url); update('cover', url); setImageError('')
        }} /><Button variant="outline" onClick={() => fileRef.current?.click()}><Upload size={17} aria-hidden="true" />{draft.cover ? '更换封面' : '选择封面'}</Button>{draft.cover && <Button onClick={() => update('cover', '')} aria-label="移除当前封面"><X size={16} aria-hidden="true" />移除封面</Button>}<p>保留整张封面，不强制裁切。<br />JPEG、PNG、WebP，最多 10MB。</p>{imageError && <p className="field-error" role="alert">{imageError}</p>}</div>
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
        <div className="form-actions"><Button onClick={back}>取消</Button><Button type="submit" variant="primary">保存这本书</Button></div>
      </div>
    </form>
    <Dialog open={stateChange !== null} onOpenChange={open => { if (!open) setStateChange(null) }}><DialogContent><DialogTitle className="overlay-title">保留还是清除完成日期？</DialogTitle><DialogDescription className="overlay-description">改为“{stateChange}”后，这本书尚未结束阅读。确认后将清除已填写的结束日期，其他内容保留。</DialogDescription><div className="dialog-actions"><Button variant="outline" onClick={() => setStateChange(null)}>保留原状态</Button><Button variant="primary" onClick={() => { setDraft(previous => ({ ...previous, status: stateChange!, finishedOn: '' })); setStateChange(null) }}>清除日期并更改</Button></div></DialogContent></Dialog>
    <Dialog open={duplicate} onOpenChange={setDuplicate}><DialogContent><DialogTitle className="overlay-title">书架里已有同名书</DialogTitle><DialogDescription className="overlay-description">仍然添加《{draft.title}》吗？新记录将保留独立的日期、评分与短评。</DialogDescription><div className="dialog-actions"><Button variant="outline" onClick={() => setDuplicate(false)}>继续编辑</Button><Button variant="primary" onClick={() => { setDuplicateConfirmed(true); setDuplicate(false); onSave({ ...draft, title: draft.title.trim(), author: draft.author.trim(), translator: draft.translator.trim() }) }}>仍然添加</Button></div></DialogContent></Dialog>
  </main>
}
