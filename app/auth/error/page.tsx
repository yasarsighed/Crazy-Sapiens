import Link from 'next/link'
import { Logo } from '@/components/logo'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card'

export default function AuthErrorPage() {
  return (
    <main className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <Logo size="md" />
          </div>
        </CardHeader>
        <CardContent className="text-center space-y-4">
          <h2 className="font-serif text-xl text-destructive">Authentication Error</h2>
          <p className="text-muted-foreground">
            Something went wrong during authentication. This could happen if the link expired or was already used.
          </p>
        </CardContent>
        <CardFooter className="flex justify-center gap-4">
          <Button variant="outline" asChild>
            <Link href="/">Go home</Link>
          </Button>
          <Button asChild>
            <Link href="/login">Try again</Link>
          </Button>
        </CardFooter>
      </Card>
    </main>
  )
}
