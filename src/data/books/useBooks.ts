import { useCallback, useEffect, useRef, useState } from 'react'
import type { StoredBook } from '../remote/contracts'
import { bookMessage, RequestSequence } from './model'
import type { BooksService } from './model'

export function useBooks(service: BooksService, onFailure: (error: unknown) => void) {
  const [records, setRecords] = useState<StoredBook[]>([])
  const [loading, setLoading] = useState(true), [error, setError] = useState<string | null>(null)
  const sequence = useRef(new RequestSequence())
  const failure = useRef(onFailure); failure.current = onFailure
  const reload = useCallback(async () => {
    const token = sequence.current.begin()
    setLoading(true); setError(null)
    try {
      const loaded = await service.list(() => sequence.current.current(token))
      if (sequence.current.current(token)) setRecords(loaded)
    } catch (reason) {
      if (sequence.current.current(token)) { setRecords([]); setError(bookMessage(reason)); failure.current(reason) }
    } finally { if (sequence.current.current(token)) setLoading(false) }
  }, [service])
  useEffect(() => { void reload(); return () => sequence.current.cancel() }, [reload])
  // A confirmed server mutation supersedes any list request already in flight.
  const accept = (record: StoredBook) => {
    const needsFullList = loading || error !== null
    sequence.current.begin()
    setLoading(false); setError(null)
    setRecords(previous => record.deletedAt ? previous.filter(item => item.book.id !== record.book.id)
      : [...previous.filter(item => item.book.id !== record.book.id), record])
    // An interrupted first load must still fetch the OTHER records in this profile.
    if (needsFullList) void reload()
  }
  return { records, loading, error, reload, accept }
}
