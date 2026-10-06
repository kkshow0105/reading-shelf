import type { BookScope } from '../remote/contracts.ts'
import { assertCoverPath } from '../remote/cover-path.ts'

export const COVER_URL_TTL_SECONDS = 3600
export const COVER_URL_REFRESH_MS = 120000
export interface CoverSource { scope: BookScope; path: string }
export interface CoverLink { url: string; expiresAt: number }
// Owned by one authenticated Workspace. Never written into a Book or browser storage.
export class CoverUrlCache {
  private links = new Map<string, CoverLink>()
  private pending = new Map<string, Promise<CoverLink>>()
  private generation = 0
  private load: (source: CoverSource) => Promise<{ url: string; expiresIn: number }>
  private now: () => number
  constructor(load: (source: CoverSource) => Promise<{ url: string; expiresIn: number }>, now = Date.now) { this.load = load; this.now = now }
  get(source: CoverSource, refresh = false) {
    const path = assertCoverPath(source.path, source.scope)
    if (refresh) this.links.delete(path)
    const hit = this.links.get(path)
    if (hit && hit.expiresAt - this.now() > COVER_URL_REFRESH_MS) return Promise.resolve(hit)
    const inflight = this.pending.get(path)
    if (inflight) return inflight
    const generation = this.generation, started = this.now()
    const request = this.load(source).then(result => {
      const link = { url: result.url, expiresAt: started + result.expiresIn * 1000 }
      if (generation === this.generation) this.links.set(path, link)
      return link
    }).finally(() => { if (this.pending.get(path) === request) this.pending.delete(path) })
    this.pending.set(path, request)
    return request
  }
  clear() { ++this.generation; this.links.clear(); this.pending.clear() }
}
