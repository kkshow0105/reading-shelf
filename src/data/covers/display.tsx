import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { CoverUrlCache, COVER_URL_REFRESH_MS } from './url-cache'
import type { CoverSource } from './url-cache'

export const CoverDisplayContext = createContext<CoverUrlCache | null>(null)
export function useCoverUrl(source?: CoverSource) {
  const cache = useContext(CoverDisplayContext)
  const [link, setLink] = useState(() => ({ cache, path: source?.path || '', url: source && cache ? cache.peek(source)?.url || '' : '' })), [attempt, setAttempt] = useState(0)
  const imageRetries = useRef(0)
  const forceRefresh = useRef(false)
  useEffect(() => { imageRetries.current = 0; forceRefresh.current = false }, [source?.path])
  useEffect(() => {
    if (!source || !cache) return
    let active = true, timer: ReturnType<typeof setTimeout> | undefined
    const cached = cache.peek(source)
    setLink(previous => previous.cache === cache && previous.path === source.path ? previous : { cache, path: source.path, url: cached?.url || '' })
    const force = forceRefresh.current; forceRefresh.current = false
    void cache.get(source, force).then(value => {
      if (!active) return
      setLink({ cache, path: source.path, url: value.url })
      timer = setTimeout(() => setAttempt(n => n + 1), Math.max(1000, value.expiresAt - Date.now() - COVER_URL_REFRESH_MS))
    }).catch(() => { if (active) timer = setTimeout(() => setAttempt(n => n + 1), 30000) })
    return () => { active = false; clearTimeout(timer) }
  }, [cache, source?.path, source?.scope.householdId, source?.scope.profileId, source?.scope.bookId, attempt])
  // A new path/cache must never display the preceding identity's URL.
  return { url: source && cache ? cache.peek(source)?.url || (link.cache === cache && link.path === source.path ? link.url : '') : '', imageError: () => {
    if (source && imageRetries.current++ === 0) { forceRefresh.current = true; setAttempt(n => n + 1) }
  } }
}
