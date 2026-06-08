'use client'

import { useState } from 'react'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { CopyButton } from './copy-button'
import { Link2, QrCode, Mail, ExternalLink } from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

interface InviteLinkDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  studyId: string
  studyTitle: string
}

export function InviteLinkDialog({ open, onOpenChange, studyId, studyTitle }: InviteLinkDialogProps) {
  const [baseUrl] = useState(() =>
    typeof window !== 'undefined' ? window.location.origin : 'https://crazy-sapiens.vercel.app'
  )

  const joinUrl = `${baseUrl}/participant/join/${studyId}`
  const qrUrl   = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(joinUrl)}&bgcolor=ffffff&color=0f0f1a&margin=10&format=png`
  const mailtoBody = encodeURIComponent(
    `Hi,\n\nYou have been invited to participate in a research study: "${studyTitle}".\n\nPlease click the link below to join:\n${joinUrl}\n\nThank you for contributing to research!\n\nBest regards`
  )
  const mailtoHref = `mailto:?subject=${encodeURIComponent(`Research Study Invitation: ${studyTitle}`)}&body=${mailtoBody}`

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-serif flex items-center gap-2">
            <Link2 className="w-4 h-4 text-primary" />
            Invite Participants
          </DialogTitle>
          <DialogDescription className="text-sm">
            Share this link to let participants join <strong>{studyTitle}</strong>.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="link" className="mt-2">
          <TabsList className="w-full">
            <TabsTrigger value="link" className="flex-1 gap-1.5 text-xs">
              <Link2 className="w-3.5 h-3.5" /> Link
            </TabsTrigger>
            <TabsTrigger value="qr" className="flex-1 gap-1.5 text-xs">
              <QrCode className="w-3.5 h-3.5" /> QR Code
            </TabsTrigger>
            <TabsTrigger value="email" className="flex-1 gap-1.5 text-xs">
              <Mail className="w-3.5 h-3.5" /> Email
            </TabsTrigger>
          </TabsList>

          {/* ── Link tab ── */}
          <TabsContent value="link" className="mt-4 space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Participant join URL</Label>
              <div className="flex gap-2">
                <Input
                  readOnly
                  value={joinUrl}
                  className="text-xs font-mono bg-muted/50 text-muted-foreground"
                />
                <CopyButton text={joinUrl} label="Copy" />
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Anyone with this link can join the study as a participant. Share via email, messaging apps, or printed handouts.
            </p>
            <Button asChild variant="outline" size="sm" className="w-full gap-1.5">
              <a href={joinUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="w-3.5 h-3.5" /> Preview as participant
              </a>
            </Button>
          </TabsContent>

          {/* ── QR tab ── */}
          <TabsContent value="qr" className="mt-4 space-y-3">
            <div className="flex justify-center">
              <div className="p-3 border border-border rounded-2xl bg-white shadow-sm">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={qrUrl}
                  alt="QR code for study invitation"
                  width={200}
                  height={200}
                  className="rounded-lg"
                />
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground text-center">
              Print or display this QR code — participants scan it to join instantly.
            </p>
            <Button asChild variant="outline" size="sm" className="w-full gap-1.5">
              <a href={qrUrl} download={`invite-qr-${studyId}.png`}>
                Download QR Code
              </a>
            </Button>
          </TabsContent>

          {/* ── Email tab ── */}
          <TabsContent value="email" className="mt-4 space-y-3">
            <div className="rounded-xl border border-border bg-muted/40 p-4 text-xs text-muted-foreground space-y-2">
              <p><strong className="text-foreground">Subject:</strong> Research Study Invitation: {studyTitle}</p>
              <p><strong className="text-foreground">Body:</strong> Hi, you have been invited to participate in "{studyTitle}". Click the link to join: {joinUrl.slice(0, 40)}…</p>
            </div>
            <Button asChild size="sm" className="w-full gap-1.5">
              <a href={mailtoHref}>
                <Mail className="w-3.5 h-3.5" /> Open in email client
              </a>
            </Button>
            <p className="text-[11px] text-muted-foreground text-center">
              Opens your default email app with the invitation pre-filled.
            </p>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}
