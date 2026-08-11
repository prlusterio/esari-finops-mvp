import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { PageHeader } from '@/components/shared/PageHeader'

/**
 * Shared placeholder module page shell.
 */
export function PlaceholderPage({ title, description, breadcrumbs, details }) {
  return (
    <div>
      <PageHeader
        title={title}
        description={description}
        breadcrumbs={breadcrumbs}
      />
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          <CardDescription>
            This module is prepared for a later phase. Navigation and access control
            are already in place.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            {details ||
              'Detailed workflows for this module will be implemented after the application foundation is stable.'}
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
