'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

export default function InstrumentsPage() {
  const [instruments, setInstruments] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: studies } = await supabase
        .from('studies')
        .select('id')
        .eq('created_by', user.id)

      const studyIds = studies?.map((s: any) => s.id) || []

      if (studyIds.length > 0) {
        const { data } = await supabase
          .from('study_instruments')
          .select('*, studies(title)')
          .in('study_id', studyIds)
          .order('created_at', { ascending: false })
        setInstruments(data || [])
      }
      setLoading(false)
    }
    load()
  }, [])

  if (loading) return <div className="p-6 lg:p-8">Loading...</div>

  return (
    <div className="p-6 lg:p-8">
      <div className="mb-8">
        <h1 className="font-serif text-2xl text-foreground">Instruments</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {instruments.length ? `${instruments.length} instruments across your studies` : 'No instruments yet.'}
        </p>
      </div>

      {instruments.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {instruments.map((instrument: any) => (
            <div key={instrument.id} className="border rounded-xl p-4 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-2">
                <h2 className="font-serif text-base font-semibold">{instrument.instrument_label}</h2>
                <Badge variant="outline" className="ml-2 shrink-0">
                  {instrument.instrument_type?.replace(/_/g, ' ')}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">{instrument.studies?.title}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {instrument.is_active ? 'Active' : 'Inactive'} · {instrument.is_mandatory ? 'Mandatory' : 'Optional'}
              </p>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <p className="font-serif text-xl text-foreground mb-2">No instruments yet.</p>
          <p className="text-sm italic text-muted-foreground">Add instruments to your studies to see them here.</p>
        </div>
      )}
    </div>
  )
}