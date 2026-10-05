import type { ComponentProps } from 'react'
import * as Primitive from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'
export const Dialog = Primitive.Root
export const DialogTrigger = Primitive.Trigger
export const DialogClose = Primitive.Close
export const DialogTitle = Primitive.Title
export const DialogDescription = Primitive.Description
export function DialogContent({ className, children, ...props }: ComponentProps<typeof Primitive.Content>) {
  return <Primitive.Portal><Primitive.Overlay className="overlay" /><Primitive.Content className={cn('dialog-content', className)} {...props}>
    {children}<Primitive.Close className="icon-button overlay-close" aria-label="关闭"><X aria-hidden="true" size={20} /></Primitive.Close>
  </Primitive.Content></Primitive.Portal>
}
