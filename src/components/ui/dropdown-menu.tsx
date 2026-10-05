import type { ComponentProps } from 'react'
import * as Primitive from '@radix-ui/react-dropdown-menu'
import { cn } from '@/lib/utils'
export const DropdownMenu = Primitive.Root
export const DropdownMenuTrigger = Primitive.Trigger
export const DropdownMenuRadioGroup = Primitive.RadioGroup
export const DropdownMenuSeparator = Primitive.Separator
export function DropdownMenuContent({ className, sideOffset = 8, ...props }: ComponentProps<typeof Primitive.Content>) {
  return <Primitive.Portal><Primitive.Content sideOffset={sideOffset} collisionPadding={20} className={cn('menu-content', className)} {...props} /></Primitive.Portal>
}
export function DropdownMenuItem({ className, ...props }: ComponentProps<typeof Primitive.Item>) { return <Primitive.Item className={cn('menu-item', className)} {...props} /> }
export function DropdownMenuRadioItem({ className, children, ...props }: ComponentProps<typeof Primitive.RadioItem>) {
  return <Primitive.RadioItem className={cn('menu-item', className)} {...props}><span>{children}</span><Primitive.ItemIndicator className="menu-indicator">✓</Primitive.ItemIndicator></Primitive.RadioItem>
}
