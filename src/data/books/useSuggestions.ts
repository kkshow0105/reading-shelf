import { useEffect, useMemo, useRef, useState } from 'react'
import { getSupabaseClient } from '../../lib/supabase'
import { emptySuggestions } from '../../lib/suggestions'
import { createRepositories } from '../remote/repositories'
import { loadHouseholdSuggestions } from './suggestions'
export function useHouseholdSuggestions(householdId: string, formKey: string, onFailure: (reason: unknown) => void) {
  const repository = useMemo(() => createRepositories(getSupabaseClient(), householdId).books, [householdId])
  const [state, setState] = useState({ index: emptySuggestions(), unavailable: false })
  const failure = useRef(onFailure); failure.current = onFailure
  useEffect(() => {
    let active = true
    setState({ index: emptySuggestions(), unavailable: false })
    if (formKey) void loadHouseholdSuggestions(repository, () => active).then(index => { if (active) setState({ index, unavailable: false }) })
      .catch(reason => { if (active) { setState({ index: emptySuggestions(), unavailable: true }); failure.current(reason) } })
    return () => { active = false }
  }, [repository, formKey])
  return state
}
