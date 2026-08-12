import { useMemo } from 'react'
import { Banknote, Building2, Wallet } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { formatCurrency, formatSignedCurrency } from '@/lib/currency'
import { getHomePathForRole } from '@/lib/permissions'
import {
  buildRetailerWalletView,
  WALLET_BALANCE_STATUS,
  WALLET_BALANCE_STATUS_LABELS,
} from '@/lib/wallets'
import {
  getFundingTransfers,
  getOrganizations,
  getRevenueSharing,
  getTransactions,
  getWallets,
} from '@/services/storage'
import { DateTimeCell } from '@/components/shared/DateTimeCell'
import { PageHeader } from '@/components/shared/PageHeader'
import { StatCard } from '@/components/shared/StatCard'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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

export default function WalletPage() {
  const { user, dataVersion } = useAuth()
  const organizations = useMemo(() => getOrganizations(), [dataVersion])
  const wallets = useMemo(() => getWallets(), [dataVersion])
  const transfers = useMemo(() => getFundingTransfers(), [dataVersion])
  const transactions = useMemo(() => getTransactions(), [dataVersion])
  const revenueSharing = useMemo(() => getRevenueSharing(), [dataVersion])

  const view = useMemo(
    () =>
      buildRetailerWalletView({
        organizationId: user?.organizationId,
        organizations,
        wallets,
        transfers,
        transactions,
        revenueSharing,
        role: user?.role,
      }),
    [
      user?.organizationId,
      user?.role,
      organizations,
      wallets,
      transfers,
      transactions,
      revenueSharing,
    ],
  )

  return (
    <div>
      <PageHeader
        title="Wallet"
        description={
          view.parentTypeLabel === 'CWPC Admin'
            ? 'Your operating and revenue wallets. Request token credits from CWPC Admin when you need float.'
            : 'Your operating and revenue wallets. Request token credits from your franchisee when you need float.'
        }
        breadcrumbs={[
          { label: 'Home', href: getHomePathForRole(user?.role) },
          { label: 'Wallet' },
        ]}
      />

      <div className="mb-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Operating Wallet
            </CardTitle>
            <Wallet className="h-4 w-4 text-wallet" />
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap items-center gap-2">
              <div className="text-2xl font-semibold text-wallet">
                {formatCurrency(view.kpis.operatingBalance)}
              </div>
              <StatusBadge status={view.kpis.operatingStatus} />
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Min. {formatCurrency(view.kpis.minimumBalance)}
            </p>
          </CardContent>
        </Card>
        <StatCard
          title="Revenue Wallet"
          value={formatCurrency(view.kpis.revenueBalance)}
          description="All-time credited revenue share"
          icon={Banknote}
          accent="success"
        />
        <Card>
          <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {view.parentTypeLabel || 'Franchisee'}
            </CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="truncate text-xl font-semibold text-slate-900">
              {view.parent?.name || '—'}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {view.parent?.code ||
                (view.parentTypeLabel === 'CWPC Admin'
                  ? 'Your upline platform admin'
                  : 'Your upline franchisee')}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card className="overflow-hidden shadow-sm">
        <CardHeader className="border-b border-border px-4 py-3">
          <CardTitle className="text-base font-semibold">
            Recent Funding Activity
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {view.activity.length === 0 ? (
            <div className="px-4 py-12 text-center text-sm text-muted-foreground">
              No funding transfers yet for your wallet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50 hover:bg-muted/50">
                    <TableHead>Date</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Counterparty</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {view.activity.map((entry) => (
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
                      <TableCell className="text-sm text-slate-700">
                        {entry.counterpartyName}
                      </TableCell>
                      <TableCell className="text-right">
                        <span
                          className={cn(
                            'text-sm font-semibold',
                            entry.direction === 'debit'
                              ? 'text-red-600'
                              : 'text-emerald-600',
                          )}
                        >
                          {formatSignedCurrency(entry.amount, entry.direction)}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
