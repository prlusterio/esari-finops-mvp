import { formatDateParts } from '@/lib/date'
import { cn } from '@/lib/utils'

/**
 * Table/detail date cell:
 * Aug 12, 2026
 * 11:00 AM
 */
export function DateTimeCell({ value, className }) {
  const parts = formatDateParts(value)

  return (
    <div className={cn('whitespace-nowrap', className)}>
      <div className="font-medium text-foreground">{parts.date}</div>
      {parts.time ? (
        <div className="text-xs text-muted-foreground">{parts.time}</div>
      ) : null}
    </div>
  )
}
