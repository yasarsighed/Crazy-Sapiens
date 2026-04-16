'use client'

import { useState } from 'react'

export default function ScaleLibraryPage() {
  const [loaded] = useState(true)
  if (!loaded) return null
  return (
    <div className="p-6 lg:p-8">
      <h1 className="font-serif text-2xl">Scale Library</h1>
      <p className="text-sm text-muted-foreground mt-1">Validated psychological scales ready to use.</p>
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <p className="font-serif text-xl mb-2">Library coming soon.</p>
        <p className="text-sm italic text-muted-foreground">PHQ-9, GAD-7, and friends are on their way.</p>
      </div>
    </div>
  )
}