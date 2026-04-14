'use client'

import { cn } from '@/lib/utils'
import { RESEARCHER_COLORS, type ResearcherColor } from '@/types/database'
import { Check } from 'lucide-react'

interface ColorPickerProps {
  value: ResearcherColor
  onChange: (color: ResearcherColor) => void
  className?: string
}

export function ColorPicker({ value, onChange, className }: ColorPickerProps) {
  return (
    <div className={cn('flex flex-wrap gap-3', className)}>
      {RESEARCHER_COLORS.map((color) => (
        <button
          key={color.value}
          type="button"
          onClick={() => onChange(color.value)}
          className={cn(
            'w-8 h-8 rounded-full transition-all duration-150 flex items-center justify-center',
            'hover:scale-110 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary',
            value === color.value && 'ring-2 ring-offset-2 ring-foreground'
          )}
          style={{ backgroundColor: color.value }}
          title={color.label}
          aria-label={`Select ${color.label} color`}
        >
          {value === color.value && (
            <Check className="w-4 h-4 text-white drop-shadow-md" strokeWidth={3} />
          )}
        </button>
      ))}
    </div>
  )
}
