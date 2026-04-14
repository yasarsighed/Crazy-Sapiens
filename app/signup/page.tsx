'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Logo } from '@/components/logo'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardFooter, CardHeader } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ColorPicker } from '@/components/color-picker'
import { createClient } from '@/lib/supabase/client'
import type { ResearcherColor, UserRole } from '@/types/database'

export default function SignupPage() {
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<UserRole>('researcher')
  const [researcherColor, setResearcherColor] = useState<ResearcherColor>('#2D6A4F')
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setIsLoading(true)

    try {
      const { error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: process.env.NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL ?? 
            `${window.location.origin}/auth/callback`,
          data: {
            full_name: fullName,
            role,
            researcher_color: researcherColor,
          },
        },
      })

      if (signUpError) {
        setError(signUpError.message)
        return
      }

      setSuccess(true)
    } catch {
      setError('An unexpected error occurred')
    } finally {
      setIsLoading(false)
    }
  }

  if (success) {
    return (
      <main className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <Logo size="md" />
            </div>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <h2 className="font-serif text-xl text-foreground">Check your email</h2>
            <p className="text-muted-foreground">
              {"We've sent a confirmation link to "}
              <span className="font-medium text-foreground">{email}</span>
              {". Click the link to activate your account."}
            </p>
            <p className="text-sm text-muted-foreground">
              {"Didn't receive it? Check your spam folder or "}
              <button 
                onClick={() => setSuccess(false)}
                className="text-primary hover:underline"
              >
                try again
              </button>
              .
            </p>
          </CardContent>
          <CardFooter className="justify-center">
            <Button variant="outline" asChild>
              <Link href="/login">Back to login</Link>
            </Button>
          </CardFooter>
        </Card>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center pb-2">
          <div className="flex justify-center mb-4">
            <Logo size="md" />
          </div>
          <CardDescription>
            Create your research account
          </CardDescription>
        </CardHeader>
        
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            {error && (
              <div className="p-3 text-sm text-destructive bg-destructive/10 rounded-lg">
                {error}
              </div>
            )}
            
            <div className="space-y-2">
              <Label htmlFor="fullName">Full name</Label>
              <Input
                id="fullName"
                type="text"
                placeholder="Dr. Jane Smith"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                autoComplete="name"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="researcher@university.edu"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="Create a strong password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                autoComplete="new-password"
              />
              <p className="text-[11px] text-muted-foreground">
                At least 8 characters
              </p>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="role">Role</Label>
              <Select value={role} onValueChange={(v) => setRole(v as UserRole)}>
                <SelectTrigger id="role">
                  <SelectValue placeholder="Select your role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="researcher">Researcher</SelectItem>
                  <SelectItem value="participant">Participant</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            {role === 'researcher' && (
              <div className="space-y-2">
                <Label>Your color</Label>
                <p className="text-[11px] text-muted-foreground mb-2">
                  This color will personalize your dashboard experience
                </p>
                <ColorPicker 
                  value={researcherColor} 
                  onChange={setResearcherColor} 
                />
              </div>
            )}
            
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? 'Creating account...' : 'Create account'}
            </Button>
          </CardContent>
        </form>
        
        <CardFooter className="flex flex-col gap-4 pt-0">
          <p className="text-sm text-center">
            Already have an account?{' '}
            <Link href="/login" className="text-primary hover:underline font-medium">
              Sign in
            </Link>
          </p>
        </CardFooter>
      </Card>
    </main>
  )
}
