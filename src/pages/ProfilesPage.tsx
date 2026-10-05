import { ArrowUpRight } from 'lucide-react'
import type { Book, Profile } from '@/types'
import { BookCover } from '@/components/BookCover'
import { readingDate } from '@/lib/books'
export function ProfilesPage({ profiles, books, onNavigate }: { profiles: Profile[]; books: Book[]; onNavigate: (path: string) => void }) {
  return <main id="main-content" className="profiles-page page-shell page-enter" tabIndex={-1}>
    <div className="profiles-intro"><span className="editorial-label">EX LIBRIS · 私人藏书</span><h1>进入谁的书房？</h1><p>每个人，都有自己的阅读记忆。</p></div>
    <div className="profile-grid">{profiles.map((profile, index) => {
      const ownBooks = books.filter(book => book.profileId === profile.id)
      const latest = [...ownBooks].sort((a, b) => readingDate(b).localeCompare(readingDate(a)))[0]
      const completed = ownBooks.filter(book => book.status === '读完').length
      return <a className="profile-entry" key={profile.id} href={`#/p/${profile.id}/shelf`} onClick={e => { e.preventDefault(); onNavigate(`/p/${profile.id}/shelf`) }} aria-label={`进入${profile.name}的书房，已读 ${completed} 本`}>
        <div className="profile-copy"><span className="profile-index">0{index + 1} / 书房</span><h2>{profile.name}<ArrowUpRight size={19} aria-hidden="true" /></h2><p className="profile-read-count"><span>{completed}</span> 本读完</p><div className="profile-recent"><span>最近阅读</span><p>{latest ? latest.title : '第一本书，尚未入架。'}</p></div></div>
        {latest && <BookCover title={latest.title} author={latest.author} cover={latest.cover} decorative className="profile-cover" />}
      </a>
    })}</div>
    <p className="profile-footnote">各自的书单，共同的书房。</p>
  </main>
}
