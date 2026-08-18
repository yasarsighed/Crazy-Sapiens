import { cn } from '@/lib/utils'

// One brand-palette hex per status. Rendered with color-mix so badges tint
// correctly in both light and dark mode instead of hardcoded *-50/*-700 shades.
const CONFIG: Record<string, string> = {
  active:    '#86C99A', // brand green — running
  draft:     '#7A5040', // warm neutral
  paused:    '#F0A65C', // burnt orange — on hold
  completed: '#C6A8F0', // brand purple — done
  archived:  '#8A7060', // muted brown — shelved
  pending:   '#D09028', // ochre — awaiting
  approved:  '#86C99A', // green
  rejected:  '#CE2029', // crimson
  withdrawn: '#9A6A5A', // muted — gone
  enrolled:  '#C6A8F0', // purple
  invited:   '#F0A65C', // orange
  critical:  '#CE2029', // crimson — urgent
  moderate:  '#D09028', // ochre
  low:       '#86C99A', // green — mild
}

interface StatusBadgeProps {
  status: string
  className?: string
  showDot?: boolean
  size?: 'sm' | 'md'
}

export function StatusBadge({ status, className, showDot = true, size = 'sm' }: StatusBadgeProps) {
  const color = CONFIG[status?.toLowerCase()] || CONFIG.draft

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border font-semibold capitalize',
        size === 'sm' ? 'px-2 py-0.5 text-[11px]' : 'px-3 py-1 text-xs',
        className
      )}
      style={{
        color,
        background: `color-mix(in srgb, ${color} 12%, var(--card))`,
        borderColor: `color-mix(in srgb, ${color} 30%, transparent)`,
      }}
    >
      {showDot && (
        <span
          className={cn('rounded-full shrink-0', size === 'sm' ? 'w-1.5 h-1.5' : 'w-2 h-2')}
          style={{ background: color }}
        />
      )}
      {status}
    </span>
  )
}
