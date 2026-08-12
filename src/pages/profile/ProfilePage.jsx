import { useMemo } from 'react'
import { useAuth } from '@/context/AuthContext'
import { ROLE_LABELS } from '@/lib/constants'
import { getHomePathForRole } from '@/lib/permissions'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { PageHeader } from '@/components/shared/PageHeader'

export default function ProfilePage() {
  const { user, organization } = useAuth()

  const details = useMemo(
    () => [
      { label: 'Name', value: user?.name },
      { label: 'Email', value: user?.email },
      { label: 'Role', value: ROLE_LABELS[user?.role] || user?.role },
      { label: 'Organization', value: organization?.name || '—' },
      { label: 'Organization ID', value: user?.organizationId || '—' },
    ],
    [user, organization],
  )

  return (
    <div>
      <PageHeader
        title="Profile"
        description="Your authenticated session details for this demo environment."
        breadcrumbs={[
          { label: 'Home', href: getHomePathForRole(user?.role) },
          { label: 'Profile' },
        ]}
      />

      <Card className="max-w-2xl">
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <div>
              <CardTitle>{user?.name}</CardTitle>
              <CardDescription>{user?.email}</CardDescription>
            </div>
            <Badge variant="secondary">
              {ROLE_LABELS[user?.role] || user?.role}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {details.map((item) => (
            <div
              key={item.label}
              className="flex items-center justify-between gap-4 border-b border-border py-2 last:border-b-0"
            >
              <span className="text-sm text-muted-foreground">{item.label}</span>
              <span className="text-sm font-medium text-foreground">{item.value}</span>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
