'use client'

import { BUILT_IN_SCALES } from '@/lib/scales'
import { Badge } from '@/components/ui/badge'
import { Clock, ShieldAlert } from 'lucide-react'

export default function ScaleLibraryPage() {
  return (
    <div className="p-6 lg:p-8 max-w-4xl">
      <div className="mb-8">
        <h1 className="font-serif text-2xl">Scale Library</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {BUILT_IN_SCALES.length} validated scales, pre-loaded with items, scoring bands, and citations.
          Add them to any study in one click — no manual entry, no typos, no excuses.
        </p>
      </div>

      <div className="space-y-3">
        {BUILT_IN_SCALES.map(scale => (
          <div
            key={scale.abbreviation}
            className="border border-border rounded-xl p-4 hover:border-primary/30 hover:bg-muted/20 transition-colors"
          >
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <span className="font-serif font-semibold text-base">{scale.abbreviation}</span>
                  <Badge variant="outline" className="text-[10px]">{scale.domain}</Badge>
                  {scale.requires_clinical_alert && (
                    <Badge className="text-[10px] bg-destructive/10 text-destructive border border-destructive/20 flex items-center gap-1">
                      <ShieldAlert className="w-2.5 h-2.5" /> Clinical alerts
                    </Badge>
                  )}
                </div>
                <p className="text-sm font-medium text-foreground">{scale.full_name}</p>
                <p className="text-xs text-muted-foreground mt-1 max-w-2xl">{scale.description}</p>

                {scale.scoring_note && (
                  <p className="text-[11px] text-muted-foreground/70 italic mt-1.5">{scale.scoring_note}</p>
                )}

                <div className="flex items-center gap-4 mt-2 flex-wrap">
                  <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    ~{scale.estimated_duration_minutes} min · {scale.total_items} items
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    Score {scale.scale_min}–{scale.scale_max} · Bands: {scale.severity_bands.map(b => b.label).join(' → ')}
                  </span>
                </div>
              </div>
            </div>

            <p className="text-[10px] text-muted-foreground/60 mt-3 italic border-t border-border/50 pt-2">
              {scale.citation}
            </p>
          </div>
        ))}
      </div>

      <p className="text-[11px] text-muted-foreground/50 text-center mt-8 italic">
        More scales arriving as fast as ethics boards approve them.
      </p>
    </div>
  )
}
