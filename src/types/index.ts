export const statuses = ['想读', '在读', '读完', '暂停', '弃读'] as const
export type ReadingStatus = (typeof statuses)[number]
export type Theme = 'system' | 'light' | 'dark'
export type SortOrder = 'recent' | 'earliest' | 'rating' | 'added' | 'title'
export interface Profile { id: string; name: string; description: string }
export interface Book {
  id: string
  profileId: string
  title: string
  author: string
  translator: string
  status: ReadingStatus
  startedOn: string
  finishedOn: string
  rating: number | null
  note: string
  cover: string
  createdAt: string
}
export interface Filters { statuses: ReadingStatus[]; ratings: string[]; years: string[] }
export type BookDraft = Omit<Book, 'id' | 'profileId' | 'createdAt'>
export type Route =
  | { page: 'profiles' }
  | { page: 'shelf'; profileId: string }
  | { page: 'detail' | 'edit'; profileId: string; bookId: string }
  | { page: 'new'; profileId: string }
