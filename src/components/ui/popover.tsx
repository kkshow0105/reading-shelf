import type { ComponentProps } from 'react'
import * as Primitive from '@radix-ui/react-popover'
import { cn } from '@/lib/utils'
export const Popover = Primitive.Root
export const PopoverTrigger = Primitive.Trigger
export const PopoverClose = Primitive.Close
export function PopoverContent({ className, sideOffset = 8, ...props }: ComponentProps<typeof Primitive.Content>) {
  return <Primitive.Portal><Primitive.Content sideOffset={sideOffset} collisionPadding={20} className={cn('popover-content', className)} {...props} /></Primitive.Portal>
}
