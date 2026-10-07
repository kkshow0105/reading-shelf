import test from 'node:test'
import assert from 'node:assert/strict'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '../data/remote/database.types.ts'
import { createRepositories } from '../data/remote/repositories.ts'
import { loadHouseholdSuggestions } from '../data/books/suggestions.ts'
import { buildSuggestionIndex, matchSuggestions, suggestionCursor } from './suggestions.ts'

test('一字符触发、trim去重、排除空及软删除，三个字段独立', () => {
  const index = buildSuggestionIndex([{ title: ' 森林 ', author: ' 村上春树 ', translator: ' 林少华 ' }, { title: '森林', author: '村上春树', translator: '' }, { title: '删除记录', author: '删除作者', translator: '删除译者', deletedAt: '2026-01-01' }, { title: '', author: ' ', translator: null }])
  assert.deepEqual(index, { title: ['森林'], author: ['村上春树'], translator: ['林少华'] })
  assert.deepEqual(matchSuggestions(index.author, '村'), ['村上春树'])
  assert.deepEqual(matchSuggestions(index.author, '春'), ['村上春树'])
  assert.deepEqual(matchSuggestions(index.title, '村'), [])
  assert.deepEqual(matchSuggestions(index.author, ''), []); assert.deepEqual(matchSuggestions(index.author, ' '), [])
})
test('英文大小写不敏感，完全相同/前缀/包含依次优先', () => {
  const values = ['The BOOK', 'bookends', 'Book', 'Books', 'Notebook']
  const result = matchSuggestions(values, ' bOoK ')
  assert.equal(result[0], 'Book'); assert.deepEqual(new Set(result.slice(1, 3)), new Set(['bookends', 'Books']))
  assert.ok(result.indexOf('Notebook') > result.indexOf('Books')); assert.equal(result.length, 5)
})
test('候选稳定排序、最多八项、不修改输入数组', () => {
  const values = Array.from({ length: 12 }, (_, i) => `候选${12 - i}`), before = [...values]
  const result = matchSuggestions(values, '候')
  assert.equal(result.length, 8); assert.deepEqual(result, matchSuggestions([...values].reverse(), '候'))
  assert.deepEqual(values, before)
})
test('键盘光标从空选择进入首/末项，循环上下移动，没有候选时不选择', () => {
  assert.equal(suggestionCursor(-1, 'ArrowDown', 3), 0); assert.equal(suggestionCursor(-1, 'ArrowUp', 3), 2)
  assert.equal(suggestionCursor(2, 'ArrowDown', 3), 0); assert.equal(suggestionCursor(0, 'ArrowUp', 3), 2)
  assert.equal(suggestionCursor(-1, 'ArrowDown', 0), -1)
})
test('repository只读投影轻量字段，按Household而非Profile，服务器排除软删除', async () => {
  const calls: { url: URL; method: string }[] = []
  const client = createClient<Database>('https://fixture.supabase.co', 'sb_publishable_test_fixture', { auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: async (url, options) => {
    calls.push({ url: new URL(String(url)), method: options?.method || 'GET' })
    return new Response(JSON.stringify([{ title: '家庭书籍一', author: '同一作者', translator: null }, { title: '家庭书籍二', author: '同一作者', translator: '另一译者' }]), { headers: { 'Content-Type': 'application/json' } })
  } } })
  const repo = createRepositories(client, '10000000-0000-0000-0000-000000000001').books
  const index = await loadHouseholdSuggestions(repo)
  assert.equal(calls.length, 1); assert.equal(calls[0].method, 'GET')
  const params = calls[0].url.searchParams
  assert.equal(params.get('select'), 'title,author,translator'); assert.equal(params.get('household_id'), 'eq.10000000-0000-0000-0000-000000000001'); assert.equal(params.get('deleted_at'), 'is.null'); assert.equal(params.has('profile_id'), false)
  assert.equal(index.title.length, 2); assert.deepEqual(index.author, ['同一作者']); assert.deepEqual(index.translator, ['另一译者'])
  matchSuggestions(index.title, '家'); matchSuggestions(index.title, '家庭'); assert.equal(calls.length, 1)
  await assert.rejects(repo.listSuggestionFields(-1)); assert.equal(calls.length, 1)
})
test('一次表单加载补齐分页；退出/切换后忽略旧结果，不继续读旧Household', async () => {
  const calls: number[] = []; const repo = { async listSuggestionFields(offset: number) { calls.push(offset); return { fields: offset === 0 ? Array(200).fill({ title: '第一批', author: '作者一', translator: '' }) : [{ title: '第二批', author: '作者二', translator: '' }], nextOffset: offset === 0 ? 200 : null } } }
  assert.deepEqual(new Set((await loadHouseholdSuggestions(repo)).title), new Set(['第一批', '第二批'])); assert.deepEqual(calls, [0, 200])
  let current = true, count = 0
  const index = await loadHouseholdSuggestions({ async listSuggestionFields() { count++; current = false; return { fields: [{ title: '旧家庭', author: '作者', translator: '' }], nextOffset: 200 } } }, () => current)
  assert.equal(count, 1); assert.deepEqual(index, { title: [], author: [], translator: [] })
})
