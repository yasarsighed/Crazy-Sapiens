'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Plus } from 'lucide-react'

export default function StudiesPage() {
  const [studies, setStudies] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data } = await supabase
        .from('studies')
        .select('*')
        .eq('researcher_id', user.id)
        .order('created_at', { ascending: false })

      setStudies(data || [])
      setLoading(false)
    }
    load()
  }, [])

  if (loading) return <div className="p-6 lg:p-8">Loading...</div>

  return (
    <div className="p-6 lg:p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-serif text-2xl text-foreground">Your studies</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {studies.length ? `${studies.length} experiments in progress` : 'Science does not do itself.'}
          </p>
        </div>
        <Button asChild>
          <Link href="/studies/new">
            <Plus className="w-4 h-4 mr-2" />
            New study
          </Link>
        </Button>
      </div>

      {studies.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {studies.map((study) => (
            <Card key={study.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
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
                  <p className="text-xs text-muted-foreground line-clamp-2">
                    {study.description}
                  </p>
                )}
              </CardHeader>
              <CardContent>
                <div className="text-xs text-muted-foreground mb-4">
                  Created {new Date(study.created_at).toLocaleDateString()}
                </div>
                <div className="flex gap-2">
                  <Button asChild size="sm" variant="outline" className="flex-1">
                    <Link href={`/studies/${study.id}`}>Manage</Link>
                  </Button>
                  <Button asChild size="sm" className="flex-1">
                    <Link href={`/studies/${study.id}/sociogram`}>Sociogram</Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <p className="font-serif text-xl text-foreground mb-2">No studies yet.</p>
          <p className="text-sm italic text-muted-foreground mb-6">Science does not do itself.</p>
          <Button asChild>
            <Link href="/studies/new">Create your first study</Link>
          </Button>
        </div>
      )}
    </div>
  )
}