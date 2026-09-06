import { useMemo, useState } from 'react'
import {
  AlertTriangle,
  Building2,
  Eye,
  Store,
  Users,
  Wallet,
} from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { isApiWired } from '@/lib/api/config'
import { useResourceData, toRows, apiErrorMessage } from '@/hooks/useResourceData'
import { listWalletsForRole, listAccountsForRole } from '@/services/api/roleResources'
import { ROLES } from '@/lib/constants'
import { formatCurrency } from '@/lib/currency'
import { DEFAULT_PAGE_SIZE, paginateItems } from '@/lib/pagination'
import { getHomePathForRole } from '@/lib/permissions'
import {
  buildFranchiseeWalletDirectory,
  buildSubFranchiseeWalletDirectory,
  buildWalletActivity,
  getWalletBalanceStatus,
  LOW_BALANCE_THRESHOLD,
  WALLET_BALANCE_STATUS,
  WALLET_BALANCE_STATUS_LABELS,
} from '@/lib/wallets'
import {
  getFundingTransfers,
  getOrganizations,
  getWallets,
} from '@/services/storage'
import { PageHeader } from '@/components/shared/PageHeader'
import { StatCard } from '@/components/shared/StatCard'
import { TablePagination } from '@/components/shared/TablePagination'
import { WalletDetailsSheet } from '@/components/shared/WalletDetailsSheet'
import { LowBalanceAlert } from '@/components/shared/LowBalanceAlert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
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

function TypeBadge({ label, orgType }) {
  return (
    <Badge
      className={cn(
        'rounded-full border-transparent px-2.5 py-1 font-medium',
        orgType === 'subfranchisee' && 'bg-blue-50 text-blue-700',
        orgType === 'franchisee' && 'bg-slate-100 text-slate-700',
        orgType === 'retailer' && 'bg-violet-50 text-violet-700',
      )}
    >
      {label}
    </Badge>
  )
}

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

export default function WalletManagementPage() {
  const { user, dataVersion } = useAuth()
  const isFranchisee = user?.role === ROLES.FRANCHISEE
  // T4: API-first wallets + activity when wired; storage until verify.
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
  const walletsError = useApi ? apiWallets.error || apiAccounts.error : null

  const directory = useMemo(() => {
    const args = {
      organizationId: user?.organizationId,
      organizations,
      wallets,
    }
    return isFranchisee
      ? buildFranchiseeWalletDirectory(args)
      : buildSubFranchiseeWalletDirectory(args)
  }, [isFranchisee, user?.organizationId, organizations, wallets])

  const [lowOnly, setLowOnly] = useState(false)
  const [page, setPage] = useState(0)
  const [selectedRow, setSelectedRow] = useState(null)

  const filteredRows = useMemo(() => {
    if (!lowOnly) return directory.rows
    return directory.rows.filter(
      (row) =>
        row.status === WALLET_BALANCE_STATUS.LOW ||
        row.status === WALLET_BALANCE_STATUS.ZERO,
    )
  }, [directory.rows, lowOnly])

  const {
    page: currentPage,
    items: paged,
  } = paginateItems(filteredRows, page, DEFAULT_PAGE_SIZE)

  const selectedActivity = useMemo(() => {
    if (!selectedRow) return []
    return buildWalletActivity({
      organizationId: selectedRow.organizationId,
      transfers,
      organizations,
      openingBalance: selectedRow.wallet?.openingBalance,
      availableBalance: selectedRow.availableBalance,
    })
  }, [selectedRow, transfers, organizations])

  const ownBalance = directory.kpis.operatingBalance
  const ownStatus = getWalletBalanceStatus(ownBalance)

  return (
    <div>
      <PageHeader
        title="Wallet Management"
        description={
          isFranchisee
            ? 'Monitor Available Credits for you and your retailers. Credit loads go through Internet Credits (cash + proof).'
            : 'Monitor Available Credits across your franchisees and retailers. Credit loads go through Internet Credits (cash + proof).'
        }
        breadcrumbs={[
          { label: 'Home', href: getHomePathForRole(user?.role) },
          { label: 'Wallets' },
        ]}
      />

      {walletsError ? (
        <div className="mb-4 rounded-md border border-danger/20 bg-danger/5 px-3 py-2 text-sm text-danger">
          {apiErrorMessage(walletsError)}
        </div>
      ) : null}

      <LowBalanceAlert
        status={ownStatus}
        availableBalance={ownBalance}
        role={user?.role}
      />

      <div
        className={cn(
          'mb-4 grid gap-4',
          isFranchisee ? 'lg:grid-cols-3' : 'lg:grid-cols-4',
        )}
      >
        <Card className="lg:col-span-1">
          <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Your Available Credits
            </CardTitle>
            <Wallet className="h-4 w-4 text-wallet" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold text-wallet">
              {formatCurrency(ownBalance)}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Credit inventory you can release to downlines
            </p>
          </CardContent>
        </Card>
        {!isFranchisee ? (
          <StatCard
            title="Franchisee Credits"
            value={formatCurrency(directory.kpis.franchiseeTotal)}
            description={`${directory.kpis.franchiseeWalletCount} franchisee${directory.kpis.franchiseeWalletCount === 1 ? '' : 's'}`}
            icon={Store}
          />
        ) : null}
        <StatCard
          title="Retailer Credits"
          value={formatCurrency(directory.kpis.retailerTotal)}
          description={`${directory.kpis.retailerWalletCount} retailer${directory.kpis.retailerWalletCount === 1 ? '' : 's'}`}
          icon={isFranchisee ? Store : Users}
        />
        <StatCard
          title={isFranchisee ? 'Managed Credits' : 'Network Credits'}
          value={directory.kpis.networkWalletCount}
          description={`${directory.kpis.lowBalanceCount} low / zero`}
          icon={Building2}
          accent={directory.kpis.lowBalanceCount > 0 ? 'warning' : 'default'}
        />
      </div>

      <Card className="mb-4 overflow-hidden shadow-sm">
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 space-y-0 border-b border-border px-4 py-3">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <CardTitle className="text-base font-semibold">
              Credits Directory
            </CardTitle>
            <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-800">
              Low ≤ ₱{LOW_BALANCE_THRESHOLD.toLocaleString('en-PH')}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant={lowOnly ? 'default' : 'outline'}
              size="sm"
              className={cn(
                lowOnly
                  ? 'bg-amber-600 text-white hover:bg-amber-700'
                  : 'border-amber-200 text-amber-700 hover:bg-amber-50',
              )}
              onClick={() => {
                setLowOnly((prev) => !prev)
                setPage(0)
              }}
            >
              <AlertTriangle className="h-3.5 w-3.5" />
              {directory.kpis.lowBalanceCount} Low Balance
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {paged.length === 0 ? (
            <div className="px-4 py-12 text-center text-sm text-muted-foreground">
              {lowOnly
                ? 'No low or zero balance wallets in your network.'
                : isFranchisee
                  ? 'No wallets found for you or your retailers.'
                  : 'No wallets found in your network.'}
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50 hover:bg-muted/50">
                      <TableHead>Wallet Owner</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Available Credits</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paged.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell>
                          <div className="font-semibold text-slate-900">
                            {row.ownerName}
                          </div>
                          <div className="text-xs text-slate-400">
                            {row.isOwnWallet
                              ? 'Your credits inventory'
                              : row.parentName}
                          </div>
                        </TableCell>
                        <TableCell>
                          <TypeBadge
                            label={row.typeLabel}
                            orgType={row.orgType}
                          />
                        </TableCell>
                        <TableCell className="whitespace-nowrap font-medium text-slate-900">
                          {formatCurrency(row.availableBalance)}
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={row.status} />
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="text-blue-600 hover:bg-blue-50 hover:text-blue-700"
                              onClick={() => setSelectedRow(row)}
                              aria-label={`View ${row.ownerName}`}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <TablePagination
                page={currentPage}
                pageSize={DEFAULT_PAGE_SIZE}
                total={filteredRows.length}
                onPageChange={setPage}
              />
            </>
          )}
        </CardContent>
      </Card>

      <WalletDetailsSheet
        open={Boolean(selectedRow)}
        onOpenChange={(open) => {
          if (!open) setSelectedRow(null)
        }}
        walletRow={selectedRow}
        activity={selectedActivity}
      />
    </div>
  )
}
