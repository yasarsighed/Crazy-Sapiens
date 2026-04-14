import Link from 'next/link'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Users } from 'lucide-react'

interface StudyCardProps {
  id: string
  title: string
  instruments: Array<{
    type: 'questionnaire' | 'iat' | 'sociogram'
  }>
  participantCount: number
  completionPercentage: number
  researcherColor?: string
  className?: string
}

const instrumentColors = {
  questionnaire: 'bg-accent-blue/10 text-accent-blue border-accent-blue/20',
  iat: 'bg-accent-orange/10 text-accent-orange border-accent-orange/20',
  sociogram: 'bg-primary/10 text-primary border-primary/20',
}

const instrumentLabels = {
  questionnaire: 'Questionnaire',
  iat: 'IAT',
  sociogram: 'Sociogram',
}

export function StudyCard({ 
  id,
  title, 
  instruments, 
  participantCount, 
  completionPercentage,
  researcherColor = '#2D6A4F',
  className 
}: StudyCardProps) {
  return (
    <Link 
      href={`/studies/${id}`}
      className={cn(
        'block p-4 rounded-lg border border-border bg-card hover:bg-muted/30 transition-colors relative',
        className
      )}
    >
      {/* Left accent border */}
      <div 
        className="absolute left-0 top-3 bottom-3 w-1 rounded-r"
        style={{ backgroundColor: researcherColor }}
      />
      
      <div className="pl-3">
        <h3 className="font-medium text-sm text-foreground mb-2 line-clamp-1">
          {title}
        </h3>
        
        {/* Instrument chips */}
        <div className="flex flex-wrap gap-1.5 mb-3">
          {instruments.map((instrument, idx) => (
            <Badge 
              key={idx}
              variant="outline"
              className={cn(
                'text-[10px] px-2 py-0.5 font-normal',
                instrumentColors[instrument.type]
              )}
            >
              {instrumentLabels[instrument.type]}
            </Badge>
          ))}
        </div>
        
        {/* Stats row */}
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <Users className="w-3 h-3" />
            <span>{participantCount} participants</span>
          </div>
          <span>{completionPercentage}% complete</span>
        </div>
      </div>
    </Link>
  )
}
