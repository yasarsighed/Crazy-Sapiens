'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ArrowLeft, Users, Network, Download, Share2, Plus } from 'lucide-react'

export default function StudyPage() {
  const params = useParams()
  const studyId = params.id as string
  const [study, setStudy] = useState<any>(null)
  const [participants, setParticipants] = useState<any[]>([])
  const [instruments, setInstruments] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: studyData } = await supabase
        .from('studies')
        .select('*')
        .eq('id', studyId)
        .single()
      setStudy(studyData)

      const { data: enrollments } = await supabase
        .from('study_enrollments')
        .select('*, profiles(full_name, email)')
        .eq('study_id', studyId)
      setParticipants(enrollments || [])

      const { data: instrumentData } = await supabase
        .from('study_instruments')
        .select('*')
        .eq('study_id', studyId)
      setInstruments(instrumentData || [])

      setLoading(false)
    }
    load()
  }, [studyId])

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
          <div className="flex items-center gap-2">
            <Badge variant={study.status === 'active' ? 'default' : 'secondary'}>
              {study.status}
            </Badge>
          </div>
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
            <Button size="sm" variant="outline">
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
    </div>
  )
}