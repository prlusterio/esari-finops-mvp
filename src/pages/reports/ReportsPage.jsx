import { useEffect, useMemo, useState } from 'react'
import {
  Download,
  Eye,
  Banknote,
  Receipt,
  Store,
  Users,
} from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { ROLES, TRANSACTION_STATUS, TRANSACTION_STATUS_LABELS } from '@/lib/constants'
import { formatCurrency } from '@/lib/currency'
import { formatReportPeriodLabel } from '@/lib/date'
import { DEFAULT_PAGE_SIZE, paginateItems } from '@/lib/pagination'
import { DateTimeCell } from '@/components/shared/DateTimeCell'
import { SignedAmount } from '@/components/shared/SignedAmount'
import { TablePagination } from '@/components/shared/TablePagination'
import { getHomePathForRole } from '@/lib/permissions'
import {
  buildPartyRevenueDetailEntries,
  buildReportSnapshot,
  exportTransactionsCsv,
  getNetworkFilterOptions,
  getReportsPageConfig,
  partyRevenueDetailEntriesToCsv,
  revenueEntriesToCsv,
} from '@/lib/reports'
import { getTransactionShareAmounts } from '@/lib/revenue'
import {
  getActiveSharePercentages,
  getTransactionsPageConfig,
  sortTransactionsNewest,
} from '@/lib/transactions'
import {
  getFundingRequests,
  getFundingTransfers,
  getOrganizations,
  getRevenueSharing,
  getTransactions,
} from '@/services/storage'
import { PageHeader } from '@/components/shared/PageHeader'
import { StatCard } from '@/components/shared/StatCard'
import { TransactionDetailsDialog } from '@/components/shared/TransactionDetailsDialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { cn } from '@/lib/utils'

function downloadCsv(filename, content) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

function sumRows(rows, field) {
  return rows.reduce((sum, row) => sum + (Number(row[field]) || 0), 0)
}

function TransactionStatusBadge({ status }) {
  const isCompleted = status === TRANSACTION_STATUS.COMPLETED
  return (
    <Badge
      className={cn(
        'rounded-full border-transparent px-2.5 py-1 font-medium',
        isCompleted
          ? 'bg-emerald-50 text-emerald-700'
          : 'bg-amber-50 text-amber-700',
      )}
    >
      {TRANSACTION_STATUS_LABELS[status] || status}
    </Badge>
  )
}

function ExportCard({ title, description, count, onExport, disabled }) {
  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold text-slate-900">
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">{description}</p>
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-medium text-slate-700">
            {count} record{count === 1 ? '' : 's'}
          </p>
          <Button
            type="button"
            variant="outline"
            disabled={disabled || count === 0}
            onClick={onExport}
          >
            <Download className="h-4 w-4" />
            Export CSV
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

function NetworkRevenueTable({
  title,
  description,
  rows,
  emptyLabel,
  showParentColumn = false,
  showRetailerCount = false,
  showViewerCommission = false,
  entityLabel = 'Organization',
  partyCommissionLabel = 'Their Commission',
  viewerCommissionLabel = 'Your Commission',
  onView,
  onExport,
}) {
  const totals = {
    transactionCount: sumRows(rows, 'transactionCount'),
    retailerCount: sumRows(rows, 'retailerCount'),
    customerPayment: sumRows(rows, 'customerPayment'),
    creditedRevenue: sumRows(rows, 'creditedRevenue'),
    viewerCommission: sumRows(rows, 'viewerCommission'),
  }

  return (
    <Card className="overflow-hidden shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 border-b border-border px-4 py-3">
        <div>
          <CardTitle className="text-base font-semibold">{title}</CardTitle>
          {description ? (
            <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
          ) : null}
        </div>
        <p className="text-sm text-muted-foreground">
          {rows.length} {rows.length === 1 ? entityLabel.toLowerCase() : `${entityLabel.toLowerCase()}s`}
        </p>
      </CardHeader>
      <CardContent className="p-0">
        {rows.length === 0 ? (
          <div className="px-4 py-12 text-center text-sm text-muted-foreground">
            {emptyLabel}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50 hover:bg-muted/50">
                  <TableHead>{entityLabel}</TableHead>
                  {showParentColumn ? <TableHead>Franchisee</TableHead> : null}
                  {showRetailerCount ? (
                    <TableHead className="text-right">Retailers</TableHead>
                  ) : null}
                  <TableHead className="text-right">Txns</TableHead>
                  <TableHead className="text-right">Sales Volume</TableHead>
                  <TableHead className="text-right">{partyCommissionLabel}</TableHead>
                  {showViewerCommission ? (
                    <>
                      <TableHead className="text-right">
                        {viewerCommissionLabel}
                      </TableHead>
                      <TableHead className="text-right">% of Yours</TableHead>
                    </>
                  ) : null}
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.organizationId}>
                    <TableCell>
                      <div className="font-semibold text-slate-900">
                        {row.name}
                      </div>
                      {row.code ? (
                        <div className="text-xs text-slate-400">{row.code}</div>
                      ) : null}
                    </TableCell>
                    {showParentColumn ? (
                      <TableCell className="text-slate-600">
                        {row.parentName || '—'}
                      </TableCell>
                    ) : null}
                    {showRetailerCount ? (
                      <TableCell className="text-right tabular-nums">
                        {row.retailerCount ?? 0}
                      </TableCell>
                    ) : null}
                    <TableCell className="text-right tabular-nums">
                      {row.transactionCount}
                    </TableCell>
                    <TableCell className="text-right tabular-nums font-medium">
                      {formatCurrency(row.customerPayment)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatCurrency(row.creditedRevenue)}
                    </TableCell>
                    {showViewerCommission ? (
                      <>
                        <TableCell className="text-right tabular-nums font-medium text-emerald-700">
                          {formatCurrency(row.viewerCommission)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-slate-600">
                          {row.shareOfViewerTotal.toFixed(1)}%
                        </TableCell>
                      </>
                    ) : null}
                    <TableCell>
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="text-blue-600 hover:bg-blue-50 hover:text-blue-700"
                          onClick={() => onView?.(row)}
                          aria-label={`View ${row.name}`}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                          onClick={() => onExport?.(row)}
                          disabled={row.transactionCount === 0}
                          aria-label={`Export ${row.name}`}
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                <TableRow className="bg-muted/30 font-medium hover:bg-muted/30">
                  <TableCell>Total</TableCell>
                  {showParentColumn ? <TableCell /> : null}
                  {showRetailerCount ? (
                    <TableCell className="text-right tabular-nums">
                      {totals.retailerCount}
                    </TableCell>
                  ) : null}
                  <TableCell className="text-right tabular-nums">
                    {totals.transactionCount}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatCurrency(totals.customerPayment)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatCurrency(totals.creditedRevenue)}
                  </TableCell>
                  {showViewerCommission ? (
                    <>
                      <TableCell className="text-right tabular-nums text-emerald-700">
                        {formatCurrency(totals.viewerCommission)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        100%
                      </TableCell>
                    </>
                  ) : null}
                  <TableCell />
                </TableRow>
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function NetworkPartyRevenueDialog({
  open,
  onOpenChange,
  selection,
  entries,
  periodLabel,
  showViewerCommission,
  viewerCommissionLabel = 'Your Commission',
  onExport,
}) {
  const party = selection?.row
  const partyLabel = selection?.entityLabel || 'Party'
  const partyCommissionLabel = `${partyLabel} Commission`
  const viewerTotal = sumRows(entries, 'viewerRevenue')
  const partyTotal = sumRows(entries, 'partyRevenue')

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] max-w-4xl flex-col gap-0 overflow-hidden p-0 sm:rounded-xl">
        <DialogHeader className="border-b border-border px-6 py-4 text-left">
          <DialogTitle>{party?.name || partyLabel} Commission</DialogTitle>
          <DialogDescription>
            {party?.code ? `${party.code} · ` : ''}
            {party?.parentName ? `${party.parentName} · ` : ''}
            Commission detail for {periodLabel}.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 overflow-y-auto px-6 py-4">
          <div
            className={cn(
              'grid gap-3',
              showViewerCommission ? 'sm:grid-cols-5' : 'sm:grid-cols-4',
            )}
          >
            <div className="rounded-lg border border-border px-3 py-2">
              <p className="text-xs text-muted-foreground">Transactions</p>
              <p className="mt-1 text-lg font-semibold tabular-nums">
                {party?.transactionCount ?? 0}
              </p>
            </div>
            <div className="rounded-lg border border-border px-3 py-2">
              <p className="text-xs text-muted-foreground">Sales Volume</p>
              <p className="mt-1 text-lg font-semibold tabular-nums">
                {formatCurrency(party?.customerPayment ?? 0)}
              </p>
            </div>
            <div className="rounded-lg border border-border px-3 py-2">
              <p className="text-xs text-muted-foreground">Commission Pool</p>
              <p className="mt-1 text-lg font-semibold tabular-nums">
                {formatCurrency(party?.distributable ?? 0)}
              </p>
            </div>
            <div className="rounded-lg border border-border px-3 py-2">
              <p className="text-xs text-muted-foreground">{partyCommissionLabel}</p>
              <p className="mt-1 text-lg font-semibold tabular-nums">
                {formatCurrency(party?.creditedRevenue ?? partyTotal)}
              </p>
            </div>
            {showViewerCommission ? (
              <div className="rounded-lg border border-border px-3 py-2">
                <p className="text-xs text-muted-foreground">
                  {viewerCommissionLabel}
                </p>
                <p className="mt-1 text-lg font-semibold tabular-nums text-emerald-700">
                  {formatCurrency(party?.viewerCommission ?? viewerTotal)}
                </p>
              </div>
            ) : null}
          </div>

          {entries.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
              No transactions for this {partyLabel.toLowerCase()} in the selected
              period.
            </div>
          ) : (
            <div className="overflow-hidden rounded-lg border border-border">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50 hover:bg-muted/50">
                      <TableHead>Reference</TableHead>
                      <TableHead>Date</TableHead>
                      {selection?.partyType === 'franchisee' ? (
                        <TableHead>Retailer</TableHead>
                      ) : null}
                      <TableHead className="text-right">Sales Volume</TableHead>
                      <TableHead className="text-right">{partyCommissionLabel}</TableHead>
                      {showViewerCommission ? (
                        <TableHead className="text-right">
                          {viewerCommissionLabel}
                        </TableHead>
                      ) : null}
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {entries.map((entry) => (
                      <TableRow key={entry.id}>
                        <TableCell className="font-medium text-slate-900">
                          {entry.reference}
                        </TableCell>
                        <TableCell>
                          <DateTimeCell value={entry.createdAt} />
                        </TableCell>
                        {selection?.partyType === 'franchisee' ? (
                          <TableCell>
                            <div className="font-medium text-slate-900">
                              {entry.retailerName || '—'}
                            </div>
                            {entry.retailerCode ? (
                              <div className="text-xs text-slate-400">
                                {entry.retailerCode}
                              </div>
                            ) : null}
                          </TableCell>
                        ) : null}
                        <TableCell className="text-right tabular-nums">
                          {formatCurrency(entry.customerPayment)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatCurrency(entry.partyRevenue)}
                        </TableCell>
                        {showViewerCommission ? (
                          <TableCell className="text-right tabular-nums font-medium text-emerald-700">
                            {formatCurrency(entry.viewerRevenue ?? 0)}
                          </TableCell>
                        ) : null}
                        <TableCell>
                          <TransactionStatusBadge status={entry.transactionStatus} />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="border-t border-border px-6 py-4 sm:justify-between">
          <p className="text-sm text-muted-foreground">
            {entries.length} transaction{entries.length === 1 ? '' : 's'}
          </p>
          <Button
            type="button"
            variant="outline"
            disabled={entries.length === 0}
            onClick={onExport}
          >
            <Download className="h-4 w-4" />
            Export CSV
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default function ReportsPage() {
  const { user, dataVersion } = useAuth()
  const config = useMemo(
    () => getReportsPageConfig(user?.role),
    [user?.role],
  )
  const txConfig = useMemo(
    () => getTransactionsPageConfig(user?.role),
    [user?.role],
  )
  const organizations = useMemo(() => getOrganizations(), [dataVersion])
  const networkOptions = useMemo(
    () => getNetworkFilterOptions(organizations, user?.organizationId),
    [organizations, user?.organizationId],
  )

  const [dateRange, setDateRange] = useState(config.defaultDateRange || 'all')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const [franchiseeId, setFranchiseeId] = useState('all')
  const [retailerId, setRetailerId] = useState('all')
  const [appliedFilters, setAppliedFilters] = useState({
    dateRange: config.defaultDateRange || 'all',
    customFrom: '',
    customTo: '',
    franchiseeId: 'all',
    retailerId: 'all',
  })
  const [page, setPage] = useState(0)
  const [selectedTx, setSelectedTx] = useState(null)
  const [selectedParty, setSelectedParty] = useState(null)

  useEffect(() => {
    const nextRange = config.defaultDateRange || 'all'
    setDateRange(nextRange)
    setCustomFrom('')
    setCustomTo('')
    setFranchiseeId('all')
    setRetailerId('all')
    setAppliedFilters({
      dateRange: nextRange,
      customFrom: '',
      customTo: '',
      franchiseeId: 'all',
      retailerId: 'all',
    })
    setPage(0)
    setSelectedParty(null)
  }, [user?.role, config.defaultDateRange])

  const retailerOptions = useMemo(() => {
    if (config.showRetailerFilter) return networkOptions.allRetailers
    if (franchiseeId === 'all') return networkOptions.allRetailers
    return networkOptions.retailersByFranchisee[franchiseeId] || []
  }, [config.showRetailerFilter, franchiseeId, networkOptions])

  const customDateInvalid =
    dateRange === 'custom' &&
    Boolean(customFrom && customTo && new Date(customFrom) > new Date(customTo))

  const customDateIncomplete =
    dateRange === 'custom' && (!customFrom || !customTo)

  useEffect(() => {
    if (customDateIncomplete || customDateInvalid) return

    setAppliedFilters({
      dateRange,
      customFrom,
      customTo,
      franchiseeId: config.showNetworkFilters ? franchiseeId : 'all',
      retailerId:
        config.showNetworkFilters || config.showRetailerFilter
          ? retailerId
          : 'all',
    })
    setPage(0)
  }, [
    dateRange,
    customFrom,
    customTo,
    franchiseeId,
    retailerId,
    customDateIncomplete,
    customDateInvalid,
    config.showNetworkFilters,
    config.showRetailerFilter,
  ])

  const periodLabel = useMemo(
    () =>
      formatReportPeriodLabel(appliedFilters.dateRange, {
        from: appliedFilters.customFrom,
        to: appliedFilters.customTo,
      }),
    [appliedFilters],
  )

  const snapshot = useMemo(() => {
    return buildReportSnapshot({
      role: user?.role,
      organizationId: user?.organizationId,
      dateRange: appliedFilters.dateRange,
      customDateRange: {
        from: appliedFilters.customFrom,
        to: appliedFilters.customTo,
      },
      franchiseeId: appliedFilters.franchiseeId,
      retailerId: appliedFilters.retailerId,
      organizations,
      transactions: getTransactions(),
      fundingRequests: getFundingRequests(),
      fundingTransfers: getFundingTransfers(),
      wallets: [],
      revenueSharing: getRevenueSharing(),
    })
  }, [
    user?.role,
    user?.organizationId,
    appliedFilters,
    organizations,
    dataVersion,
  ])

  const {
    kpis,
    datasets,
    orgById,
    franchiseeRevenueRows = [],
    retailerRevenueRows = [],
    networkEarnings,
  } = snapshot
  const roleSlug = user?.role || 'export'
  const showViewerCommission = Boolean(config.showViewerCommissionColumn)

  const detailedTransactions = useMemo(
    () => sortTransactionsNewest(datasets.transactions),
    [datasets.transactions],
  )

  const activeSharePercentages = useMemo(
    () => getActiveSharePercentages(getRevenueSharing()),
    [dataVersion],
  )

  const {
    page: currentPage,
    items: paged,
  } = paginateItems(detailedTransactions, page, DEFAULT_PAGE_SIZE)

  const selectedPartyEntries = useMemo(() => {
    if (!selectedParty) return []
    return buildPartyRevenueDetailEntries({
      transactions: datasets.transactions,
      revenueSharing: getRevenueSharing(),
      partyRole: selectedParty.partyRole,
      organizationId: selectedParty.row.organizationId,
      partyType: selectedParty.partyType,
      viewerRole: showViewerCommission ? user?.role : null,
    })
  }, [
    selectedParty,
    datasets.transactions,
    dataVersion,
    showViewerCommission,
    user?.role,
  ])

  const exportPartyRevenue = (selection, entries) => {
    if (!selection) return
    const slug = selection.row.code || selection.row.organizationId || 'party'
    downloadCsv(
      `esarisari-${selection.partyType}-revenue-${slug}.csv`,
      partyRevenueDetailEntriesToCsv(entries, {
        partyLabel: selection.entityLabel,
        includeViewerCommission: showViewerCommission,
        viewerLabel: config.viewerCommissionLabel || 'Your Commission',
      }),
    )
  }

  const handleViewParty = (row, partyType) => {
    setSelectedParty({
      row,
      partyType,
      partyRole:
        partyType === 'franchisee' ? ROLES.FRANCHISEE : ROLES.RETAILER,
      entityLabel: partyType === 'franchisee' ? 'Franchisee' : 'Retailer',
    })
  }

  const handleExportParty = (row, partyType) => {
    const selection = {
      row,
      partyType,
      partyRole:
        partyType === 'franchisee' ? ROLES.FRANCHISEE : ROLES.RETAILER,
      entityLabel: partyType === 'franchisee' ? 'Franchisee' : 'Retailer',
    }
    const entries = buildPartyRevenueDetailEntries({
      transactions: datasets.transactions,
      revenueSharing: getRevenueSharing(),
      partyRole: selection.partyRole,
      organizationId: row.organizationId,
      partyType,
      viewerRole: showViewerCommission ? user?.role : null,
    })
    exportPartyRevenue(selection, entries)
  }

  const handleFranchiseeChange = (value) => {
    setFranchiseeId(value)
    setRetailerId('all')
  }

  const filterGridClass = config.showNetworkFilters
    ? 'lg:grid-cols-3'
    : config.showRetailerFilter
      ? 'sm:grid-cols-2'
      : 'sm:grid-cols-1'

  return (
    <div>
      <PageHeader
        title="Reports"
        description={config.subtitle}
        breadcrumbs={[
          { label: 'Home', href: getHomePathForRole(user?.role) },
          { label: 'Reports' },
        ]}
      />

      <Card className="mb-4 shadow-sm">
        <CardContent className={cn('grid gap-3 p-4', filterGridClass)}>
          <div className="space-y-2">
            <Label className="text-xs text-slate-500">Date Range</Label>
            <Select value={dateRange} onValueChange={setDateRange}>
              <SelectTrigger>
                <SelectValue placeholder="Select range" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="this_month">This Month</SelectItem>
                <SelectItem value="7d">Last 7 Days</SelectItem>
                <SelectItem value="30d">Last 30 Days</SelectItem>
                <SelectItem value="3m">Last 3 Months</SelectItem>
                <SelectItem value="6m">Last 6 Months</SelectItem>
                <SelectItem value="this_year">This Year</SelectItem>
                <SelectItem value="last_year">Last Year</SelectItem>
                <SelectItem value="all">All Time</SelectItem>
                {config.showCustomDateRange ? (
                  <SelectItem value="custom">Custom Range</SelectItem>
                ) : null}
              </SelectContent>
            </Select>
          </div>

          {config.showNetworkFilters ? (
            <>
              <div className="space-y-2">
                <Label className="text-xs text-slate-500">Franchisee</Label>
                <Select value={franchiseeId} onValueChange={handleFranchiseeChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Franchisees" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Franchisees</SelectItem>
                    {networkOptions.franchisees.map((org) => (
                      <SelectItem key={org.id} value={org.id}>
                        {org.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-xs text-slate-500">Retailer</Label>
                <Select value={retailerId} onValueChange={setRetailerId}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Retailers" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Retailers</SelectItem>
                    {retailerOptions.map((org) => (
                      <SelectItem key={org.id} value={org.id}>
                        {org.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </>
          ) : null}

          {config.showRetailerFilter ? (
            <div className="space-y-2">
              <Label className="text-xs text-slate-500">Retailer</Label>
              <Select value={retailerId} onValueChange={setRetailerId}>
                <SelectTrigger>
                  <SelectValue placeholder="All Retailers" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Retailers</SelectItem>
                  {retailerOptions.map((org) => (
                    <SelectItem key={org.id} value={org.id}>
                      {org.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}

          {config.showCustomDateRange && dateRange === 'custom' ? (
            <div
              className={cn(
                'grid gap-3 sm:grid-cols-2',
                config.showNetworkFilters
                  ? 'lg:col-span-3'
                  : config.showRetailerFilter
                    ? 'sm:col-span-2'
                    : 'sm:col-span-1',
              )}
            >
              <div className="space-y-2">
                <Label className="text-xs text-slate-500" htmlFor="report-from">
                  From
                </Label>
                <Input
                  id="report-from"
                  type="date"
                  value={customFrom}
                  onChange={(event) => setCustomFrom(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-slate-500" htmlFor="report-to">
                  To
                </Label>
                <Input
                  id="report-to"
                  type="date"
                  value={customTo}
                  onChange={(event) => setCustomTo(event.target.value)}
                />
              </div>
              {customDateInvalid ? (
                <p className="text-sm text-red-600 sm:col-span-2">
                  From date must be on or before To date.
                </p>
              ) : null}
            </div>
          ) : null}
        </CardContent>
      </Card>

      {config.showNetworkEarningsHero ? (
        <div
          className={cn(
            'mb-4 grid gap-4 sm:grid-cols-2',
            config.showFranchiseeRevenueTable
              ? 'xl:grid-cols-4'
              : config.showRetailerRevenueTable
                ? 'xl:grid-cols-3'
                : 'xl:grid-cols-2',
          )}
        >
          <StatCard
            title={config.yourCommissionLabel || 'Your Commission'}
            value={formatCurrency(networkEarnings?.yourCommission ?? kpis.creditedRevenue)}
            description={`For ${periodLabel}`}
            descriptionBelowTitle
            icon={Banknote}
            accent="success"
          />
          {config.showFranchiseeRevenueTable ? (
            <StatCard
              title="Franchisee Commissions"
              value={formatCurrency(networkEarnings?.franchiseeCommission ?? 0)}
              description={`Network franchisees · ${periodLabel}`}
              descriptionBelowTitle
              icon={Users}
            />
          ) : null}
          {config.showRetailerRevenueTable ? (
            <StatCard
              title="Retailer Commissions"
              value={formatCurrency(networkEarnings?.retailerCommission ?? 0)}
              description={`Network retailers · ${periodLabel}`}
              descriptionBelowTitle
              icon={Store}
            />
          ) : null}
          <StatCard
            title="Sales Volume"
            value={formatCurrency(networkEarnings?.salesVolume ?? kpis.customerPaymentTotal)}
            description={`${kpis.completedTxCount} transactions · ${periodLabel}`}
            descriptionBelowTitle
            icon={Receipt}
          />
        </div>
      ) : (
        <div className="mb-4 grid gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <div>
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Transaction Activity
                </CardTitle>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  {kpis.completedTxCount} completed · {periodLabel}
                </p>
              </div>
              <Receipt className="h-4 w-4 shrink-0 text-foreground" />
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 divide-x divide-border">
                <div className="pr-3">
                  <p className="truncate text-xs text-muted-foreground">Count</p>
                  <p className="mt-1 truncate text-lg font-semibold tabular-nums text-foreground">
                    {kpis.transactionCount}
                  </p>
                </div>
                <div className="px-3">
                  <p className="truncate text-xs text-muted-foreground">
                    Sales Volume
                  </p>
                  <p className="mt-1 truncate text-lg font-semibold tabular-nums text-success">
                    {formatCurrency(kpis.customerPaymentTotal)}
                  </p>
                </div>
                <div className="pl-3">
                  <p className="truncate text-xs text-muted-foreground">
                    Commission Pool
                  </p>
                  <p className="mt-1 truncate text-lg font-semibold tabular-nums text-success">
                    {formatCurrency(kpis.distributableTotal)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          <StatCard
            title={config.yourCommissionLabel || 'Your Commission'}
            value={formatCurrency(kpis.creditedRevenue)}
            description={`For ${periodLabel}`}
            descriptionBelowTitle
            icon={Banknote}
            accent="success"
          />
        </div>
      )}

      {config.showFranchiseeRevenueTable || config.showRetailerRevenueTable ? (
        <div className="mb-4 space-y-4">
          {config.showFranchiseeRevenueTable ? (
            <NetworkRevenueTable
              title="Franchisee Commissions"
              description={`What each franchisee earned, and ${
                user?.role === ROLES.ADMIN ? 'platform' : 'your'
              } commission from their volume · ${periodLabel}.`}
              rows={franchiseeRevenueRows}
              emptyLabel="No franchisees in your network for the selected filters."
              entityLabel="Franchisee"
              showRetailerCount
              showViewerCommission={showViewerCommission}
              partyCommissionLabel="Their Commission"
              viewerCommissionLabel={
                config.viewerCommissionLabel || 'Your Commission'
              }
              onView={(row) => handleViewParty(row, 'franchisee')}
              onExport={(row) => handleExportParty(row, 'franchisee')}
            />
          ) : null}
          {config.showRetailerRevenueTable ? (
            <NetworkRevenueTable
              title="Retailer Commissions"
              description={`What each retailer earned, and ${
                user?.role === ROLES.ADMIN ? 'platform' : 'your'
              } commission from their volume · ${periodLabel}.`}
              rows={retailerRevenueRows}
              emptyLabel="No retailers in your network for the selected filters."
              entityLabel="Retailer"
              showParentColumn={Boolean(config.showFranchiseeRevenueTable)}
              showViewerCommission={showViewerCommission}
              partyCommissionLabel="Their Commission"
              viewerCommissionLabel={
                config.viewerCommissionLabel || 'Your Commission'
              }
              onView={(row) => handleViewParty(row, 'retailer')}
              onExport={(row) => handleExportParty(row, 'retailer')}
            />
          ) : null}
        </div>
      ) : null}

      <Card className="mb-4 overflow-hidden shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 border-b border-border px-4 py-3">
          <CardTitle className="text-base font-semibold">
            Transactions
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            {detailedTransactions.length} in selected period
          </p>
        </CardHeader>
        <CardContent className="p-0">
          {paged.length === 0 ? (
            <div className="px-4 py-12 text-center text-sm text-muted-foreground">
              No transactions in the selected period.
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50 hover:bg-muted/50">
                      <TableHead>Reference</TableHead>
                      <TableHead>Date</TableHead>
                      {txConfig.showRetailerColumn ? (
                        <TableHead>Retailer</TableHead>
                      ) : null}
                      <TableHead>Customer Payment</TableHead>
                      <TableHead>Wallet Deduction</TableHead>
                      <TableHead>Distributable Rev.</TableHead>
                      <TableHead>Retailer</TableHead>
                      <TableHead>Franchisee</TableHead>
                      <TableHead>Sub-Franchisee</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paged.map((tx) => {
                      const retailer = orgById[tx.retailerOrganizationId] || null
                      const shares = getTransactionShareAmounts(
                        tx,
                        activeSharePercentages,
                      )
                      return (
                        <TableRow key={tx.id}>
                          <TableCell className="font-medium text-slate-900">
                            {tx.reference || tx.id}
                          </TableCell>
                          <TableCell>
                            <DateTimeCell value={tx.createdAt} />
                          </TableCell>
                          {txConfig.showRetailerColumn ? (
                            <TableCell>
                              <div className="font-semibold text-slate-900">
                                {tx.retailerName || retailer?.name || '—'}
                              </div>
                              <div className="text-xs text-slate-400">
                                {orgById[tx.franchiseeOrganizationId]?.name ||
                                  (retailer?.parentId
                                    ? orgById[retailer.parentId]?.name
                                    : null) ||
                                  '—'}
                              </div>
                            </TableCell>
                          ) : null}
                          <TableCell className="whitespace-nowrap font-medium">
                            {formatCurrency(tx.customerPayment)}
                          </TableCell>
                          <TableCell className="whitespace-nowrap">
                            <SignedAmount
                              amount={tx.walletDeduction}
                              direction="debit"
                            />
                          </TableCell>
                          <TableCell className="whitespace-nowrap">
                            <SignedAmount
                              amount={shares.distributable}
                              direction="credit"
                              showSign={false}
                            />
                          </TableCell>
                          <TableCell className="whitespace-nowrap">
                            <SignedAmount
                              amount={shares.retailer}
                              direction="credit"
                              showSign={false}
                            />
                          </TableCell>
                          <TableCell className="whitespace-nowrap">
                            <SignedAmount
                              amount={shares.franchisee}
                              direction="credit"
                              showSign={false}
                            />
                          </TableCell>
                          <TableCell className="whitespace-nowrap">
                            <SignedAmount
                              amount={shares.subfranchisee}
                              direction="credit"
                              showSign={false}
                            />
                          </TableCell>
                          <TableCell>
                            <TransactionStatusBadge status={tx.status} />
                          </TableCell>
                          <TableCell>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="text-blue-600 hover:bg-blue-50 hover:text-blue-700"
                              onClick={() => setSelectedTx(tx)}
                              aria-label={`View ${tx.reference || tx.id}`}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>

              <TablePagination
                page={currentPage}
                pageSize={DEFAULT_PAGE_SIZE}
                total={detailedTransactions.length}
                onPageChange={setPage}
              />
            </>
          )}
        </CardContent>
      </Card>

      <div className="mb-4">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
          Export Reports
        </h2>
        <div className="grid gap-4 md:grid-cols-2">
          <ExportCard
            title="Transactions"
            description="Sales volume and commission shares for your scope."
            count={datasets.transactions.length}
            onExport={() =>
              downloadCsv(
                `esarisari-transactions-report-${roleSlug}.csv`,
                exportTransactionsCsv(datasets.transactions, orgById, {
                  revenueSharing: getRevenueSharing(),
                }),
              )
            }
          />
          {config.showRevenueExport ? (
            <ExportCard
              title="Your Commission"
              description="Your per-transaction commission for the selected period."
              count={datasets.revenueEntries.length}
              onExport={() =>
                downloadCsv(
                  `esarisari-revenue-report-${roleSlug}.csv`,
                  revenueEntriesToCsv(datasets.revenueEntries),
                )
              }
            />
          ) : null}
        </div>
      </div>

      <NetworkPartyRevenueDialog
        open={Boolean(selectedParty)}
        onOpenChange={(open) => {
          if (!open) setSelectedParty(null)
        }}
        selection={selectedParty}
        entries={selectedPartyEntries}
        periodLabel={periodLabel}
        showViewerCommission={showViewerCommission}
        viewerCommissionLabel={
          config.viewerCommissionLabel || 'Your Commission'
        }
        onExport={() =>
          exportPartyRevenue(selectedParty, selectedPartyEntries)
        }
      />

      <TransactionDetailsDialog
        open={Boolean(selectedTx)}
        onOpenChange={(open) => {
          if (!open) setSelectedTx(null)
        }}
        transaction={selectedTx}
        organizations={organizations}
        role={user?.role}
      />
    </div>
  )
}
