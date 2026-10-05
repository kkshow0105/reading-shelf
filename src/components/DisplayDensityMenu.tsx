import { ChevronDown } from 'lucide-react'
import { Button } from './ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuTrigger } from './ui/dropdown-menu'
import { useMediaQuery } from '@/lib/useMediaQuery'

export type MobileShelfDensity = 'compact' | 'relaxed'

export function DisplayDensityMenu({ value, onChange }: { value: MobileShelfDensity; onChange: (value: MobileShelfDensity) => void }) {
  const mobile = useMediaQuery('(max-width: 640px)')
  if (!mobile) return null
  return <DropdownMenu><DropdownMenuTrigger asChild><Button className="density-trigger" aria-label={`显示方式：${value === 'compact' ? '紧凑 · 三列' : '舒展 · 两列'}`}>显示<ChevronDown size={14} aria-hidden="true" /></Button></DropdownMenuTrigger>
    <DropdownMenuContent align="end" aria-label="手机书架显示方式"><DropdownMenuRadioGroup value={value} onValueChange={value => onChange(value as MobileShelfDensity)}>
      <DropdownMenuRadioItem value="compact">紧凑 · 三列</DropdownMenuRadioItem>
      <DropdownMenuRadioItem value="relaxed">舒展 · 两列</DropdownMenuRadioItem>
    </DropdownMenuRadioGroup></DropdownMenuContent>
  </DropdownMenu>
}
