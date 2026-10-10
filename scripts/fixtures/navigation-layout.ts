// Isolated browser fixture: official SDK + local, read-only household records.
// This module is substituted only by verify-navigation-layout.mjs, never by the app build.
import { createClient } from '@supabase/supabase-js'

const householdId = '10000000-0000-0000-0000-000000000001'
const userId = '50000000-0000-0000-0000-000000000001'
const stamp = '2026-10-07T00:00:00.123456+00:00'
export const counts = { reads: 0, signs: 0 }
const profiles = [1, 2].map((n, i) => ({
  id: `20000000-0000-0000-0000-${String(n).padStart(12, '0')}`,
  household_id: householdId, name: i ? '测试乙' : '测试甲', sort_order: i,
  archived_at: null, created_at: stamp, updated_at: stamp,
}))
const rows = Array.from({ length: 128 }, (_, i) => {
  const id = `30000000-0000-0000-0000-${String(i + 1).padStart(12, '0')}`
  const profileId = profiles[i < 120 ? 0 : 1].id
  return {
    id, household_id: householdId, profile_id: profileId,
    title: `隔离长书名与文字放大回归检查第${i + 1}本`, author: '测试作者', translator: '',
    status: 'finished', rating: 4, progress_percent: null, notes: '仅本地隔离记录',
    started_on: '2025-12-01', finished_on: '2025-12-31',
    cover_original_path: `${householdId}/${profileId}/${id}/original/40000000-0000-0000-0000-000000000001.jpg`,
    cover_original_filename: 'fixture.jpg', cover_mime_type: 'image/jpeg',
    cover_position_x: .5, cover_position_y: .5, created_at: stamp, updated_at: stamp,
    deleted_at: null, deleted_by: null,
  }
})
const user = { id: userId, aud: 'authenticated', role: 'authenticated', email: 'qa@example.invalid',
  app_metadata: {}, user_metadata: {}, created_at: stamp }
const json = (data: unknown) => new Response(JSON.stringify(data), { headers: { 'Content-Type': 'application/json' } })
const base = 'http://127.0.0.1:5184/local-regression'
const client = createClient(base, 'sb_publishable_local_fixture', {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
  global: { fetch: async (input, init) => {
    const url = new URL(String(input)), method = init?.method || 'GET'
    if (!url.href.startsWith(base + '/')) throw new Error('Non-fixture request blocked')
    if (url.pathname.includes('/auth/v1/token')) {
      const part = (value: unknown) => btoa(JSON.stringify(value)).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '')
      return json({ access_token: `${part({ alg: 'HS256', typ: 'JWT' })}.${part({ sub: userId, exp: Math.floor(Date.now() / 1000) + 3600 })}.local-only`,
        refresh_token: 'local-only', expires_in: 3600, token_type: 'bearer', user })
    }
    if (url.pathname.endsWith('/auth/v1/user')) return json(user)
    if (url.pathname.includes('/object/sign/')) { counts.signs++; return json({ signedURL: '/object/sign/book-covers/fixture.jpg' }) }
    if (method !== 'GET') throw new Error('This regression fixture prohibits mutations')
    counts.reads++
    const table = url.pathname.split('/').pop()
    const source = table === 'household_members' ? [{ household_id: householdId }] : table === 'households' ? [{ id: householdId, name: '隔离书房' }] : table === 'profiles' ? profiles : table === 'books' ? rows : []
    const data = source.filter(row => ['id', 'profile_id', 'household_id'].every(key => !url.searchParams.has(key) || url.searchParams.get(key) === `eq.${(row as Record<string, unknown>)[key]}`))
    return json(new Headers(init?.headers).get('Accept')?.includes('object+json') ? data[0] || null : data)
  } },
})
export function getSupabaseClient() { return client }
