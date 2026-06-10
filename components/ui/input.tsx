import * as React from 'react'

import { cn } from '@/lib/utils'

function Input({ className, type, ...props }: React.ComponentProps<'input'>) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        'file:text-foreground placeholder:text-muted-foreground selection:bg-primary/15 selection:text-foreground border-input h-9 w-full min-w-0 rounded-none border bg-transparent px-3 py-1 text-base transition-colors outline-none shadow-[inset_0_1px_2px_rgba(0,0,0,0.05)] file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-normal disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-40 md:text-sm',
        'focus-visible:border-ring focus-visible:outline focus-visible:outline-1 focus-visible:outline-ring focus-visible:outline-offset-0',
        'aria-invalid:border-destructive',
        className,
      )}
      {...props}
    />
  )
}

export { Input }
