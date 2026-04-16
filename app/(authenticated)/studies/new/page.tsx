'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function NewStudyPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    title: '',
    description: '',
    institution: '',
    department: '',
  })

  const handleSubmit = async () => {
    if (!form.title) return
    setLoading(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      alert('Not logged in')
      setLoading(false)
      return
    }

    const { data, error } = await supabase
      .from('studies')
      .insert({
        title: form.title,
        description: form.description,
        institution: form.institution,
        department: form.department,
        created_by: user.id,
        status: 'draft',
      })
      .select()
      .single()

    if (error) {
      alert('Error: ' + error.message)
      setLoading(false)
      return
    }

    if (data) {
      router.push(`/studies/${data.id}`)
    }
    setLoading(false)
  }

  return (
    <div className="p-6 lg:p-8 max-w-2xl">
      <Link href="/studies" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6">
        <ArrowLeft className="w-4 h-4" />
        Back to studies
      </Link>

      <h1 className="font-serif text-2xl text-foreground mb-2">New study</h1>
      <p className="text-sm text-muted-foreground mb-8">Science does not do itself. Let us begin.</p>

      <div className="space-y-5">
        <div>
          <label className="text-sm font-medium block mb-1.5">Study title <span className="text-red-500">*</span></label>
          <input
            type="text"
            value={form.title}
            onChange={e => setForm({ ...form, title: e.target.value })}
            placeholder="e.g. Workplace Sociogram Study 2026"
            className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>

        <div>
          <label className="text-sm font-medium block mb-1.5">Description</label>
          <textarea
            value={form.description}
            onChange={e => setForm({ ...form, description: e.target.value })}
            placeholder="What is this study about?"
            rows={3}
            className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary resize-none"
          />
        </div>

        <div>
          <label className="text-sm font-medium block mb-1.5">Institution</label>
          <input
            type="text"
            value={form.institution}
            onChange={e => setForm({ ...form, institution: e.target.value })}
            placeholder="e.g. University of Vadodara"
            className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>

        <div>
          <label className="text-sm font-medium block mb-1.5">Department</label>
          <input
            type="text"
            value={form.department}
            onChange={e => setForm({ ...form, department: e.target.value })}
            placeholder="e.g. Psychology"
            className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>

        <div className="flex gap-3 pt-2">
          <Button
            onClick={handleSubmit}
            disabled={loading || !form.title}
            className="flex-1"
          >
            {loading ? 'Creating...' : 'Create study'}
          </Button>
          <Button variant="outline" asChild>
            <Link href="/studies">Cancel</Link>
          </Button>
        </div>
      </div>
    </div>
  )
}