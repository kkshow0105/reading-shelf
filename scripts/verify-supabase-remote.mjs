// Explicit 4A.5 test runner for ONE verified project. No UI imports except SSR smoke.
// Real credentials/passwords/session tokens remain in memory. Never print raw errors.
import { createClient } from '@supabase/supabase-js'
import { spawnSync } from 'node:child_process'
import { randomUUID, randomBytes } from 'node:crypto'
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs'
import { createRepositories } from '../src/data/remote/repositories.ts'
import { createCoverService } from '../src/data/remote/cover-service.ts'
import { blankDraft, toDraft } from '../src/lib/books.ts'
import { projectKeys, query, check, PROJECT_REF, PROJECT_URL } from './supabase-remote-utils.mjs'

mkdirSync('qa', { recursive: true })
const ledgerPath = 'qa/supabase-4a5-ledger.json'
if (existsSync(ledgerPath)) check(JSON.parse(readFileSync(ledgerPath, 'utf8')).cleaned === true, 'previous test cleanup')
const state = { ref: PROJECT_REF, users: [], households: [], profiles: [], objects: [], cleaned: false }
const results = []
let stage = 'initialization'
let admin, server
const saveLedger = () => writeFileSync(ledgerPath, JSON.stringify(state, null, 2))
const pass = label => { results.push(label); console.log(`PASS ${label}`) }
const clientOptions = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } }
const must = (result, label) => { check(!result.error, label); return result.data }
const ids = () => randomUUID()
try {
  stage = 'keys'
  const { publishableKey, adminKey } = projectKeys()
  const initial = query(`select (select count(*) from public.households)::int as households, (select count(*) from public.profiles)::int as profiles, (select count(*) from public.books)::int as books, (select count(*) from storage.objects where bucket_id='book-covers')::int as objects;`)[0]
  check(Object.values(initial).every(value => value === 0), 'empty dedicated test project required; never run against family data')
  admin = createClient(PROJECT_URL, adminKey, clientOptions)
  stage = 'bucket'
  const initialized = spawnSync(process.execPath, ['scripts/setup-cover-bucket.mjs'], {
    env: { ...process.env, SUPABASE_URL: PROJECT_URL, SUPABASE_PROJECT_REF: PROJECT_REF, SUPABASE_SECRET_KEY: adminKey },
    encoding: 'utf8', windowsHide: true,
  })
  check(initialized.status === 0, 'Storage API bucket initialization')
  const bucket = must(await admin.storage.getBucket('book-covers'), 'bucket metadata')
  check(bucket.public === false && Number(bucket.file_size_limit) === 10485760, 'private bucket and file limit')
  check(JSON.stringify([...bucket.allowed_mime_types].sort()) === JSON.stringify(['image/jpeg', 'image/png', 'image/webp'].sort()), 'bucket MIME restriction')
  pass('private_bucket_api_initialization')

  stage = 'frontend_environment'
  if (existsSync('.env.local')) {
    const original = readFileSync('.env.local', 'utf8')
    check(!/sb_secret_|service_role|SUPABASE_DB_PASSWORD|SUPABASE_ACCESS_TOKEN/.test(original), 'safe existing frontend environment')
    check(!original.split(/\r?\n/).some(line => line.trim() && !line.trim().startsWith('#') && !/^VITE_SUPABASE_(URL|PUBLISHABLE_KEY)=/.test(line)), 'preserve unexpected existing environment')
  }
  writeFileSync('.env.local', `VITE_SUPABASE_URL=${PROJECT_URL}\nVITE_SUPABASE_PUBLISHABLE_KEY=${publishableKey}\n`, { mode: 0o600 })
  const ignored = spawnSync('git', ['check-ignore', '-q', '.env.local'], { windowsHide: true })
  check(ignored.status === 0, 'frontend environment ignored')
  const settings = await fetch(`${PROJECT_URL}/auth/v1/settings`, { headers: { apikey: publishableKey } })
  check(settings.status === 200, 'publishable key valid')
  const anon = createClient(PROJECT_URL, publishableKey, clientOptions)
  for (const table of ['households', 'household_members', 'profiles', 'books']) {
    const result = await anon.from(table).select('*')
    check(result.error?.code === '42501', `anon grant denied ${table}`)
  }
  pass('publishable_key_and_anon_grants')
  const { createServer } = await import('vite')
  server = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'silent' })
  const centralized = await server.ssrLoadModule('/src/lib/supabase.ts')
  const smoke = await centralized.getSupabaseClient().from('books').select('id').limit(1)
  check(smoke.error?.code === '42501', 'centralized client anonymous isolation')
  await server.close(); server = undefined
  pass('existing_central_client_smoke')

  stage = 'temporary_auth'
  const clients = []
  const run = randomUUID()
  for (const role of ['a', 'b', 'outside']) {
    const password = randomBytes(24).toString('base64url') + 'Aa1!'
    const email = `rs4a5-${run}-${role}@example.invalid`
    const created = must(await admin.auth.admin.createUser({ email, password, email_confirm: true }), 'temporary Auth user')
    state.users.push(created.user.id); saveLedger()
    const client = createClient(PROJECT_URL, publishableKey, clientOptions)
    must(await client.auth.signInWithPassword({ email, password }), 'temporary Auth sign-in')
    clients.push(client)
  }
  const [a, b, outside] = clients
  const [ha, hb, pa, pb, po] = Array.from({ length: 5 }, ids)
  state.households = [ha, hb]; state.profiles = [pa, pb, po]; saveLedger()
  query(`begin;
    insert into public.households(id,name) values('${ha}','4A.5 test household A'),('${hb}','4A.5 test household outside');
    insert into public.household_members(household_id,user_id,role) values
    ('${ha}','${state.users[0]}','owner'),('${ha}','${state.users[1]}','member'),('${hb}','${state.users[2]}','owner');
    insert into public.profiles(id,household_id,name,sort_order) values
    ('${pa}','${ha}','Test A',0),('${pb}','${ha}','Test B',1),('${po}','${hb}','Test Outside',0);
    commit; select true as initialized;`)
  pass('temporary_auth_fixture_initialization')
  const reposA = createRepositories(a, ha), reposB = createRepositories(b, ha)
  const draft = { ...blankDraft(), title: '4A.5 test record', author: 'Test author' }
  for (const [client, repos] of [[a, reposA], [b, reposB]]) {
    check(must(await client.from('households').select('id').eq('id', ha), 'member household select').length === 1, 'member household visible')
    check((await repos.profiles.listProfiles()).length === 2, 'member profiles visible')
    for (const profile of [pa, pb]) await repos.books.createBook(profile, draft)
  }
  let current = (await reposA.books.listBooks(pa)).books[0]
  check(current && (await reposB.books.getBook(current.book.id)), 'shared member books visible')
  pass('members_read_and_create_all_family_profiles')
  const originalCreatedAt = current.book.createdAt
  let saved = await reposB.books.updateBook(current.book.id, pa, current.updatedAt, { ...toDraft(current.book), note: 'Member B update' })
  check(saved.kind === 'saved' && saved.record.book.note === 'Member B update', 'member edit')
  const stale = current.updatedAt
  current = saved.record
  check(current.updatedAt !== stale, 'DB updated_at advances')
  check(current.book.createdAt === originalCreatedAt, 'created_at preserved')
  check((await reposA.books.updateBook(current.book.id, pa, stale, draft)).kind === 'conflict', 'stale optimistic update')
  pass('member_update_trigger_and_optimistic_conflict')
  saved = await reposB.books.softDeleteBook(current.book.id, pa, current.updatedAt)
  check(saved.kind === 'saved' && saved.record.deletedAt && saved.record.deletedBy === state.users[1], 'soft delete DB actor')
  check(!(await reposA.books.listBooks(pa)).books.some(item => item.book.id === current.book.id), 'default soft-delete filtering')
  current = saved.record
  saved = await reposA.books.restoreBook(current.book.id, pa, current.updatedAt)
  check(saved.kind === 'saved' && saved.record.deletedAt === null && saved.record.deletedBy === null, 'member restore')
  current = saved.record
  check((await a.from('books').delete().eq('id', current.book.id)).error?.code === '42501', 'hard DELETE privilege rejection')
  check((await b.from('household_members').insert({ household_id: ha, user_id: state.users[2] })).error?.code === '42501', 'membership insert privilege rejection')
  check((await b.from('household_members').update({ role: 'owner' }).eq('user_id', state.users[1])).error?.code === '42501', 'membership update privilege rejection')
  check((await b.from('household_members').delete().eq('user_id', state.users[1])).error?.code === '42501', 'membership delete privilege rejection')
  pass('soft_delete_restore_filter_and_hard_delete_grants')

  stage = 'outside_rls'
  for (const table of ['households', 'profiles', 'books']) {
    const filter = table === 'households' ? 'id' : 'household_id'
    check(must(await outside.from(table).select('*').eq(filter, ha), 'outside raw SELECT').length === 0, `outside denied ${table}`)
  }
  check((await outside.from('books').insert({ household_id: ha, profile_id: pa, title: 'Unauthorized', author: 'Test' })).error?.code === '42501', 'outside INSERT denied by RLS')
  for (const columns of [{ title: 'Unauthorized' }, { deleted_at: new Date().toISOString() }]) {
    check(must(await outside.from('books').update(columns).eq('id', current.book.id).select('id'), 'outside raw UPDATE').length === 0, 'outside UPDATE blocked by RLS')
  }
  const preserved = await reposA.books.getBook(current.book.id)
  check(preserved.book.title === current.book.title && preserved.deletedAt === null, 'outside attempts changed nothing')
  pass('outside_raw_api_rls_denials_without_recursion')

  stage = 'storage'
  const serviceA = createCoverService(a), serviceB = createCoverService(b), serviceOutside = createCoverService(outside)
  const scope = { householdId: ha, profileId: pa, bookId: current.book.id }
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aX1cAAAAASUVORK5CYII=', 'base64')
  const file = new File([png], '测试原图.png', { type: 'image/png' })
  const original = await serviceA.uploadOriginalCover(scope, file)
  state.objects.push(original.path); saveLedger()
  saved = await reposA.books.replaceCover(current.book.id, pa, current.updatedAt, original)
  check(saved.kind === 'saved' && saved.record.originalCover.path === original.path, 'persist original path')
  current = saved.record
  check(Buffer.compare(Buffer.from(await (await serviceB.getCoverBlob(scope, original.path)).arrayBuffer()), png) === 0, 'member reads identical original bytes')
  check((await a.storage.from('book-covers').upload(original.path, file, { upsert: false })).error, 'duplicate upload rejected')
  check((await a.storage.from('book-covers').upload(original.path, file, { upsert: true })).error, 'overwrite rejected')
  check((await a.storage.from('book-covers').update(original.path, file)).error, 'object UPDATE rejected')
  const movedPath = original.path.replace(/[^/]+$/, `${randomUUID()}.png`)
  check((await a.storage.from('book-covers').move(original.path, movedPath)).error, 'object MOVE rejected')
  state.objects.push(movedPath); saveLedger()
  const deletion = await a.storage.from('book-covers').remove([original.path])
  check(deletion.error || deletion.data.length === 0, 'object DELETE blocked')
  check((await b.storage.from('book-covers').download(original.path)).data, 'original survives forbidden removal')
  check((await outside.storage.from('book-covers').download(original.path)).error, 'outside download rejected')
  const outsidePath = original.path.replace(/[^/]+$/, `${randomUUID()}.png`)
  check((await outside.storage.from('book-covers').upload(outsidePath, file, { upsert: false })).error, 'outside upload rejected')
  state.objects.push(outsidePath); saveLedger()
  pass('storage_member_read_upload_and_forbidden_actions')
  const signed = await serviceA.getCoverDisplayUrl(scope, original.path)
  check(signed.expiresIn === 300 && (await fetch(signed.url)).status === 200, 'short-lived signed URL works')
  const short = must(await a.storage.from('book-covers').createSignedUrl(original.path, 1), 'one-second signed URL')
  await new Promise(resolve => setTimeout(resolve, 2200))
  check((await fetch(short.signedUrl)).status !== 200, 'expired signed URL rejected')
  check((await reposA.books.getBook(current.book.id)).originalCover.path === original.path, 'DB stores path not URL')
  pass('signed_url_generation_expiration_and_path_only_storage')
  const replacement = await serviceB.replaceOriginalCover(scope, current.updatedAt, file)
  state.objects.push(replacement.uploadedCover.path); saveLedger()
  check(replacement.result.kind === 'saved' && replacement.uploadedCover.path !== original.path, 'new unique original replaces reference')
  const oldRevision = current.updatedAt
  current = replacement.result.record
  check((await serviceA.getCoverBlob(scope, original.path)).size === png.length, 'old original retained')
  const conflict = await serviceA.replaceOriginalCover(scope, oldRevision, file)
  state.objects.push(conflict.uploadedCover.path); saveLedger()
  check(conflict.result.kind === 'conflict', 'cover replacement conflict detected')
  check((await reposA.books.getBook(current.book.id)).originalCover.path === current.originalCover.path, 'conflict preserves previous reference')
  check((await serviceA.getCoverBlob(scope, conflict.uploadedCover.path)).size === png.length, 'new orphan retained safely')
  const deleted = await reposA.books.softDeleteBook(current.book.id, pa, current.updatedAt)
  check(deleted.kind === 'saved' && (await serviceB.getCoverBlob(scope, current.originalCover.path)).size === png.length, 'soft deletion preserves original access for recovery')
  pass('cover_replacement_conflict_and_soft_delete_keep_originals')
} catch (error) {
  const label = String(error.message).startsWith('Verification failed:') ? error.message : 'raw error suppressed'
  console.log(JSON.stringify({ failedStage: stage, failure: label, sqlState: error.sqlState }))
  process.exitCode = 1
} finally {
  if (server) await server.close()
  try {
    if (admin) {
      // Administrator cleanup is limited to IDs/paths recorded by this run.
      if (state.objects.length) must(await admin.storage.from('book-covers').remove(state.objects), 'test Storage cleanup')
      if (state.households.length) {
        const list = state.households.map(id => `'${id}'`).join(',')
        query(`begin; delete from public.books where household_id in (${list}); delete from public.profiles where household_id in (${list}); delete from public.household_members where household_id in (${list}); delete from public.households where id in (${list}); commit; select true as cleaned;`)
      }
      for (const id of state.users) must(await admin.auth.admin.deleteUser(id), 'test Auth cleanup')
      if (state.users.length) {
        const users = state.users.map(id => `'${id}'`).join(',')
        check(query(`select count(*)::int as count from auth.users where id in (${users});`)[0].count === 0, 'no remaining temporary Auth users')
      }
      const householdList = state.households.length ? state.households.map(id => `'${id}'`).join(',') : 'null'
      const objectList = state.objects.length ? state.objects.map(path => `'${path}'`).join(',') : 'null'
      const counts = query(`select (select count(*) from public.households where id in (${householdList}))::int as households, (select count(*) from public.profiles where household_id in (${householdList}))::int as profiles, (select count(*) from public.books where household_id in (${householdList}))::int as books, (select count(*) from public.household_members where household_id in (${householdList}))::int as members, (select count(*) from storage.objects where bucket_id='book-covers' and name in (${objectList}))::int as objects;`)[0]
      check(Object.values(counts).every(value => value === 0), 'no remaining test fixtures')
      state.cleaned = true; saveLedger()
      pass('all_test_data_auth_users_and_storage_cleaned')
    }
  } catch { console.log('CLEANUP_FAILED: Stop; retain the non-secret ledger for exact cleanup.'); process.exitCode = 1 }
  writeFileSync('qa/supabase-4a5-report.json', JSON.stringify({ ref: PROJECT_REF, results, cleaned: state.cleaned, passed: !process.exitCode }, null, 2))
}
