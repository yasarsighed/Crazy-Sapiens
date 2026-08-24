'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { ColorPicker } from '@/components/color-picker'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogTrigger, DialogFooter,
} from '@/components/ui/dialog'
import { SlidersHorizontal, RotateCcw } from 'lucide-react'
import { toast } from 'sonner'
import type { ResearcherColor } from '@/types/database'
import { deriveCustomTheme, customThemeToCSSVars } from '@/lib/custom-theme'

// Sections a researcher may show/hide. Core sections (stats, studies,
// clinical alerts) are always shown and deliberately not listed here.
export const TOGGLEABLE_SECTIONS = [
  { key: 'quickActions', label: 'Quick actions',        hint: 'Shortcut buttons row' },
  { key: 'researchers',  label: 'Platform researchers', hint: 'Your colleagues on the platform' },
  { key: 'activity',     label: 'Live activity',        hint: 'Recent events feed' },
  { key: 'resources',    label: 'Resources',            hint: 'Scale library, audit log, participants' },
] as const

interface Props {
  userId: string
  initialColor: string
  initialHidden: string[]
  initialGreeting: string | null
  initialBgColor?: string | null
}

// Applies (or removes) the custom-background CSS vars directly on the app
// shell, live, as the researcher drags the picker — before anything is
// saved. Reverts automatically if the dialog is cancelled, since we only
// persist on Save.
function previewBackground(hex: string | null) {
  const shell = document.querySelector<HTMLElement>('[data-app-shell]')
  if (!shell) return
  if (!hex) {
    for (const k of ['--background','--foreground','--card','--card-foreground','--popover','--popover-foreground','--muted','--muted-foreground','--secondary','--secondary-foreground','--accent','--accent-foreground','--border','--input','--ring']) {
      shell.style.removeProperty(k)
    }
    return
  }
  const vars = customThemeToCSSVars(deriveCustomTheme(hex))
  Object.entries(vars).forEach(([k, v]) => shell.style.setProperty(k, v as string))
}

export function DashboardCustomizer({ userId, initialColor, initialHidden, initialGreeting, initialBgColor }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [hidden, setHidden] = useState<Set<string>>(new Set(initialHidden))
  const [color, setColor] = useState<ResearcherColor>(initialColor as ResearcherColor)
  const [greeting, setGreeting] = useState(initialGreeting ?? '')
  const [bgColor, setBgColor] = useState<string | null>(initialBgColor ?? null)
  const [saving, setSaving] = useState(false)

  const setShown = (key: string, shown: boolean) =>
    setHidden(prev => {
      const next = new Set(prev)
      if (shown) next.delete(key)
      else next.add(key)
      return next
    })

  const save = async () => {
    setSaving(true)
    const supabase = createClient()
    const { error } = await supabase
      .from('profiles')
      .update({
        researcher_color: color,
        dashboard_prefs: {
          hidden: [...hidden],
          greeting: greeting.trim() || null,
          bgColor: bgColor || null,
        },
      })
      .eq('id', userId)
    setSaving(false)
    if (error) {
      toast.error('Could not save', { description: error.message })
      return
    }
    toast.success('Dashboard updated')
    setOpen(false)
    router.refresh()
  }

  // Revert the live preview if the dialog closes without saving (Cancel,
  // Escape, clicking outside) — otherwise an unsaved color choice would
  // stick around visually until the next full page load.
  const handleOpenChange = (next: boolean) => {
    if (!next) {
      previewBackground(initialBgColor ?? null)
      setBgColor(initialBgColor ?? null)
    }
    setOpen(next)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <SlidersHorizontal className="w-3.5 h-3.5" />
          Customize
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-serif">Customize your dashboard</DialogTitle>
          <DialogDescription>
            Yours alone — these settings only change how <em>your</em> dashboard looks.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-1">
          {/* Accent colour */}
          <div className="space-y-2.5">
            <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Accent colour</Label>
            <p className="text-xs text-muted-foreground -mt-1">Used across your studies, avatar and highlights.</p>
            <ColorPicker value={color} onChange={setColor} />
          </div>

          {/* Background colour */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Background colour</Label>
              {bgColor && (
                <button
                  type="button"
                  onClick={() => { setBgColor(null); previewBackground(null) }}
                  className="text-[11px] text-muted-foreground hover:text-foreground flex items-center gap-1"
                >
                  <RotateCcw className="w-3 h-3" /> Reset to default
                </button>
              )}
            </div>
            <p className="text-xs text-muted-foreground -mt-1">
              Any colour — the rest of the page (text, cards, borders) adjusts automatically so everything stays readable.
            </p>
            <div className="flex items-center gap-2.5">
              <input
                type="color"
                value={bgColor ?? '#A50E22'}
                onChange={e => { setBgColor(e.target.value); previewBackground(e.target.value) }}
                className="w-10 h-10 rounded-lg border border-border cursor-pointer bg-transparent p-0.5"
                aria-label="Pick a background colour"
              />
              <Input
                value={bgColor ?? ''}
                onChange={e => {
                  const v = e.target.value
                  setBgColor(v)
                  if (/^#[0-9a-fA-F]{6}$/.test(v)) previewBackground(v)
                }}
                placeholder="Default (Red Room)"
                maxLength={7}
                className="font-mono text-sm"
              />
            </div>
          </div>

          {/* Greeting */}
          <div className="space-y-2">
            <Label htmlFor="greeting" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Greeting</Label>
            <Input
              id="greeting"
              value={greeting}
              onChange={e => setGreeting(e.target.value)}
              placeholder="Leave blank for the default greeting"
              maxLength={80}
            />
          </div>

          {/* Section visibility */}
          <div className="space-y-2.5">
            <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Show on dashboard</Label>
            <div className="space-y-1 rounded-xl border border-border overflow-hidden">
              {TOGGLEABLE_SECTIONS.map(s => (
                <div key={s.key} className="flex items-center justify-between gap-3 px-3.5 py-2.5 border-b border-border last:border-0">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground">{s.label}</p>
                    <p className="text-xs text-muted-foreground">{s.hint}</p>
                  </div>
                  <Switch
                    checked={!hidden.has(s.key)}
                    onCheckedChange={(v: boolean) => setShown(s.key, v)}
                    aria-label={`Show ${s.label}`}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => handleOpenChange(false)} disabled={saving}>Cancel</Button>
          <Button size="sm" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save changes'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
