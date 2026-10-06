import type { BookDraft } from '../../types/index.ts'
import type { StoredBook } from '../remote/contracts.ts'
import { draftColumns } from '../remote/contracts.ts'
import type { createCoverService } from '../remote/cover-service.ts'
import type { BooksRepository } from '../books/model.ts'
import { createBooksService } from '../books/model.ts'
import type { CoverChoice } from './files.ts'

export type CoverSaveResult = { kind: 'saved'; record: StoredBook; coverIssue?: 'upload' | 'link' | 'conflict' } | { kind: 'conflict' }
export function createBookCoverMutations(repository: BooksRepository, covers: ReturnType<typeof createCoverService>, householdId: string, profileId: string) {
  const books = createBooksService(repository, householdId, profileId)
  const scope = (record: StoredBook) => ({ householdId, profileId, bookId: record.book.id })
  const clean = (draft: BookDraft) => ({ ...draft, cover: '' })
  return {
    async create(draft: BookDraft, id: string, choice: CoverChoice): Promise<CoverSaveResult> {
      const created = await books.create(clean(draft), id)
      if (created.kind !== 'saved' || choice.kind !== 'file') return created
      let uploaded
      try { uploaded = await covers.uploadOriginalCover(scope(created.record), choice.file) }
      catch { return { ...created, coverIssue: 'upload' } }
      try {
        const linked = await repository.replaceCover(id, profileId, created.record.updatedAt, uploaded)
        return linked.kind === 'saved' ? linked : { ...created, coverIssue: 'conflict' }
      } catch { return { ...created, coverIssue: 'link' } }
    },
    async update(record: StoredBook, draft: BookDraft, choice: CoverChoice): Promise<CoverSaveResult> {
      if (record.householdId !== householdId || record.book.profileId !== profileId) throw new Error('invalid scope')
      draftColumns(clean(draft))
      if (choice.kind === 'keep') return books.update(record, clean(draft))
      const uploaded = choice.kind === 'file' ? await covers.uploadOriginalCover(scope(record), choice.file) : null
      // One conditional PATCH changes text, reference and position; old objects remain.
      return repository.updateBookWithCover(record.book.id, profileId, record.updatedAt, clean(draft), uploaded)
    },
  }
}
