import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'
export function BookCover({ title, author, cover, className, decorative = false }: { title: string; author: string; cover: string; className?: string; decorative?: boolean }) {
  const [failed, setFailed] = useState(false)
  useEffect(() => setFailed(false), [cover])
  return <div className={cn('book-cover', className)}>
    {cover && !failed ? <img src={cover} alt={decorative ? '' : `《${title}》封面`} width="360" height="540" loading="lazy" onError={() => setFailed(true)} /> : <div className="cover-fallback" aria-hidden={decorative || undefined}>
      <span className="cover-fallback-rule" /><strong>{title || '尚未选定封面'}</strong><span>{author || '一本书，一段记忆'}</span>
    </div>}
  </div>
}
