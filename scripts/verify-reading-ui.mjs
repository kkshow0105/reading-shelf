// Initial React render checks (effects cannot populate a URL during SSR).
// Browser interaction/geometry is verified separately; this is not a screenshot test.
import assert from 'node:assert/strict'
import { createServer } from 'vite'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'silent' })
try {
  const { CoverUrlCache } = await vite.ssrLoadModule('/src/data/covers/url-cache.ts')
  const { CoverDisplayContext } = await vite.ssrLoadModule('/src/data/covers/display.tsx')
  const { BookCover } = await vite.ssrLoadModule('/src/components/BookCover.tsx')
  const { ShelfPage } = await vite.ssrLoadModule('/src/pages/ShelfPage.tsx')
  const { ShelfDetailView } = await vite.ssrLoadModule('/src/components/ShelfDetailView.tsx')
  const { blankDraft, emptyFilters } = await vite.ssrLoadModule('/src/lib/books.ts')
  const scope = { householdId: '11111111-1111-4111-8111-111111111111', profileId: '22222222-2222-4222-8222-222222222222', bookId: '33333333-3333-4333-8333-333333333333' }
  const source = { scope, path: `${scope.householdId}/${scope.profileId}/${scope.bookId}/original/44444444-4444-4444-8444-444444444444.jpg` }
  let calls = 0
  const cache = new CoverUrlCache(async () => { calls++; return { url: '/covers/gate.svg', expiresIn: 3600 } })
  await cache.get(source)
  const cover = presentation => renderToStaticMarkup(createElement(CoverDisplayContext.Provider, { value: cache }, createElement(BookCover, { title: '测试', author: '作者', cover: '', remote: source, presentation })))
  for (const visit of ['shelf', 'detail', 'shelf', 'detail', 'shelf']) {
    const html = cover(visit)
    assert.ok(html.includes('src="/covers/gate.svg"'))
    assert.ok(html.includes('loading="lazy"') && html.includes('decoding="async"'))
    assert.ok(!html.includes('cover-fallback'))
  }
  assert.equal(calls, 1)
  cache.clear(); assert.ok(cover('shelf').includes('cover-fallback'))
  const profile = { id: scope.profileId, name: '测试书房', description: '' }
  // Only the SSR metadata assertion needs the existing media-query hook's window.
  globalThis.window = { matchMedia: () => ({ matches: true }) }
  const books = ['在读', '暂停', '在读', '暂停', '在读', '读完', '想读', '弃读'].map((status, i) => ({ ...blankDraft(), id: String(i), profileId: profile.id, title: '测试书名', author: '测试作者', status, rating: 4, progressPercent: [35, 68, null, null, 100, 50, 35, 35][i], createdAt: '2026-10-07T00:00:00Z' }))
  const html = renderToStaticMarkup(createElement(ShelfPage, { profile, books, query: '', filters: emptyFilters(), sort: 'recent', density: 'compact', loading: false, onFilters() {}, onSort() {}, onQuery() {}, onNavigate() {}, onDensityChange() {} }))
  assert.equal((html.match(/role="progressbar"/g) || []).length, 5)
  assert.equal((html.match(/class="stars"/g) || []).length, 3)
  assert.ok(html.includes('35%') && html.includes('68%') && html.includes('100%'))
  assert.equal((html.match(/aria-valuetext="未记录"/g) || []).length, 2)
  assert.ok(!html.includes('进度 0%'))
  const deepDetail = renderToStaticMarkup(createElement(ShelfDetailView, { page: 'detail', renderShelf: () => { throw new Error('Direct detail must not render a background shelf') } }, createElement('main', { id: 'main-content' }, '详情')))
  assert.ok(deepDetail.includes('详情') && !deepDetail.includes('hidden'))
  const inactive = renderToStaticMarkup(createElement(ShelfPage, { profile, books, query: '', filters: emptyFilters(), sort: 'recent', density: 'compact', loading: false, active: false, animate: false, onFilters() {}, onSort() {}, onQuery() {}, onNavigate() {}, onDensityChange() {} }))
  assert.ok(!inactive.includes('id="main-content"') && !inactive.includes('page-enter') && !inactive.includes('筛选书架'))
  console.log('PASS React initial/remount cached URL without effects, TTL single sign, lazy/async attrs, shelf statuses/NULL/100/ratings')
  console.log('PASS direct-detail has no background shelf; inactive shelf has no main ID, entrance animation or portal controls')
} finally { delete globalThis.window; await vite.close() }
