import { useEffect, useState } from 'react'
import type { Ref } from 'react'
import { cn } from '@/lib/utils'
import type { CropPosition } from '@/types'
import { normalizeCropPosition } from '@/lib/covers'
import type { CoverSource } from '@/data/covers/url-cache'
import { useCoverUrl } from '@/data/covers/display'
export function BookCover({ title, author, cover, remote, className, decorative = false, presentation = 'preview', cropPosition, onView, viewRef }: { title: string; author: string; cover: string; remote?: CoverSource; className?: string; decorative?: boolean; presentation?: 'shelf' | 'detail' | 'preview'; cropPosition?: CropPosition; onView?: (source: string) => void; viewRef?: Ref<HTMLButtonElement> }) {
  const signed = useCoverUrl(cover ? undefined : remote)
  const source = cover || signed.url
  const [failed, setFailed] = useState(false)
  useEffect(() => setFailed(false), [source])
  const position = normalizeCropPosition(cropPosition)
  const positionStyle = presentation === 'shelf' && cropPosition ? { objectPosition: `${position.x * 100}% ${position.y * 100}%` } : undefined
  const image = <img src={source} alt={decorative ? '' : `《${title}》封面`} width={presentation === 'shelf' ? 360 : undefined} height={presentation === 'shelf' ? 540 : undefined} style={positionStyle} loading="lazy" decoding="async" onError={() => { setFailed(true); if (!cover) signed.imageError() }} />
  return <div className={cn('book-cover', presentation !== 'shelf' && source && !failed && 'book-cover-original', className)} data-presentation={presentation} data-remote={remote ? 'true' : undefined}>
    {source && !failed ? onView ? <button type="button" ref={viewRef} className="cover-view-trigger" aria-label={`查看《${title}》完整封面`} onClick={() => onView(source)}>{image}</button> : image : <div className="cover-fallback" aria-hidden={decorative || undefined}>
      <span className="cover-fallback-rule" /><strong>{title || '尚未选定封面'}</strong><span>{author || '一本书，一段记忆'}</span>
    </div>}
  </div>
}
