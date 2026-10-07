import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { ComponentProps } from 'react'
import { Input } from './ui/input'
import { matchSuggestions, suggestionCursor } from '../lib/suggestions'

export function SuggestionInput({ id, value, values, onValue, ...props }: Omit<ComponentProps<'input'>, 'value' | 'onChange' | 'id'> & { id: string; value: string; values: string[]; onValue: (value: string) => void }) {
  const [open, setOpen] = useState(false), [cursor, setCursor] = useState(-1)
  const root = useRef<HTMLDivElement>(null), input = useRef<HTMLInputElement>(null)
  const candidates = useMemo(() => matchSuggestions(values, value), [values, value])
  const expanded = open && candidates.length > 0
  const selected = Math.min(cursor, candidates.length - 1)
  const [placement, setPlacement] = useState({ above: false, height: 240 })
  const list = useRef<HTMLDivElement>(null)
  const choose = (value: string) => { onValue(value); setOpen(false); setCursor(-1); input.current?.focus() }
  useEffect(() => {
    const outside = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false) }
    document.addEventListener('pointerdown', outside)
    return () => document.removeEventListener('pointerdown', outside)
  }, [])
  useLayoutEffect(() => {
    if (!expanded) return
    const measure = () => {
      const rect = input.current?.getBoundingClientRect(); if (!rect) return
      const viewport = window.visualViewport, top = viewport?.offsetTop || 0, height = viewport?.height || window.innerHeight
      const below = top + height - rect.bottom - 12, above = rect.top - top - 12
      const upward = below < Math.min(240, candidates.length * 48 + 8) && above > below
      setPlacement({ above: upward, height: Math.max(48, Math.min(240, upward ? above : below)) })
    }
    measure(); window.addEventListener('resize', measure); document.addEventListener('scroll', measure, true)
    window.visualViewport?.addEventListener('resize', measure); window.visualViewport?.addEventListener('scroll', measure)
    return () => { window.removeEventListener('resize', measure); document.removeEventListener('scroll', measure, true); window.visualViewport?.removeEventListener('resize', measure); window.visualViewport?.removeEventListener('scroll', measure) }
  }, [expanded, candidates.length])
  useLayoutEffect(() => {
    const box = list.current, option = box?.querySelector<HTMLElement>('[aria-selected="true"]')
    if (!box || !option) return
    if (option.offsetTop < box.scrollTop) box.scrollTop = option.offsetTop
    else if (option.offsetTop + option.offsetHeight > box.scrollTop + box.clientHeight) box.scrollTop = option.offsetTop + option.offsetHeight - box.clientHeight
  }, [expanded, selected])
  return <div ref={root} className="suggestion-field"><Input {...props} ref={input} id={id} value={value} autoComplete="off" role="combobox" aria-autocomplete="list" aria-haspopup="listbox" aria-expanded={expanded} aria-controls={expanded ? `${id}-suggestions` : undefined} aria-activedescendant={expanded && selected >= 0 ? `${id}-suggestion-${selected}` : undefined}
    onFocus={() => setOpen(true)} onBlur={() => setOpen(false)} onChange={event => { onValue(event.target.value); setOpen(true); setCursor(-1) }} onKeyDown={event => {
      if (event.nativeEvent.isComposing) return
      if ((event.key === 'ArrowDown' || event.key === 'ArrowUp') && candidates.length) { event.preventDefault(); setOpen(true); setCursor(suggestionCursor(selected, event.key, candidates.length)) }
      else if (event.key === 'Enter' && expanded) { event.preventDefault(); choose(candidates[selected >= 0 ? selected : 0]) }
      else if (event.key === 'Escape' && expanded) { event.preventDefault(); event.stopPropagation(); setOpen(false); setCursor(-1) }
    }} />
    {expanded && <div ref={list} id={`${id}-suggestions`} role="listbox" aria-label="历史输入建议" className="suggestion-list" style={{ maxHeight: placement.height, ...(placement.above ? { top: 'auto', bottom: 'calc(100% + 4px)' } : {}) }}>{candidates.map((candidate, index) => <button type="button" role="option" tabIndex={-1} id={`${id}-suggestion-${index}`} aria-selected={index === selected} key={candidate} className="suggestion-option" onPointerDown={event => event.preventDefault()} onClick={() => choose(candidate)}>{candidate}</button>)}</div>}
  </div>
}
