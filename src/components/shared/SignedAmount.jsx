import {
  formatCurrency,
  formatSignedCurrency,
  signedAmountClassName,
} from '@/lib/currency'
import { cn } from '@/lib/utils'

/**
 * Colored signed money: +amount in green (credit), -amount in red (debit).
 * Pass direction, or omit it to render a neutral unsigned amount.
 *
 * @param {{
 *   amount: number,
 *   direction?: 'credit' | 'debit' | null,
 *   className?: string,
 * }} props
 */
export function SignedAmount({ amount, direction = null, className }) {
  if (!direction) {
    return (
      <span className={cn('font-semibold text-slate-900', className)}>
        {formatCurrency(amount)}
      </span>
    )
  }

  return (
    <span
      className={cn(
        'font-semibold',
        signedAmountClassName(direction),
        className,
      )}
    >
      {formatSignedCurrency(amount, direction)}
    </span>
  )
}
