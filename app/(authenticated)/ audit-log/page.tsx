'use client'

export default function AuditLogPage() {
  return (
    <div className="p-6 lg:p-8">
      <h1 className="font-serif text-2xl">Audit Log</h1>
      <p className="text-sm text-muted-foreground mt-1">Every action. Every time. Forever.</p>
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <p className="font-serif text-xl mb-2">No activity yet.</p>
        <p className="text-sm italic text-muted-foreground">The log is watching. Always.</p>
      </div>
    </div>
  )
}