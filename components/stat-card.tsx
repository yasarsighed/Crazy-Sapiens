import { cn } from '@/lib/utils'
import { Card, CardContent } from '@/components/ui/card'

interface StatCardProps {
  title: string
  value: number | string
  subtitle: string
  variant?: 'default' | 'alert' | 'researcher-color'
  className?: string
}

export function StatCard({ 
  title, 
  value, 
  subtitle, 
  variant = 'default',
  className 
}: StatCardProps) {
  return (
    <Card className={cn(
      'transition-all',
      variant === 'alert' && Number(value) > 0 && 'border-destructive/50 bg-destructive/5',
      className
    )}>
      <CardContent className="p-5">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
          {title}
        </p>
        <p className={cn(
          'font-serif text-3xl font-semibold mb-1',
          variant === 'researcher-color' && 'text-[color:var(--researcher-color)]',
          variant === 'alert' && Number(value) > 0 && 'text-destructive',
          variant === 'default' && 'text-foreground'
        )}>
          {value}
        </p>
        <p className="text-[11px] text-muted-foreground">
          {subtitle}
        </p>
      </CardContent>
    </Card>
  )
}
