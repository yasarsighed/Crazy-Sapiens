'use client'

import { cn } from '@/lib/utils'

interface MascotProps {
  size?: 'sm' | 'md' | 'lg' | 'xl'
  className?: string
  animate?: boolean
}

const sizeMap = {
  sm: 32,
  md: 48,
  lg: 64,
  xl: 96,
}

export function Mascot({ size = 'md', className, animate = false }: MascotProps) {
  const dimension = sizeMap[size]
  
  return (
    <svg 
      width={dimension} 
      height={dimension} 
      viewBox="0 0 100 100" 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg"
      className={cn(
        animate && 'animate-bounce',
        className
      )}
      aria-label="Crazy Sapiens mascot"
    >
      {/* Main yellow circle head */}
      <circle cx="50" cy="52" r="38" fill="#E9C46A" />
      
      {/* Messy hair spikes - left side */}
      <path d="M18 35 L8 25 L16 32 L6 18 L15 28 L12 12 L18 26" stroke="#1A1A2E" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      
      {/* Messy hair spikes - right side */}
      <path d="M82 35 L92 25 L84 32 L94 18 L85 28 L88 12 L82 26" stroke="#1A1A2E" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      
      {/* Messy hair spikes - top */}
      <path d="M40 18 L35 5 L42 14 L50 2 L52 16 L58 14 L65 5 L60 18" stroke="#1A1A2E" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      
      {/* Left eye - white */}
      <ellipse cx="35" cy="48" rx="12" ry="14" fill="white" />
      {/* Left pupil - slightly wild/off-center */}
      <circle cx="38" cy="46" r="6" fill="#1A1A2E" />
      {/* Left eye highlight */}
      <circle cx="40" cy="44" r="2" fill="white" />
      
      {/* Right eye - white */}
      <ellipse cx="65" cy="48" rx="12" ry="14" fill="white" />
      {/* Right pupil - slightly wild/off-center */}
      <circle cx="62" cy="46" r="6" fill="#1A1A2E" />
      {/* Right eye highlight */}
      <circle cx="64" cy="44" r="2" fill="white" />
      
      {/* Eyebrows - slightly raised for curious look */}
      <path d="M24 35 Q35 30 46 35" stroke="#1A1A2E" strokeWidth="2.5" strokeLinecap="round" fill="none" />
      <path d="M54 35 Q65 30 76 35" stroke="#1A1A2E" strokeWidth="2.5" strokeLinecap="round" fill="none" />
      
      {/* Big grin mouth */}
      <path d="M30 68 Q50 85 70 68" stroke="#1A1A2E" strokeWidth="3" strokeLinecap="round" fill="none" />
      
      {/* Teeth showing in grin */}
      <path d="M35 68 L35 73 M42 70 L42 76 M50 71 L50 77 M58 70 L58 76 M65 68 L65 73" stroke="white" strokeWidth="3" strokeLinecap="round" />
      
      {/* Small whisker lines on left cheek */}
      <path d="M15 55 L22 52" stroke="#D4A855" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M14 60 L22 58" stroke="#D4A855" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M15 65 L22 64" stroke="#D4A855" strokeWidth="1.5" strokeLinecap="round" />
      
      {/* Small whisker lines on right cheek */}
      <path d="M85 55 L78 52" stroke="#D4A855" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M86 60 L78 58" stroke="#D4A855" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M85 65 L78 64" stroke="#D4A855" strokeWidth="1.5" strokeLinecap="round" />
      
      {/* Slight blush on cheeks */}
      <circle cx="22" cy="58" r="6" fill="#F4A261" opacity="0.3" />
      <circle cx="78" cy="58" r="6" fill="#F4A261" opacity="0.3" />
    </svg>
  )
}
