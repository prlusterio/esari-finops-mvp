import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'

export function StatCard({ title, value, description, icon: Icon, accent = 'default' }) {
  const accents = {
    default: 'text-foreground',
    wallet: 'text-wallet',
    success: 'text-success',
    warning: 'text-warning',
    danger: 'text-danger',
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        {Icon && (
          <Icon className={cn('h-4 w-4', accents[accent] || accents.default)} />
        )}
      </CardHeader>
      <CardContent>
        <div className={cn('text-2xl font-semibold', accents[accent] || accents.default)}>
          {value}
        </div>
        {description && (
          <p className="mt-1 text-xs text-muted-foreground">{description}</p>
        )}
      </CardContent>
    </Card>
  )
}
