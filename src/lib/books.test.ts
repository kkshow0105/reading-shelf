import test from 'node:test'
import assert from 'node:assert/strict'
import { selectBooks, emptyFilters, readingDate, blankDraft, validateDraft, toDraft } from './books.ts'
import { normalizeCropPosition } from './covers.ts'
import type { Book } from '../types/index.ts'
const book = (values: Partial<Book>): Book => ({ ...blankDraft(), id: 'a', profileId: 'one', title: '悉达多', author: '赫尔曼·黑塞', translator: '姜乙', createdAt: '2026-10-01T00:00:00Z', ...values })
test('同名记录不会跨档案搜索或改变输入列表', () => {
  const records = [book({ id: 'a', rating: 5 }), book({ id: 'b', profileId: 'two', rating: 3 })]
  assert.deepEqual(selectBooks(records, 'one', '姜乙', emptyFilters(), 'rating').map(b => b.id), ['a'])
  assert.equal(records[1].rating, 3)
})
test('最近和最早阅读都将未知日期置末，不使用添加时间冒充阅读日期', () => {
  const records = [book({ id: 'none', createdAt: '2026-10-05T00:00:00Z' }), book({ id: 'older', startedOn: '2025-01-01' }), book({ id: 'newer', status: '读完', startedOn: '2025-02-01', finishedOn: '2026-01-01' })]
  assert.deepEqual(selectBooks(records, 'one', '', emptyFilters(), 'recent').map(b => b.id), ['newer', 'older', 'none'])
  assert.deepEqual(selectBooks(records, 'one', '', emptyFilters(), 'earliest').map(b => b.id), ['older', 'newer', 'none'])
  assert.equal(readingDate(records[2]), '2026-01-01')
})
test('未评分和无日期可以筛选，评分排序保持未评分在末尾', () => {
  const records = [book({ id: 'unrated' }), book({ id: 'five', rating: 5 })]
  assert.deepEqual(selectBooks(records, 'one', '', { statuses: ['想读'], ratings: ['unrated'], years: ['undated'] }, 'recent').map(b => b.id), ['unrated'])
  assert.equal(selectBooks(records, 'one', '', emptyFilters(), 'rating')[0].id, 'five')
})
test('必填与日期先后校验，未评分及未知日期允许保存', () => {
  assert.ok(validateDraft(blankDraft()).title)
  assert.deepEqual(validateDraft({ ...blankDraft(), title: '窄门', author: '纪德' }), {})
  assert.ok(validateDraft({ ...blankDraft(), title: '窄门', author: '纪德', startedOn: '2025-02-01', finishedOn: '2025-01-01' }).finishedOn)
})
test('封面原始引用与位置经过编辑保留，旧记录默认居中且草稿不共用位置对象', () => {
  const original = book({ cover: 'blob:original-image', cropPosition: { x: 0.25, y: 0.75 } })
  const draft = toDraft(original)
  assert.equal(draft.cover, original.cover)
  assert.deepEqual(draft.cropPosition, original.cropPosition)
  assert.notEqual(draft.cropPosition, original.cropPosition)
  assert.deepEqual(toDraft(book({ cropPosition: undefined })).cropPosition, { x: 0.5, y: 0.5 })
  assert.deepEqual(blankDraft().cropPosition, { x: 0.5, y: 0.5 })
  assert.deepEqual(normalizeCropPosition({ x: -1, y: Number.NaN }), { x: 0, y: 0.5 })
})
