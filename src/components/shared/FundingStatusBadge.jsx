import { FUNDING_STATUS, FUNDING_STATUS_LABELS } from '@/lib/constants'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

const STATUS_STYLES = {
  [FUNDING_STATUS.PENDING]:
    'border-transparent bg-amber-50 text-amber-700 hover:bg-amber-50',
  [FUNDING_STATUS.APPROVED]:
    'border-transparent bg-success/10 text-success hover:bg-success/10',
  [FUNDING_STATUS.COMPLETED]:
    'border-transparent bg-wallet/10 text-wallet hover:bg-wallet/10',
  [FUNDING_STATUS.RELEASED]:
    'border-transparent bg-wallet/10 text-wallet hover:bg-wallet/10',
  [FUNDING_STATUS.REJECTED]:
    'border-transparent bg-danger/10 text-danger hover:bg-danger/10',
  [FUNDING_STATUS.REVERSED]:
    'border-transparent bg-slate-100 text-slate-600 hover:bg-slate-100',
}

const DOT_STYLES = {
  [FUNDING_STATUS.PENDING]: 'bg-amber-500',
  [FUNDING_STATUS.APPROVED]: 'bg-success',
  [FUNDING_STATUS.COMPLETED]: 'bg-wallet',
  [FUNDING_STATUS.RELEASED]: 'bg-wallet',
  [FUNDING_STATUS.REJECTED]: 'bg-danger',
  [FUNDING_STATUS.REVERSED]: 'bg-slate-500',
}

export function FundingStatusBadge({ status }) {
  return (
    <Badge
      className={cn(
        'gap-1.5 rounded-full px-2.5 py-1 font-medium',
        STATUS_STYLES[status] || STATUS_STYLES[FUNDING_STATUS.PENDING],
      )}
    >
      <span
        className={cn(
          'h-1.5 w-1.5 rounded-full',
          DOT_STYLES[status] || DOT_STYLES[FUNDING_STATUS.PENDING],
        )}
      />
      {FUNDING_STATUS_LABELS[status] || status}
    </Badge>
  )
}
