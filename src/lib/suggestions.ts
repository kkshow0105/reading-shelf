export const suggestionFields = ['title', 'author', 'translator'] as const
export type SuggestionField = typeof suggestionFields[number]
export interface SuggestionRecord { title: string; author: string; translator: string | null; deletedAt?: string | null }
export type SuggestionIndex = Record<SuggestionField, string[]>
export const emptySuggestions = (): SuggestionIndex => ({ title: [], author: [], translator: [] })
const collator = new Intl.Collator('zh-CN', { numeric: true, sensitivity: 'variant' })
const stableTextOrder = (a: string, b: string) => collator.compare(a, b) || (a < b ? -1 : a > b ? 1 : 0)
export function buildSuggestionIndex(records: SuggestionRecord[]): SuggestionIndex {
  const index = emptySuggestions()
  for (const field of suggestionFields) {
    index[field] = [...new Set(records.filter(row => !row.deletedAt).map(row => (row[field] || '').trim()).filter(Boolean))].sort(stableTextOrder)
  }
  return index
}
export function matchSuggestions(values: string[], query: string, limit = 8): string[] {
  const term = query.trim().toLocaleLowerCase('zh-CN')
  if (!term) return []
  const rank = (value: string) => { const text = value.toLocaleLowerCase('zh-CN'); return text === term ? 0 : text.startsWith(term) ? 1 : 2 }
  return values.filter(value => value.toLocaleLowerCase('zh-CN').includes(term)).sort((a, b) => rank(a) - rank(b) || stableTextOrder(a, b)).slice(0, limit)
}
export function suggestionCursor(current: number, key: 'ArrowDown' | 'ArrowUp', count: number) {
  if (!count) return -1
  if (current < 0) return key === 'ArrowDown' ? 0 : count - 1
  return key === 'ArrowDown' ? (current + 1 + count) % count : (current - 1 + count) % count
}
