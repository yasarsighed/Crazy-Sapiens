'use client'

import { useState, useEffect } from 'react'
import { formatDistanceToNow, format } from 'date-fns'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

interface RelativeTimeProps {
  date: string | Date
  className?: string
}

export function RelativeTime({ date, className }: RelativeTimeProps) {
  const [relative, setRelative] = useState('')

  useEffect(() => {
    const update = () => {
      try {
        setRelative(formatDistanceToNow(new Date(date), { addSuffix: true }))
      } catch {
        setRelative('')
      }
    }
    update()
    const interval = setInterval(update, 60_000)
    return () => clearInterval(interval)
  }, [date])

  let abs = ''
  try {
    abs = format(new Date(date), 'MMM d, yyyy · h:mm a')
  } catch { /* ignore */ }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className={cn('cursor-default', className)}>{relative}</span>
      </TooltipTrigger>
      <TooltipContent className="text-xs">{abs}</TooltipContent>
    </Tooltip>
  )
}
