import test from 'node:test'
import assert from 'node:assert/strict'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '../remote/database.types.ts'
import { createRepositories } from '../remote/repositories.ts'
import { createCoverService } from '../remote/cover-service.ts'
import { mapBook } from '../remote/mappers.ts'
import { coverPath, MAX_COVER_BYTES } from '../remote/cover-path.ts'
import { blankDraft } from '../../lib/books.ts'
import { validateCoverMetadata, validateBrowserCover, localPreview } from './files.ts'
import { CoverUrlCache, COVER_URL_TTL_SECONDS } from './url-cache.ts'
import { createBookCoverMutations } from './mutations.ts'

const householdId = '10000000-0000-0000-0000-000000000001', profileId = '20000000-0000-0000-0000-000000000001'
const bookId = '30000000-0000-0000-0000-000000000001', imageId = '40000000-0000-0000-0000-000000000001'
const scope = { householdId, profileId, bookId }, path = coverPath(scope, 'image/png', imageId)
const oldRevision = '2026-10-06T10:00:00.123456+00:00'
const row: Database['public']['Tables']['books']['Row'] = { id: bookId, household_id: householdId, profile_id: profileId,
  title: '测试', author: '作者', translator: null, notes: null, status: 'want_to_read', progress_percent: null, rating: null,
  started_on: null, finished_on: null, cover_original_path: path, cover_original_filename: '旧.png', cover_mime_type: 'image/png',
  cover_position_x: .25, cover_position_y: .75, created_at: oldRevision, updated_at: oldRevision, deleted_at: null, deleted_by: null }
const draft = { ...blankDraft(), title: '测试', author: '作者', note: '新的文字', cropPosition: { x: .25, y: .75 } }
const file = new File([new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 0])], '原始文件.JPG', { type: 'image/png' })
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
function fixture(respond: (url: URL, method: string, body: unknown) => Response) {
  const requests: { url: URL; method: string; body: unknown; headers: Headers }[] = []
  const client = createClient<Database>('https://fixture.supabase.co', 'sb_publishable_test_fixture', { auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: async (input, init = {}) => {
    const url = new URL(String(input)), method = init.method || 'GET', body = typeof init.body === 'string' ? JSON.parse(init.body) : init.body
    requests.push({ url, method, body, headers: new Headers(init.headers) }); return respond(url, method, body)
  } } })
  return { requests, service: createBookCoverMutations(createRepositories(client, householdId).books, createCoverService(client), householdId, profileId) }
}
test('MIME决定扩展名，唯一UUID路径拒绝SVG/未知类型，文件大小校验', () => {
  for (const [mime, ext] of [['image/jpeg', 'jpg'], ['image/png', 'png'], ['image/webp', 'webp']]) {
    assert.ok(coverPath(scope, mime, imageId).endsWith('.' + ext))
    assert.notEqual(coverPath(scope, mime, crypto.randomUUID()), coverPath(scope, mime, crypto.randomUUID()))
  }
  assert.throws(() => coverPath(scope, 'image/svg+xml', imageId))
  assert.throws(() => validateCoverMetadata(new File(['x'], 'x.svg', { type: 'image/svg+xml' })))
  assert.throws(() => validateCoverMetadata(new File([new Uint8Array(MAX_COVER_BYTES + 1)], 'x.png', { type: 'image/png' })))
  validateCoverMetadata(file)
})
test('浏览器解码失败即拒绝，临时URL始终释放；解码尺寸可读且文件不改字节', async () => {
  const released: string[] = [], urls = { createObjectURL: () => 'blob:test-only', revokeObjectURL: (url: string) => { released.push(url) } }
  const original = await file.arrayBuffer()
  await assert.rejects(validateBrowserCover(file, async () => { throw new Error('decoder') }, urls))
  assert.deepEqual(await validateBrowserCover(file, async () => ({ width: 400, height: 600 }), urls), { width: 400, height: 600 })
  await assert.rejects(validateBrowserCover(new File(['not an image'], 'fake.jpg', { type: 'image/jpeg' }), async () => ({ width: 1, height: 1 }), urls))
  assert.equal(released.length, 2); assert.deepEqual(await file.arrayBuffer(), original)
  const local = localPreview(file, urls); local.release(); local.release(); assert.equal(released.length, 3)
})
test('新建先记录后上传；上传失败返回书籍已保存的部分成功，不回滚记录', async () => {
  const f = fixture((url, method) => url.pathname.includes('/storage/') ? json({ message: 'failed' }, 503) : method === 'POST' ? json({ ...row, cover_original_path: null, cover_original_filename: null, cover_mime_type: null }) : json([{ ...row, cover_original_path: null, cover_original_filename: null, cover_mime_type: null }]))
  const result = await f.service.create(draft, bookId, { kind: 'file', file })
  assert.equal(result.kind, 'saved'); if (result.kind !== 'saved') return
  assert.equal(result.coverIssue, 'upload'); assert.equal(result.record.originalCover, null)
  assert.equal(f.requests[0].method, 'POST'); assert.equal(f.requests.some(r => r.method === 'DELETE' || r.method === 'PATCH'), false)
  assert.equal('cover_original_path' in (f.requests[0].body as object), false)
})
test('新建上传成功而关联conflict保留Book和原图，部分成功区分link错误', async () => {
  for (const failure of ['conflict', 'link'] as const) {
    const f = fixture((url, method) => url.pathname.includes('/storage/') ? json({ Key: 'fixture' }) : method === 'POST' ? json(row) : method === 'PATCH' ? failure === 'conflict' ? json([]) : json({ code: 'network_error' }, 503) : json([row]))
    const result = await f.service.create(draft, bookId, { kind: 'file', file })
    assert.equal(result.kind, 'saved'); if (result.kind === 'saved') assert.equal(result.coverIssue, failure)
    assert.equal(f.requests.some(r => r.method === 'DELETE'), false)
  }
})
test('编辑先上传再一次CAS更新文字+封面+center，不覆盖旧原图、不保存URL', async () => {
  const f = fixture((url, method, body) => url.pathname.includes('/storage/') ? json({ Key: 'fixture' }) : method === 'PATCH' ? json([{ ...row, ...(body as object) }]) : json([row]))
  const result = await f.service.update(mapBook(row, householdId, profileId), draft, { kind: 'file', file })
  assert.equal(result.kind, 'saved')
  const patch = f.requests.filter(r => r.method === 'PATCH'); assert.equal(patch.length, 1)
  const body = patch[0].body as Record<string, unknown>
  assert.equal(body.notes, draft.note); assert.equal(body.cover_position_x, .5); assert.equal(body.cover_position_y, .5)
  assert.ok(String(body.cover_original_path).endsWith('.png')); assert.equal(body.cover_original_filename, file.name)
  assert.equal(patch[0].url.searchParams.get('updated_at'), 'eq.' + oldRevision)
  const upload = f.requests.find(r => r.url.pathname.includes('/storage/'))!
  assert.ok(f.requests.indexOf(upload) < f.requests.indexOf(patch[0])); assert.equal(upload.headers.get('x-upsert'), 'false')
  assert.deepEqual(await ((upload.body as FormData).get('') as File).arrayBuffer(), await file.arrayBuffer())
  assert.equal(f.requests.some(r => r.method === 'DELETE'), false)
})
test('编辑上传失败不PATCH，上传后conflict不强制覆盖，原输入File保留', async () => {
  for (const failUpload of [true, false]) {
    const f = fixture((url, method) => url.pathname.includes('/storage/') ? failUpload ? json({ message: 'failed' }, 503) : json({ Key: 'fixture' }) : method === 'PATCH' ? json([]) : json([row]))
    const record = mapBook(row, householdId, profileId), before = structuredClone(draft)
    if (failUpload) { await assert.rejects(f.service.update(record, draft, { kind: 'file', file })); assert.equal(f.requests.some(r => r.method === 'PATCH'), false) }
    else assert.deepEqual(await f.service.update(record, draft, { kind: 'file', file }), { kind: 'conflict' })
    assert.deepEqual(draft, before); assert.equal(record.originalCover?.path, path); assert.equal(f.requests.some(r => r.method === 'DELETE'), false)
  }
})
test('普通编辑保留位置和引用，移除只清空引用并居中，不删文件', async () => {
  const f = fixture((_url, method, body) => method === 'PATCH' ? json([{ ...row, ...(body as object) }]) : json([row]))
  const record = mapBook(row, householdId, profileId)
  await f.service.update(record, draft, { kind: 'keep' })
  assert.equal('cover_original_path' in (f.requests[0].body as object), false)
  assert.equal((f.requests[0].body as Record<string, unknown>).cover_position_x, .25)
  await f.service.update(record, draft, { kind: 'remove' })
  const removed = f.requests[1].body as Record<string, unknown>
  assert.equal(removed.cover_original_path, null); assert.equal(removed.cover_position_x, .5)
  assert.equal(f.requests.some(r => r.method === 'DELETE' || r.url.pathname.includes('/storage/')), false)
})
test('签名内存缓存命中、接近60分钟到期提前刷新、同path并发去重', async () => {
  let now = 0, calls = 0, resolve!: (value: { url: string; expiresIn: number }) => void
  const cache = new CoverUrlCache(async () => { calls++; return new Promise(r => { resolve = r }) }, () => now)
  const source = { scope, path }, first = cache.get(source), second = cache.get(source)
  assert.equal(calls, 1); resolve({ url: 'test-display-only', expiresIn: COVER_URL_TTL_SECONDS })
  assert.equal(await first, await second); await cache.get(source); assert.equal(calls, 1)
  now = 3500000; const next = cache.get(source); assert.equal(calls, 2)
  resolve({ url: 'test-refreshed-display-only', expiresIn: COVER_URL_TTL_SECONDS }); await next
})
test('签名失败可重试，清理身份缓存后旧请求不能填回；错误归属拒绝', async () => {
  let calls = 0
  const failing = new CoverUrlCache(async () => { if (++calls === 1) throw new Error('request'); return { url: 'test-only', expiresIn: 3600 } })
  await assert.rejects(failing.get({ scope, path })); await failing.get({ scope, path }); assert.equal(calls, 2)
  let release!: () => void, requests = 0
  const cache = new CoverUrlCache(async () => { requests++; await new Promise<void>(r => { release = r }); return { url: 'test-only', expiresIn: 3600 } })
  const old = cache.get({ scope, path }); cache.clear(); release(); await old
  const newer = cache.get({ scope, path }); assert.equal(requests, 2); release(); await newer
  assert.throws(() => cache.get({ path, scope: { ...scope, profileId: householdId } }))
})
test('同步peek只复用有效path，返回/重新挂载无额外签名；提前120秒失效，clear后不可读', async () => {
  let now = 0, calls = 0
  const cache = new CoverUrlCache(async () => { calls++; return { url: 'same-test-only-url', expiresIn: 3600 } }, () => now)
  const source = { scope, path }
  assert.equal(cache.peek(source), undefined)
  const initial = await cache.get(source)
  for (let visit = 0; visit < 3; visit++) { assert.equal(cache.peek(source), initial); assert.equal(await cache.get(source), initial) }
  assert.equal(calls, 1)
  now = 3479999; assert.equal(cache.peek(source), initial)
  now = 3480000; assert.equal(cache.peek(source), undefined)
  assert.throws(() => cache.peek({ scope: { ...scope, profileId: householdId }, path }))
  await cache.get(source); assert.equal(calls, 2)
  cache.clear(); assert.equal(cache.peek(source), undefined)
})
