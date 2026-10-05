import type { ComponentProps } from 'react'
import * as Primitive from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'
export const Sheet = Primitive.Root
export const SheetTrigger = Primitive.Trigger
export const SheetClose = Primitive.Close
export const SheetTitle = Primitive.Title
export const SheetDescription = Primitive.Description
export function SheetContent({ className, children, ...props }: ComponentProps<typeof Primitive.Content>) {
  return <Primitive.Portal><Primitive.Overlay className="overlay" /><Primitive.Content className={cn('sheet-content', className)} {...props}>
    {children}<Primitive.Close className="icon-button overlay-close" aria-label="关闭"><X aria-hidden="true" size={20} /></Primitive.Close>
  </Primitive.Content></Primitive.Portal>
}
