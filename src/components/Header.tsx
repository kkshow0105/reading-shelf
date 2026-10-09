import { useState, useRef, useEffect } from 'react'
import { Search, X, ChevronDown, Moon, Sun, Check, Plus } from 'lucide-react'
import type { Profile, Theme } from '@/types'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuSeparator } from './ui/dropdown-menu'
import { Sheet, SheetContent, SheetDescription, SheetTitle } from './ui/sheet'
import { useMediaQuery } from '@/lib/useMediaQuery'
import { usePwa } from '@/pwa/PwaProvider'

const themeNames: Record<Theme, string> = { light: '暖纸书房', dark: '夜航玻璃' }
function ThemeMenu({ theme, onTheme }: { theme: Theme; onTheme: (theme: Theme) => void }) {
  const Icon = theme === 'dark' ? Moon : Sun
  return <DropdownMenu><DropdownMenuTrigger asChild><Button className="icon-button" aria-label={`外观：${themeNames[theme]}`}><Icon size={18} aria-hidden="true" /></Button></DropdownMenuTrigger>
    <DropdownMenuContent align="end" aria-label="外观"><DropdownMenuRadioGroup value={theme} onValueChange={value => onTheme(value as Theme)}>
      {(Object.keys(themeNames) as Theme[]).map(value => <DropdownMenuRadioItem value={value} key={value}>{themeNames[value]}</DropdownMenuRadioItem>)}
    </DropdownMenuRadioGroup></DropdownMenuContent></DropdownMenu>
}
export function Header({ profiles, profile, shelf = false, query = '', onQuery, theme, onTheme, onNavigate, onLogout, logoutBusy }: { profiles: Profile[]; profile?: Profile; shelf?: boolean; query?: string; onQuery?: (query: string) => void; theme: Theme; onTheme: (theme: Theme) => void; onNavigate: (path: string) => void; onLogout?: () => void; logoutBusy?: boolean }) {
  const compact = useMediaQuery('(max-width: 1024px)')
  const pwa = usePwa()
  const [switchOpen, setSwitchOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const searchRef = useRef<HTMLInputElement>(null)
  const profileRef = useRef<HTMLButtonElement>(null)
  useEffect(() => { if (searchOpen) searchRef.current?.focus() }, [searchOpen])
  useEffect(() => setSearchOpen(false), [profile?.id, shelf])
  const chooseProfile = (id: string) => { setSwitchOpen(false); onNavigate(`/p/${id}/shelf`) }
  return <header className="site-header">
    <a className="skip-link" href="#main-content" onClick={event => { event.preventDefault(); const main = document.getElementById('main-content'); main?.focus({ preventScroll: true }); main?.scrollIntoView({ block: 'start' }) }}>跳到主要内容</a>
    <div className="header-inner page-shell">
      <a className="wordmark" href="#/profiles" onClick={e => { e.preventDefault(); onNavigate('/profiles') }}>私人书架<span className="wordmark-english">READING SHELF</span></a>
      {profile && !compact && <DropdownMenu><DropdownMenuTrigger asChild><Button className="profile-trigger" aria-label={`切换阅读档案，当前${profile.name}`}>{profile.name}<ChevronDown size={14} aria-hidden="true" /></Button></DropdownMenuTrigger>
        <DropdownMenuContent align="start" aria-label="阅读档案">{profiles.map(p => <DropdownMenuItem key={p.id} onSelect={() => chooseProfile(p.id)}>{p.name}{p.id === profile.id && <Check size={16} aria-hidden="true" />}</DropdownMenuItem>)}<DropdownMenuSeparator className="menu-separator" /><DropdownMenuItem onSelect={() => onNavigate('/profiles')}>所有书房</DropdownMenuItem><DropdownMenuItem onSelect={() => onNavigate(`/p/${profile.id}/backup`)}>数据与备份</DropdownMenuItem>{onLogout && <DropdownMenuItem disabled={logoutBusy} onSelect={onLogout}>{logoutBusy ? '正在退出…' : '退出登录'}</DropdownMenuItem>}</DropdownMenuContent>
      </DropdownMenu>}
      <div className="header-actions">
        {onLogout && !profile && <Button className="logout-link" disabled={logoutBusy} onClick={onLogout}>{logoutBusy ? '正在退出…' : '退出登录'}</Button>}
        {shelf && !compact && <div className="search-box"><Search size={18} aria-hidden="true" /><Input aria-label="搜索书名、作者、译者" placeholder="搜索书名、作者、译者" value={query} onChange={e => onQuery?.(e.target.value)} />{query && <Button className="icon-button" aria-label="清除搜索" onClick={() => onQuery?.('')}><X size={16} aria-hidden="true" /></Button>}</div>}
        {shelf && compact && <Button className="icon-button" aria-label={searchOpen ? '收起搜索' : '搜索书架'} aria-expanded={searchOpen} onClick={() => setSearchOpen(!searchOpen)}><Search size={20} aria-hidden="true" /></Button>}
        {shelf && !compact && <Button variant="primary" onClick={() => onNavigate(`/p/${profile!.id}/new`)}><Plus size={17} aria-hidden="true" />添一本书</Button>}
        {compact && profile ? <Button ref={profileRef} className="profile-mark" aria-label={`切换阅读档案，当前${profile.name}`} onClick={() => setSwitchOpen(true)}>{profile.name}<ChevronDown size={14} aria-hidden="true" /></Button> : <ThemeMenu theme={theme} onTheme={onTheme} />}
      </div>
    </div>
    {shelf && compact && searchOpen && <div className="mobile-search page-shell"><div className="search-box"><Search size={18} aria-hidden="true" /><Input ref={searchRef} aria-label="搜索书名、作者、译者" placeholder="搜索书名、作者、译者" value={query} onChange={e => onQuery?.(e.target.value)} />{query && <Button className="icon-button" aria-label="清除搜索" onClick={() => onQuery?.('')}><X size={16} aria-hidden="true" /></Button>}</div><Button onClick={() => setSearchOpen(false)}>收起</Button></div>}
    <Sheet open={switchOpen} onOpenChange={setSwitchOpen}><SheetContent onCloseAutoFocus={event => { event.preventDefault(); profileRef.current?.focus() }}><SheetTitle className="overlay-title">换一间书房</SheetTitle><SheetDescription className="overlay-description">每个人，都有自己的阅读记忆。</SheetDescription>
      <div className="profile-choices">{profiles.map(p => <Button className="profile-choice" key={p.id} onClick={() => chooseProfile(p.id)}>{p.name}{p.id === profile?.id && <span className="current-profile">当前书房 <Check size={16} aria-hidden="true" /></span>}</Button>)}</div>
      <Button className="all-profiles" onClick={() => { setSwitchOpen(false); onNavigate('/profiles') }}>所有书房</Button>
      <Button className="all-profiles" onClick={() => { setSwitchOpen(false); if (profile) onNavigate(`/p/${profile.id}/backup`) }}>数据与备份</Button><div className="sheet-theme"><label htmlFor="mobile-theme">外观</label><select id="mobile-theme" className="native-select" value={theme} onChange={e => onTheme(e.target.value as Theme)}>{(Object.keys(themeNames) as Theme[]).map(value => <option key={value} value={value}>{themeNames[value]}</option>)}</select></div>
      {pwa?.canInstall && <Button className="all-profiles" onClick={() => { setSwitchOpen(false); pwa.install() }}>安装私人书架</Button>}
      {onLogout && <Button className="logout-link" disabled={logoutBusy} onClick={() => { setSwitchOpen(false); onLogout() }}>{logoutBusy ? '正在退出…' : '退出登录'}</Button>}
    </SheetContent></Sheet>
  </header>
}
