'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { ArrowRight, Bell } from 'lucide-react'

interface PendingTasksReminderProps {
  count: number
  nextHref: string
  nextTitle: string
  nextColor: string
}

/**
 * In-app reminder for participants with outstanding instruments. There is no
 * email/push infrastructure, so this nudges in two ways:
 *  1) a prominent "do this next" banner with a deep link to the next task, and
 *  2) a passive tab-title badge (e.g. "(2) Crazy Sapiens") so an open tab keeps
 *     reminding them of pending work.
 */
export function PendingTasksReminder({ count, nextHref, nextTitle, nextColor }: PendingTasksReminderProps) {
  useEffect(() => {
    if (count <= 0) return
    const original = document.title
    document.title = `(${count}) Crazy Sapiens`
    return () => { document.title = original }
  }, [count])

  if (count <= 0) return null

  return (
    <Link
      href={nextHref}
      className="group block mb-6 rounded-2xl border p-4 transition-colors"
      style={{
        borderColor: `color-mix(in srgb, ${nextColor} 32%, transparent)`,
        background: `color-mix(in srgb, ${nextColor} 8%, var(--card))`,
      }}
    >
      <div className="flex items-center gap-3">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: `color-mix(in srgb, ${nextColor} 18%, var(--card))` }}
        >
          <Bell className="w-5 h-5" style={{ color: nextColor }} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-foreground">
            {count === 1 ? 'You have 1 task waiting' : `You have ${count} tasks waiting`}
          </p>
          <p className="text-sm text-muted-foreground truncate">
            Pick up where you left off: <span className="font-medium text-foreground">{nextTitle}</span>
          </p>
        </div>
        <span
          className="shrink-0 inline-flex items-center gap-1 text-sm font-semibold text-white rounded-xl px-3 py-1.5 group-hover:opacity-90"
          style={{ background: nextColor }}
        >
          Continue <ArrowRight className="w-3.5 h-3.5" />
        </span>
      </div>
    </Link>
  )
}
