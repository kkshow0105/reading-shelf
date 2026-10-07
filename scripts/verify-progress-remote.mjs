// 5C-1: ordinary authenticated clients, fresh disposable UUIDs only.
import { createClient } from '@supabase/supabase-js'
import { randomUUID, randomBytes } from 'node:crypto'
import { existsSync, mkdirSync, writeFileSync, unlinkSync } from 'node:fs'
import { query, check, projectKeys, PROJECT_URL } from './supabase-remote-utils.mjs'
import { createRepositories } from '../src/data/remote/repositories.ts'
import { blankDraft, toDraft } from '../src/lib/books.ts'

const ledger = 'qa/progress-remote-ledger.json'
check(!existsSync(ledger), 'no unfinished progress fixture')
const formalIds = new Set(query('select id from public.households;').map(r => r.id))
const { publishableKey, adminKey } = projectKeys()
const options = { auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: (url, init) => fetch(url, { ...init, signal: AbortSignal.timeout(20000) }) } }
const admin = createClient(PROJECT_URL, adminKey, options), users = [], households = new Set()
const persist = () => { mkdirSync('qa', { recursive: true }); writeFileSync(ledger, JSON.stringify({ users: users.map(u => u.id), households: [...households] })) }
async function fixture() {
  const email = `reading-shelf-progress-${randomUUID()}@example.invalid`, password = randomBytes(32).toString('base64url')
  const created = await admin.auth.admin.createUser({ email, password, email_confirm: true })
  check(!created.error && created.data.user?.id, 'temporary Auth created')
  const client = createClient(PROJECT_URL, publishableKey, options), user = { id: created.data.user.id, client }
  users.push(user); persist()
  check(!(await client.auth.signInWithPassword({ email, password })).error, 'temporary login')
  const boot = await client.rpc('bootstrap_household', { p_household_name: '临时进度验证', p_profile_names: ['测试甲', '测试乙'] })
  check(!boot.error && boot.data && !formalIds.has(boot.data), 'new isolated household')
  households.add(boot.data); persist()
  const repo = createRepositories(client, boot.data), profiles = await repo.profiles.listProfiles()
  return { ...user, householdId: boot.data, repo, profileId: profiles[0].profile.id }
}
try {
  const owner = await fixture(), outside = await fixture()
  const draft = { ...blankDraft(), title: '临时进度记录', author: '测试作者', status: '在读' }
  let record = await owner.repo.books.createBook(owner.profileId, draft)
  check(record.book.progressPercent === null, 'create NULL')
  const second = await owner.repo.books.createBook(owner.profileId, { ...draft, progressPercent: 35 })
  check(second.book.progressPercent === 35, 'create 35')
  record = second
  for (const progressPercent of [67, 0, null, 1, 50, 100]) {
    const changed = await owner.repo.books.updateBook(record.book.id, owner.profileId, record.updatedAt, { ...toDraft(record.book), progressPercent })
    check(changed.kind === 'saved' && changed.record.book.progressPercent === progressPercent && changed.record.book.status === '在读', 'CAS progress update, status independent')
    record = changed.record
  }
  for (const status of ['暂停', '读完', '在读']) {
    const changed = await owner.repo.books.updateBook(record.book.id, owner.profileId, record.updatedAt, { ...toDraft(record.book), status })
    check(changed.kind === 'saved' && changed.record.book.progressPercent === 100 && changed.record.book.status === status, 'status switch preserves progress')
    record = changed.record
  }
  for (const progress_percent of [-1, 101]) {
    const badCreate = await owner.client.from('books').insert({ household_id: owner.householdId, profile_id: owner.profileId, title: '应拒绝', author: '临时', progress_percent })
    const badUpdate = await owner.client.from('books').update({ progress_percent }).eq('id', record.book.id)
    check(badCreate.error?.code === '23514' && badUpdate.error?.code === '23514', 'real database rejects out-of-range create/update')
  }
  const forbidden = await outside.client.from('books').update({ progress_percent: 35 }).eq('id', record.book.id).select('id')
  check(!forbidden.error && forbidden.data.length === 0 && (await owner.repo.books.getBook(record.book.id)).book.progressPercent === 100, 'outside household cannot update')
  const hardDelete = await owner.client.from('books').delete().eq('id', record.book.id)
  check(hardDelete.error?.code === '42501', 'hard DELETE still forbidden')
  console.log('PASS real NULL/create35/update67/0/NULL/1/50/100, status preservation, CHECK, RLS, DELETE unchanged')
} catch (error) {
  console.error(error?.message?.startsWith('Verification failed:') ? error.message : 'FAIL progress verification; raw errors suppressed')
  process.exitCode = 1
} finally {
  try {
    const ids = users.map(u => u.id)
    check(ids.every(id => /^[0-9a-f-]{36}$/.test(id)), 'exact test users')
    if (ids.length) query(`select household_id from public.household_members where user_id in (${ids.map(id => `'${id}'`).join(',')});`).forEach(r => households.add(r.household_id))
    check([...households].every(id => /^[0-9a-f-]{36}$/.test(id) && !formalIds.has(id)), 'exclude every formal household'); persist()
    if (households.size) {
      const hs = [...households].map(id => `'${id}'`).join(',')
      check(query(`select count(*) n from storage.objects where split_part(name,'/',1) in (${hs});`)[0].n === 0, 'no Storage writes')
      query(`begin; delete from public.books where household_id in (${hs}); delete from public.profiles where household_id in (${hs}); delete from public.household_members where household_id in (${hs}); delete from public.households where id in (${hs}); commit;`)
      check(query(`select (select count(*) from public.books where household_id in (${hs}))+(select count(*) from public.profiles where household_id in (${hs}))+(select count(*) from public.household_members where household_id in (${hs}))+(select count(*) from public.households where id in (${hs})) n;`)[0].n === 0, 'zero temporary data')
    }
    for (const user of users) check(!(await admin.auth.admin.deleteUser(user.id)).error, 'exact temporary Auth cleanup')
    if (ids.length) check(query(`select count(*) n from auth.users where id in (${ids.map(id => `'${id}'`).join(',')});`)[0].n === 0, 'zero temporary Auth')
    if (existsSync(ledger)) unlinkSync(ledger)
    console.log('PASS temporary Auth/Household/Profile/Books zero; no Storage objects created')
  } catch { console.error('STOP cleanup incomplete; preserve ignored ledger'); process.exitCode = 2 }
}
