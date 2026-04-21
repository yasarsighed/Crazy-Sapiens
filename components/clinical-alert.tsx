import { cn } from '@/lib/utils'
import { AlertTriangle } from 'lucide-react'

interface ClinicalAlertProps {
  id: string
  severity: 'critical' | 'moderate' | 'low'
  message: string
  participantId: string
  studyTitle?: string
  createdAt: string
  onAcknowledge?: (id: string) => void
  className?: string
}

const severityStyles = {
  critical: {
    bg: 'bg-[#FEF0F0]',
    border: 'border-[#F5B8B8]',
    icon: 'text-destructive',
    label: 'Critical',
  },
  moderate: {
    bg: 'bg-[#FEF9F0]',
    border: 'border-[#F5D88A]',
    icon: 'text-amber-600',
    label: 'Moderate',
  },
  low: {
    bg: 'bg-muted',
    border: 'border-border',
    icon: 'text-muted-foreground',
    label: 'Low',
  },
}

export function ClinicalAlert({ 
  severity, 
  message, 
  participantId,
  studyTitle,
  createdAt,
  onAcknowledge,
  className 
}: ClinicalAlertProps) {
  const styles = severityStyles[severity] ?? severityStyles.low
  
  return (
    <div className={cn(
      'p-3 rounded-lg border',
      styles.bg,
      styles.border,
      className
    )}>
      <div className="flex items-start gap-2">
        <AlertTriangle className={cn('w-4 h-4 mt-0.5 shrink-0', styles.icon)} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className={cn('text-[10px] font-medium uppercase', styles.icon)}>
              {styles.label}
            </span>
            <span className="text-[10px] text-muted-foreground">
              {new Date(createdAt).toLocaleDateString()}
            </span>
          </div>
          <p className="text-xs text-foreground mb-1 line-clamp-2">
            {message}
          </p>
          <div className="flex items-center justify-between">
            <p className="text-[10px] text-muted-foreground">
              Participant: {participantId.slice(0, 8)}...
              {studyTitle && ` | ${studyTitle}`}
            </p>
            {onAcknowledge && (
              <button 
                onClick={() => onAcknowledge(participantId)}
                className="text-[10px] text-primary hover:underline"
              >
                Acknowledge
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
