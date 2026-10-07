// Dedicated 5A disposable households. Never print credentials, private paths or backup contents.
import { createClient } from '@supabase/supabase-js'
import { randomUUID, randomBytes, createHash } from 'node:crypto'
import { readFileSync, existsSync, mkdirSync, writeFileSync, unlinkSync } from 'node:fs'
import { zipSync, unzipSync } from 'fflate'
import { query, projectKeys, PROJECT_URL, check, PROJECT_REF } from './supabase-remote-utils.mjs'
import { createBackupRepository } from '../src/data/backup/repository.ts'
import { exportComplete, exportCsv, snapshotIdentity } from '../src/data/backup/export.ts'
import { openArchive, sha256, jsonBytes } from '../src/data/backup/archive.ts'
import { RestoreSession, inspectTarget } from '../src/data/backup/restore.ts'
import { createRepositories } from '../src/data/remote/repositories.ts'
import { createCoverService } from '../src/data/remote/cover-service.ts'
import { draftColumns } from '../src/data/remote/contracts.ts'

const ledger = 'qa/backup-remote-ledger.json'
check(!existsSync(ledger), 'no unfinished backup ledger')
check(readFileSync('supabase/.temp/project-ref', 'utf8').trim() === PROJECT_REF, 'linked project ref')
const stateSQL = `select jsonb_build_object('books',(select jsonb_agg(x order by x.id) from (select id,household_id,profile_id,updated_at,deleted_at,cover_original_path from public.books)x),'objects',(select jsonb_agg(x order by x.name) from (select bucket_id,name,created_at,updated_at,metadata from storage.objects)x)) state;`
const fingerprint = () => createHash('sha256').update(JSON.stringify(query(stateSQL)[0].state)).digest('hex')
const before = fingerprint(), formalIds = new Set(query('select id from public.households;').map(r => r.id))
const { publishableKey, adminKey } = projectKeys()
const options = { auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: (url, init) => fetch(url, { ...init, signal: AbortSignal.timeout(20000) }) } }
const admin = createClient(PROJECT_URL, adminKey, options), users = [], households = new Set()
const persist = () => { mkdirSync('qa', { recursive: true }); writeFileSync(ledger, JSON.stringify({ users: users.map(u => u.id), households: [...households] })) }
const pass = label => console.log('PASS ' + label)
let failUpload = false, finalResult
async function fixture() {
  const email = `reading-shelf-backup-${randomUUID()}@example.invalid`, password = randomBytes(32).toString('base64url')
  const created = await admin.auth.admin.createUser({ email, password, email_confirm: true })
  check(!created.error && created.data.user?.id, 'temporary backup Auth')
  const client = createClient(PROJECT_URL, publishableKey, { ...options, global: { fetch: (url, init) => {
    if (failUpload && init?.method === 'POST' && String(url).includes('/storage/v1/object/book-covers/')) return Promise.resolve(new Response(JSON.stringify({ message: 'temporary test upload interruption' }), { status: 503, headers: { 'Content-Type': 'application/json' } }))
    return options.global.fetch(url, init)
  } } })
  const user = { id: created.data.user.id, client }; users.push(user); persist()
  check(!(await client.auth.signInWithPassword({ email, password })).error, 'temporary backup login')
  const boot = await client.rpc('bootstrap_household', { p_household_name: '临时备份验证', p_profile_names: ['初始甲', '初始乙'] })
  check(!boot.error && boot.data && !formalIds.has(boot.data), 'only disposable backup household')
  households.add(boot.data); persist()
  const repo = createBackupRepository(client, boot.data)
  return { ...user, repo, householdId: boot.data, profiles: await repo.profiles() }
}
try {
  const source = await fixture(), target = await fixture(), legacyTarget = await fixture(), outside = await fixture()
  const bookRepo = createRepositories(source.client, source.householdId).books, covers = createCoverService(source.client)
  const images = [['near-2x3.jpg', 'image/jpeg'], ['wide.png', 'image/png'], ['tall.webp', 'image/webp']].map(([name, type]) => new File([readFileSync('qa/cover-fixtures/' + name)], name, { type }))
  const statuses = ['想读', '在读', '读完', '暂停', '弃读'], records = []
  for (let i = 0; i < 5; i++) {
    const profileId = source.profiles[i < 3 ? 0 : 1].id
    const draft = { title: i === 3 ? '=测试公式,"书名"' : `临时记录${i + 1}`, author: '临时作者', translator: i % 2 ? '临时译者' : '', status: statuses[i],
      startedOn: i === 0 ? '' : '2026-09-01', finishedOn: i === 2 || i === 4 ? '2026-09-28' : '', rating: i % 2 ? null : 5, progressPercent: [null, 0, 1, 50, 100][i], note: '第一行\n第二行：逗号,与"引号"', cover: '', cropPosition: { x: .2 + i * .1, y: .8 - i * .1 } }
    let record = await bookRepo.createBook(profileId, draft)
    if (i < 3) {
      const scope = { householdId: source.householdId, profileId, bookId: record.book.id }
      const cover = await covers.uploadOriginalCover(scope, images[i])
      const linked = await bookRepo.replaceCover(record.book.id, profileId, record.updatedAt, cover)
      check(linked.kind === 'saved', 'fixture cover link')
      const positioned = await bookRepo.updateBook(record.book.id, profileId, linked.record.updatedAt, draft)
      check(positioned.kind === 'saved', 'fixture noncenter position'); record = positioned.record
      if (i === 0) await covers.uploadOriginalCover(scope, images[1]) // Historical original is not referenced.
    }
    records.push(record)
  }
  const deleted = await bookRepo.softDeleteBook(records[0].book.id, records[0].book.profileId, records[0].updatedAt)
  check(deleted.kind === 'saved', 'fixture soft delete with cover')
  const archive = await source.client.from('profiles').update({ name: '已归档乙', archived_at: new Date().toISOString() }).eq('id', source.profiles[1].id)
  check(!archive.error, 'fixture archived profile')
  const exported = await exportComplete(source.repo), backup = await openArchive(exported.bytes)
  check(backup.manifest.profileCount === 2 && backup.manifest.bookCount === 5 && backup.manifest.softDeletedBookCount === 1 && backup.manifest.coverFileCount === 4 && backup.manifest.historicalCoverFileCount === 1, 'complete counts include archived profile deleted Book and history')
  check(backup.data.books.filter(b => b.profileId === source.profiles[0].id).length === 3 && backup.data.books.filter(b => b.profileId === source.profiles[1].id).length === 2, 'A3 B2 household export')
  const serialized = JSON.stringify(backup.data)
  check(!serialized.includes('access_token') && !serialized.includes('refresh_token') && !serialized.includes('signedUrl') && !serialized.includes('example.invalid'), 'allowlisted export excludes Auth credentials')
  check(exportCsv(backup.data).startsWith('\uFEFF') && exportCsv(backup.data).includes("'=测试公式"), 'BOM CSV formula protection')
  pass('2 profiles A3/B2 all five statuses nulls translator ratings dates crop archived/deleted plus all4 originals')
  const outsideBooks = await outside.client.from('books').select('id').eq('household_id', source.householdId)
  check(!outsideBooks.error && outsideBooks.data.length === 0, 'outside household RLS denies data')
  const outsideObjects = await createBackupRepository(outside.client, source.householdId).objects()
  check(outsideObjects.length === 0, 'outside household RLS denies all originals')
  pass('cross-household RLS privacy unchanged')
  // Reject every corrupted ZIP before invoking the restore engine. No writes are possible in parsing.
  const mutations = ['json', 'cover', 'missing-cover', 'future', 'no-manifest']
  for (const kind of mutations) {
    const input = unzipSync(exported.bytes), imagePath = backup.manifest.files.find(f => f.kind === 'cover').path
    if (kind === 'json') input['data/structured-data.json'][50] ^= 1
    if (kind === 'cover') input[imagePath][50] ^= 1
    if (kind === 'missing-cover') delete input[imagePath]
    if (kind === 'future') input['manifest.json'] = jsonBytes({ ...backup.manifest, formatVersion: 999 })
    if (kind === 'no-manifest') delete input['manifest.json']
    let rejected = false; try { await openArchive(zipSync(input, { level: 0 })) } catch { rejected = true }
    check(rejected, 'corrupted ZIP rejected before write')
  }
  check((await target.repo.books()).length === 0 && (await target.repo.objects()).length === 0, 'validation caused zero remote writes')
  pass('damaged JSON/cover missing cover future version no manifest rejected with zero writes')
  const job = new RestoreSession(target.repo, target.id, backup, target.profiles.map(p => ({ id: p.id, updatedAt: p.updated_at })))
  failUpload = true
  const pause = new AbortController()
  const paused = await job.run(message => { if (message.startsWith('恢复阅读记录 1 /')) pause.abort() }, pause.signal)
  check(!paused.complete && paused.bookCount === 1 && paused.failures.some(f => f.stage === 'verification'), 'interrupt preserves checkpoint and first record')
  check(!(await target.client.from('households').update({ name: '临时外部改名' }).eq('id', target.householdId)).error, 'temporary other device household edit')
  const conflicted = await job.run()
  check(!conflicted.complete && (await target.repo.household()).name === '临时外部改名', 'retry never overwrites another household edit')
  check(!(await target.client.from('households').update({ name: backup.data.household.name }).eq('id', target.householdId)).error, 'explicit disposable test reconciliation')
  const partial = await job.run()
  check(!partial.complete && partial.bookCount === 5 && partial.coverCount === 0 && partial.failures.length === 3, 'partial upload failure retains books and reports items')
  failUpload = false
  const restored = await job.run()
  check(restored.complete && restored.profileCount === 2 && restored.bookCount === 5 && restored.coverCount === 3 && restored.softDeletedBookCount === 1, 'retry completes without duplicate books')
  check((await target.repo.objects()).length === 3, 'history stays ZIP only no redundant uploads')
  pass('real upload failure retains 5 Books; session retry restores exactly 3 current covers and no duplicates')
  const output = await target.repo.snapshot()
  for (const original of backup.data.books) {
    const current = output.books.find(b => b.id === restored.bookMapping[original.id])
    check(current && current.id !== original.id && current.profileId === restored.profileMapping[original.profileId] && current.profileId !== original.profileId, 'new book and profile IDs')
    for (const key of ['title', 'author', 'translator', 'status', 'startedOn', 'finishedOn', 'rating', 'progressPercent', 'notes']) check(current[key] === original[key], 'restored field equality')
    check(JSON.stringify(current.cropPosition) === JSON.stringify(original.cropPosition) && Boolean(current.deletedAt) === Boolean(original.deletedAt), 'crop/deleted state equality')
    if (original.cover) {
      check(current.cover.originalPath !== original.cover.originalPath && current.cover.originalPath.startsWith(`${target.householdId}/${current.profileId}/${current.id}/original/`), 'new scoped original path')
      const fileEntry = backup.manifest.files.find(f => f.kind === 'cover' && f.referencedByBookId === original.id)
      const blob = await createCoverService(target.client).getCoverBlob({ householdId: target.householdId, profileId: current.profileId, bookId: current.id }, current.cover.originalPath)
      check(await sha256(new Uint8Array(await blob.arrayBuffer())) === fileEntry.sha256 && current.cover.originalFilename === original.cover.originalFilename && current.cover.mimeType === original.cover.mimeType, 'restored cover bytes SHA filename MIME')
    }
  }
  check(output.profiles.every(p => { const src = backup.data.profiles.find(s => restored.profileMapping[s.id] === p.id); return src && p.name === src.name && p.sortOrder === src.sortOrder && p.archivedAt === src.archivedAt }), 'profile archive names sort equality')
  check(restored.originalHistory.every(h => h.originalCreatedAt && h.originalUpdatedAt), 'original clocks preserved in report')
  check((await inspectTarget(target.repo, target.id, backup)).allowed === false, 'nonempty target cannot repeat restore')
  let repeated = false; try { await job.run() } catch { repeated = true }; check(repeated, 'completed checkpoint cannot duplicate restore')
  pass('all record fields new IDs/paths exact image SHA verified; original clocks historical and new clocks server generated; nonempty repeat blocked')
  // Rebuild a genuine pre-progress v1 ZIP from temporary data and unchanged original bytes.
  const legacyData = structuredClone(backup.data); legacyData.formatVersion = 1
  for (const book of legacyData.books) delete book.progressPercent
  const legacyBytes = jsonBytes(legacyData), legacyFiles = new Map(backup.files)
  legacyFiles.set('data/structured-data.json', legacyBytes)
  const legacyManifest = { ...backup.manifest, formatVersion: 1, files: backup.manifest.files.map(f => f.kind === 'data' ? { ...f, size: legacyBytes.length, sha256: '' } : f) }
  legacyManifest.files.find(f => f.kind === 'data').sha256 = await sha256(legacyBytes)
  const { packArchive } = await import('../src/data/backup/archive.ts')
  const legacyBackup = await openArchive(await packArchive(legacyManifest, legacyFiles))
  const legacyJob = new RestoreSession(legacyTarget.repo, legacyTarget.id, legacyBackup)
  const legacyResult = await legacyJob.run()
  check(legacyResult.complete && legacyResult.bookCount === 5 && legacyResult.coverCount === 3, 'v1 real empty-household ZIP restore complete')
  check((await legacyTarget.repo.books()).every(b => b.progress_percent === null), 'v1 all restored progress NULL')
  pass('v2 progress NULL/0/1/50/100 restored; pre-progress v1 ZIP including covers restored with progress NULL')
  mkdirSync('qa/backup-fixtures', { recursive: true }); writeFileSync('qa/backup-fixtures/valid.zip', exported.bytes)
  finalResult = { passed: true, profiles: 2, sourceBooks: 5, sourceCovers: 4, restoredBooks: 5, restoredCurrentCovers: 3, historicalKeptInZip: 1, softDeleted: 1 }
} catch (error) {
  console.error('FAIL backup verification; raw errors and private data suppressed')
  if (error?.message?.startsWith('Verification failed: ')) console.error(error.message)
  else { const category = String(error?.code || error?.name || 'unknown'); console.error('Safe failure category: ' + (/^[A-Za-z0-9_]{1,60}$/.test(category) ? category : 'unknown')) }
  process.exitCode = 1
} finally {
  failUpload = false
  try {
    const ids = users.map(u => u.id)
    check(ids.every(id => /^[0-9a-f-]{36}$/.test(id)), 'own temporary IDs')
    if (ids.length) query(`select household_id from public.household_members where user_id in (${ids.map(id => `'${id}'`).join(',')});`).forEach(r => households.add(r.household_id))
    check([...households].every(id => /^[0-9a-f-]{36}$/.test(id) && !formalIds.has(id)), 'exclude all formal households'); persist()
    if (households.size) {
      const hs = [...households].map(id => `'${id}'`).join(',')
      const paths = query(`select name from storage.objects where bucket_id='book-covers' and split_part(name,'/',1) in (${hs});`).map(r => r.name)
      check(paths.every(p => households.has(p.split('/')[0])), 'only own Storage paths')
      if (paths.length) check(!(await admin.storage.from('book-covers').remove(paths)).error, 'exact temporary Storage API cleanup')
      check(query(`select count(*) n from storage.objects where bucket_id='book-covers' and split_part(name,'/',1) in (${hs});`)[0].n === 0, 'zero temporary objects')
      query(`begin; delete from public.books where household_id in (${hs}); delete from public.profiles where household_id in (${hs}); delete from public.household_members where household_id in (${hs}); delete from public.households where id in (${hs}); commit;`)
      check(query(`select (select count(*) from public.books where household_id in (${hs}))+(select count(*) from public.profiles where household_id in (${hs}))+(select count(*) from public.household_members where household_id in (${hs}))+(select count(*) from public.households where id in (${hs})) n;`)[0].n === 0, 'zero temporary business rows')
    }
    for (const user of users) check(!(await admin.auth.admin.deleteUser(user.id)).error, 'own Auth cleanup')
    if (ids.length) check(query(`select count(*) n from auth.users where id in (${ids.map(id => `'${id}'`).join(',')});`)[0].n === 0, 'zero temporary Auth')
    check(fingerprint() === before, 'formal Book and Storage fingerprint unchanged')
    if (existsSync(ledger)) unlinkSync(ledger)
    writeFileSync('qa/backup-remote-result.json', JSON.stringify({ ...finalResult, temporaryRemainder: 0, formalFingerprint: before }, null, 2))
    pass('all temporary Auth/Households/Members/Profiles/Books/Storage zero; formal fingerprints unchanged')
  } catch { console.error('STOP backup cleanup incomplete; preserve ignored ledger'); process.exitCode = 2 }
}
