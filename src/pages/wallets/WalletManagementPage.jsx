import { useMemo, useState } from 'react'
import {
  AlertTriangle,
  ArrowLeftRight,
  Building2,
  Eye,
  Store,
  Users,
  Wallet,
} from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { ROLES } from '@/lib/constants'
import { formatCurrency } from '@/lib/currency'
import { getFundingWorkspaceConfig } from '@/lib/funding'
import { DEFAULT_PAGE_SIZE, paginateItems } from '@/lib/pagination'
import { getHomePathForRole } from '@/lib/permissions'
import {
  buildFranchiseeWalletDirectory,
  buildSubFranchiseeWalletDirectory,
  buildWalletActivity,
  WALLET_BALANCE_STATUS,
  WALLET_BALANCE_STATUS_LABELS,
} from '@/lib/wallets'
import { executeWalletTransfer } from '@/services/fundingActions'
import {
  getFundingTransfers,
  getOrganizations,
  getWallets,
} from '@/services/storage'
import { buildAmountConfirmRows, FundingConfirmDialog } from '@/components/shared/FundingConfirmDialog'
import { FundingSuccessDialog } from '@/components/shared/FundingSuccessDialog'
import { DirectTransferSheet } from '@/components/shared/DirectTransferSheet'
import { PageHeader } from '@/components/shared/PageHeader'
import { StatCard } from '@/components/shared/StatCard'
import { TablePagination } from '@/components/shared/TablePagination'
import { WalletDetailsSheet } from '@/components/shared/WalletDetailsSheet'
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
  const { user, dataVersion, bumpDataVersion } = useAuth()
  const isFranchisee = user?.role === ROLES.FRANCHISEE
  const organizations = useMemo(() => getOrganizations(), [dataVersion])
  const wallets = useMemo(() => getWallets(), [dataVersion])
  const transfers = useMemo(() => getFundingTransfers(), [dataVersion])

  const fundingConfig = useMemo(
    () =>
      getFundingWorkspaceConfig({
        role: user?.role,
        organizationId: user?.organizationId,
        organizations,
      }),
    [user?.role, user?.organizationId, organizations],
  )

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
  const [transferOpen, setTransferOpen] = useState(false)
  const [initialRecipientId, setInitialRecipientId] = useState('')
  const [confirmAction, setConfirmAction] = useState(null)
  const [actionBusy, setActionBusy] = useState(false)
  const [actionError, setActionError] = useState('')
  const [successAction, setSuccessAction] = useState(null)

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
    })
  }, [selectedRow, transfers, organizations])

  const ownBalance = directory.kpis.operatingBalance

  const openTransfer = (recipientId = '') => {
    setInitialRecipientId(recipientId || '')
    setTransferOpen(true)
  }

  const handleConfirmTransfer = () => {
    if (!confirmAction) return
    setActionBusy(true)
    setActionError('')
    try {
      const result = executeWalletTransfer(confirmAction.payload)
      setConfirmAction(null)
      bumpDataVersion()
      setSuccessAction({
        title: 'Transfer completed',
        message: 'Funds were transferred successfully.',
        details: [
          { label: 'Transfer', value: result.transfer.id },
          { label: 'Amount', value: formatCurrency(result.transfer.amount) },
        ],
      })
    } catch (error) {
      setActionError(error.message || 'Unable to complete this transfer.')
    } finally {
      setActionBusy(false)
    }
  }

  return (
    <div>
      <PageHeader
        title="Wallet Management"
        description={
          isFranchisee
            ? 'Monitor your operating wallet and manage liquidity for retailers under you.'
            : 'Monitor and manage platform liquidity across your organizational hierarchy.'
        }
        breadcrumbs={[
          { label: 'Home', href: getHomePathForRole(user?.role) },
          { label: 'Wallets' },
        ]}
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
              Operating Wallet Balance
            </CardTitle>
            <Wallet className="h-4 w-4 text-wallet" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold text-wallet">
              {formatCurrency(ownBalance)}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Your available operating balance
            </p>
          </CardContent>
        </Card>
        {!isFranchisee ? (
          <StatCard
            title="Franchisee Total"
            value={formatCurrency(directory.kpis.franchiseeTotal)}
            description={`${directory.kpis.franchiseeWalletCount} wallet${directory.kpis.franchiseeWalletCount === 1 ? '' : 's'}`}
            icon={Store}
          />
        ) : null}
        <StatCard
          title="Retailer Total"
          value={formatCurrency(directory.kpis.retailerTotal)}
          description={`${directory.kpis.retailerWalletCount} wallet${directory.kpis.retailerWalletCount === 1 ? '' : 's'}`}
          icon={isFranchisee ? Store : Users}
        />
        <StatCard
          title={isFranchisee ? 'Managed Wallets' : 'Network Wallets'}
          value={directory.kpis.networkWalletCount}
          description={`${directory.kpis.lowBalanceCount} low / zero`}
          icon={Building2}
          accent={directory.kpis.lowBalanceCount > 0 ? 'warning' : 'default'}
        />
      </div>

      <Card className="mb-4 overflow-hidden shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 border-b border-border px-4 py-3">
          <CardTitle className="text-base font-semibold">
            Wallet Directory
          </CardTitle>
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
            <Button
              type="button"
              className="bg-blue-600 text-white hover:bg-blue-700"
              onClick={() => openTransfer()}
            >
              <ArrowLeftRight className="h-4 w-4" />
              Transfer
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
                      <TableHead>Available Balance</TableHead>
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
                            {row.parentName}
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
                            {row.canTransferTo ? (
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                                onClick={() => openTransfer(row.organizationId)}
                                aria-label={`Transfer to ${row.ownerName}`}
                              >
                                <ArrowLeftRight className="h-4 w-4" />
                              </Button>
                            ) : null}
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

      <DirectTransferSheet
        open={transferOpen}
        onOpenChange={setTransferOpen}
        user={user}
        recipients={fundingConfig.recipients}
        recipientLabel={fundingConfig.recipientLabel}
        availableBalance={ownBalance}
        initialRecipientId={initialRecipientId}
        onConfirmIntent={(payload) => {
          setActionError('')
          setConfirmAction({ type: 'direct-transfer', payload })
        }}
      />

      <FundingConfirmDialog
        open={Boolean(confirmAction)}
        onOpenChange={(open) => {
          if (!open && !actionBusy) {
            setConfirmAction(null)
            setActionError('')
          }
        }}
        title="Confirm direct transfer"
        description="This will debit your wallet and credit the recipient."
        rows={
          confirmAction
            ? buildAmountConfirmRows({
                amount: confirmAction.payload.amount,
                balanceAfter: confirmAction.payload.balanceAfter,
                counterpartyLabel:
                  confirmAction.payload.recipientLabel || 'Recipient',
                counterpartyName: confirmAction.payload.recipientName,
              })
            : []
        }
        confirmLabel="Confirm Transfer"
        busy={actionBusy}
        error={actionError}
        onConfirm={handleConfirmTransfer}
      />

      <FundingSuccessDialog
        open={Boolean(successAction)}
        onOpenChange={(open) => {
          if (!open) setSuccessAction(null)
        }}
        title={successAction?.title}
        message={successAction?.message || ''}
        details={successAction?.details || []}
      />
    </div>
  )
}
