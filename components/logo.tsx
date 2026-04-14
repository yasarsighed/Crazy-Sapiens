import { cn } from '@/lib/utils'
import { Mascot } from './mascot'

interface LogoProps {
  size?: 'sm' | 'md' | 'lg'
  showWordmark?: boolean
  className?: string
}

const sizeConfig = {
  sm: {
    mascot: 'sm' as const,
    crazy: 'text-lg',
    sapiens: 'text-xl',
    gap: 'gap-1',
  },
  md: {
    mascot: 'md' as const,
    crazy: 'text-2xl',
    sapiens: 'text-3xl',
    gap: 'gap-2',
  },
  lg: {
    mascot: 'lg' as const,
    crazy: 'text-3xl',
    sapiens: 'text-4xl',
    gap: 'gap-3',
  },
}

export function Logo({ size = 'md', showWordmark = true, className }: LogoProps) {
  const config = sizeConfig[size]
  
  return (
    <div className={cn('flex items-center', config.gap, className)}>
      <Mascot size={config.mascot} />
      {showWordmark && (
        <div className="flex flex-col leading-none">
          <span 
            className={cn(
              'font-[family-name:var(--font-permanent-marker)] text-[#1A2E1A] -rotate-2',
              config.crazy
            )}
          >
            CRAZY
          </span>
          <span 
            className={cn(
              'font-[family-name:var(--font-caveat)] font-bold text-primary -mt-1',
              config.sapiens
            )}
          >
            Sapiens
          </span>
        </div>
      )}
    </div>
  )
}

export function Wordmark({ size = 'md', className }: { size?: 'sm' | 'md' | 'lg'; className?: string }) {
  const config = sizeConfig[size]
  
  return (
    <div className={cn('flex flex-col leading-none', className)}>
      <span 
        className={cn(
          'font-[family-name:var(--font-permanent-marker)] text-[#1A2E1A] -rotate-2',
          config.crazy
        )}
      >
        CRAZY
      </span>
      <span 
        className={cn(
          'font-[family-name:var(--font-caveat)] font-bold text-primary -mt-1',
          config.sapiens
        )}
      >
        Sapiens
      </span>
    </div>
  )
}
