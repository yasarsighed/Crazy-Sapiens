import Link from 'next/link'
import { ChevronRight, Home } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Crumb {
  label: string
  href?: string
}

interface PageHeaderProps {
  title: string
  subtitle?: string
  crumbs?: Crumb[]
  actions?: React.ReactNode
  className?: string
  badge?: React.ReactNode
}

export function PageHeader({ title, subtitle, crumbs, actions, className, badge }: PageHeaderProps) {
  return (
    <div className={cn('px-6 lg:px-8 pt-7 pb-5 border-b border-border bg-background/80 backdrop-blur-sm sticky top-0 z-20', className)}>
      {/* Breadcrumbs */}
      {crumbs && crumbs.length > 0 && (
        <nav className="flex items-center gap-1 mb-2" aria-label="Breadcrumb">
          <Link href="/dashboard" className="text-muted-foreground hover:text-foreground transition-colors">
            <Home className="w-3 h-3" />
          </Link>
          {crumbs.map((crumb, i) => (
            <span key={i} className="flex items-center gap-1">
              <ChevronRight className="w-3 h-3 text-muted-foreground/50" />
              {crumb.href ? (
                <Link href={crumb.href} className="text-[11px] text-muted-foreground hover:text-foreground transition-colors">
                  {crumb.label}
                </Link>
              ) : (
                <span className="text-[11px] text-foreground font-medium">{crumb.label}</span>
              )}
            </span>
          ))}
        </nav>
      )}

      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="font-serif text-2xl font-semibold text-foreground leading-tight truncate">{title}</h1>
            {badge}
          </div>
          {subtitle && (
            <p className="text-sm text-muted-foreground mt-0.5">{subtitle}</p>
          )}
        </div>
        {actions && (
          <div className="flex items-center gap-2 shrink-0">{actions}</div>
        )}
      </div>
    </div>
  )
}
