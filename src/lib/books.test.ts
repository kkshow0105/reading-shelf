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
test('最早阅读仍将未知日期置末，阅读日期展示不使用创建时间', () => {
  const records = [book({ id: 'none', createdAt: '2026-10-05T00:00:00Z' }), book({ id: 'older', startedOn: '2025-01-01' }), book({ id: 'newer', status: '读完', startedOn: '2025-02-01', finishedOn: '2026-01-01' })]
  assert.deepEqual(selectBooks(records, 'one', '', emptyFilters(), 'earliest').map(b => b.id), ['older', 'newer', 'none'])
  assert.equal(readingDate(records[2]), '2026-01-01')
})
test('最近阅读按在读、读完、暂停/弃读、想读分组，不被其他组的新日期打乱', () => {
  const records = [book({ id: 'want', createdAt: '2026-10-07T00:00:00Z' }), book({ id: 'abandoned', status: '弃读' }), book({ id: 'finished', status: '读完', finishedOn: '2026-10-01' }), book({ id: 'reading', status: '在读', startedOn: '2024-01-01' }), book({ id: 'paused', status: '暂停', createdAt: '2026-10-02T00:00:00Z' })]
  assert.deepEqual(selectBooks(records, 'one', '', emptyFilters(), 'recent').map(b => b.id), ['reading', 'finished', 'paused', 'abandoned', 'want'])
})
test('在读真实开始日优先，按开始日降序；无开始日按创建时间降序', () => {
  const records = [book({ id: 'none-old', status: '在读', createdAt: '2026-09-01T00:00:00Z' }), book({ id: 'dated-old', status: '在读', startedOn: '2024-01-01' }), book({ id: 'none-new', status: '在读', createdAt: '2026-10-07T00:00:00Z' }), book({ id: 'dated-new', status: '在读', startedOn: '2025-01-01' })]
  assert.deepEqual(selectBooks(records, 'one', '', emptyFilters(), 'recent').map(b => b.id), ['dated-new', 'dated-old', 'none-new', 'none-old'])
})
test('读完按完成日、缺失则创建时间比较，不误用开始日', () => {
  const records = [book({ id: 'dated-old', status: '读完', finishedOn: '2025-01-01' }), book({ id: 'none', status: '读完', startedOn: '2020-01-01', createdAt: '2026-08-01T12:00:00Z' }), book({ id: 'dated-new', status: '读完', finishedOn: '2026-09-01' })]
  assert.deepEqual(selectBooks(records, 'one', '', emptyFilters(), 'recent').map(b => b.id), ['dated-new', 'none', 'dated-old'])
})
test('暂停与弃读共用创建时间顺序，想读按创建时间且始终最后', () => {
  const records = [book({ id: 'want-new', createdAt: '2026-10-07T00:00:00Z', startedOn: '2026-10-07' }), book({ id: 'paused', status: '暂停', createdAt: '2026-08-01T00:00:00Z' }), book({ id: 'abandoned', status: '弃读', createdAt: '2026-09-01T00:00:00Z' }), book({ id: 'want-old', createdAt: '2026-01-01T00:00:00Z' })]
  assert.deepEqual(selectBooks(records, 'one', '', emptyFilters(), 'recent').map(b => b.id), ['abandoned', 'paused', 'want-new', 'want-old'])
})
test('相同日期/创建时间使用id稳定打破并列，输入顺序反转不影响结果', () => {
  for (const status of ['在读', '读完', '暂停', '弃读', '想读'] as const) {
    const records = [book({ id: 'b', status, startedOn: '2025-01-01', finishedOn: status === '读完' ? '2026-01-01' : '' }), book({ id: 'a', status, startedOn: '2025-01-01', finishedOn: status === '读完' ? '2026-01-01' : '' })]
    assert.deepEqual(selectBooks(records, 'one', '', emptyFilters(), 'recent').map(b => b.id), ['a', 'b'])
    assert.deepEqual(selectBooks([...records].reverse(), 'one', '', emptyFilters(), 'recent').map(b => b.id), ['a', 'b'])
    assert.deepEqual(records.map(b => b.id), ['b', 'a'])
  }
})
test('其他排序不采用状态优先；日期/评分/添加/书名原语义保留', () => {
  const records = [book({ id: 'z', title: 'Z', status: '在读', startedOn: '2024-01-01', rating: 1, createdAt: '2024-01-01T00:00:00Z' }), book({ id: 'a', title: 'A', status: '读完', finishedOn: '2026-01-01', rating: 5, createdAt: '2026-01-01T00:00:00Z' })]
  for (const mode of ['rating', 'added', 'title'] as const) assert.equal(selectBooks(records, 'one', '', emptyFilters(), mode)[0].id, 'a')
  assert.equal(selectBooks(records, 'one', '', emptyFilters(), 'earliest')[0].id, 'z')
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
