'use client'

import { useState } from 'react'

export default function SupervisorsPage() {
  const [loaded] = useState(true)
  if (!loaded) return null
  return (
    <div className="p-6 lg:p-8">
      <h1 className="font-serif text-2xl">Supervisors</h1>
      <p className="text-sm text-muted-foreground mt-1">Manage supervisor access and permissions.</p>
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <p className="font-serif text-xl mb-2">No supervisors yet.</p>
        <p className="text-sm italic text-muted-foreground">Grant access when you are ready.</p>
      </div>
    </div>
  )
}