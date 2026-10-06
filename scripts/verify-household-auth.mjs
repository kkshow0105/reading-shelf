// Disposable 4B-1 fixtures only. No passwords/keys/tokens are printed or saved.
import { createClient } from '@supabase/supabase-js'
import { randomUUID, randomBytes } from 'node:crypto'
import { createServer } from 'vite'
import { mkdirSync, writeFileSync, unlinkSync, existsSync } from 'node:fs'
import { check, query, projectKeys, PROJECT_URL } from './supabase-remote-utils.mjs'

const { publishableKey, adminKey } = projectKeys()
const options = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  global: { fetch: (url, init) => fetch(url, { ...init, signal: AbortSignal.timeout(15000) }) } }
const admin = createClient(PROJECT_URL, adminKey, options)
const anon = createClient(PROJECT_URL, publishableKey, options)
const users = [], households = new Set()
const ledger = 'qa/household-auth-ledger.json'
const saveLedger = () => { mkdirSync('qa', { recursive: true }); writeFileSync(ledger, JSON.stringify({ users: users.map(u => u.id), households: [...households] })) }
const report = label => console.log(`PASS ${label}`)
const validUuid = id => /^[0-9a-f-]{36}$/.test(id)
let vite
// Stop BEFORE entering cleanup when an older run owns the recovery ledger.
check(!existsSync(ledger), 'no unfinished fixture ledger')
try {
  const settings = await fetch(`${PROJECT_URL}/auth/v1/settings`, { headers: { apikey: publishableKey }, signal: AbortSignal.timeout(15000) }).then(r => r.json())
  check(settings.disable_signup === true && settings.external.email === true, 'private email login configuration')
  report('public signup disabled; email login enabled')
  vite = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'silent' })
  const { createAuthService, createHouseholdService } = await vite.ssrLoadModule('/src/data/auth/service.ts')
  async function makeUser() {
    const email = `reading-shelf-4b1-${randomUUID()}@example.invalid`, password = randomBytes(30).toString('base64url')
    const result = await admin.auth.admin.createUser({ email, password, email_confirm: true })
    check(!result.error && result.data.user?.id, 'temporary Auth create')
    const id = result.data.user.id
    const client = createClient(PROJECT_URL, publishableKey, options)
    const auth = createAuthService(client)
    const fixture = { id, client, auth, service: createHouseholdService(client) }
    users.push(fixture); saveLedger()
    await auth.signInWithPassword(email, password)
    check((await auth.getCurrentUser())?.id === id && (await auth.restore())?.user.id === id, 'temporary login/user/restore')
    return fixture
  }
  const refused = await anon.rpc('bootstrap_household', { p_household_name: '测试', p_profile_names: ['甲', '乙'] })
  check(refused.error?.code === '42501', 'anon bootstrap permission denied')
  const anonMembers = await anon.from('household_members').select('household_id')
  check(anonMembers.error?.code === '42501', 'anon membership denied')
  report('anon RPC and private tables denied')
  const first = await makeUser()
  check(await first.service.load(first.id) === null, 'new user has no household')
  report('real login, SDK session restore, current user, initial membership lookup')
  // Invalid requests must leave no membership or ownerless household.
  const baseline = query('select count(*) n from public.households;')[0].n
  const invalidInputs = [
    [null, ['甲', '乙']], ['', ['甲', '乙']], ['  ', ['甲', '乙']], ['名'.repeat(81), ['甲']],
    ['测试', null], ['测试', []], ['测试', Array(11).fill('甲')], ['测试', [null, '乙']],
    ['测试', ['', '乙']], ['测试', [' ', '乙']], ['测试', ['名'.repeat(21), '乙']], ['测试', [['甲'], ['乙']]],
  ]
  for (const [name, names] of invalidInputs) {
    const result = await first.client.rpc('bootstrap_household', { p_household_name: name, p_profile_names: names })
    check(Boolean(result.error), 'invalid bootstrap rejected')
    check(await first.service.load(first.id) === null, 'no partial membership')
  }
  check(query('select count(*) n from public.households;')[0].n === baseline, 'no orphan household after failed requests')
  report('12 invalid parameter cases rejected; no partial household/profile/member')
  const result = await first.service.bootstrap(first.id, '  临时书房  ', ['  测试甲  ', '测试乙'])
  households.add(result.id); saveLedger()
  check(result.name === '临时书房' && result.profiles.length === 2, 'household and two profiles')
  check(result.profiles.map(p => p.profile.name).join('|') === '测试甲|测试乙', 'trimmed ordered profile names')
  const membership = await first.client.from('household_members').select('user_id,household_id,role')
  check(membership.data?.length === 1 && membership.data[0].user_id === first.id && membership.data[0].role === 'owner', 'caller-only owner')
  report('one household, caller owner, two trimmed and ordered real profiles')
  const duplicate = await first.client.rpc('bootstrap_household', { p_household_name: '重复', p_profile_names: ['甲'] })
  check(duplicate.error?.message === 'already_initialized', 'duplicate bootstrap denied')
  const recovered = await first.service.bootstrap(first.id, '不应该新建', ['甲', '乙'])
  check(recovered.id === result.id && recovered.profiles.length === 2, 'lost-response recovery uses existing server data')
  report('second RPC refused; already_initialized recovery uses existing membership')
  const second = await makeUser()
  for (const extra of [{ p_user_id: first.id }, { p_household_id: result.id }, { p_role: 'owner' }]) {
    const attempt = await second.client.rpc('bootstrap_household', { p_household_name: '测试', p_profile_names: ['甲'], ...extra })
    check(Boolean(attempt.error), 'RPC extra administrator parameter denied')
  }
  const join = await second.client.from('household_members').insert({ household_id: result.id, user_id: second.id, role: 'owner' })
  check(join.error?.code === '42501', 'membership insert remains denied')
  const foreign = await second.client.from('profiles').select('id').eq('household_id', result.id)
  check(!foreign.error && foreign.data?.length === 0, 'outsider cannot read profiles')
  check(await second.service.load(second.id) === null, 'outsider membership remains absent')
  report('cannot specify user/role/household; membership writes and cross-family reads denied')
  const pair = await Promise.all([
    second.client.rpc('bootstrap_household', { p_household_name: '并发测试', p_profile_names: ['甲', '乙'] }),
    second.client.rpc('bootstrap_household', { p_household_name: '并发测试', p_profile_names: ['甲', '乙'] }),
  ])
  const winner = pair.find(r => !r.error)
  if (winner?.data) { households.add(winner.data); saveLedger() }
  check(pair.filter(r => !r.error).length === 1 && pair.filter(r => r.error?.message === 'already_initialized').length === 1, 'one concurrency winner')
  const concurrent = await second.service.load(second.id)
  check(concurrent?.profiles.length === 2 && concurrent.id === winner.data, 'no concurrent duplicate')
  report('two simultaneous requests create exactly one household and two profiles')
  const ownProfiles = result.profiles.map(p => p.profile.id)
  const archived = await first.client.from('profiles').update({ archived_at: new Date().toISOString() }).eq('id', ownProfiles[0])
  check(!archived.error && (await first.service.load(first.id)).profiles.length === 1, 'archived profile excluded')
  report('real profile query excludes archived profiles')
  // Force a failure AFTER all inserts within a PL/pgSQL subtransaction; all must roll back.
  const third = await makeUser()
  check(validUuid(third.id), 'rollback fixture uuid')
  query(`begin; set local request.jwt.claims = '{"sub":"${third.id}","role":"authenticated"}';
    do $test$ begin
      begin perform public.bootstrap_household('事务测试', array['甲','乙']);
        raise exception using errcode='P0001',message='forced_rollback';
      exception when sqlstate 'P0001' then
        if sqlerrm <> 'forced_rollback' then raise; end if;
      end;
      if exists(select 1 from public.household_members where user_id='${third.id}') then raise exception 'partial_bootstrap'; end if;
    end $test$; select true rollback_passed; rollback;`)
  check(await third.service.load(third.id) === null, 'forced transaction rollback')
  report('forced failure after inserts rolls back all bootstrap data')
  const emptyBefore = (await second.auth.getCurrentSession())?.user.id
  await second.auth.signOut()
  check(emptyBefore === second.id && await second.auth.getCurrentSession() === null, 'SDK logout clears session')
  report('real logout clears SDK session')
} catch (error) {
  // Never print SDK error objects, emails, JWTs, request bodies, or SQL key output.
  console.error('FAIL household Auth verification; safe code:', /^[A-Z0-9_]{1,30}$/i.test(error?.code || '') ? error.code : 'verification_failed')
  process.exitCode = 1
} finally {
  await vite?.close()
  try {
    // Discover own committed households even if a response was lost before ledger update.
    const ids = users.map(user => user.id)
    check(ids.every(validUuid), 'cleanup own fixture IDs')
    if (ids.length) {
      const list = ids.map(id => `'${id}'`).join(',')
      const rows = query(`select household_id from public.household_members where user_id in (${list});`)
      rows.forEach(row => households.add(row.household_id))
      check([...households].every(validUuid), 'cleanup own household IDs')
      saveLedger()
      if (households.size) {
        const hs = [...households].map(id => `'${id}'`).join(',')
        check(query(`select count(*) n from public.books where household_id in (${hs});`)[0].n === 0, 'no test books')
        query(`begin; delete from public.profiles where household_id in (${hs}); delete from public.household_members where household_id in (${hs}); delete from public.households where id in (${hs}); commit;`)
        check(query(`select count(*) n from public.households where id in (${hs});`)[0].n === 0, 'household cleanup')
      }
      for (const user of users) { await user.client.auth.signOut({ scope: 'local' }); check(!(await admin.auth.admin.deleteUser(user.id)).error, 'test Auth cleanup') }
      const counts = query(`select (select count(*) from auth.users where id in (${list})) users, (select count(*) from public.household_members where user_id in (${list})) members;`)[0]
      check(counts.users === 0 && counts.members === 0, 'zero own remaining users and memberships')
    }
    if (existsSync(ledger)) unlinkSync(ledger)
    report('all disposable Auth/Household/Profile fixtures removed; zero remainder')
  } catch {
    console.error('STOP fixture cleanup incomplete; retain ignored ledger for safe recovery')
    process.exitCode = 2
  }
}
