'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Plus, ShieldAlert } from 'lucide-react'

interface Study {
  id: string
  title: string
  description: string | null
  status: string
  created_at: string
  created_by: string
  creator_name?: string
  creator_color?: string
}

export default function StudiesPage() {
  const [studies, setStudies] = useState<Study[]>([])
  const [loading, setLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // Check role
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

      const admin = profile?.role === 'admin'
      setIsAdmin(admin)

      // Fetch studies — admin sees all, researcher sees own
      let query = supabase
        .from('studies')
        .select('*')
        .order('created_at', { ascending: false })
      if (!admin) query = query.eq('created_by', user.id)
      const { data } = await query

      const studiesList: Study[] = data || []

      // For admin: fetch creator profiles to show who owns each study
      if (admin && studiesList.length > 0) {
        const creatorIds = [...new Set(studiesList.map(s => s.created_by))]
        const { data: creators } = await supabase
          .from('profiles')
          .select('id, full_name, researcher_color')
          .in('id', creatorIds)

        const creatorById = Object.fromEntries((creators || []).map(c => [c.id, c]))
        studiesList.forEach(s => {
          const creator = creatorById[s.created_by]
          s.creator_name = creator?.full_name ?? 'Unknown'
          s.creator_color = creator?.researcher_color ?? '#2D6A4F'
        })
      }

      setStudies(studiesList)
      setLoading(false)
    }
    load()
  }, [])

  if (loading) return <div className="p-6 lg:p-8 text-sm text-muted-foreground">Consulting the data…</div>

  return (
    <div className="p-6 lg:p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-serif text-2xl text-foreground">
            {isAdmin ? 'All studies' : 'Your studies'}
          </h1>
          <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1.5">
            {isAdmin && <ShieldAlert className="w-3.5 h-3.5" />}
            {studies.length
              ? `${studies.length} ${isAdmin ? 'studies across all researchers' : studies.length === 1 ? 'experiment. A humble beginning.' : 'experiments. Greenwald would be proud.'}`
              : 'No studies yet. Staring at each other is not a methodology.'}
          </p>
        </div>
        {!isAdmin && (
          <Button asChild>
            <Link href="/studies/new">
              <Plus className="w-4 h-4 mr-2" />
              New study
            </Link>
          </Button>
        )}
      </div>

      {studies.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {studies.map((study) => (
            <Card
              key={study.id}
              className="hover:shadow-md transition-shadow relative overflow-hidden"
            >
              {/* Researcher color accent */}
              {study.creator_color && (
                <div
                  className="absolute top-0 left-0 right-0 h-1"
                  style={{ backgroundColor: study.creator_color }}
                />
              )}
              <CardHeader className="pb-3 pt-5">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="font-serif text-base leading-snug">
                    {study.title}
                  </CardTitle>
                  <Badge
                    variant={study.status === 'active' ? 'default' : 'secondary'}
                    className="ml-2 shrink-0"
                  >
                    {study.status}
                  </Badge>
                </div>
                {study.description && (
                  <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
                    {study.description}
                  </p>
                )}
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between text-xs text-muted-foreground mb-4">
                  <span>Created {new Date(study.created_at).toLocaleDateString()}</span>
                  {isAdmin && study.creator_name && (
                    <span className="flex items-center gap-1.5">
                      <span
                        className="w-2 h-2 rounded-full inline-block"
                        style={{ backgroundColor: study.creator_color }}
                      />
                      {study.creator_name}
                    </span>
                  )}
                </div>
                <Button asChild size="sm" className="w-full">
                  <Link href={`/studies/${study.id}`}>
                    {isAdmin ? 'View study' : 'Manage'}
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <p className="font-serif text-xl text-foreground mb-2">No studies yet.</p>
          <p className="text-sm italic text-muted-foreground mb-6">Technically this is a null result. Those matter too, but not like this.</p>
          {!isAdmin && (
            <Button asChild>
              <Link href="/studies/new">Start your first experiment</Link>
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
