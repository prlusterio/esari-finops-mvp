import { useMemo } from 'react'
import { Building2, Wallet } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { isApiWired } from '@/lib/api/config'
import { useResourceData, toRows, apiErrorMessage } from '@/hooks/useResourceData'
import { listWalletsForRole, listAccountsForRole, listSaleTransactionsForRole } from '@/services/api/roleResources'
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
  getTransactions,
  getWallets,
} from '@/services/storage'
import { DateTimeCell } from '@/components/shared/DateTimeCell'
import { LowBalanceAlert } from '@/components/shared/LowBalanceAlert'
import { PageHeader } from '@/components/shared/PageHeader'
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
  // T4: API-first retailer wallet when wired; storage until verify.
  const apiWallets = useResourceData({
    loadFromApi: () => listWalletsForRole(user?.role),
    loadFromStorage: () => getWallets(),
    deps: [user?.role],
  })
  const apiAccounts = useResourceData({
    loadFromApi: () => listAccountsForRole(user?.role),
    loadFromStorage: () => getOrganizations(),
    deps: [user?.role],
  })
  const apiTransactions = useResourceData({
    loadFromApi: () => listSaleTransactionsForRole(user?.role),
    loadFromStorage: () => getTransactions(),
    deps: [user?.role],
  })
  const useApi = isApiWired()
  const organizations = useMemo(
    () => (useApi ? toRows(apiAccounts.data) : getOrganizations()),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [useApi, apiAccounts.data, dataVersion],
  )
  const wallets = useMemo(
    () => (useApi ? toRows(apiWallets.data) : getWallets()),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [useApi, apiWallets.data, dataVersion],
  )
  const transfers = useMemo(() => getFundingTransfers(), [dataVersion])
  const transactions = useMemo(
    () => (useApi ? toRows(apiTransactions.data) : getTransactions()),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [useApi, apiTransactions.data, dataVersion],
  )
  const walletError = useApi
    ? apiWallets.error || apiAccounts.error || apiTransactions.error
    : null

  const view = useMemo(
    () =>
      buildRetailerWalletView({
        organizationId: user?.organizationId,
        organizations,
        wallets,
        transfers,
        transactions,
        role: user?.role,
      }),
    [
      user?.organizationId,
      user?.role,
      organizations,
      wallets,
      transfers,
      transactions,
    ],
  )

  const uplineLabel = view.parentTypeLabel || 'Franchisee'
  const requestHint =
    view.parentTypeLabel === 'CWPC Admin'
      ? 'Request more via Internet Credits from CWPC Admin (cash + proof).'
      : 'Request more via Internet Credits from your franchisee.'

  return (
    <div>
      <PageHeader
        title="Wallet"
        description={`Available Credits for internet sales. ${requestHint}`}
        breadcrumbs={[
          { label: 'Home', href: getHomePathForRole(user?.role) },
          { label: 'Wallet' },
        ]}
      />

      {walletError ? (
        <div className="mb-4 rounded-md border border-danger/20 bg-danger/5 px-3 py-2 text-sm text-danger">
          {apiErrorMessage(walletError)}
        </div>
      ) : null}

      <LowBalanceAlert
        status={view.kpis.operatingStatus}
        availableBalance={view.kpis.operatingBalance}
        role={user?.role}
      />

      <div className="mb-4 grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Available Credits
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
              Min. {formatCurrency(view.kpis.minimumBalance)} · burned on
              internet sales
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {uplineLabel}
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
                  : 'Your upline for Internet Credits requests')}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card className="overflow-hidden shadow-sm">
        <CardHeader className="border-b border-border px-4 py-3">
          <CardTitle className="text-base font-semibold">
            Recent Credits Activity
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {view.activity.length === 0 ? (
            <div className="px-4 py-12 text-center text-sm text-muted-foreground">
              No credit releases yet. Request Internet Credits when you need
              inventory.
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
