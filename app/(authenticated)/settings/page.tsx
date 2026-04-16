'use client'

import { useState } from 'react'

export default function SettingsPage() {
  const [loaded] = useState(true)
  if (!loaded) return null
  return (
    <div className="p-6 lg:p-8">
      <h1 className="font-serif text-2xl">Settings</h1>
      <p className="text-sm text-muted-foreground mt-1">Platform configuration and preferences.</p>
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <p className="font-serif text-xl mb-2">Settings coming soon.</p>
        <p className="text-sm italic text-muted-foreground">Good things take time.</p>
      </div>
    </div>
  )
}