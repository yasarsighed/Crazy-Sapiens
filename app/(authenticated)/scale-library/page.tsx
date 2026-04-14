import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { EmptyState } from '@/components/empty-state'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Search, Library, Plus, FileText } from 'lucide-react'

// Sample scale categories
const scaleCategories = [
  { id: 'anxiety', label: 'Anxiety', count: 12 },
  { id: 'depression', label: 'Depression', count: 8 },
  { id: 'personality', label: 'Personality', count: 15 },
  { id: 'wellbeing', label: 'Well-being', count: 6 },
  { id: 'social', label: 'Social', count: 9 },
  { id: 'cognitive', label: 'Cognitive', count: 7 },
]

export default async function ScaleLibraryPage() {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Fetch profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('researcher_color')
    .eq('id', user.id)
    .single()

  // Fetch scales from the library
  const { data: scales } = await supabase
    .from('questionnaire_definitions')
    .select('*')
    .order('name', { ascending: true })

  const researcherColor = profile?.researcher_color || '#2D6A4F'

  return (
    <div className="p-6 lg:p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-serif text-2xl text-foreground">Scale Library</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Browse validated psychological scales and questionnaires.
          </p>
        </div>
        <Button>
          <Plus className="w-4 h-4 mr-2" />
          Add custom scale
        </Button>
      </div>

      {/* Search and filters */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input 
            placeholder="Search scales..." 
            className="pl-10"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          {scaleCategories.slice(0, 4).map(cat => (
            <Badge 
              key={cat.id}
              variant="outline" 
              className="cursor-pointer hover:bg-muted"
            >
              {cat.label}
            </Badge>
          ))}
        </div>
      </div>

      {/* Scale categories */}
      <h2 className="font-serif text-lg text-foreground mb-4">Categories</h2>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-8">
        {scaleCategories.map(cat => (
          <Card 
            key={cat.id}
            className="cursor-pointer hover:border-primary/50 transition-colors"
          >
            <CardContent className="p-4 text-center">
              <p className="text-sm font-medium text-foreground">{cat.label}</p>
              <p className="text-xs text-muted-foreground">{cat.count} scales</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Scales list */}
      <h2 className="font-serif text-lg text-foreground mb-4">All scales</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {scales && scales.length > 0 ? (
          scales.map((scale: any) => (
            <Card key={scale.id} className="hover:border-primary/50 transition-colors">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div 
                    className="w-10 h-10 rounded-lg flex items-center justify-center"
                    style={{ backgroundColor: `${researcherColor}20` }}
                  >
                    <FileText className="w-5 h-5" style={{ color: researcherColor }} />
                  </div>
                  <Badge variant="outline" className="text-[10px]">
                    {scale.item_count || '?'} items
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm font-medium text-foreground mb-1">
                  {scale.name}
                </p>
                <p className="text-xs text-muted-foreground line-clamp-2">
                  {scale.description || 'No description available.'}
                </p>
              </CardContent>
            </Card>
          ))
        ) : (
          <Card className="col-span-full">
            <CardContent className="py-12">
              <EmptyState
                title="Scale library is empty."
                subtitle="Add your first validated scale to get started."
              />
              <div className="flex justify-center mt-6">
                <Button>
                  <Plus className="w-4 h-4 mr-2" />
                  Add your first scale
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Info card */}
      <Card className="mt-8 border-dashed">
        <CardContent className="py-6">
          <div className="flex items-start gap-3">
            <Library className="w-5 h-5 text-muted-foreground mt-0.5" />
            <div>
              <p className="text-sm font-medium text-foreground">About the Scale Library</p>
              <p className="text-xs text-muted-foreground mt-1">
                The scale library contains validated psychological instruments. Each scale includes citation information, 
                scoring instructions, and clinical cutoff points where applicable. You can use these scales directly 
                in your studies or create custom instruments.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
