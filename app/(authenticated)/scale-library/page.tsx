'use client'

import { BUILT_IN_SCALES } from '@/lib/scales'
import { Badge } from '@/components/ui/badge'
import { Brain, Clock, AlertTriangle } from 'lucide-react'

export default function ScaleLibraryPage() {
  return (
    <div className="p-6 lg:p-8 max-w-3xl">
      <h1 className="font-serif text-2xl">Scale Library</h1>
      <p className="text-sm text-muted-foreground mt-1">
        Validated psychological scales ready to use. Add one from a study&apos;s
        instrument picker — items and scoring bands are pre-loaded.
      </p>

      <div className="space-y-3 mt-6">
        {BUILT_IN_SCALES.map(scale => (
          <div
            key={scale.abbreviation}
            className="border border-border rounded-xl p-4"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span className="font-serif font-semibold text-base">{scale.abbreviation}</span>
                  <Badge variant="outline" className="text-[10px]">{scale.domain}</Badge>
                  {scale.requires_clinical_alert && (
                    <Badge className="text-[10px] bg-destructive/10 text-destructive border border-destructive/20">
                      <AlertTriangle className="w-2.5 h-2.5 mr-1" /> Clinical alerts
                    </Badge>
                  )}
                </div>
                <p className="text-sm font-medium text-foreground">{scale.full_name}</p>
                <p className="text-xs text-muted-foreground mt-1">{scale.description}</p>
                <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {scale.total_items} items · ~{scale.estimated_duration_minutes} min · scores {scale.scale_min}–{scale.scale_max}
                </p>
              </div>
              <Brain className="w-4 h-4 text-muted-foreground mt-1 shrink-0" />
            </div>

            {/* Severity bands */}
            <div className="flex flex-wrap gap-1.5 mt-3">
              {scale.severity_bands.map(band => (
                <span
                  key={band.label}
                  className="text-[10px] font-medium px-2 py-0.5 rounded-full"
                  style={{
                    // band.color as literal text color measured as low as 1.01
                    // contrast against a saturated custom background — a 16%
                    // tint barely shifts luminance. Text now uses the
                    // guaranteed-safe card-foreground token; band.color stays
                    // as the tint for visual identity.
                    color: 'var(--card-foreground)',
                    background: `color-mix(in srgb, ${band.color} 16%, var(--card))`,
                  }}
                >
                  {band.label} {band.min}–{band.max}
                </span>
              ))}
            </div>

            <p className="text-[10px] text-muted-foreground mt-3 italic">{scale.citation}</p>
          </div>
        ))}
      </div>

      <p className="text-xs text-muted-foreground mt-6 italic text-center">
        More validated scales are on their way — this list grows as they&apos;re added to the codebase.
      </p>
    </div>
  )
}
