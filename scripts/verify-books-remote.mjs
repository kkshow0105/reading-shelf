// 4B-2 real Books tests. Fresh disposable households only; never clean formal data.
import { createClient } from '@supabase/supabase-js'
import { randomUUID, randomBytes } from 'node:crypto'
import { createServer } from 'vite'
import { existsSync, mkdirSync, writeFileSync, unlinkSync } from 'node:fs'
import { check, query, projectKeys, PROJECT_URL } from './supabase-remote-utils.mjs'
const ledger = 'qa/books-remote-ledger.json'
check(!existsSync(ledger), 'no unfinished Books fixture ledger')
const { publishableKey, adminKey } = projectKeys()
const options = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }, global: { fetch: (url, init) => fetch(url, { ...init, signal: AbortSignal.timeout(15000) }) } }
const admin = createClient(PROJECT_URL, adminKey, options), anon = createClient(PROJECT_URL, publishableKey, options)
const formalIds = new Set(query('select id from public.households;').map(row => row.id))
const users = [], households = new Set()
const persist = () => { mkdirSync('qa', { recursive: true }); writeFileSync(ledger, JSON.stringify({ users: users.map(u => u.id), households: [...households] })) }
const pass = label => console.log(`PASS ${label}`)
let vite
try {
  vite = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'silent' })
  const { createRepositories } = await vite.ssrLoadModule('/src/data/remote/repositories.ts')
  const { createBooksService } = await vite.ssrLoadModule('/src/data/books/model.ts')
  const { blankDraft } = await vite.ssrLoadModule('/src/lib/books.ts')
  async function fixture() {
    const email = `reading-shelf-books-${randomUUID()}@example.invalid`, password = randomBytes(32).toString('base64url')
    const created = await admin.auth.admin.createUser({ email, password, email_confirm: true })
    check(!created.error && created.data.user?.id, 'temporary Auth user')
    const client = createClient(PROJECT_URL, publishableKey, options)
    const secondClient = createClient(PROJECT_URL, publishableKey, options)
    const user = { id: created.data.user.id, client, secondClient }
    users.push(user); persist()
    for (const c of [client, secondClient]) check(!(await c.auth.signInWithPassword({ email, password })).error, 'temporary login')
    const bootstrap = await client.rpc('bootstrap_household', { p_household_name: '临时书籍验证', p_profile_names: ['测试甲', '测试乙'] })
    check(!bootstrap.error && bootstrap.data && !formalIds.has(bootstrap.data), 'disposable household only')
    households.add(bootstrap.data); persist()
    const repositories = createRepositories(client, bootstrap.data)
    const profiles = await repositories.profiles.listProfiles()
    check(profiles.length === 2, 'temporary Profiles')
    return { ...user, householdId: bootstrap.data, repositories, profiles }
  }
  const owner = await fixture(), outside = await fixture()
  const aId = owner.profiles[0].profile.id, bId = owner.profiles[1].profile.id
  const a = createBooksService(owner.repositories.books, owner.householdId, aId), b = createBooksService(owner.repositories.books, owner.householdId, bId)
  check((await a.list()).length === 0 && (await b.list()).length === 0, 'real empty shelves')
  pass('two empty real shelves; no mock seed')
  const draft = { ...blankDraft(), title: '临时验证记录', author: '临时作者', translator: '临时译者', status: '读完', finishedOn: '2025-09-28', rating: 4, note: '仅用于临时安全测试。' }
  const id = randomUUID(), created = await a.create(draft, id)
  check(created.kind === 'saved' && created.record.book.id === id, 'server returned created UUID')
  check(created.record.book.startedOn === '' && created.record.book.finishedOn === '2025-09-28' && created.record.originalCover === null, 'date/null/cover mapping')
  check((await a.list()).length === 1 && (await b.list()).length === 0, 'Profile isolated list')
  check(await b.get(id) === null && (await a.get(id)).book.title === draft.title, 'Profile isolated detail')
  pass('real create/get/list map fields and enforce Profile scope')
  const repeated = await a.create(draft, id)
  check(repeated.kind === 'saved' && repeated.record.book.id === id && (await a.list()).length === 1, 'lost create response recovery without duplicate')
  check((await a.create({ ...draft, note: '不允许覆盖' }, id)).kind === 'conflict', 'changed input cannot overwrite existing create')
  pass('stable create UUID recovers lost response; no overwrite or duplicate')
  const same = await b.create({ ...draft, rating: null, finishedOn: '', note: '' }, randomUUID())
  check(same.kind === 'saved' && same.record.book.id !== id && (await b.list()).length === 1, 'same-title records independent')
  pass('same title in two Profiles stays independent; NULL rating/date supported')
  const old = created.record
  const updated = await a.update(old, { ...draft, rating: null, note: '新的临时笔记。' })
  check(updated.kind === 'saved' && updated.record.updatedAt !== old.updatedAt && updated.record.book.rating === null, 'update returned new server revision')
  const otherA = createBooksService(createRepositories(owner.secondClient, owner.householdId).books, owner.householdId, aId)
  const stale = await otherA.update(old, { ...draft, note: '过期客户端内容' })
  check(stale.kind === 'conflict' && (await a.get(id)).book.note === '新的临时笔记。', 'stale update does not overwrite')
  pass('real update; second client stale revision conflicts without overwrite')
  const positioned = await owner.repositories.books.updateBook(id, aId, updated.record.updatedAt, { ...draft, cropPosition: { x: .25, y: .75 } })
  check(positioned.kind === 'saved', 'position update')
  const retained = await a.update(positioned.record, { ...draft, cropPosition: positioned.record.book.cropPosition, note: '只改笔记' })
  check(retained.kind === 'saved' && retained.record.book.cropPosition.x === .25 && retained.record.book.cropPosition.y === .75, 'ordinary edit preserves position')
  pass('non-destructive cropPosition survives ordinary book edit; no Storage calls')
  const removed = await a.remove(retained.record)
  check(removed.kind === 'saved' && removed.record.deletedAt && removed.record.deletedBy === owner.id, 'server deletion date/actor')
  check((await a.list()).length === 0 && await a.get(id) === null, 'normal queries server-exclude soft deleted')
  check((await a.restore(retained.record)).kind === 'conflict', 'old pre-delete restore revision refused')
  const restored = await a.restore(removed.record)
  check(restored.kind === 'saved' && restored.record.deletedAt === null && restored.record.deletedBy === null && (await a.list()).length === 1, 'latest delete revision restores')
  pass('soft delete uses real actor; latest revision undo restores without hard DELETE')
  const removedAgain = await a.remove(restored.record)
  const parallelRestore = await otherA.restore(removedAgain.record)
  check(parallelRestore.kind === 'saved' && (await a.restore(removedAgain.record)).kind === 'conflict', 'stale undo refuses to overwrite another device')
  pass('undo conflicts after another device changes record')
  const forbiddenRead = await outside.client.from('books').select('id').eq('household_id', owner.householdId)
  check(!forbiddenRead.error && forbiddenRead.data.length === 0, 'outside household read denied')
  const forbiddenWrite = await outside.client.from('books').insert({ household_id: owner.householdId, profile_id: aId, title: '不允许', author: '临时' })
  check(forbiddenWrite.error?.code === '42501', 'outside household insert denied')
  const wrongProfile = await owner.client.from('books').insert({ household_id: owner.householdId, profile_id: outside.profiles[0].profile.id, title: '不允许', author: '临时' })
  check(Boolean(wrongProfile.error), 'cross-household Profile FK rejected')
  const hardDelete = await owner.client.from('books').delete().eq('id', id)
  const anonymous = await anon.from('books').select('id')
  check(hardDelete.error?.code === '42501' && anonymous.error?.code === '42501', 'hard DELETE and anon refused')
  pass('RLS/FK isolate households; hard DELETE and anon reads refused')
  check((await b.get(same.record.book.id)).book.rating === null, 'Profile B unaffected by Profile A mutations')
  pass('all mutations leave the other Profile independent')
} catch (error) {
  console.error('FAIL Books verification; raw SDK errors suppressed')
  if (error?.message?.startsWith('Verification failed: ')) console.error(error.message)
  process.exitCode = 1
} finally {
  await vite?.close()
  try {
    const ownUsers = users.map(u => u.id)
    check(ownUsers.every(id => /^[0-9a-f-]{36}$/.test(id)), 'fixture IDs only')
    if (ownUsers.length) query(`select household_id from public.household_members where user_id in (${ownUsers.map(id => `'${id}'`).join(',')});`).forEach(row => households.add(row.household_id))
    check([...households].every(id => /^[0-9a-f-]{36}$/.test(id) && !formalIds.has(id)), 'never clean formal households')
    persist()
    if (households.size) {
      const hs = [...households].map(id => `'${id}'`).join(',')
      check(query(`select count(*) n from storage.objects where split_part(name,'/',1) in (${hs});`)[0].n === 0, 'no temporary Storage files')
      query(`begin; delete from public.books where household_id in (${hs}); delete from public.profiles where household_id in (${hs}); delete from public.household_members where household_id in (${hs}); delete from public.households where id in (${hs}); commit;`)
      check(query(`select (select count(*) from public.books where household_id in (${hs})) + (select count(*) from public.profiles where household_id in (${hs})) + (select count(*) from public.households where id in (${hs})) n;`)[0].n === 0, 'all own data cleared')
    }
    for (const user of users) { await user.client.auth.signOut({ scope: 'local' }); await user.secondClient.auth.signOut({ scope: 'local' }); check(!(await admin.auth.admin.deleteUser(user.id)).error, 'temporary Auth removed') }
    if (ownUsers.length) check(query(`select count(*) n from auth.users where id in (${ownUsers.map(id => `'${id}'`).join(',')});`)[0].n === 0, 'zero temporary Auth remainder')
    if (existsSync(ledger)) unlinkSync(ledger)
    pass('all own disposable Books/Profile/Household/Auth fixtures removed; formal data preserved')
  } catch { console.error('STOP Books fixture cleanup incomplete; preserve ignored ledger'); process.exitCode = 2 }
}
