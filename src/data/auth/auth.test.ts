import test from 'node:test'
import assert from 'node:assert/strict'
import type { Session, SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../remote/database.types.ts'
import { createAuthService } from './service.ts'
import type { StoredProfile } from '../remote/contracts.ts'
import { AccessError, sessionState, accessMessage, isInvalidSession, availableProfiles,
  validActiveProfile, bootstrapInput, recoverBootstrap } from './policies.ts'

const householdId = '10000000-0000-0000-0000-000000000001'
function profile(id: string, sortOrder = 0, createdAt = '2026-10-06T00:00:00Z', archivedAt: string | null = null): StoredProfile {
  return { householdId, profile: { id, name: '测试档案', description: '' }, sortOrder, createdAt, archivedAt, updatedAt: createdAt }
}
test('Session 映射区分 authenticated / unauthenticated，保留 SDK user', () => {
  assert.deepEqual(sessionState(null), { status: 'unauthenticated', user: null })
  const session = { user: { id: 'test-user' } } as Session
  assert.equal(sessionState(session).status, 'authenticated')
  assert.equal(sessionState(session).user, session.user)
})
test('中文错误映射不显示原始错误或敏感请求', () => {
  assert.equal(accessMessage({ code: 'invalid_credentials', message: 'unsafe raw message' }), '邮箱或密码不正确。')
  assert.equal(accessMessage(new TypeError('fetch failed')), '暂时无法连接书房，请稍后重试。')
  assert.equal(accessMessage({ code: 'refresh_token_not_found' }), '登录已失效，请重新登录。')
  assert.equal(isInvalidSession(new TypeError('network')), false)
  assert.equal(isInvalidSession({ code: 'refresh_token_not_found' }), true)
})
test('档案只保留当前家庭未归档项，按 sort_order / created_at / id 稳定排序', () => {
  const a = profile('a', 1), b = profile('b', 0), c = profile('c', 1, '2026-10-05T00:00:00Z')
  const archived = profile('archived', -1, undefined, '2026-10-06T00:00:00Z')
  const other = { ...profile('other'), householdId: 'other-household' }
  const input = [a, other, archived, c, b]
  assert.deepEqual(availableProfiles(input, householdId).map(p => p.profile.id), ['b', 'c', 'a'])
  assert.equal(input[0], a)
  assert.deepEqual(availableProfiles([profile('z'), profile('a')], householdId).map(p => p.profile.id), ['a', 'z'])
})
test('activeProfileId 每次重新核验，拒绝删除、归档、其他家庭及旧 mock ID', () => {
  const valid = profile('real-id'), archived = profile('archived', 0, undefined, '2026-10-06T00:00:00Z')
  const other = { ...profile('other'), householdId: 'other-household' }
  const profiles = [valid, archived, other]
  assert.equal(validActiveProfile('real-id', profiles, householdId), 'real-id')
  for (const id of [null, 'missing', 'lin', 'archived', 'other']) assert.equal(validActiveProfile(id, profiles, householdId), null)
})
test('初始化输入 trim，UI 恰好两个姓名，限制字符数', () => {
  assert.deepEqual(bootstrapInput(' 私人书房 ', [' 一 ', ' 二 ']), { name: '私人书房', names: ['一', '二'] })
  for (const name of ['', ' ', '书'.repeat(81)]) assert.throws(() => bootstrapInput(name, ['一', '二']))
  for (const names of [[], ['一'], ['一', '二', '三'], [' ', '二'], ['书'.repeat(21), '二']]) assert.throws(() => bootstrapInput('书房', names))
  assert.equal(bootstrapInput('书'.repeat(80), ['名'.repeat(20), '二']).names[0].length, 20)
})
test('RPC 成功以及 already_initialized 都重新读取服务器归属，不使用本地输入代替', async () => {
  const existing = { id: 'server-household' }
  for (const repeated of [false, true]) {
    let calls = 0
    assert.equal(await recoverBootstrap(async () => { if (repeated) throw new AccessError('already_initialized') }, async () => { calls++; return existing }), existing)
    assert.equal(calls, 1)
  }
})
test('初始化网络失败保留错误，恢复查询无 membership 时不能宣称成功', async () => {
  let queried = false
  await assert.rejects(recoverBootstrap(async () => { throw new AccessError('network_error') }, async () => { queried = true; return null }))
  assert.equal(queried, false)
  await assert.rejects(recoverBootstrap(async () => {}, async () => null), error => error instanceof AccessError && error.code === 'household_unavailable')
})
test('会话恢复遇到网络错误保留 SDK session；确定失效时才调用官方 signOut', async () => {
  const session = { user: { id: 'test-user' } } as Session
  for (const invalid of [false, true]) {
    let signOutCount = 0
    const client = { auth: {
      getSession: async () => ({ data: { session }, error: null }),
      getUser: async () => ({ data: { user: null }, error: invalid ? { code: 'bad_jwt', status: 401 } : { code: 'network_error', status: 0 } }),
      signOut: async () => { signOutCount++; return { error: null } },
    } } as unknown as SupabaseClient<Database>
    const auth = createAuthService(client)
    if (invalid) assert.equal(await auth.restore(), null)
    else await assert.rejects(auth.restore(), error => error instanceof AccessError && error.code === 'network_error')
    assert.equal(signOutCount, invalid ? 1 : 0)
  }
})
test('无 session 不请求用户；有效 session 经服务器校验后恢复', async () => {
  for (const exists of [false, true]) {
    const session = { user: { id: 'test-user' } } as Session
    let requests = 0
    const client = { auth: {
      getSession: async () => ({ data: { session: exists ? session : null }, error: null }),
      getUser: async () => { requests++; return { data: { user: session.user }, error: null } },
    } } as unknown as SupabaseClient<Database>
    assert.equal(await createAuthService(client).restore(), exists ? session : null)
    assert.equal(requests, exists ? 1 : 0)
  }
})
