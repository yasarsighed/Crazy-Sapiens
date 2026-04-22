import { AlertCircle, Phone, Globe } from 'lucide-react'

// Localised crisis resources. Add more rows as needed — render filters by locale prefix.
interface Resource {
  country: string   // ISO-3166 alpha-2 or 'GLOBAL'
  name:    string
  phone?:  string
  url?:    string
  hours?:  string
}

const RESOURCES: Resource[] = [
  // Global / English
  { country: 'GLOBAL', name: 'Befrienders Worldwide (directory)',     url: 'https://www.befrienders.org',            hours: '24/7 (varies by centre)' },
  { country: 'GLOBAL', name: 'International Association for Suicide Prevention — resources', url: 'https://www.iasp.info/resources/Crisis_Centres/' },

  // UK / IE
  { country: 'GB', name: 'Samaritans',           phone: '116 123', url: 'https://www.samaritans.org',           hours: '24/7' },
  { country: 'GB', name: 'Shout (text-based)',   phone: 'Text SHOUT to 85258', url: 'https://giveusashout.org', hours: '24/7' },
  { country: 'IE', name: 'Samaritans Ireland',   phone: '116 123', url: 'https://www.samaritans.org/samaritans-ireland/' },
  { country: 'IE', name: 'Pieta House',          phone: '1800 247 247', url: 'https://www.pieta.ie' },

  // US / CA
  { country: 'US', name: '988 Suicide & Crisis Lifeline',  phone: '988', url: 'https://988lifeline.org',     hours: '24/7' },
  { country: 'US', name: 'Crisis Text Line',               phone: 'Text HOME to 741741' },
  { country: 'CA', name: 'Talk Suicide Canada',            phone: '1-833-456-4566', url: 'https://talksuicide.ca', hours: '24/7' },

  // IN / AU / NZ
  { country: 'IN', name: 'iCall (India)',                  phone: '9152987821', url: 'https://icallhelpline.org' },
  { country: 'IN', name: 'Vandrevala Foundation',          phone: '1860-2662-345', url: 'https://www.vandrevalafoundation.com' },
  { country: 'AU', name: 'Lifeline Australia',             phone: '13 11 14', url: 'https://www.lifeline.org.au',   hours: '24/7' },
  { country: 'NZ', name: '1737 — Need to talk?',           phone: '1737', url: 'https://1737.org.nz',                hours: '24/7' },
]

// Hoisted — these never change at runtime
const GLOBAL_RESOURCES  = RESOURCES.filter(r => r.country === 'GLOBAL')
const FALLBACK_RESOURCES = RESOURCES.filter(r => r.country === 'GB')

function pickResources(locale: string, max = 4): Resource[] {
  const region = locale.toUpperCase().split(/[-_]/)[1] ?? ''
  const local  = RESOURCES.filter(r => r.country === region)
  const chosen = local.length ? [...local, ...GLOBAL_RESOURCES] : [...FALLBACK_RESOURCES, ...GLOBAL_RESOURCES]
  return chosen.slice(0, max)
}

interface Props {
  locale?:   string      // e.g. 'en-GB', 'en-US'. Defaults to navigator.language client-side, 'en-GB' server-side.
  compact?:  boolean
  title?:    string
  subtitle?: string
}

export function CrisisResources({ locale, compact = false, title, subtitle }: Props) {
  const loc = locale ?? (typeof navigator !== 'undefined' ? navigator.language : 'en-GB')
  const items = pickResources(loc)

  return (
    <div className={`rounded-xl border border-destructive/30 bg-destructive/5 ${compact ? 'p-3' : 'p-5'}`}>
      <div className="flex items-start gap-2 mb-3">
        <AlertCircle className={`shrink-0 text-destructive ${compact ? 'w-4 h-4 mt-0.5' : 'w-5 h-5 mt-0.5'}`} />
        <div>
          <p className={`font-medium text-destructive ${compact ? 'text-sm' : 'text-base'}`}>
            {title ?? 'If you need to talk to someone right now'}
          </p>
          {subtitle !== undefined && (
            <p className={`text-muted-foreground mt-0.5 ${compact ? 'text-xs' : 'text-sm'}`}>
              {subtitle ?? 'Free, confidential support is available 24/7. You are not alone.'}
            </p>
          )}
        </div>
      </div>

      <div className={`grid ${compact ? 'grid-cols-1 gap-2' : 'grid-cols-1 sm:grid-cols-2 gap-3'}`}>
        {items.map((r, i) => (
          <div key={i} className="rounded-lg bg-background/60 border border-destructive/15 p-3">
            <p className={`font-medium ${compact ? 'text-xs' : 'text-sm'}`}>{r.name}</p>
            {r.phone && (
              <a href={r.phone.startsWith('Text') ? undefined : `tel:${r.phone.replace(/[^\d+]/g, '')}`}
                className="flex items-center gap-1.5 mt-1 text-sm font-mono hover:underline text-destructive">
                <Phone className="w-3 h-3" />{r.phone}
              </a>
            )}
            {r.url && (
              <a href={r.url} target="_blank" rel="noreferrer"
                className="flex items-center gap-1.5 mt-1 text-xs text-muted-foreground hover:text-foreground hover:underline">
                <Globe className="w-3 h-3" />{r.url.replace(/^https?:\/\//, '')}
              </a>
            )}
            {r.hours && <p className="text-[11px] text-muted-foreground mt-1">{r.hours}</p>}
          </div>
        ))}
      </div>

      {!compact && (
        <p className="text-[11px] text-muted-foreground mt-3 leading-relaxed">
          If you are in immediate danger, please call your local emergency number (999 UK / 911 US / 112 EU / 000 AU).
          These services are not affiliated with this study.
        </p>
      )}
    </div>
  )
}
