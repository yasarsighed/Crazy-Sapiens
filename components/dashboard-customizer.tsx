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
import { SlidersHorizontal } from 'lucide-react'
import { toast } from 'sonner'
import type { ResearcherColor } from '@/types/database'

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
}

export function DashboardCustomizer({ userId, initialColor, initialHidden, initialGreeting }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [hidden, setHidden] = useState<Set<string>>(new Set(initialHidden))
  const [color, setColor] = useState<ResearcherColor>(initialColor as ResearcherColor)
  const [greeting, setGreeting] = useState(initialGreeting ?? '')
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

  return (
    <Dialog open={open} onOpenChange={setOpen}>
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
          <Button variant="outline" size="sm" onClick={() => setOpen(false)} disabled={saving}>Cancel</Button>
          <Button size="sm" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save changes'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
