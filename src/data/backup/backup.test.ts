import test from 'node:test'
import assert from 'node:assert/strict'
import { zipSync, unzipSync } from 'fflate'
import { crossCheck, jsonBytes, openArchive, packArchive, sha256 } from './archive.ts'
import { csvCell, exportCsv, exportComplete } from './export.ts'
import { safeArchivePath, validateStructured } from './validation.ts'
import { inspectTarget, RestoreSession } from './restore.ts'
import type { BackupRepository } from './repository.ts'
import type { BackupManifestV1, StructuredBackupV1 } from './types.ts'

const hh = '11111111-1111-4111-8111-111111111111', pp = '22222222-2222-4222-8222-222222222222', bb = '33333333-3333-4333-8333-333333333333'
const time = '2026-10-06T01:02:03.123456+00:00'
function data(): StructuredBackupV1 { return { format: 'reading-shelf-structured-export', formatVersion: 1, createdAt: time, coverFilesIncluded: false,
  household: { id: hh, name: '测试书房', originalCreatedAt: time, originalUpdatedAt: time }, profiles: [{ id: pp, name: '测试甲', sortOrder: 0, archivedAt: null, originalCreatedAt: time, originalUpdatedAt: time }],
  books: [{ id: bb, profileId: pp, title: '中文,"书名"', author: '作者', translator: '', status: 'finished', startedOn: null, finishedOn: '2026-09-28', rating: null, notes: '第一行\n第二行', cropPosition: { x: .25, y: .75 }, cover: null,
    originalCreatedAt: time, originalUpdatedAt: time, deletedAt: null, deletedByOriginal: null }] } }
async function fixture() {
  const source = data(), content = jsonBytes(source), files = new Map([['data/structured-data.json', content]])
  const manifest: BackupManifestV1 = { format: 'reading-shelf-backup', formatVersion: 1, createdAt: time, backupStartedAt: time, backupCompletedAt: time, source: 'supabase', household: { id: hh, name: source.household.name },
    profileCount: 1, bookCount: 1, activeBookCount: 1, softDeletedBookCount: 0, coverFileCount: 0, referencedCoverFileCount: 0, historicalCoverFileCount: 0,
    backupIncludes: ['structuredData', 'covers', 'softDeletedRecords', 'historicalOriginals'], hashAlgorithm: 'SHA-256', restoreHistoricalCovers: 'keep-in-zip',
    files: [{ kind: 'data', path: 'data/structured-data.json', size: content.length, sha256: await sha256(content) }] }
  return { source, manifest, files, bytes: await packArchive(manifest, files) }
}
test('真实 ZIP roundtrip 保留中文、换行、null、微秒原时间和非居中位置', async () => {
  const f = await fixture(), opened = await openArchive(f.bytes)
  assert.deepEqual(opened.data, f.source); assert.equal(opened.identity.length, 64)
  assert.deepEqual([...opened.files.keys()], ['data/structured-data.json'])
})
test('SHA-256 使用实际 UTF8 原始字节', async () => { assert.equal(await sha256(new TextEncoder().encode('abc')), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad') })
for (const kind of ['json-damaged', 'json-hash', 'missing-data', 'future', 'missing-manifest', 'unexpected', 'traversal', 'windows-path'] as const) {
  test(`ZIP 拒绝 ${kind}，校验阶段无写入接口`, async () => {
    const f = await fixture(), input = unzipSync(f.bytes)
    if (kind === 'json-damaged') input['data/structured-data.json'][0] = 120
    if (kind === 'json-hash') input['data/structured-data.json'][50] ^= 1
    if (kind === 'missing-data') delete input['data/structured-data.json']
    if (kind === 'missing-manifest') delete input['manifest.json']
    if (kind === 'future') input['manifest.json'] = jsonBytes({ ...f.manifest, formatVersion: 2 })
    if (kind === 'unexpected') input['unknown.txt'] = new Uint8Array([1])
    if (kind === 'traversal') input['../../evil'] = new Uint8Array([1])
    if (kind === 'windows-path') input['C:\\evil'] = new Uint8Array([1])
    await assert.rejects(openArchive(zipSync(input, { level: 0 })))
  })
}
test('Zip bomb：库提供的 originalSize 在分配/解压之前受限', async () => {
  const input = zipSync({ 'manifest.json': new Uint8Array(2 * 1024 * 1024 + 1) }, { level: 9 })
  await assert.rejects(openArchive(input), /安全上限/)
})
test('原始路径拒绝绝对路径、反斜杠、空目录、dot 和编码歧义', () => {
  for (const path of ['/root', 'a/../b', 'a/./b', 'a//b', 'a\\b', '%2e%2e/x', 'a\u0000b']) assert.throws(() => safeArchivePath(path))
})
test('结构化格式拒绝凭据/未知字段、跨档案引用、重复 ID 和越界位置', () => {
  const cases = [Object.assign(data(), { session: 'secret' }), { ...data(), books: [data().books[0], data().books[0]] },
    { ...data(), books: [{ ...data().books[0], profileId: hh }] }, { ...data(), books: [{ ...data().books[0], cropPosition: { x: 2, y: .5 } }] }]
  cases.forEach(source => assert.throws(() => validateStructured(source)))
})
test('manifest 数量/引用必须与数据一致', async () => { const f = await fixture(); assert.throws(() => crossCheck({ ...f.manifest, bookCount: 2 }, f.source)); assert.throws(() => crossCheck({ ...f.manifest, household: { id: pp, name: '其他' } }, f.source)) })
test('CSV BOM / 中文 / null / 逗号双引号换行，全部正确转义', () => {
  const csv = exportCsv(data()); assert.equal(csv.charCodeAt(0), 0xfeff); assert.ok(csv.includes('"中文,""书名"""')); assert.ok(csv.includes('"第一行\n第二行"')); assert.ok(csv.includes('"评分"')); assert.ok(!csv.includes('null'))
})
test('CSV 阻止空白和控制符前缀的公式，JSON 原文不变', () => {
  for (const value of ['=SUM(1,2)', '+cmd', '-1+1', '@a', ' \t=1', '\r@a']) assert.equal(csvCell(value), `"'${value}"`)
  const source = data(); source.books[0].notes = '=1+1'; assert.ok(exportCsv(source).includes("'=1+1")); assert.equal(source.books[0].notes, '=1+1')
})
test('目标有软删除记录或旧原图仍被阻止；空白同数档案另一个书房才允许', async () => {
  const f = await fixture(), backup = await openArchive(f.bytes)
  const repo = (allowed: boolean, count = 1, householdId = pp) => ({ householdId, target: async () => ({ allowed, profiles: Array.from({ length: count }, () => ({ id: bb })), bookCount: allowed ? 0 : 1, objectCount: allowed ? 0 : 1 }) }) as unknown as BackupRepository
  assert.equal((await inspectTarget(repo(false), hh, backup)).allowed, false)
  assert.equal((await inspectTarget(repo(true, 2), hh, backup)).allowed, false)
  assert.equal((await inspectTarget(repo(true, 1, hh), hh, backup)).allowed, false)
  assert.equal((await inspectTarget(repo(true), hh, backup)).allowed, true)
})
test('云端原图下载失败不返回完整 ZIP', async () => {
  const repo = { householdId: hh, snapshot: async () => data(), objects: async () => [{ path: `${hh}/${pp}/${bb}/original/44444444-4444-4444-8444-444444444444.png`, profileId: pp, bookId: bb, size: 10, mimeType: 'image/png' }],
    client: { storage: { from: () => ({ download: async () => ({ data: null, error: { code: 'network' } }) }) } } } as unknown as BackupRepository
  await assert.rejects(exportComplete(repo))
})
test('备份期间数据变化拒绝打包；已取消操作不下载', async () => {
  let reads = 0
  const repo = { snapshot: async () => { const source = data(); if (reads++) source.books[0].notes = '其他设备修改'; return source }, objects: async () => [] } as unknown as BackupRepository
  await assert.rejects(exportComplete(repo), /书房发生变化/)
  const controller = new AbortController(); controller.abort()
  await assert.rejects(exportComplete(repo, () => {}, controller.signal), /取消/)
})
test('恢复预览后目标空档案变动时在任何写入前停止', async () => {
  const f = await fixture(), backup = await openArchive(f.bytes)
  const repo = { householdId: pp, target: async () => ({ allowed: true, profiles: [{ id: bb, updated_at: time }], bookCount: 0, objectCount: 0 }) } as unknown as BackupRepository
  const job = new RestoreSession(repo, hh, backup, [{ id: bb, updatedAt: '2026-10-01T00:00:00Z' }])
  await assert.rejects(job.run(), /空档案发生变化/)
})
