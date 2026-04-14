import { cn } from '@/lib/utils'

interface EmptyStateProps {
  title: string
  subtitle: string
  className?: string
}

export function EmptyState({ title, subtitle, className }: EmptyStateProps) {
  return (
    <div className={cn('text-center py-8 px-4', className)}>
      <p className="text-sm text-foreground mb-1">{title}</p>
      <p className="text-xs text-muted-foreground italic">{subtitle}</p>
    </div>
  )
}
