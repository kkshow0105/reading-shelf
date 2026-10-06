import test from 'node:test'
import assert from 'node:assert/strict'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '../remote/database.types.ts'
import { createRepositories } from '../remote/repositories.ts'
import { mapBook } from '../remote/mappers.ts'
import { draftColumns, DataAccessError } from '../remote/contracts.ts'
import { blankDraft, selectBooks, toDraft, emptyFilters } from '../../lib/books.ts'
import { createBooksService, ReadingDrafts, RequestSequence, MutationGate, parseBookRoute } from './model.ts'

const householdId = '10000000-0000-0000-0000-000000000001', profileId = '20000000-0000-0000-0000-000000000001'
const otherProfile = '20000000-0000-0000-0000-000000000002', id = '30000000-0000-0000-0000-000000000001'
const revision = '2026-10-06T10:00:00.123456+00:00', deletedRevision = '2026-10-06T10:00:00.234567+00:00'
const draft = { ...blankDraft(), title: '测试书籍', author: '测试作者', translator: '测试译者', status: '读完' as const, finishedOn: '2025-09-28', note: '测试笔记' }
const row: Database['public']['Tables']['books']['Row'] = {
  id, household_id: householdId, profile_id: profileId, title: draft.title, author: draft.author, translator: draft.translator,
  status: 'finished', started_on: null, finished_on: draft.finishedOn, rating: null, notes: draft.note,
  cover_original_path: null, cover_original_filename: null, cover_mime_type: null, cover_position_x: .5, cover_position_y: .5,
  created_at: revision, updated_at: revision, deleted_at: null, deleted_by: null,
}
function fixture(respond: (url: URL, method: string, body: unknown) => Response | Promise<Response>) {
  const requests: { url: URL; method: string; body: unknown }[] = []
  const client = createClient<Database>('https://fixture.supabase.co', 'sb_publishable_test_fixture', {
    auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: async (input, init = {}) => {
      const url = new URL(String(input)), method = init.method || 'GET', body = typeof init.body === 'string' ? JSON.parse(init.body) : null
      requests.push({ url, method, body }); return respond(url, method, body)
    } },
  })
  return { requests, service: createBooksService(createRepositories(client, householdId).books, householdId, profileId) }
}
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
test('正式 Row 保留日期/null/位置/原始时间和删除 metadata，Insert 不写 actor 或技术时间', () => {
  const stored = mapBook(row, householdId, profileId)
  assert.equal(stored.book.startedOn, ''); assert.equal(stored.book.finishedOn, '2025-09-28')
  assert.equal(stored.book.rating, null); assert.equal(stored.book.status, '读完')
  assert.deepEqual(stored.book.cropPosition, { x: .5, y: .5 }); assert.equal(stored.updatedAt, revision)
  const columns = draftColumns(toDraft(stored.book))
  assert.equal(columns.status, 'finished'); assert.equal(columns.rating, null); assert.equal(columns.started_on, null)
  for (const key of ['id', 'updated_at', 'created_at', 'deleted_by', 'cover_original_path']) assert.equal(key in columns, false)
  const deleted = mapBook({ ...row, deleted_at: revision, deleted_by: id }, householdId, profileId)
  assert.equal(deleted.deletedBy, id); assert.equal(deleted.deletedAt, revision)
})
test('详情请求同时限定 household/profile/id；错误 Profile 不会显示成当前人', async () => {
  const f = fixture(() => json([]))
  assert.equal(await f.service.get(id), null)
  const params = f.requests[0].url.searchParams
  assert.equal(params.get('household_id'), `eq.${householdId}`); assert.equal(params.get('profile_id'), `eq.${profileId}`)
  assert.equal(params.get('id'), `eq.${id}`); assert.equal(params.get('deleted_at'), 'is.null')
  assert.equal(await f.service.get('mock-1'), null); assert.equal(f.requests.length, 1)
  const wrong = fixture(() => json([{ ...row, profile_id: otherProfile }]))
  await assert.rejects(wrong.service.get(id))
})
test('列表读取全部分页，每一页都限定档案且在服务器排除删除', async () => {
  const f = fixture(url => json(url.searchParams.get('offset') === '0' ? Array(100).fill(row) : [row]))
  assert.equal((await f.service.list()).length, 101); assert.equal(f.requests.length, 2)
  assert.deepEqual(f.requests.map(r => r.url.searchParams.get('offset')), ['0', '100'])
  for (const r of f.requests) { assert.equal(r.url.searchParams.get('profile_id'), `eq.${profileId}`); assert.equal(r.url.searchParams.get('deleted_at'), 'is.null') }
})
test('旧档案和退出后的请求失效；分页不会继续读旧档案', async () => {
  const guard = new RequestSequence(), first = guard.begin(), second = guard.begin()
  assert.equal(guard.current(first), false); assert.equal(guard.current(second), true)
  guard.cancel(); assert.equal(guard.current(second), false)
  let current = true
  const f = fixture(() => { current = false; return json(Array(100).fill(row)) })
  await f.service.list(() => current)
  assert.equal(f.requests.length, 1)
})
test('同步连点只能启动一次 mutation，失败后释放按钮锁', async () => {
  const gate = new MutationGate()
  let finish!: () => void, count = 0
  const pending = gate.run(async () => { count++; await new Promise<void>(resolve => { finish = resolve }); return 1 })
  assert.equal(await gate.run(async () => { count++; return 2 }), undefined)
  assert.equal(count, 1); finish(); assert.equal(await pending, 1); assert.equal(gate.busy, false)
  await assert.rejects(gate.run(async () => { throw new Error('test failure') }))
  assert.equal(gate.busy, false)
})
test('响应丢失后使用稳定 UUID 恢复同一已保存内容，不制造重复记录或强制覆盖', async () => {
  const f = fixture((_url, method) => method === 'POST' ? json({ code: '23505' }, 409) : json([row]))
  const result = await f.service.create(draft, id)
  assert.equal(result.kind, 'saved')
  assert.equal((f.requests[0].body as { id: string }).id, id)
  assert.equal(f.requests[1].url.searchParams.get('profile_id'), `eq.${profileId}`)
  assert.deepEqual(await f.service.create({ ...draft, note: '后来改写' }, id), { kind: 'conflict' })
  assert.equal(f.requests.some(r => r.method === 'PATCH'), false)
})
test('保存网络失败不改变调用者草稿，返回错误而非 saved', async () => {
  const f = fixture(() => json({ code: 'network_error', message: 'raw diagnostic' }, 503))
  const before = structuredClone(draft)
  await assert.rejects(f.service.create(draft, id), error => error instanceof DataAccessError && error.code === 'network_error' && !error.message.includes('raw diagnostic'))
  assert.deepEqual(draft, before)
})
test('撤销使用软删除返回的新 revision；过期恢复返回 conflict，不发 DELETE', async () => {
  const f = fixture((_url, _method, body) => (body as { deleted_at: string | null }).deleted_at === null ? json([]) : json([{ ...row, deleted_at: deletedRevision, updated_at: deletedRevision, deleted_by: id }]))
  const removed = await f.service.remove(mapBook(row, householdId, profileId))
  assert.equal(removed.kind, 'saved')
  if (removed.kind !== 'saved') return
  assert.deepEqual(await f.service.restore(removed.record), { kind: 'conflict' })
  assert.equal(f.requests[1].url.searchParams.get('updated_at'), `eq.${deletedRevision}`)
  assert.equal(f.requests[1].url.searchParams.get('deleted_at'), 'not.is.null')
  assert.deepEqual(f.requests.map(r => r.method), ['PATCH', 'PATCH'])
})
test('同名真实记录按 Profile 独立；译者搜索、NULL筛选及并列排序稳定', () => {
  const a = mapBook(row, householdId, profileId).book, b = { ...a, id: id.replace(/1$/, '2') }, outside = { ...a, profileId: otherProfile }
  assert.deepEqual(selectBooks([b, outside, a], profileId, '测试译者', emptyFilters(), 'recent').map(r => r.id), [a.id, b.id])
  assert.equal(selectBooks([a, b], profileId, '', { statuses: ['读完'], ratings: ['unrated'], years: ['2025'] }, 'rating').length, 2)
})
test('草稿隔离 user/household/profile/book，保留编辑原始 revision，显式退出只清理本用户', () => {
  const store = new ReadingDrafts(), first = store.key('user-a', householdId, profileId, id), second = store.key('user-b', householdId, profileId, id)
  const record = mapBook(row, householdId, profileId)
  store.set(first, { draft, baseline: record, createId: id }); store.set(second, { draft, baseline: null, createId: id })
  assert.equal(store.get(store.key('user-a', householdId, otherProfile, id)), undefined)
  assert.equal(store.get(first)?.baseline?.updatedAt, revision)
  store.clearUser('user-a'); assert.equal(store.get(first), undefined); assert.equal(store.hasUser('user-b'), true)
})
test('真实路由不依赖姓名或 mock；详情/edit保留所属 Profile', () => {
  const profiles = [{ id: profileId, name: '姓名', description: '' }]
  assert.deepEqual(parseBookRoute(`/p/${profileId}/books/${id}/edit`, profiles), { page: 'edit', profileId, bookId: id })
  assert.deepEqual(parseBookRoute('/p/lin/shelf', profiles), { page: 'profiles' })
})
