'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { ArrowLeft, FlaskConical, Database } from 'lucide-react'
import { toast } from 'sonner'

interface CohortOption { id: string; name: string }

export default function NewStudyPage() {
  const router = useRouter()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [cohortId, setCohortId] = useState<string>('none')
  const [cohorts, setCohorts] = useState<CohortOption[]>([])
  const [saving, setSaving] = useState(false)

  // Cohorts the researcher can see (RLS scopes this to their own + shared
  // ones) — lets a study be tied to a participant pool at creation time
  // instead of that link only ever being possible from the database directly.
  useEffect(() => {
    const supabase = createClient()
    supabase.from('cohorts').select('id, name').eq('status', 'active').order('name')
      .then(({ data }) => setCohorts(data ?? []))
  }, [])

  const handleCreate = async () => {
    if (!title.trim()) return
    setSaving(true)

    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data: study, error } = await supabase
        .from('studies')
        .insert({
          title:       title.trim(),
          description: description.trim() || null,
          status:      'draft',
          created_by:  user.id,
          cohort_id:   cohortId === 'none' ? null : cohortId,
        })
        .select('id')
        .single()

      if (error) throw error

      fetch('/api/activity/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'study_created',
          entity: 'study',
          entityId: study.id,
          details: { title: title.trim() },
        }),
      }).catch(() => {})

      toast.success('Study created as draft', {
        description: 'Add instruments and participants, then set status to Active.',
      })
      router.push(`/studies/${study.id}`)
    } catch (err) {
      toast.error('Failed to create study', {
        description: err instanceof Error ? err.message : 'Please try again.',
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="p-6 lg:p-8 max-w-xl">
      <Link
        href="/studies"
        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-8"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to studies
      </Link>

      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <FlaskConical className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h1 className="font-serif text-2xl">New study</h1>
          <p className="text-xs text-muted-foreground">Give your study a name to begin.</p>
        </div>
      </div>

      <div className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="title">
            Study title <span className="text-destructive">*</span>
          </Label>
          <Input
            id="title"
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="e.g. Wellbeing Study 2025"
            onKeyDown={e => e.key === 'Enter' && handleCreate()}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="description">
            Description{' '}
            <span className="text-muted-foreground font-normal">(optional)</span>
          </Label>
          <Textarea
            id="description"
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="Briefly describe your study's aims and methods..."
            rows={3}
          />
        </div>

        {cohorts.length > 0 && (
          <div className="space-y-2">
            <Label htmlFor="cohort" className="flex items-center gap-1.5">
              <Database className="w-3.5 h-3.5" />
              Cohort <span className="text-muted-foreground font-normal">(optional)</span>
            </Label>
            <Select value={cohortId} onValueChange={setCohortId}>
              <SelectTrigger id="cohort" className="w-full">
                <SelectValue placeholder="No cohort" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No cohort</SelectItem>
                {cohorts.map(c => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-[11px] text-muted-foreground">
              Tie this study to a named participant pool for shared baseline tracking.
            </p>
          </div>
        )}

        <div className="flex gap-3 pt-2">
          <Button variant="outline" asChild className="flex-1">
            <Link href="/studies">Cancel</Link>
          </Button>
          <Button
            onClick={handleCreate}
            disabled={saving || !title.trim()}
            className="flex-1"
          >
            {saving ? 'Creating...' : 'Create study'}
          </Button>
        </div>
      </div>
    </div>
  )
}
