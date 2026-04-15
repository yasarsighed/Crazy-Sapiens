import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

export default async function UsersPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: currentUser } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (currentUser?.role !== 'admin') redirect('/dashboard')

  const { data: profiles } = await supabase
    .from('profiles')
    .select('*')
    .order('created_at', { ascending: false })

  return (
    <div className="p-6 lg:p-8">
      <div className="mb-8">
        <h1 className="font-serif text-2xl text-foreground">Users</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {profiles?.length ? `${profiles.length} humans on the platform` : 'No users yet.'}
        </p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="font-serif text-base">All users</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {profiles?.map((profile: any) => (
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