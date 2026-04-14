import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { EmptyState } from '@/components/empty-state'
import { BarChart3, PieChart, TrendingUp, Download } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default async function AnalysisPage() {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Fetch profile for researcher color
  const { data: profile } = await supabase
    .from('profiles')
    .select('researcher_color')
    .eq('id', user.id)
    .single()

  // Fetch studies with data
  const { data: studies } = await supabase
    .from('studies')
    .select('id, title, status')
    .eq('created_by', user.id)

  const studyIds = studies?.map(s => s.id) || []

  // Fetch response counts per study
  const { count: totalResponses } = await supabase
    .from('questionnaire_item_responses')
    .select('*', { count: 'exact', head: true })

  const researcherColor = profile?.researcher_color || '#2D6A4F'

  return (
    <div className="p-6 lg:p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-serif text-2xl text-foreground">Analysis</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Where data becomes insight.
          </p>
        </div>
        <Button variant="outline">
          <Download className="w-4 h-4 mr-2" />
          Export all data
        </Button>
      </div>

      {/* Stats overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Responses</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-serif" style={{ color: researcherColor }}>
              {totalResponses || 0}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Studies with Data</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-serif" style={{ color: researcherColor }}>
              {studies?.filter(s => s.status === 'active').length || 0}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Completion Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-serif" style={{ color: researcherColor }}>
              --
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Analysis tools */}
      <h2 className="font-serif text-lg text-foreground mb-4">Analysis tools</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <Card className="hover:border-primary/50 transition-colors cursor-pointer">
          <CardHeader>
            <div 
              className="w-10 h-10 rounded-lg flex items-center justify-center mb-2"
              style={{ backgroundColor: `${researcherColor}20` }}
            >
              <BarChart3 className="w-5 h-5" style={{ color: researcherColor }} />
            </div>
            <CardTitle className="text-base">Descriptive Statistics</CardTitle>
            <CardDescription className="text-xs">
              Mean, median, standard deviation, and frequency distributions.
            </CardDescription>
          </CardHeader>
        </Card>

        <Card className="hover:border-primary/50 transition-colors cursor-pointer">
          <CardHeader>
            <div 
              className="w-10 h-10 rounded-lg flex items-center justify-center mb-2"
              style={{ backgroundColor: `${researcherColor}20` }}
            >
              <TrendingUp className="w-5 h-5" style={{ color: researcherColor }} />
            </div>
            <CardTitle className="text-base">Correlation Analysis</CardTitle>
            <CardDescription className="text-xs">
              Explore relationships between variables with Pearson and Spearman coefficients.
            </CardDescription>
          </CardHeader>
        </Card>

        <Card className="hover:border-primary/50 transition-colors cursor-pointer">
          <CardHeader>
            <div 
              className="w-10 h-10 rounded-lg flex items-center justify-center mb-2"
              style={{ backgroundColor: `${researcherColor}20` }}
            >
              <PieChart className="w-5 h-5" style={{ color: researcherColor }} />
            </div>
            <CardTitle className="text-base">Group Comparisons</CardTitle>
            <CardDescription className="text-xs">
              T-tests, ANOVA, and non-parametric alternatives.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>

      {/* Coming soon notice */}
      <Card className="mt-8 border-dashed">
        <CardContent className="py-8">
          <EmptyState
            title="Advanced analysis coming soon."
            subtitle="Factor analysis, SEM, and machine learning integrations are in development."
          />
        </CardContent>
      </Card>
    </div>
  )
}
