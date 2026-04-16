'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ArrowLeft, Network, Download, Share2, Plus, X } from 'lucide-react'

// v5

export default function StudyPage() {
  const params = useParams()
  const studyId = params.id as string
  const [study, setStudy] = useState<any>(null)
  const [participants, setParticipants] = useState<any[]>([])
  const [instruments, setInstruments] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddParticipant, setShowAddParticipant] = useState(false)
  const [allProfiles, setAllProfiles] = useState<any[]>([])
  const [search, setSearch] = useState('')
  const [adding, setAdding] = useState(false)

  async function loadData() {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: studyData } = await supabase
      .from('studies')
      .select('*')
      .eq('id', studyId)
      .single()
    setStudy(studyData)

    const { data: enrollments, error: enrollError } = await supabase
      .from('study_enrollments')
      .select('id, participant_id, status, profiles(full_name, email)')
      .eq('study_id', studyId)
    console.log('enrollments:', enrollments, 'error:', enrollError)
    setParticipants(enrollments || [])

    const { data: instrumentData } = await supabase
      .from('study_instruments')
      .select('*')
      .eq('study_id', studyId)
    setInstruments(instrumentData || [])

    setLoading(false)
  }

  useEffect(() => {
    loadData()
  }, [studyId])

  const openAddParticipant = async () => {
    const supabase = createClient()
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('role', 'participant')
      .order('full_name')
    setAllProfiles(data || [])
    setShowAddParticipant(true)
  }

  const addParticipant = async (profileId: string) => {
    setAdding(true)
    const supabase = createClient()
    const { error } = await supabase
      .from('study_enrollments')
      .insert({
        study_id: studyId,
        participant_id: profileId,
        status: 'active',
        enrolled_at: new Date().toISOString(),
      })
    if (error) {
      alert('Error: ' + error.message)
    } else {
      await loadData()
      setShowAddParticipant(false)
    }
    setAdding(false)
  }

  const enrolledIds = participants.map(p => p.participant_id)
  const filteredProfiles = allProfiles.filter(p =>
    !enrolledIds.includes(p.id) &&
    (p.full_name?.toLowerCase().includes(search.toLowerCase()) ||
     p.email?.toLowerCase().includes(search.toLowerCase()))
  )

  if (loading) return <div className="p-6 lg:p-8">Loading...</div>
  if (!study) return <div className="p-6 lg:p-8">Study not found.</div>

  return (
    <div className="p-6 lg:p-8">
      <div className="mb-6">
        <Link href="/studies" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-4">
          <ArrowLeft className="w-4 h-4" />
          Back to studies
        </Link>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="font-serif text-2xl text-foreground">{study.title}</h1>
            {study.description && (
              <p className="text-sm text-muted-foreground mt-1">{study.description}</p>
            )}
          </div>
          <Badge variant={study.status === 'active' ? 'default' : 'secondary'}>
            {study.status}
          </Badge>
        </div>
      </div>

      <div className="flex flex-wrap gap-3 mb-8">
        <Button asChild>
          <Link href={`/studies/${studyId}/sociogram`}>
            <Network className="w-4 h-4 mr-2" />
            View Sociogram
          </Link>
        </Button>
        <Button variant="outline">
          <Share2 className="w-4 h-4 mr-2" />
          Share Insights
        </Button>
        <Button variant="outline">
          <Download className="w-4 h-4 mr-2" />
          Export CSV
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="border rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-serif text-base font-semibold">
              Participants ({participants.length})
            </h2>
            <Button size="sm" variant="outline" onClick={openAddParticipant}>
              <Plus className="w-4 h-4 mr-1" />
              Add
            </Button>
          </div>
          {participants.length === 0 ? (
            <p className="text-sm text-muted-foreground italic">No participants yet. They will come.</p>
          ) : (
            <div className="space-y-2">
              {participants.map((enrollment: any) => (
                <div key={enrollment.id} className="flex items-center gap-3 py-2 border-b border-border last:border-0">
                  <div
                    className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-medium shrink-0"
                    style={{ backgroundColor: '#2D6A4F' }}
                  >
                    {enrollment.profiles?.full_name?.charAt(0) || '?'}
                  </div>
                  <div>
                    <p className="text-sm font-medium">{enrollment.profiles?.full_name || 'Unknown'}</p>
                    <p className="text-xs text-muted-foreground">{enrollment.profiles?.email}</p>
                  </div>
                  <Badge variant="outline" className="ml-auto text-xs">
                    {enrollment.status}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="border rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-serif text-base font-semibold">
              Instruments ({instruments.length})
            </h2>
            <Button size="sm" variant="outline">
              <Plus className="w-4 h-4 mr-1" />
              Add
            </Button>
          </div>
          {instruments.length === 0 ? (
            <p className="text-sm text-muted-foreground italic">No instruments yet. Add one to get started.</p>
          ) : (
            <div className="space-y-2">
              {instruments.map((instrument: any) => (
                <div key={instrument.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                  <div>
                    <p className="text-sm font-medium">{instrument.instrument_label}</p>
                    <p className="text-xs text-muted-foreground">{instrument.instrument_type?.replace(/_/g, ' ')}</p>
                  </div>
                  <Badge variant={instrument.is_active ? 'default' : 'secondary'} className="text-xs">
                    {instrument.is_active ? 'Active' : 'Inactive'}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {showAddParticipant && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-background rounded-xl p-6 w-full max-w-md shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-serif text-lg">Add participant</h2>
              <button onClick={() => setShowAddParticipant(false)}>
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>
            <input
              type="text"
              placeholder="Search by name or email..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary mb-4"
            />
            {filteredProfiles.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No participants found. Make sure users have the participant role.
              </p>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {filteredProfiles.map((profile: any) => (
                  <div key={profile.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                    <div>
                      <p className="text-sm font-medium">{profile.full_name}</p>
                      <p className="text-xs text-muted-foreground">{profile.email}</p>
                    </div>
                    <Button
                      size="sm"
                      disabled={adding}
                      onClick={() => addParticipant(profile.id)}
                    >
                      Add
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}