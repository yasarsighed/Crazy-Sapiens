'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { ArrowLeft, FlaskConical } from 'lucide-react'
import { toast } from 'sonner'

export default function NewStudyPage() {
  const router = useRouter()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [saving, setSaving] = useState(false)

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

      toast.success('Study created — it begins.', {
        description: 'Add instruments and participants, then flip it to Active. Science awaits.',
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
          <p className="text-xs text-muted-foreground">It won&apos;t fund itself either, but one problem at a time.</p>
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
            placeholder="What are you investigating? 'Whether psychology works' is not specific enough."
            rows={3}
          />
        </div>

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
