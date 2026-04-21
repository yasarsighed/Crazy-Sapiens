'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { toast } from 'sonner'
import { Shield, Plus, X, ChevronDown } from 'lucide-react'

interface Profile {
  id: string
  full_name: string | null
  email: string | null
  role: string
  researcher_color: string | null
}

interface Relationship {
  id: string
  supervisor_id: string
  researcher_id: string
  supervisor: Profile
  researcher: Profile
}

function getInitials(name: string | null) {
  if (!name) return '?'
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
}

export default function SupervisorsPage() {
  const [currentUser, setCurrentUser] = useState<{ id: string; role: string } | null>(null)
  const [relationships, setRelationships] = useState<Relationship[]>([])
  const [supervisors, setSupervisors] = useState<Profile[]>([])
  const [researchers, setResearchers] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [selectedSupervisor, setSelectedSupervisor] = useState('')
  const [selectedResearcher, setSelectedResearcher] = useState('')
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)

  async function loadData() {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
    setCurrentUser({ id: user.id, role: profile?.role ?? 'researcher' })

    const { data: rels } = await supabase
      .from('supervisor_researcher_relationships')
      .select(`
        id, supervisor_id, researcher_id,
        supervisor:profiles!supervisor_researcher_relationships_supervisor_id_fkey(id, full_name, email, role, researcher_color),
        researcher:profiles!supervisor_researcher_relationships_researcher_id_fkey(id, full_name, email, role, researcher_color)
      `)

    setRelationships((rels as any[]) ?? [])

    const { data: allProfiles } = await supabase
      .from('profiles')
      .select('id, full_name, email, role, researcher_color')
      .in('role', ['researcher', 'admin', 'supervisor'])
      .order('full_name')

    setSupervisors((allProfiles ?? []).filter(p => p.role === 'supervisor' || p.role === 'admin'))
    setResearchers((allProfiles ?? []).filter(p => p.role === 'researcher'))
    setLoading(false)
  }

  useEffect(() => { loadData() }, [])

  const addRelationship = async () => {
    if (!selectedSupervisor || !selectedResearcher) {
      toast.error('Please select both a supervisor and a researcher')
      return
    }
    if (selectedSupervisor === selectedResearcher) {
      toast.error('Supervisor and researcher cannot be the same person')
      return
    }
    setSaving(true)
    const supabase = createClient()
    const { error } = await supabase
      .from('supervisor_researcher_relationships')
      .insert({ supervisor_id: selectedSupervisor, researcher_id: selectedResearcher })
    if (error) {
      toast.error('Failed to add relationship', { description: error.message })
    } else {
      toast.success('Supervisor relationship added')
      setShowAdd(false)
      setSelectedSupervisor('')
      setSelectedResearcher('')
      await loadData()
    }
    setSaving(false)
  }

  const removeRelationship = async (id: string) => {
    if (!window.confirm('Remove this supervisor relationship?')) return
    setDeleting(id)
    const supabase = createClient()
    const { error } = await supabase.from('supervisor_researcher_relationships').delete().eq('id', id)
    if (error) {
      toast.error('Failed to remove relationship', { description: error.message })
    } else {
      toast.success('Relationship removed')
      await loadData()
    }
    setDeleting(null)
  }

  const isAdmin = currentUser?.role === 'admin'

  if (loading) return <div className="p-6 lg:p-8 text-sm text-muted-foreground">Loading supervisors…</div>

  return (
    <div className="p-6 lg:p-8 max-w-3xl">
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="font-serif text-2xl text-foreground flex items-center gap-2">
            <Shield className="w-6 h-6" /> Supervisors
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Supervisors can view all studies and results of their assigned researchers, but cannot modify or delete data.
          </p>
        </div>
        {isAdmin && (
          <Button size="sm" onClick={() => setShowAdd(v => !v)}>
            <Plus className="w-3.5 h-3.5 mr-1.5" /> Add relationship
          </Button>
        )}
      </div>

      {/* Role explanation */}
      <Card className="mb-6 border-border/60">
        <CardContent className="pt-4 pb-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
            {[
              { role: 'Admin', desc: 'Full access: create/delete/manage everything, assign supervisors, change roles.' },
              { role: 'Supervisor', desc: 'Read-only access to assigned researchers\' studies and results. Can add notes on clinical alerts.' },
              { role: 'Researcher', desc: 'Owns their own studies. Can create instruments, enroll participants, acknowledge alerts.' },
            ].map(r => (
              <div key={r.role} className="space-y-1">
                <Badge variant="outline" className="text-[10px]">{r.role}</Badge>
                <p className="text-muted-foreground leading-relaxed">{r.desc}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Add form */}
      {isAdmin && showAdd && (
        <Card className="mb-6">
          <CardHeader className="pb-3">
            <CardTitle className="font-serif text-base">Add supervisor → researcher relationship</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Supervisor</label>
                <select
                  value={selectedSupervisor}
                  onChange={e => setSelectedSupervisor(e.target.value)}
                  className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="">Select supervisor…</option>
                  {supervisors.map(s => (
                    <option key={s.id} value={s.id}>{s.full_name ?? s.email} ({s.role})</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Researcher</label>
                <select
                  value={selectedResearcher}
                  onChange={e => setSelectedResearcher(e.target.value)}
                  className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="">Select researcher…</option>
                  {researchers.map(r => (
                    <option key={r.id} value={r.id}>{r.full_name ?? r.email}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={addRelationship} disabled={saving}>
                {saving ? 'Saving…' : 'Add relationship'}
              </Button>
              <Button size="sm" variant="outline" onClick={() => setShowAdd(false)}>Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Relationships list */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="font-serif text-base">Active relationships ({relationships.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {relationships.length === 0 ? (
            <div className="text-center py-12">
              <Shield className="w-8 h-8 text-muted-foreground/30 mx-auto mb-3" />
              <p className="font-serif text-base text-foreground mb-1">No supervisor relationships yet</p>
              <p className="text-xs text-muted-foreground">
                {isAdmin ? 'Use the button above to assign a supervisor to a researcher.' : 'An admin must create supervisor relationships.'}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {relationships.map(rel => {
                const sup = rel.supervisor as any
                const res = rel.researcher as any
                return (
                  <div key={rel.id} className="flex items-center gap-3 py-3 border-b border-border last:border-0">
                    {/* Supervisor */}
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <div
                        className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-medium shrink-0"
                        style={{ backgroundColor: sup?.researcher_color ?? '#2D6A4F' }}
                      >
                        {getInitials(sup?.full_name)}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{sup?.full_name ?? 'Unknown'}</p>
                        <Badge variant="outline" className="text-[9px] mt-0.5">Supervisor</Badge>
                      </div>
                    </div>

                    <ChevronDown className="w-3 h-3 text-muted-foreground rotate-[-90deg] shrink-0" />

                    {/* Researcher */}
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <div
                        className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-medium shrink-0"
                        style={{ backgroundColor: res?.researcher_color ?? '#457B9D' }}
                      >
                        {getInitials(res?.full_name)}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{res?.full_name ?? 'Unknown'}</p>
                        <Badge variant="outline" className="text-[9px] mt-0.5">Researcher</Badge>
                      </div>
                    </div>

                    {isAdmin && (
                      <button
                        onClick={() => removeRelationship(rel.id)}
                        disabled={deleting === rel.id}
                        className="p-1.5 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/5 transition-colors disabled:opacity-40 shrink-0"
                        title="Remove relationship"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
