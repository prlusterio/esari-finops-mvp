import { AlertTriangle, Plus } from 'lucide-react'
import { Link } from 'react-router-dom'
import { formatCurrency } from '@/lib/currency'
import { getNewCreditsRequestHref } from '@/lib/notifications'
import {
  LOW_BALANCE_THRESHOLD,
  WALLET_BALANCE_STATUS,
} from '@/lib/wallets'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export function LowBalanceAlert({
  status,
  availableBalance = 0,
  role,
  className,
}) {
  const isZero = status === WALLET_BALANCE_STATUS.ZERO
  const isLow = status === WALLET_BALANCE_STATUS.LOW
  if (!isZero && !isLow) return null

  const amount = formatCurrency(availableBalance)
  const threshold = formatCurrency(LOW_BALANCE_THRESHOLD)

  return (
    <div
      role="status"
      className={cn(
        'mb-4 flex flex-col gap-3 rounded-xl border px-4 py-3 sm:flex-row sm:items-center sm:justify-between',
        isZero
          ? 'border-red-200 bg-red-50'
          : 'border-amber-200 bg-amber-50',
        className,
      )}
    >
      <div className="flex min-w-0 items-start gap-3">
        <AlertTriangle
          className={cn(
            'mt-0.5 h-5 w-5 shrink-0',
            isZero ? 'text-red-600' : 'text-amber-600',
          )}
        />
        <div className="min-w-0">
          <p
            className={cn(
              'text-sm font-semibold',
              isZero ? 'text-red-900' : 'text-amber-950',
            )}
          >
            {isZero ? 'Your credits are at zero' : 'Your credits are low'}
          </p>
          <p
            className={cn(
              'mt-0.5 text-sm',
              isZero ? 'text-red-800' : 'text-amber-900',
            )}
          >
            {isZero
              ? `Available Credits are ${amount}. Request Internet Credits from your upline to restock.`
              : `Available Credits are ${amount}. We alert you when the balance is ${threshold} or less. Request Internet Credits from your upline to restock.`}
          </p>
        </div>
      </div>
      <Button
        asChild
        size="sm"
        className={cn(
          'shrink-0 text-white',
          isZero
            ? 'bg-red-600 hover:bg-red-700'
            : 'bg-amber-600 hover:bg-amber-700',
        )}
      >
        <Link to={getNewCreditsRequestHref(role)}>
          <Plus className="h-4 w-4" />
          New Credits Request
        </Link>
      </Button>
    </div>
  )
}
