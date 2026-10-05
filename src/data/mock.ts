import type { Book, Profile } from '@/types'
export const profiles: Profile[] = [
  { id: 'lin', name: '林予', description: '文学、哲学，与一些旧日的故事。' },
  { id: 'chen', name: '陈禾', description: '慢慢读，偶尔写几句。' },
]
const books: Omit<Book, 'profileId'>[] = [
  { id: 'siddhartha', title: '悉达多', author: '赫尔曼·黑塞', translator: '姜乙', status: '读完', startedOn: '2026-09-20', finishedOn: '2026-09-28', rating: 5, note: '读到最后，留下的不是一个答案，而是河水的声音。\n\n有些书不需要急着理解。把它放在手边，在不同的日子重新翻开，或许会看见不同的自己。', cover: '/covers/siddhartha.svg', createdAt: '2026-09-20T09:00:00+08:00' },
  { id: 'sisyphus', title: '西西弗神话', author: '阿尔贝·加缪', translator: '杜小真', status: '读完', startedOn: '2026-09-06', finishedOn: '2026-09-18', rating: 4, note: '缓慢地读了两遍。生活中的重复，偶尔也能有自己的重量。', cover: '/covers/sisyphus.svg', createdAt: '2026-09-06T09:00:00+08:00' },
  { id: 'stranger', title: '局外人', author: '阿尔贝·加缪', translator: '柳鸣九', status: '读完', startedOn: '2026-08-25', finishedOn: '2026-08-30', rating: 5, note: '很短，却读了很久。那些看似平静的句子，合上书之后还在回响。', cover: '/covers/stranger.svg', createdAt: '2026-08-25T09:00:00+08:00' },
  { id: 'gate', title: '窄门', author: '安德烈·纪德', translator: '桂裕芳', status: '在读', startedOn: '2026-09-24', finishedOn: '', rating: null, note: '', cover: '/covers/gate.svg', createdAt: '2026-09-24T09:00:00+08:00' },
  { id: 'plague', title: '鼠疫', author: '阿尔贝·加缪', translator: '刘方', status: '读完', startedOn: '2025-12-08', finishedOn: '2025-12-22', rating: 4, note: '记住了那些普通人的选择。读完之后，更愿意认真对待身边的小事。', cover: '/covers/plague.svg', createdAt: '2025-12-08T09:00:00+08:00' },
  { id: 'veil', title: '面纱', author: '威廉·萨默塞特·毛姆', translator: '', status: '暂停', startedOn: '2026-08-14', finishedOn: '', rating: 3, note: '暂时停在中间，等一个更安静的周末。', cover: '/covers/veil.svg', createdAt: '2026-08-14T09:00:00+08:00' },
  { id: 'moon', title: '月亮与六便士', author: '威廉·萨默塞特·毛姆', translator: '傅惟慈', status: '读完', startedOn: '2026-07-05', finishedOn: '2026-07-16', rating: 4, note: '理想与日常之间，没有简单的刻度。喜欢它留下的疑问。', cover: '/covers/moon.svg', createdAt: '2026-07-05T09:00:00+08:00' },
  { id: 'zarathustra', title: '查拉图斯特拉如是说：一本为所有人而写、又不为任何人而写的书', author: '弗里德里希·尼采', translator: '钱春绮', status: '想读', startedOn: '', finishedOn: '', rating: null, note: '', cover: '/covers/zarathustra.svg', createdAt: '2026-09-30T09:00:00+08:00' },
  { id: 'lightness', title: '不能承受的生命之轻', author: '米兰·昆德拉', translator: '许钧', status: '读完', startedOn: '2026-06-02', finishedOn: '2026-06-22', rating: 5, note: '有些选择在发生时很轻，在回忆里却越来越重。留给下一次重读。', cover: '/covers/lightness.svg', createdAt: '2026-06-02T09:00:00+08:00' },
  { id: 'human', title: '人间失格', author: '太宰治', translator: '', status: '弃读', startedOn: '2024-09-08', finishedOn: '2024-09-12', rating: 3, note: '这一次没有读完。也允许自己和一本书暂时保持距离。', cover: '/covers/human.svg', createdAt: '2024-09-08T09:00:00+08:00' },
  { id: 'solitude', title: '百年孤独', author: '加西亚·马尔克斯', translator: '范晔', status: '想读', startedOn: '', finishedOn: '', rating: null, note: '', cover: '/covers/solitude.svg', createdAt: '2026-08-20T09:00:00+08:00' },
  { id: 'sea', title: '老人与海', author: '欧内斯特·海明威', translator: '', status: '读完', startedOn: '2026-08-31', finishedOn: '2026-09-02', rating: 4, note: '短短一程，像在海边坐了一个下午。', cover: '/covers/sea.svg', createdAt: '2026-08-31T09:00:00+08:00' },
]
export function createMockBooks(): Book[] {
  const first = books.map(book => ({ ...book, id: `lin-${book.id}`, profileId: 'lin' }))
  const second = books.slice(0, 8).map((book, index) => ({ ...book, id: `chen-${book.id}`, profileId: 'chen', rating: index % 3 === 0 ? null : index % 2 === 0 ? 3 : 5, status: (index === 0 ? '在读' : index === 5 ? '想读' : '读完') as Book['status'], startedOn: index === 5 ? '' : '2026-08-01', finishedOn: index === 0 || index === 5 ? '' : `2026-08-${String(10 + index).padStart(2, '0')}`, note: index === 1 ? '同一本书，在不同人的心里会留下不同的痕迹。' : '' }))
  return [...first, ...second]
}
