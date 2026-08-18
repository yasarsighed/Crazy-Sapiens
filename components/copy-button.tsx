'use client'

import { useState } from 'react'
import { Copy, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

interface CopyButtonProps {
  text: string
  label?: string
  className?: string
  size?: 'sm' | 'default' | 'icon'
  tooltip?: string
}

export function CopyButton({ text, label, className, size = 'sm', tooltip = 'Copy to clipboard' }: CopyButtonProps) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // fallback
      const el = document.createElement('textarea')
      el.value = text
      document.body.appendChild(el)
      el.select()
      document.execCommand('copy')
      document.body.removeChild(el)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const btn = (
    <Button
      variant="outline"
      size={size}
      onClick={handleCopy}
      className={cn(
        'gap-1.5 transition-all duration-150',
        copied && 'border-[#86C99A]/40 bg-[#86C99A]/10 text-[#86C99A]',
        className
      )}
    >
      {copied ? (
        <>
          <Check className="w-3.5 h-3.5" />
          {label && <span>Copied!</span>}
        </>
      ) : (
        <>
          <Copy className="w-3.5 h-3.5" />
          {label && <span>{label}</span>}
        </>
      )}
    </Button>
  )

  if (!label) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{btn}</TooltipTrigger>
        <TooltipContent>{copied ? 'Copied!' : tooltip}</TooltipContent>
      </Tooltip>
    )
  }

  return btn
}
