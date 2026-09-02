import { useEffect, useMemo, useState } from 'react'
import { Download, Eye, Filter, Plus } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { ROLES, TRANSACTION_STATUS, TRANSACTION_STATUS_LABELS } from '@/lib/constants'
import { formatCurrency } from '@/lib/currency'
import { DEFAULT_PAGE_SIZE, paginateItems } from '@/lib/pagination'
import { getNetworkFilterOptions } from '@/lib/reports'
import { DateTimeCell } from '@/components/shared/DateTimeCell'
import { SignedAmount } from '@/components/shared/SignedAmount'
import { TablePagination } from '@/components/shared/TablePagination'
import { getHomePathForRole } from '@/lib/permissions'
import {
  applyTransactionFilters,
  filterTransactionsForRole,
  getTransactionsPageConfig,
  getViewerShareAmountForRole,
  sortTransactionsNewest,
  transactionsToCsv,
} from '@/lib/transactions'
import {
  getOrganizations,
  getRevenueSharing,
  getTransactions,
} from '@/services/storage'
import { FranchiseCollectionsPanel } from '@/components/shared/FranchiseCollectionsPanel'
import { PageHeader } from '@/components/shared/PageHeader'
import { DummyTransactionDialog } from '@/components/shared/DummyTransactionDialog'
import { TransactionDetailsDialog } from '@/components/shared/TransactionDetailsDialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
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

export default function TransactionsPage() {
  const { user, dataVersion, bumpDataVersion } = useAuth()
  const config = useMemo(
    () => getTransactionsPageConfig(user?.role),
    [user?.role],
  )

  const organizations = useMemo(() => getOrganizations(), [dataVersion])
  const orgById = useMemo(
    () => Object.fromEntries(organizations.map((org) => [org.id, org])),
    [organizations],
  )

  const [dateRange, setDateRange] = useState('all')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const [retailerId, setRetailerId] = useState('all')
  const [search, setSearch] = useState('')
  const [appliedFilters, setAppliedFilters] = useState({
    dateRange: 'all',
    customDateRange: null,
    retailerId: 'all',
    search: '',
    status: TRANSACTION_STATUS.COMPLETED,
  })
  const [page, setPage] = useState(0)
  const [selectedTx, setSelectedTx] = useState(null)
  const [demoSaleOpen, setDemoSaleOpen] = useState(false)
  const canRecordDemoSale = user?.role === ROLES.RETAILER

  useEffect(() => {
    setPage(0)
    setDateRange('all')
    setCustomFrom('')
    setCustomTo('')
    setRetailerId('all')
    setSearch('')
    setAppliedFilters({
      dateRange: 'all',
      customDateRange: null,
      retailerId: 'all',
      search: '',
      status: TRANSACTION_STATUS.COMPLETED,
    })
  }, [user?.role])

  const retailerOptions = useMemo(() => {
    if (!config.showRetailerColumn || !user?.organizationId) return []

    if (user.role === ROLES.SUBFRANCHISEE) {
      return getNetworkFilterOptions(organizations, user.organizationId)
        .allRetailers
    }

    if (user.role === ROLES.FRANCHISEE) {
      return organizations
        .filter(
          (org) =>
            org.parentId === user.organizationId && org.type === 'retailer',
        )
        .sort((a, b) => a.name.localeCompare(b.name))
    }

    return organizations
      .filter((org) => org.type === 'retailer')
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [
    config.showRetailerColumn,
    organizations,
    user?.organizationId,
    user?.role,
  ])

  const scopedTransactions = useMemo(() => {
    const all = getTransactions()
    return sortTransactionsNewest(
      filterTransactionsForRole(all, {
        role: user?.role,
        organizationId: user?.organizationId,
      }),
    )
  }, [user?.role, user?.organizationId, dataVersion])

  const revenueSharing = useMemo(() => getRevenueSharing(), [dataVersion])

  const filteredTransactions = useMemo(
    () =>
      applyTransactionFilters(scopedTransactions, {
        ...appliedFilters,
        organizations,
      }),
    [scopedTransactions, appliedFilters, organizations],
  )

  const {
    page: currentPage,
    items: paged,
  } = paginateItems(filteredTransactions, page, DEFAULT_PAGE_SIZE)

  const customDateInvalid =
    dateRange === 'custom' &&
    customFrom &&
    customTo &&
    new Date(customFrom) > new Date(customTo)

  const handleApplyFilters = () => {
    if (dateRange === 'custom' && customFrom && customTo) {
      if (customDateInvalid) return
    }
    setAppliedFilters({
      dateRange,
      customDateRange:
        dateRange === 'custom'
          ? { from: customFrom, to: customTo }
          : null,
      retailerId: config.showRetailerColumn ? retailerId : 'all',
      search,
      status: TRANSACTION_STATUS.COMPLETED,
    })
    setPage(0)
  }

  const handleExport = () => {
    const csv = transactionsToCsv(filteredTransactions, orgById, {
      revenueSharing,
      role: user?.role,
    })
    downloadCsv(`esarisari-transactions-${user?.role || 'export'}.csv`, csv)
  }

  return (
    <div>
      <PageHeader
        title="Transactions Ledger"
        description={config.subtitle}
        breadcrumbs={[
          { label: 'Home', href: getHomePathForRole(user?.role) },
          { label: 'Transactions' },
        ]}
        actions={
          <>
            {canRecordDemoSale ? (
              <Button
                type="button"
                className="bg-blue-600 text-white hover:bg-blue-700"
                onClick={() => setDemoSaleOpen(true)}
              >
                <Plus className="h-4 w-4" />
                Record demo sale
              </Button>
            ) : null}
            <Button type="button" variant="outline" onClick={handleExport}>
              <Download className="h-4 w-4" />
              Export CSV
            </Button>
          </>
        }
      />

      <Card className="mb-4 shadow-sm">
        <CardContent
          className={cn(
            'grid gap-3 p-4 lg:items-end',
            config.showRetailerColumn
              ? 'lg:grid-cols-[1fr_1fr_1fr_auto]'
              : 'lg:grid-cols-[1fr_1.4fr_auto]',
          )}
        >
          <div className="space-y-2">
            <Label className="text-xs text-slate-500">Date Range</Label>
            <Select value={dateRange} onValueChange={setDateRange}>
              <SelectTrigger>
                <SelectValue placeholder="Select range" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Time</SelectItem>
                <SelectItem value="this_month">This Month</SelectItem>
                <SelectItem value="7d">Last 7 Days</SelectItem>
                <SelectItem value="30d">Last 30 Days</SelectItem>
                <SelectItem value="3m">Last 3 Months</SelectItem>
                <SelectItem value="6m">Last 6 Months</SelectItem>
                <SelectItem value="this_year">This Year</SelectItem>
                <SelectItem value="last_year">Last Year</SelectItem>
                <SelectItem value="custom">Custom Range</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {config.showRetailerColumn ? (
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

          <div className="space-y-2">
            <Label className="text-xs text-slate-500">{config.searchLabel}</Label>
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={config.searchPlaceholder}
            />
          </div>

          <Button
            type="button"
            className="bg-blue-600 text-white hover:bg-blue-700"
            onClick={handleApplyFilters}
            disabled={
              customDateInvalid ||
              (dateRange === 'custom' && (!customFrom || !customTo))
            }
          >
            <Filter className="h-4 w-4" />
            Apply Filters
          </Button>

          {dateRange === 'custom' ? (
            <div
              className={cn(
                'grid gap-3 sm:grid-cols-2',
                config.showRetailerColumn ? 'lg:col-span-4' : 'lg:col-span-3',
              )}
            >
              <div className="space-y-2">
                <Label className="text-xs text-slate-500" htmlFor="tx-from">
                  From
                </Label>
                <Input
                  id="tx-from"
                  type="date"
                  value={customFrom}
                  onChange={(event) => setCustomFrom(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-slate-500" htmlFor="tx-to">
                  To
                </Label>
                <Input
                  id="tx-to"
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

      {user?.role === ROLES.ADMIN ? (
        <FranchiseCollectionsPanel
          className="mb-4"
          dateRange={appliedFilters.dateRange}
          customDateRange={appliedFilters.customDateRange}
          search={appliedFilters.search}
        />
      ) : null}

      <Card className="overflow-hidden shadow-sm">
        <CardContent className="p-0">
          {paged.length === 0 ? (
            <div className="px-4 py-12 text-center text-sm text-muted-foreground">
              {scopedTransactions.length === 0
                ? canRecordDemoSale
                  ? 'No sales yet. Record a demo sale to walk it through Revenue and Reports.'
                  : 'No sales in this network yet. Retailers can record a demo sale from their Transactions page.'
                : 'No transactions match the current filters.'}
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50 hover:bg-muted/50">
                      <TableHead>Reference</TableHead>
                      <TableHead>Date</TableHead>
                      {config.showRetailerColumn ? (
                        <TableHead>Retailer</TableHead>
                      ) : null}
                      <TableHead>Customer Payment</TableHead>
                      <TableHead>Credits Consumed</TableHead>
                      {config.showShareColumns ? (
                        <TableHead>{config.yourShareLabel || 'Your Share'}</TableHead>
                      ) : null}
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paged.map((tx) => {
                      const retailer =
                        orgById[tx.retailerOrganizationId] || null
                      const yourShare = getViewerShareAmountForRole(
                        tx,
                        user?.role,
                        revenueSharing,
                      )
                      return (
                        <TableRow key={tx.id}>
                          <TableCell className="font-medium text-slate-900">
                            {tx.reference || tx.id}
                          </TableCell>
                          <TableCell>
                            <DateTimeCell value={tx.createdAt} />
                          </TableCell>
                          {config.showRetailerColumn ? (
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
                          {config.showShareColumns ? (
                            <TableCell className="whitespace-nowrap">
                              <SignedAmount
                                amount={yourShare}
                                direction="credit"
                                showSign={false}
                              />
                            </TableCell>
                          ) : null}
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
                total={filteredTransactions.length}
                onPageChange={setPage}
              />
            </>
          )}
        </CardContent>
      </Card>

      <DummyTransactionDialog
        open={demoSaleOpen}
        onOpenChange={setDemoSaleOpen}
        organizationId={user?.organizationId}
        onCreated={(transaction) => {
          bumpDataVersion()
          setSelectedTx(transaction)
          setDateRange('all')
          setAppliedFilters((current) => ({
            ...current,
            dateRange: 'all',
            customDateRange: null,
            search: '',
            status: TRANSACTION_STATUS.COMPLETED,
          }))
          setPage(0)
        }}
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
