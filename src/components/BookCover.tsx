import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'
import type { CropPosition } from '@/types'
import { normalizeCropPosition } from '@/lib/covers'
import type { CoverSource } from '@/data/covers/url-cache'
import { useCoverUrl } from '@/data/covers/display'
export function BookCover({ title, author, cover, remote, className, decorative = false, presentation = 'preview', cropPosition }: { title: string; author: string; cover: string; remote?: CoverSource; className?: string; decorative?: boolean; presentation?: 'shelf' | 'detail' | 'preview'; cropPosition?: CropPosition }) {
  const signed = useCoverUrl(cover ? undefined : remote)
  const source = cover || signed.url
  const [failed, setFailed] = useState(false)
  useEffect(() => setFailed(false), [source])
  const position = normalizeCropPosition(cropPosition)
  const positionStyle = presentation === 'shelf' && cropPosition ? { objectPosition: `${position.x * 100}% ${position.y * 100}%` } : undefined
  return <div className={cn('book-cover', presentation === 'detail' && source && !failed && 'book-cover-original', className)} data-presentation={presentation} data-remote={remote ? 'true' : undefined}>
    {source && !failed ? <img src={source} alt={decorative ? '' : `《${title}》封面`} width="360" height="540" style={positionStyle} loading="lazy" onError={() => { setFailed(true); if (!cover) signed.imageError() }} /> : <div className="cover-fallback" aria-hidden={decorative || undefined}>
      <span className="cover-fallback-rule" /><strong>{title || '尚未选定封面'}</strong><span>{author || '一本书，一段记忆'}</span>
    </div>}
  </div>
}
