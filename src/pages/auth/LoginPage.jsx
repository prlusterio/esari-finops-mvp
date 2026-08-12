import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { DEMO_ACCOUNTS, DEMO_PASSWORD } from '@/lib/constants'
import { getHomePathForRole } from '@/lib/permissions'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'

export default function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = (event) => {
    event.preventDefault()
    setError('')
    setSubmitting(true)

    const result = login(email, password)
    setSubmitting(false)

    if (!result.success) {
      setError(result.error || 'Invalid email or password.')
      return
    }

    navigate(getHomePathForRole(result.user?.role), { replace: true })
  }

  const fillDemoAccount = (demoEmail) => {
    setEmail(demoEmail)
    setPassword('')
    setError('')
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Sign In</CardTitle>
        <CardDescription>
          Access your eSariSari workspace with your account credentials.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              autoComplete="username"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@esarisari.local"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Enter password"
              required
            />
          </div>

          {error && (
            <div className="rounded-md border border-danger/20 bg-danger/5 px-3 py-2 text-sm text-danger">
              {error}
            </div>
          )}

          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting ? 'Signing in...' : 'Sign In'}
          </Button>
        </form>

        <Separator className="my-6" />

        <div>
          <h2 className="text-sm font-semibold text-foreground">Demo Accounts</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Click an account to populate the email field. Default password:{' '}
            <span className="font-medium text-foreground">{DEMO_PASSWORD}</span>
          </p>

          <div className="mt-3 space-y-2">
            {DEMO_ACCOUNTS.map((account) => (
              <button
                key={account.email}
                type="button"
                onClick={() => fillDemoAccount(account.email)}
                className="flex w-full items-center justify-between rounded-md border border-border bg-muted/40 px-3 py-2 text-left transition-colors hover:bg-muted"
              >
                <span className="text-sm font-medium text-foreground">
                  {account.label}
                </span>
                <span className="text-xs text-muted-foreground">{account.email}</span>
              </button>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
