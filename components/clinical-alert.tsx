import { cn } from '@/lib/utils'
import { AlertTriangle } from 'lucide-react'
import Link from 'next/link'

interface ClinicalAlertProps {
  id: string
  severity: 'critical' | 'moderate' | 'low'
  message: string
  participantId: string
  participantName?: string | null
  studyTitle?: string
  createdAt: string
  onAcknowledge?: (id: string) => void
  className?: string
}

const severityStyles = {
  critical: {
    bg: 'bg-destructive/10',
    border: 'border-destructive/40',
    icon: 'text-destructive',
    label: 'Critical',
  },
  moderate: {
    bg: 'bg-[color:var(--brand-gold)]/10',
    border: 'border-[color:var(--brand-gold)]/40',
    icon: 'text-[color:var(--brand-gold)]',
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
  participantName,
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
          <div className="flex items-center justify-between gap-2">
            <Link
              href={`/participants/${participantId}`}
              className="text-[10px] text-foreground font-medium hover:text-primary hover:underline truncate"
            >
              {participantName || `Participant ${participantId.slice(0, 8)}…`}
              {studyTitle && ` · ${studyTitle}`}
            </Link>
            {onAcknowledge && (
              <button
                onClick={() => onAcknowledge(participantId)}
                className="text-[10px] text-primary hover:underline shrink-0"
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
