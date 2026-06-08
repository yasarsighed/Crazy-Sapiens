'use client'

import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Kbd } from '@/components/ui/kbd'

interface KeyboardShortcutsProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const SECTIONS = [
  {
    title: 'Global',
    shortcuts: [
      { keys: ['Ctrl', 'K'],  desc: 'Open command palette'        },
      { keys: ['?'],           desc: 'Show keyboard shortcuts'     },
      { keys: ['Esc'],         desc: 'Close dialog / cancel'       },
    ],
  },
  {
    title: 'Navigation (G + key)',
    shortcuts: [
      { keys: ['G', 'D'], desc: 'Go to Dashboard'   },
      { keys: ['G', 'S'], desc: 'Go to Studies'     },
      { keys: ['G', 'P'], desc: 'Go to Participants'},
      { keys: ['G', ','], desc: 'Go to Settings'    },
    ],
  },
  {
    title: 'Studies',
    shortcuts: [
      { keys: ['Ctrl', 'N'], desc: 'Create new study' },
    ],
  },
  {
    title: 'Accessibility',
    shortcuts: [
      { keys: ['Tab'],         desc: 'Move focus forward'     },
      { keys: ['Shift', 'Tab'],desc: 'Move focus backward'    },
      { keys: ['Enter'],       desc: 'Activate focused item'  },
      { keys: ['Space'],       desc: 'Toggle checkbox / button'},
    ],
  },
]

export function KeyboardShortcuts({ open, onOpenChange }: KeyboardShortcutsProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-serif flex items-center gap-2">
            ⌨️ Keyboard Shortcuts
          </DialogTitle>
        </DialogHeader>
        <div className="mt-2 space-y-5 max-h-96 overflow-y-auto pr-1">
          {SECTIONS.map(section => (
            <div key={section.title}>
              <p className="section-label mb-2">{section.title}</p>
              <div className="space-y-1.5">
                {section.shortcuts.map((s, i) => (
                  <div key={i} className="flex items-center justify-between py-1.5 px-3 rounded-lg hover:bg-muted/50 transition-colors">
                    <span className="text-[13px] text-foreground">{s.desc}</span>
                    <div className="flex items-center gap-1">
                      {s.keys.map((k, j) => (
                        <span key={j} className="flex items-center gap-1">
                          <Kbd>{k}</Kbd>
                          {j < s.keys.length - 1 && <span className="text-muted-foreground text-[10px]">+</span>}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        <p className="text-[11px] text-muted-foreground border-t border-border pt-3 mt-2">
          Press <Kbd>?</Kbd> anywhere to toggle this panel.
        </p>
      </DialogContent>
    </Dialog>
  )
}
