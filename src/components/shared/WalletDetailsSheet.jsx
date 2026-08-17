import { formatCurrency, formatSignedCurrency } from '@/lib/currency'
import {
  sumWalletActivityNet,
  WALLET_BALANCE_STATUS,
  WALLET_BALANCE_STATUS_LABELS,
} from '@/lib/wallets'
import { DateTimeCell } from '@/components/shared/DateTimeCell'
import { Badge } from '@/components/ui/badge'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { cn } from '@/lib/utils'

function StatusBadge({ status }) {
  const label = WALLET_BALANCE_STATUS_LABELS[status] || status
  return (
    <Badge
      className={cn(
        'rounded-full border-transparent px-2.5 py-1 font-medium',
        status === WALLET_BALANCE_STATUS.SUFFICIENT &&
          'bg-emerald-50 text-emerald-700',
        status === WALLET_BALANCE_STATUS.LOW && 'bg-amber-50 text-amber-700',
        status === WALLET_BALANCE_STATUS.ZERO && 'bg-red-50 text-red-700',
      )}
    >
      <span
        className={cn(
          'mr-1.5 inline-block h-1.5 w-1.5 rounded-full',
          status === WALLET_BALANCE_STATUS.SUFFICIENT && 'bg-emerald-500',
          status === WALLET_BALANCE_STATUS.LOW && 'bg-amber-500',
          status === WALLET_BALANCE_STATUS.ZERO && 'bg-red-500',
        )}
      />
      {label}
    </Badge>
  )
}

export function WalletDetailsSheet({
  open,
  onOpenChange,
  walletRow,
  activity = [],
}) {
  if (!walletRow) return null

  const activityNet = sumWalletActivityNet(activity)

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full gap-0 p-0 sm:max-w-[30rem]">
        <SheetHeader className="border-b border-slate-200 px-6 py-5 pr-12">
          <div className="flex flex-wrap items-center gap-2">
            <SheetTitle className="text-xl font-semibold text-slate-900">
              {walletRow.ownerName}
            </SheetTitle>
            <StatusBadge status={walletRow.status} />
          </div>
          <p className="mt-2 text-2xl font-bold text-slate-900">
            {formatCurrency(walletRow.availableBalance)}
          </p>
          <p className="mt-1 text-xs text-slate-400">
            Available Credits = opening inventory + credit activity (
            {formatCurrency(activityNet)})
          </p>
        </SheetHeader>

        <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
          <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
            <p className="text-xs text-slate-400">Parent Organization</p>
            <p className="mt-1 text-sm font-semibold text-slate-900">
              {walletRow.parentName}
            </p>
          </div>

          <div>
            <h3 className="mb-3 text-sm font-semibold text-slate-900">
              Recent Activity
            </h3>
            {activity.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 px-4 py-10 text-center text-sm text-slate-400">
                No credit releases yet for this wallet.
              </div>
            ) : (
              <div className="overflow-hidden rounded-xl border border-slate-200">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50 hover:bg-muted/50">
                      <TableHead>Date</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {activity.map((entry) => (
                      <TableRow key={entry.id}>
                        <TableCell>
                          <DateTimeCell value={entry.createdAt} />
                          <div className="mt-0.5 text-[11px] text-slate-400">
                            {entry.reference}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-slate-700">
                          {entry.typeLabel}
                        </TableCell>
                        <TableCell className="text-right">
                          <div
                            className={cn(
                              'text-sm font-semibold',
                              entry.direction === 'debit'
                                ? 'text-red-600'
                                : 'text-emerald-600',
                            )}
                          >
                            {formatSignedCurrency(
                              entry.amount,
                              entry.direction,
                            )}
                          </div>
                          <div className="mt-0.5 text-[11px] text-slate-400">
                            {entry.counterpartyName}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
