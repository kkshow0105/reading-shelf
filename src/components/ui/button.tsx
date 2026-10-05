import type { ComponentProps } from 'react'
import { cn } from '@/lib/utils'

// Adapted from shadcn/ui: keep native semantics, replace default visual tokens.
export function Button({ className, variant = 'quiet', type = 'button', ...props }: ComponentProps<'button'> & { variant?: 'quiet' | 'primary' | 'outline' | 'danger' }) {
  return <button type={type} className={cn('button', `button-${variant}`, className)} {...props} />
}
