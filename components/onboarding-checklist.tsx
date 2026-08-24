'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { CheckCircle2, Circle, ChevronDown, X, ListChecks } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const STEPS = [
  { id: 'profile',     label: 'Complete your profile',       href: '/settings',     desc: 'Add your name and pick a color' },
  { id: 'study',       label: 'Create your first study',     href: '/studies/new',  desc: 'Design your experiment'          },
  { id: 'instrument',  label: 'Add an instrument',           href: '/instruments',  desc: 'Questionnaire, IAT or Sociogram' },
  { id: 'scale',       label: 'Explore the scale library',   href: '/scale-library',desc: 'Browse validated psychological scales' },
  { id: 'participant', label: 'Invite a participant',         href: '/participants', desc: 'Share your study invite link'    },
]

const STORAGE_KEY = 'cs-onboarding-v1'

function getState(): Record<string, boolean> {
  if (typeof window === 'undefined') return {}
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')
  } catch { return {} }
}

function saveState(state: Record<string, boolean>) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)) } catch {}
}

export function OnboardingChecklist() {
  const [checked, setChecked] = useState<Record<string, boolean>>({})
  const [expanded, setExpanded] = useState(true)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    setChecked(getState())
    // Auto-dismiss if previously dismissed
    const raw = localStorage.getItem(STORAGE_KEY + '-dismissed')
    if (raw === 'true') setDismissed(true)
  }, [])

  const toggle = (id: string) => {
    const next = { ...checked, [id]: !checked[id] }
    setChecked(next)
    saveState(next)
  }

  const dismiss = () => {
    setDismissed(true)
    localStorage.setItem(STORAGE_KEY + '-dismissed', 'true')
  }

  const doneCount = STEPS.filter(s => checked[s.id]).length
  const allDone   = doneCount === STEPS.length
  const pct       = Math.round((doneCount / STEPS.length) * 100)

  if (dismissed || allDone) return null

  return (
    <div className="fixed bottom-6 left-[256px] z-40 w-72 rounded-xl border border-border bg-card shadow-lg overflow-hidden animate-slide-up">
      {/* Header — same dark-ink treatment as the sidebar/panel headers
          elsewhere, not a one-off gradient no other surface in this app uses. */}
      <div
        className="flex items-center justify-between px-4 py-3 cursor-pointer select-none"
        style={{ background: 'var(--popover)' }}
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-2">
          <ListChecks className="w-3.5 h-3.5" style={{ color: 'var(--brand-gold)' }} />
          <span className="text-[13px] font-semibold" style={{ color: 'var(--popover-foreground)' }}>Getting started</span>
          <span className="text-[10px] font-bold px-1.5 py-px rounded-md" style={{ color: 'var(--popover-foreground)', background: 'color-mix(in srgb, var(--popover-foreground) 16%, transparent)' }}>
            {doneCount}/{STEPS.length}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <ChevronDown className={cn('w-3.5 h-3.5 transition-transform', !expanded && 'rotate-180')} style={{ color: 'color-mix(in srgb, var(--popover-foreground) 70%, transparent)' }} />
          <button
            onClick={e => { e.stopPropagation(); dismiss() }}
            className="transition-colors ml-1 hover:opacity-80"
            style={{ color: 'color-mix(in srgb, var(--popover-foreground) 60%, transparent)' }}
            aria-label="Dismiss"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-1 bg-muted">
        <div
          className="h-full bg-primary transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>

      {/* Steps */}
      {expanded && (
        <div className="p-3 space-y-1 max-h-64 overflow-y-auto">
          {STEPS.map(step => {
            const done = !!checked[step.id]
            return (
              <div
                key={step.id}
                className={cn(
                  'flex items-start gap-3 p-2.5 rounded-xl transition-colors',
                  done ? 'opacity-50' : 'hover:bg-muted/50'
                )}
              >
                <button
                  onClick={() => toggle(step.id)}
                  className="shrink-0 mt-0.5 transition-colors"
                  aria-label={done ? 'Mark incomplete' : 'Mark complete'}
                >
                  {done
                    ? <CheckCircle2 className="w-4 h-4" style={{ color: '#86C99A' }} />
                    : <Circle className="w-4 h-4 text-muted-foreground/50 hover:text-primary transition-colors" />
                  }
                </button>
                <div className="flex-1 min-w-0">
                  <Link
                    href={step.href}
                    className={cn(
                      'text-[12px] font-medium leading-snug hover:text-primary transition-colors',
                      done ? 'line-through text-muted-foreground' : 'text-foreground'
                    )}
                  >
                    {step.label}
                  </Link>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{step.desc}</p>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
