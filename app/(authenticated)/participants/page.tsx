'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function ParticipantsPage() {
  const [enrollments, setEnrollments] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
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
            .from('study_enrollments')
            .select('*, profiles(full_name, email), studies(title)')
            .in('study_id', studyIds)
            .order('enrolled_at', { ascending: false })
          setEnrollments(data || [])
        }
      } catch (e) {
        console.error(e)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  if (loading) return <div className="p-6 lg:p-8">Loading...</div>

  return (
    <div className="p-6 lg:p-8">
      <div className="mb-8">
        <h1 className="font-serif text-2xl">Participants</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {enrollments.length ? `${enrollments.length} brave souls enrolled` : 'Nobody here yet.'}
        </p>
      </div>

      {enrollments.length === 0 && (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <p className="font-serif text-xl mb-2">Nobody here yet.</p>
          <p className="text-sm italic text-muted-foreground">They will come. Give it time.</p>
        </div>
      )}

      {enrollments.length > 0 && (
        <div className="space-y-3">
          {enrollments.map((enrollment: any) => (
            <div key={enrollment.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
              <div className="flex items-center gap-3">
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-medium"
                  style={{ backgroundColor: '#2D6A4F' }}
                >
                  {enrollment.profiles?.full_name?.charAt(0) || '?'}
                </div>
                <div>
                  <p className="text-sm font-medium">{enrollment.profiles?.full_name || 'Unknown'}</p>
                  <p className="text-xs text-muted-foreground">{enrollment.profiles?.email}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <p className="text-xs text-muted-foreground">{enrollment.studies?.title}</p>
                <span className="text-xs border rounded px-2 py-0.5">
                  {enrollment.status === 'active' ? 'Getting there...' : enrollment.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}