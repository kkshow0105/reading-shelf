// Dedicated 4B-3 temporary Storage workflow. Never log signed URLs or credentials.
import { createClient } from '@supabase/supabase-js'
import { randomUUID, randomBytes, createHash } from 'node:crypto'
import { createServer } from 'vite'
import { readFileSync, existsSync, mkdirSync, writeFileSync, unlinkSync } from 'node:fs'
import { query, projectKeys, PROJECT_URL, check } from './supabase-remote-utils.mjs'
const ledger = 'qa/covers-remote-ledger.json'
check(!existsSync(ledger), 'no unfinished cover test ledger')
const formalIds = new Set(query('select id from public.households;').map(r => r.id))
const { publishableKey, adminKey } = projectKeys()
const options = { auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: (url, init) => fetch(url, { ...init, signal: AbortSignal.timeout(15000) }) } }
const admin = createClient(PROJECT_URL, adminKey, options), users = [], households = new Set()
const persist = () => { mkdirSync('qa', { recursive: true }); writeFileSync(ledger, JSON.stringify({ users: users.map(u => u.id), households: [...households] })) }
const pass = label => console.log('PASS ' + label)
const hash = value => createHash('sha256').update(value).digest('hex')
let vite
try {
  vite = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'silent' })
  const { createRepositories } = await vite.ssrLoadModule('/src/data/remote/repositories.ts')
  const { createCoverService } = await vite.ssrLoadModule('/src/data/remote/cover-service.ts')
  const { createBookCoverMutations } = await vite.ssrLoadModule('/src/data/covers/mutations.ts')
  const { blankDraft, toDraft } = await vite.ssrLoadModule('/src/lib/books.ts')
  const { coverPath } = await vite.ssrLoadModule('/src/data/remote/cover-path.ts')
  async function fixture() {
    const email = `reading-shelf-covers-${randomUUID()}@example.invalid`, password = randomBytes(32).toString('base64url')
    const created = await admin.auth.admin.createUser({ email, password, email_confirm: true })
    check(!created.error && created.data.user?.id, 'temporary cover Auth')
    const client = createClient(PROJECT_URL, publishableKey, options), user = { id: created.data.user.id, client }
    users.push(user); persist()
    check(!(await client.auth.signInWithPassword({ email, password })).error, 'temporary cover login')
    const result = await client.rpc('bootstrap_household', { p_household_name: '临时封面验证', p_profile_names: ['封面测试甲', '封面测试乙'] })
    check(!result.error && result.data && !formalIds.has(result.data), 'only disposable cover household')
    households.add(result.data); persist()
    const repo = createRepositories(client, result.data), profiles = await repo.profiles.listProfiles(), covers = createCoverService(client)
    return { ...user, householdId: result.data, profileId: profiles[0].profile.id, repo, covers, mutations: createBookCoverMutations(repo.books, covers, result.data, profiles[0].profile.id) }
  }
  const owner = await fixture(), outside = await fixture()
  const files = [['near-2x3.jpg', 'image/jpeg'], ['wide.png', 'image/png'], ['tall.webp', 'image/webp']].map(([name, type]) => new File([readFileSync('qa/cover-fixtures/' + name)], name, { type }))
  const records = []
  for (const [index, file] of files.entries()) {
    const result = await owner.mutations.create({ ...blankDraft(), title: `临时封面${index + 1}`, author: '临时作者' }, randomUUID(), { kind: 'file', file })
    check(result.kind === 'saved' && !result.coverIssue && result.record.originalCover, 'new Book plus cover linked')
    const record = result.record, scope = { householdId: owner.householdId, profileId: owner.profileId, bookId: record.book.id }, original = record.originalCover
    check(original.path.startsWith(`${owner.householdId}/${owner.profileId}/${record.book.id}/original/`) && !original.path.includes(file.name), 'UUID path only')
    check(record.book.cover === '' && !original.path.includes('://') && record.book.cropPosition.x === .5 && record.book.cropPosition.y === .5, 'only relative path and center in Database')
    const blob = await owner.covers.getCoverBlob(scope, original.path)
    check(hash(Buffer.from(await blob.arrayBuffer())) === hash(Buffer.from(await file.arrayBuffer())), 'exact original bytes')
    const signed = await owner.covers.getCoverDisplayUrl(scope, original.path)
    check(signed.expiresIn === 3600 && (await fetch(signed.url)).status === 200, '60 minute signed URL reads')
    check((await outside.client.storage.from('book-covers').download(original.path)).error, 'outside authenticated read denied')
    const outsideSign = await outside.client.storage.from('book-covers').createSignedUrl(original.path, 3600)
    check(outsideSign.error && !outsideSign.data?.signedUrl, 'outside sign denied')
    const publicUrl = owner.client.storage.from('book-covers').getPublicUrl(original.path).data.publicUrl
    check((await fetch(publicUrl)).status !== 200, 'private object is not public')
    const raw = await owner.repo.books.getBook(record.book.id, false, owner.profileId)
    check(raw.originalCover.path === original.path && raw.originalCover.filename === file.name, 'permanent metadata retains original filename')
    records.push({ record, scope, file }); pass(`${file.type} real upload/read/bytes/private signed display`)
  }
  const first = records[0], originalPath = first.record.originalCover.path
  check((await owner.client.storage.from('book-covers').upload(originalPath, first.file, { upsert: false, contentType: first.file.type })).error, 'same path duplicate denied')
  check((await owner.client.storage.from('book-covers').upload(originalPath, files[1], { upsert: true, contentType: files[1].type })).error, 'overwrite denied')
  const forbiddenPath = coverPath(first.scope, first.file.type, randomUUID())
  check((await outside.client.storage.from('book-covers').upload(forbiddenPath, first.file, { upsert: false, contentType: first.file.type })).error, 'outside write denied')
  pass('same-path duplicate / overwrite / outside insert denied')
  for (const file of [new File(['plain text'], 'fake.jpg', { type: 'image/jpeg' }), new File(['<svg/>'], 'image.svg', { type: 'image/svg+xml' }), new File([new Uint8Array(10485761)], 'large.png', { type: 'image/png' })]) {
    let rejected = false
    try { await owner.covers.uploadOriginalCover(first.scope, file) } catch { rejected = true }
    check(rejected, 'invalid cover rejected before Storage')
  }
  pass('invalid bytes / SVG / over10MiB rejected by service')
  const replacement = await owner.mutations.update(first.record, { ...toDraft(first.record.book), note: '临时替换同时修改文字' }, { kind: 'file', file: files[1] })
  check(replacement.kind === 'saved' && replacement.record.originalCover.path !== originalPath && replacement.record.book.note === '临时替换同时修改文字', 'single edit reference and text saved')
  check(hash(Buffer.from(await (await owner.covers.getCoverBlob(first.scope, originalPath)).arrayBuffer())) === hash(Buffer.from(await first.file.arrayBuffer())), 'old original survives replacement unchanged')
  const beforeOrphan = query(`select count(*) n from storage.objects where bucket_id='book-covers' and split_part(name,'/',1)='${owner.householdId}';`)[0].n
  const conflict = await owner.mutations.update(first.record, { ...toDraft(first.record.book), note: '旧设备不得覆盖' }, { kind: 'file', file: files[2] })
  check(conflict.kind === 'conflict', 'upload then stale revision rejected')
  const actual = await owner.repo.books.getBook(first.record.book.id)
  check(actual.originalCover.path === replacement.record.originalCover.path && actual.book.note === replacement.record.book.note, 'old Book reference unchanged on conflict')
  check(query(`select count(*) n from storage.objects where bucket_id='book-covers' and split_part(name,'/',1)='${owner.householdId}';`)[0].n === beforeOrphan + 1, 'new orphan retained')
  pass('replacement retains old bytes; stale replacement leaves orphan without overwrite')
  const second = records[1]
  const deleted = await owner.repo.books.softDeleteBook(second.record.book.id, owner.profileId, second.record.updatedAt)
  check(deleted.kind === 'saved' && (await owner.covers.getCoverBlob(second.scope, second.record.originalCover.path)).size === second.file.size, 'soft delete keeps cover readable')
  const restored = await owner.repo.books.restoreBook(second.record.book.id, owner.profileId, deleted.record.updatedAt)
  check(restored.kind === 'saved' && restored.record.originalCover.path === second.record.originalCover.path && (await fetch((await owner.covers.getCoverDisplayUrl(second.scope, second.record.originalCover.path)).url)).status === 200, 'restored cover readable')
  const removed = await owner.mutations.update(replacement.record, toDraft(replacement.record.book), { kind: 'remove' })
  check(removed.kind === 'saved' && removed.record.originalCover === null && removed.record.book.cropPosition.x === .5, 'remove reference only')
  check((await owner.covers.getCoverBlob(first.scope, replacement.record.originalCover.path)).size === files[1].size, 'remove keeps original file')
  pass('soft delete / restore / remove reference preserve Storage originals')
  const partial = await owner.mutations.create({ ...blankDraft(), title: '部分成功测试', author: '临时作者' }, randomUUID(), { kind: 'file', file: new File(['invalid'], 'invalid.png', { type: 'image/png' }) })
  check(partial.kind === 'saved' && partial.coverIssue === 'upload' && partial.record.originalCover === null && await owner.repo.books.getBook(partial.record.book.id), 'created Book survives cover rejection')
  pass('new Book remains saved on rejected cover; no record rollback')
} catch (error) {
  console.error('FAIL cover verification; raw errors / signed URLs suppressed')
  // Labels are fixed strings from check(), never SDK messages containing a URL/token.
  if (error?.message?.startsWith('Verification failed: ')) console.error(error.message)
  else {
    const category = String(error?.code || error?.name || 'unknown')
    console.error('Safe failure category: ' + (/^[A-Za-z0-9_]{1,60}$/.test(category) ? category : 'unknown'))
    if (Array.isArray(error?.failureKinds)) console.error('CLI failure kinds: ' + error.failureKinds.join(', '))
  }
  process.exitCode = 1
}
finally {
  await vite?.close()
  try {
    const ids = users.map(u => u.id)
    check(ids.every(id => /^[0-9a-f-]{36}$/.test(id)), 'own temporary user IDs')
    if (ids.length) query(`select household_id from public.household_members where user_id in (${ids.map(id => `'${id}'`).join(',')});`).forEach(r => households.add(r.household_id))
    check([...households].every(id => /^[0-9a-f-]{36}$/.test(id) && !formalIds.has(id)), 'exclude all formal households')
    persist()
    if (households.size) {
      const hs = [...households].map(id => `'${id}'`).join(',')
      const paths = query(`select name from storage.objects where bucket_id='book-covers' and split_part(name,'/',1) in (${hs});`).map(r => r.name)
      check(paths.every(p => households.has(p.split('/')[0])), 'only own Storage objects')
      if (paths.length) check(!(await admin.storage.from('book-covers').remove(paths)).error, 'Storage API cleanup')
      check(query(`select count(*) n from storage.objects where bucket_id='book-covers' and split_part(name,'/',1) in (${hs});`)[0].n === 0, 'zero own Storage remainder')
      query(`begin; delete from public.books where household_id in (${hs}); delete from public.profiles where household_id in (${hs}); delete from public.household_members where household_id in (${hs}); delete from public.households where id in (${hs}); commit;`)
      check(query(`select (select count(*) from public.books where household_id in (${hs}))+(select count(*) from public.households where id in (${hs})) n;`)[0].n === 0, 'zero own data remainder')
    }
    for (const user of users) check(!(await admin.auth.admin.deleteUser(user.id)).error, 'own temporary Auth cleanup')
    if (ids.length) check(query(`select count(*) n from auth.users where id in (${ids.map(id => `'${id}'`).join(',')});`)[0].n === 0, 'zero own Auth remainder')
    if (existsSync(ledger)) unlinkSync(ledger)
    pass('all own Auth / Books / Profiles / Household / Storage fixtures cleared; formal data preserved')
  } catch { console.error('STOP cover fixture cleanup incomplete; preserve ignored ledger'); process.exitCode = 2 }
}
