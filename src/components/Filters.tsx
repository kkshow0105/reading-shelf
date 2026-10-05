import { useState } from 'react'
import { SlidersHorizontal, ChevronDown } from 'lucide-react'
import { statuses } from '@/types'
import type { Filters as FilterState, SortOrder } from '@/types'
import { emptyFilters } from '@/lib/books'
import { Button } from './ui/button'
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover'
import { Sheet, SheetTrigger, SheetContent, SheetTitle, SheetDescription } from './ui/sheet'
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger, DropdownMenuRadioGroup, DropdownMenuRadioItem } from './ui/dropdown-menu'
import { useMediaQuery } from '@/lib/useMediaQuery'
export const sortNames: Record<SortOrder, string> = { recent: '最近阅读', earliest: '最早阅读', rating: '评分', added: '添加时间', title: '书名' }
export function Filters({ value, onChange, sort, onSort, years }: { value: FilterState; onChange: (value: FilterState) => void; sort: SortOrder; onSort: (sort: SortOrder) => void; years: string[] }) {
  const mobile = useMediaQuery('(max-width: 640px)')
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState<FilterState>(value)
  const count = value.statuses.length + value.ratings.length + value.years.length
  const changeOpen = (next: boolean) => { if (next) setDraft({ statuses: [...value.statuses], ratings: [...value.ratings], years: [...value.years] }); setOpen(next) }
  const toggle = (group: keyof FilterState, value: string) => setDraft(previous => ({ ...previous, [group]: previous[group].includes(value as never) ? previous[group].filter(v => v !== value) : [...previous[group], value] }))
  const body = <><div className="filter-body"><fieldset><legend>阅读状态</legend><div className="filter-options"><Button className="filter-all" aria-label="全部阅读状态" aria-pressed={!draft.statuses.length} onClick={() => setDraft(previous => ({ ...previous, statuses: [] }))}>全部</Button>{statuses.map(status => <label key={status}><input type="checkbox" checked={draft.statuses.includes(status)} onChange={() => toggle('statuses', status)} /><span>{status}</span></label>)}</div></fieldset>
    <fieldset><legend>星级</legend><div className="filter-options">{['5', '4', '3', '2', '1', 'unrated'].map(rating => <label key={rating}><input type="checkbox" checked={draft.ratings.includes(rating)} onChange={() => toggle('ratings', rating)} /><span>{rating === 'unrated' ? '未评分' : `${rating} 星`}</span></label>)}</div></fieldset>
    <fieldset><legend>阅读年份</legend><div className="filter-options">{[...years, 'undated'].map(year => <label key={year}><input type="checkbox" checked={draft.years.includes(year)} onChange={() => toggle('years', year)} /><span>{year === 'undated' ? '未记录日期' : year}</span></label>)}</div></fieldset>
    </div><div className="filter-footer"><Button onClick={() => setDraft(emptyFilters())}>重置</Button><Button onClick={() => setOpen(false)}>取消</Button><Button variant="primary" onClick={() => { onChange(draft); setOpen(false) }}>应用</Button></div></>
  const trigger = <Button className="filter-trigger" aria-label={count ? `筛选，已选 ${count} 项` : '筛选'}><SlidersHorizontal size={17} aria-hidden="true" />筛选{count > 0 && <span className="filter-count">{count}</span>}</Button>
  return <div className="shelf-tools">
    {mobile ? <Sheet open={open} onOpenChange={changeOpen}><SheetTrigger asChild>{trigger}</SheetTrigger><SheetContent><SheetTitle className="overlay-title">筛选书架</SheetTitle><SheetDescription className="overlay-description">找一找，此刻想看的那些书。</SheetDescription>{body}</SheetContent></Sheet> : <Popover open={open} onOpenChange={changeOpen}><PopoverTrigger asChild>{trigger}</PopoverTrigger><PopoverContent align="end" aria-label="筛选书架"><h2 className="filter-heading">筛选书架</h2>{body}</PopoverContent></Popover>}
    {count > 0 && <Button className="clear-filters" onClick={() => onChange(emptyFilters())}>清除筛选</Button>}
    <DropdownMenu><DropdownMenuTrigger asChild><Button aria-label={`排序：${sortNames[sort]}`}>{sortNames[sort]}<ChevronDown size={14} aria-hidden="true" /></Button></DropdownMenuTrigger><DropdownMenuContent align="end" aria-label="书架排序"><DropdownMenuRadioGroup value={sort} onValueChange={value => onSort(value as SortOrder)}>{(Object.keys(sortNames) as SortOrder[]).map(value => <DropdownMenuRadioItem key={value} value={value}>{sortNames[value]}</DropdownMenuRadioItem>)}</DropdownMenuRadioGroup></DropdownMenuContent></DropdownMenu>
  </div>
}
