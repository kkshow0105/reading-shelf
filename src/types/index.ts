export const statuses = ['想读', '在读', '读完', '暂停', '弃读'] as const
export type ReadingStatus = (typeof statuses)[number]
export type Theme = 'system' | 'light' | 'dark'
export type SortOrder = 'recent' | 'earliest' | 'rating' | 'added' | 'title'
export interface Profile { id: string; name: string; description: string }
// Non-destructive display alignment: 0 = left/top, 0.5 = center, 1 = right/bottom.
export interface CropPosition { x: number; y: number }
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
  cover: string // Original image source; never replaced with a cropped rendition.
  cropPosition?: CropPosition // Missing on older records means centered display.
  createdAt: string
}
export interface Filters { statuses: ReadingStatus[]; ratings: string[]; years: string[] }
export type BookDraft = Omit<Book, 'id' | 'profileId' | 'createdAt'>
export type Route =
  | { page: 'profiles' }
  | { page: 'shelf'; profileId: string }
  | { page: 'detail' | 'edit'; profileId: string; bookId: string }
  | { page: 'new' | 'backup'; profileId: string }
