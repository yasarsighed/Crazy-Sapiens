import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { EmptyState } from '@/components/empty-state'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Search, UserCog } from 'lucide-react'
import type { Profile } from '@/types/database'

export default async function UsersPage() {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Fetch current user profile to check role
  const { data: currentProfile } = await supabase
    .from('profiles')
    .select('role, researcher_color')
    .eq('id', user.id)
    .single()

  // Fetch all users
  const { data: users } = await supabase
    .from('profiles')
    .select('*')
    .order('created_at', { ascending: false })

  const researcherColor = currentProfile?.researcher_color || '#2D6A4F'

  return (
    <div className="p-6 lg:p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-serif text-2xl text-foreground">Users</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage platform users and their roles.
          </p>
        </div>
      </div>

      {/* Search bar */}
      <div className="mb-6">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input 
            placeholder="Search users..." 
            className="pl-10"
          />
        </div>
      </div>

      {/* Users table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <UserCog className="w-4 h-4" />
            All users
          </CardTitle>
        </CardHeader>
        <CardContent>
          {users && users.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">User</th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">Role</th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">Joined</th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">Color</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((profile: Profile) => (
                    <tr key={profile.id} className="border-b border-border/50 hover:bg-muted/50">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div 
                            className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-medium"
                            style={{ backgroundColor: profile.researcher_color || '#2D6A4F' }}
                          >
                            {profile.full_name?.split(' ').map(n => n[0]).join('').slice(0, 2) || '?'}
                          </div>
                          <span className="text-foreground">{profile.full_name || 'Unnamed'}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <Badge 
                          variant={profile.role === 'admin' ? 'default' : 'secondary'}
                          className="text-[10px] capitalize"
                        >
                          {profile.role || 'researcher'}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 text-muted-foreground">
                        {profile.created_at ? new Date(profile.created_at).toLocaleDateString() : '--'}
                      </td>
                      <td className="py-3 px-4">
                        <div 
                          className="w-6 h-6 rounded"
                          style={{ backgroundColor: profile.researcher_color || '#2D6A4F' }}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState
              title="No users found."
              subtitle="Users will appear here once they sign up."
            />
          )}
        </CardContent>
      </Card>
    </div>
  )
}
