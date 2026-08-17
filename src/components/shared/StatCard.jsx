import { Link } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'

export function StatCard({
  title,
  value,
  description,
  icon: Icon,
  accent = 'default',
  descriptionBelowTitle = false,
  to,
  toLabel,
}) {
  const accents = {
    default: 'text-foreground',
    wallet: 'text-wallet',
    success: 'text-success',
    warning: 'text-warning',
    danger: 'text-danger',
  }

  const card = (
    <Card
      className={cn(
        to &&
          'transition-colors hover:border-blue-200 hover:bg-blue-50/40',
      )}
    >
      <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
        <div className="min-w-0 space-y-0.5">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            {title}
          </CardTitle>
          {description && descriptionBelowTitle ? (
            <p className="text-[11px] text-muted-foreground">{description}</p>
          ) : null}
        </div>
        {Icon && (
          <Icon
            className={cn(
              'mt-0.5 h-4 w-4 shrink-0',
              accents[accent] || accents.default,
            )}
          />
        )}
      </CardHeader>
      <CardContent>
        <div
          className={cn(
            'text-2xl font-semibold',
            accents[accent] || accents.default,
          )}
        >
          {value}
        </div>
        {description && !descriptionBelowTitle ? (
          <p className="mt-1 text-xs text-muted-foreground">{description}</p>
        ) : null}
      </CardContent>
    </Card>
  )

  if (!to) return card

  return (
    <Link
      to={to}
      aria-label={toLabel || title}
      className="block rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
    >
      {card}
    </Link>
  )
}
