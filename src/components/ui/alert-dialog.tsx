import type { ComponentProps } from 'react'
import * as Primitive from '@radix-ui/react-alert-dialog'
import { cn } from '@/lib/utils'
export const AlertDialog = Primitive.Root
export const AlertDialogTrigger = Primitive.Trigger
export const AlertDialogTitle = Primitive.Title
export const AlertDialogDescription = Primitive.Description
export function AlertDialogContent({ className, ...props }: ComponentProps<typeof Primitive.Content>) {
  return <Primitive.Portal><Primitive.Overlay className="overlay" /><Primitive.Content className={cn('dialog-content', className)} {...props} /></Primitive.Portal>
}
export function AlertDialogAction({ className, ...props }: ComponentProps<typeof Primitive.Action>) { return <Primitive.Action className={cn('button button-danger', className)} {...props} /> }
export function AlertDialogCancel({ className, ...props }: ComponentProps<typeof Primitive.Cancel>) { return <Primitive.Cancel className={cn('button button-outline', className)} {...props} /> }
