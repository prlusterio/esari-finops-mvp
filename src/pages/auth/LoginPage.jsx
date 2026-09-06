import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import {
  ADMIN_USER_GUIDE_DOCX_HREF,
  ADMIN_USER_GUIDE_HREF,
  COMPUTATIONS_XLSX_HREF,
  DEMO_ACCOUNTS,
  DEMO_PASSWORD,
  USER_GUIDE_DOCX_HREF,
  USER_GUIDE_HREF,
} from '@/lib/constants'
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

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError('')
    setSubmitting(true)

    try {
      const result = await login(email, password)
      if (!result.success) {
        setError(result.error || 'Invalid email or password.')
        return
      }

      navigate(getHomePathForRole(result.user?.role), { replace: true })
    } finally {
      setSubmitting(false)
    }
  }

  const fillDemoAccount = (account) => {
    setEmail(account.email)
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
            Click an account to populate credentials. Default password:{' '}
            <span className="font-medium text-foreground">{DEMO_PASSWORD}</span>
          </p>

          <div className="mt-3 space-y-2">
            {DEMO_ACCOUNTS.map((account) => (
              <button
                key={account.email}
                type="button"
                onClick={() => fillDemoAccount(account)}
                className="flex w-full items-center justify-between gap-3 rounded-md border border-border bg-muted/40 px-3 py-2 text-left transition-colors hover:bg-muted"
              >
                <span className="min-w-0">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium text-foreground">
                      {account.label}
                    </span>
                    {account.restricted ? (
                      <span className="rounded border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700">
                        Restricted
                      </span>
                    ) : null}
                  </span>
                  <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                    {account.email}
                  </span>
                </span>
              </button>
            ))}
          </div>

          <p className="mt-4 text-center text-xs text-muted-foreground">
            <a
              href={USER_GUIDE_HREF}
              target="_blank"
              rel="noreferrer"
              className="font-medium text-foreground underline-offset-4 hover:underline"
            >
              Open the user guide
            </a>
            {', '}
            <a
              href={USER_GUIDE_DOCX_HREF}
              className="font-medium text-foreground underline-offset-4 hover:underline"
            >
              download User Guide Word copy
            </a>
            {', or '}
            <a
              href={COMPUTATIONS_XLSX_HREF}
              download="esari-computations.xlsx"
              className="font-medium text-foreground underline-offset-4 hover:underline"
            >
              download Excel
            </a>
            .
          </p>
          <p className="mt-2 text-center text-xs text-muted-foreground">
            Admin franchise setup:{' '}
            <a
              href={ADMIN_USER_GUIDE_HREF}
              target="_blank"
              rel="noreferrer"
              className="font-medium text-foreground underline-offset-4 hover:underline"
            >
              Open the admin user guide
            </a>
            {', or '}
            <a
              href={ADMIN_USER_GUIDE_DOCX_HREF}
              className="font-medium text-foreground underline-offset-4 hover:underline"
            >
              download Admin User Guide Word copy
            </a>
            .
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
