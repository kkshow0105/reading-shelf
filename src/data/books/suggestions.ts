import { buildSuggestionIndex, emptySuggestions } from '../../lib/suggestions.ts'
import type { SuggestionRecord } from '../../lib/suggestions.ts'
interface SuggestionRepository { listSuggestionFields: (offset: number, limit: number) => Promise<{ fields: SuggestionRecord[]; nextOffset: number | null }> }
export async function loadHouseholdSuggestions(repository: SuggestionRepository, current: () => boolean = () => true) {
  const records: SuggestionRecord[] = []
  let offset: number | null = 0
  do {
    if (!current()) return emptySuggestions()
    const page = await repository.listSuggestionFields(offset, 200)
    if (!current()) return emptySuggestions()
    records.push(...page.fields); offset = page.nextOffset
  } while (offset !== null)
  return buildSuggestionIndex(records)
}
