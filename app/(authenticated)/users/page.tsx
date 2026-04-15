'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

export default function UsersPage() {
  const [profiles, setProfiles] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false })

      setProfiles(data || [])
      setLoading(false)
    }
    load()
  }, [])

  if (loading) return <div className="p-6 lg:p-8">Loading...</div>

  return (
    <div className="p-6 lg:p-8">
      <div className="mb-8">
        <h1 className="font-serif text-2xl text-foreground">Users</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {profiles.length ? `${profiles.length} humans on the platform` : 'No users yet.'}
        </p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="font-serif text-base">All users</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {profiles.map((profile: any) => (
              <div key={profile.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                <div className="flex items-center gap-3">
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-medium"
                    style={{ backgroundColor: profile.researcher_color || '#2D6A4F' }}
                  >
                    {profile.full_name?.charAt(0) || '?'}
                  </div>
                  <div>
                    <p className="text-sm font-medium">{profile.full_name}</p>
                    <p className="text-xs text-muted-foreground">{profile.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant={
                    profile.role === 'admin' ? 'default' :
                    profile.role === 'researcher' ? 'secondary' : 'outline'
                  }>
                    {profile.role}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}