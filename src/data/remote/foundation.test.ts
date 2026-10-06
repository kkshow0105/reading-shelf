import test from 'node:test'
import assert from 'node:assert/strict'
import { createClient } from '@supabase/supabase-js'
import type { Database } from './database.types.ts'
import { readFileSync } from 'node:fs'
import { blankDraft } from '../../lib/books.ts'
import { readSupabaseConfig } from '../../lib/supabase-config.ts'
import { statusToDatabase, fromDatabaseStatus, draftColumns, assertPosition } from './contracts.ts'
import { coverPath, assertCoverPath } from './cover-path.ts'
import { mapBook, mapProfile } from './mappers.ts'
import { createRepositories } from './repositories.ts'
import { createCoverService } from './cover-service.ts'

const householdId = '10000000-0000-0000-0000-000000000001'
const profileId = '20000000-0000-0000-0000-000000000001'
const bookId = '30000000-0000-0000-0000-000000000001'
const imageId = '40000000-0000-0000-0000-000000000001'
const scope = { householdId, profileId, bookId }
const draft = { ...blankDraft(), title: '书名', author: '作者', status: '读完' as const, finishedOn: '2025-09-28' }
const timestamp = '2026-10-05T10:00:00.123456+00:00'
const row = { id: bookId, household_id: householdId, profile_id: profileId, ...draftColumns(draft),
  cover_original_path: null, cover_original_filename: null, cover_mime_type: null,
  created_at: timestamp, updated_at: timestamp, deleted_at: null, deleted_by: null }

test('五种状态双向映射，未知状态拒绝', () => {
  for (const status of Object.keys(statusToDatabase) as (keyof typeof statusToDatabase)[]) assert.equal(fromDatabaseStatus(statusToDatabase[status]), status)
  assert.throws(() => fromDatabaseStatus('unknown'))
})
test('评分为空或整数 1～5；日期可以只填完成日', () => {
  for (const rating of [null, 1, 5]) assert.equal(draftColumns({ ...draft, rating }).rating, rating)
  for (const rating of [0, 6, 1.5, NaN]) assert.throws(() => draftColumns({ ...draft, rating }))
  assert.equal(draftColumns(draft).started_on, null)
  assert.equal(draftColumns(draft).finished_on, '2025-09-28')
  assert.throws(() => draftColumns({ ...draft, finishedOn: '2025-02-30' }))
  assert.throws(() => draftColumns({ ...draft, author: '  ' }))
})
test('cropPosition 有限 0～1；缺少位置的普通更新不重置', () => {
  assert.deepEqual(assertPosition({ x: 0, y: 1 }), { x: 0, y: 1 })
  for (const x of [-1, 1.01, NaN, Infinity]) assert.throws(() => assertPosition({ x, y: 0.5 }))
  assert.equal('cover_position_x' in draftColumns({ ...draft, cropPosition: undefined }), false)
})
test('路径绑定 household/profile/book；拒绝跨归属、URL、遍历、伪 UUID', () => {
  const path = coverPath(scope, 'image/jpeg', imageId)
  assert.equal(path, `${householdId}/${profileId}/${bookId}/original/${imageId}.jpg`)
  assert.equal(assertCoverPath(path, scope), path)
  for (const invalid of [`../${path}`, `https://example.test/${path}`, `${path}?token=a`, path.replace(profileId, imageId), path.replace('original/', 'original/../')]) assert.throws(() => assertCoverPath(invalid, scope))
  assert.throws(() => coverPath({ ...scope, profileId: 'lin' }, 'image/jpeg', imageId))
  assert.throws(() => coverPath(scope, 'image/svg+xml', imageId))
})
test('映射保留原始 revision 精度，拒绝跨家庭和跨档案返回', () => {
  assert.equal(mapBook(row, householdId, profileId).updatedAt, timestamp)
  assert.equal(mapBook(row, householdId).book.cover, '')
  assert.throws(() => mapBook(row, imageId))
  assert.throws(() => mapBook(row, householdId, imageId))
  assert.throws(() => mapProfile({ id: profileId, household_id: imageId, name: '测试', updated_at: timestamp, archived_at: null }, householdId))
})

// Real SDK + intercepted fetch: verify the actual PostgREST/Storage request contract.
// This is not a database or RLS integration test; no network request is sent.
function fixture(respond: (request: { url: URL; init: RequestInit; body: unknown }) => Response | Promise<Response>) {
  const requests: { url: URL; init: RequestInit; body: unknown }[] = []
  const client = createClient<Database>('https://fixture.supabase.co', 'sb_publishable_test_fixture', {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: async (input, init = {}) => {
      const request = { url: new URL(String(input)), init, body: typeof init.body === 'string' ? JSON.parse(init.body) : init.body }
      requests.push(request)
      return respond(request)
    } },
  })
  return { requests, client, repos: createRepositories(client, householdId) }
}
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
// Installed SDK's maybeSingle fetches arrays for all methods, including PATCH.
const noRow = () => json([])
test('listBooks 请求显式过滤 household/profile/软删除并分页', async () => {
  const f = fixture(() => json([row]))
  assert.equal((await f.repos.books.listBooks(profileId)).books.length, 1)
  const query = f.requests[0].url.searchParams
  assert.equal(query.get('household_id'), `eq.${householdId}`)
  assert.equal(query.get('profile_id'), `eq.${profileId}`)
  assert.equal(query.get('deleted_at'), 'is.null')
  assert.equal(query.get('limit'), '100')
})
test('更新使用原始 updated_at；零行返回 conflict，网络错误不能伪称成功', async () => {
  const f = fixture(noRow)
  assert.deepEqual(await f.repos.books.updateBook(bookId, profileId, timestamp, draft), { kind: 'conflict' })
  assert.equal(f.requests[0].url.searchParams.get('updated_at'), `eq.${timestamp}`)
  assert.equal(f.requests[0].url.searchParams.get('profile_id'), `eq.${profileId}`)
  const bad = fixture(() => json({ code: '42501', message: 'denied' }, 403))
  await assert.rejects(bad.repos.books.updateBook(bookId, profileId, timestamp, draft), { code: '42501' })
})
test('删除和恢复是条件 PATCH；不发 hard DELETE，不碰 Storage', async () => {
  const f = fixture(() => json([row]))
  await f.repos.books.softDeleteBook(bookId, profileId, timestamp)
  await f.repos.books.restoreBook(bookId, profileId, timestamp)
  assert.deepEqual(f.requests.map(r => r.init.method), ['PATCH', 'PATCH'])
  assert.equal(f.requests[0].url.searchParams.get('deleted_at'), 'is.null')
  assert.equal(f.requests[1].url.searchParams.get('deleted_at'), 'not.is.null')
  assert.deepEqual(f.requests[1].body, { deleted_at: null })
})
test('原图上传不覆盖、不转换；替换冲突仍保留旧新原图', async () => {
  const original = new File([new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 0])], '原封面.png', { type: 'image/png' })
  const f = fixture(r => r.url.pathname.includes('/storage/') ? json({ Key: 'book-covers/key', Id: imageId }) : r.init.method === 'PATCH' ? noRow() : json([row]))
  const service = createCoverService(f.client)
  const result = await service.replaceOriginalCover(scope, timestamp, original)
  assert.equal(result.result.kind, 'conflict')
  assert.equal(result.uploadedCover.filename, '原封面.png')
  const upload = f.requests.find(r => r.url.pathname.includes('/storage/'))!
  assert.equal(new Headers(upload.init.headers).get('x-upsert'), 'false')
  assert.ok(upload.init.body instanceof FormData)
  const uploaded = (upload.init.body as FormData).get('') as File
  assert.deepEqual(new Uint8Array(await uploaded.arrayBuffer()), new Uint8Array(await original.arrayBuffer()))
  assert.equal(f.requests.some(r => r.init.method === 'DELETE'), false)
})
test('上传失败不更新书籍；伪图片头在请求前拒绝', async () => {
  const f = fixture(r => r.url.pathname.includes('/storage/') ? json({ message: 'denied' }, 403) : json([row]))
  const service = createCoverService(f.client)
  const bad = new File(['not an image'], 'fake.png', { type: 'image/png' })
  await assert.rejects(service.uploadOriginalCover(scope, bad))
  assert.equal(f.requests.length, 0)
  const original = new File([new Uint8Array([0xff, 0xd8, 0xff, 0])], 'original.jpg', { type: 'image/jpeg' })
  await assert.rejects(service.replaceOriginalCover(scope, timestamp, original))
  assert.equal(f.requests.some(r => r.init.method === 'PATCH'), false)
})
test('环境缺失、占位符和高权限 key 拒绝；错误不回显密钥', () => {
  assert.throws(() => readSupabaseConfig({}))
  assert.throws(() => readSupabaseConfig({ VITE_SUPABASE_URL: 'https://YOUR_PROJECT_REF.supabase.co', VITE_SUPABASE_PUBLISHABLE_KEY: 'YOUR_PUBLISHABLE_KEY' }))
  for (const key of ['sb_secret_fixture', `a.${btoa(JSON.stringify({ role: 'service_role' }))}.b`]) {
    assert.throws(() => readSupabaseConfig({ VITE_SUPABASE_URL: 'https://fixture.supabase.co', VITE_SUPABASE_PUBLISHABLE_KEY: key }), e => e instanceof Error && !e.message.includes(key))
  }
  assert.equal(readSupabaseConfig({ VITE_SUPABASE_URL: 'https://fixture.supabase.co', VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test' }).url, 'https://fixture.supabase.co')
})
test('migration 安全静态检查（不是实际 RLS 执行）', () => {
  const schema = readFileSync(new URL('../../../supabase/migrations/20261005000100_reading_shelf_foundation.sql', import.meta.url), 'utf8')
  const storage = readFileSync(new URL('../../../supabase/migrations/20261005000200_cover_storage_policies.sql', import.meta.url), 'utf8')
  for (const table of ['households', 'household_members', 'profiles', 'books']) assert.ok(schema.includes(`alter table public.${table} enable row level security`))
  assert.match(schema, /foreign key \(household_id, profile_id\) references public\.profiles\(household_id, id\)/)
  assert.doesNotMatch(schema, /grant\s+(?:all|delete).*on public\.books/i)
  assert.doesNotMatch(schema, /create policy .*on public\.household_members for (?:insert|update|delete)/)
  assert.doesNotMatch(storage, /(?:insert into|update|delete from) storage\.(?:objects|buckets)/i)
  assert.equal((storage.match(/to authenticated/g) || []).length, 2)
  assert.equal((storage.match(/m\.user_id = \(select auth\.uid\(\)\)/g) || []).length, 2)
})
