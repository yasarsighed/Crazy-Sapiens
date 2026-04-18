'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function AnalysisPage() {
  const [projects, setProjects] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: studies } = await supabase
        .from('studies')
        .select('id')
        .eq('researcher_id', user.id)

      const studyIds = studies?.map((s: any) => s.id) || []

      if (studyIds.length > 0) {
        const { data } = await supabase
          .from('analysis_projects')
          .select('*, studies(title)')
          .in('study_id', studyIds)
          .order('created_at', { ascending: false })
        setProjects(data || [])
      }
      setLoading(false)
    }
    load()
  }, [])

  if (loading) return <div className="p-6 lg:p-8">Loading...</div>

  return (
    <div className="p-6 lg:p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-serif text-2xl">Analysis</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {projects.length ? `${projects.length} analyses running` : 'No analyses yet.'}
          </p>
        </div>
      </div>

      {projects.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map((project) => (
            <div key={project.id} className="border rounded-xl p-4 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-2">
                <h2 className="font-serif text-base font-semibold">{project.title}</h2>
                <span className="text-xs border rounded px-2 py-0.5 ml-2">{project.status}</span>
              </div>
              <p className="text-xs text-muted-foreground">{project.studies?.title}</p>
              <p className="text-xs text-muted-foreground mt-1">{project.analysis_type?.replace(/_/g, ' ')}</p>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <p className="font-serif text-xl mb-2">No analyses yet.</p>
          <p className="text-sm italic text-muted-foreground">The data awaits its moment of truth.</p>
        </div>
      )}
    </div>
  )
}