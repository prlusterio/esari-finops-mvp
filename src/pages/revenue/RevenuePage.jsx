import { useEffect, useMemo, useState } from 'react'
import { Banknote, Eye, Filter, Wallet } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { ROLES } from '@/lib/constants'
import { formatCurrency } from '@/lib/currency'
import { formatReportPeriodLabel } from '@/lib/date'
import { DEFAULT_PAGE_SIZE, paginateItems } from '@/lib/pagination'
import { DateTimeCell } from '@/components/shared/DateTimeCell'
import { SignedAmount } from '@/components/shared/SignedAmount'
import { TablePagination } from '@/components/shared/TablePagination'
import { getHomePathForRole } from '@/lib/permissions'
import { getNetworkFilterOptions } from '@/lib/reports'
import {
  buildRevenueEntries,
  filterRevenueEntries,
  resolveCreditedRevenueBalance,
  REVENUE_ENTRY_STATUS,
  REVENUE_ENTRY_STATUS_LABELS,
} from '@/lib/revenue'
import { filterTransactionsForRole } from '@/lib/transactions'
import {
  getOrganizations,
  getRevenueSharing,
  getTransactions,
} from '@/services/storage'
import { PageHeader } from '@/components/shared/PageHeader'
import { StatCard } from '@/components/shared/StatCard'
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

function RevenueStatusBadge({ status }) {
  const isCredited = status === REVENUE_ENTRY_STATUS.CREDITED
  return (
    <Badge
      className={cn(
        'rounded-full border-transparent px-2.5 py-1 font-medium',
        isCredited
          ? 'bg-emerald-50 text-emerald-700'
          : 'bg-amber-50 text-amber-700',
      )}
    >
      {REVENUE_ENTRY_STATUS_LABELS[status] || status}
    </Badge>
  )
}

export default function RevenuePage() {
  const { user, dataVersion } = useAuth()
  const isRetailer = user?.role === ROLES.RETAILER
  const canViewRevenue =
    user?.role === ROLES.SUBFRANCHISEE ||
    user?.role === ROLES.FRANCHISEE ||
    user?.role === ROLES.RETAILER

  const organizations = useMemo(() => getOrganizations(), [dataVersion])
  const revenueSharing = useMemo(() => getRevenueSharing(), [dataVersion])
  const transactions = useMemo(() => getTransactions(), [dataVersion])

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
    status: REVENUE_ENTRY_STATUS.CREDITED,
  })
  const [page, setPage] = useState(0)
  const [selectedTx, setSelectedTx] = useState(null)

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
      status: REVENUE_ENTRY_STATUS.CREDITED,
    })
  }, [user?.role])

  const retailerOptions = useMemo(() => {
    if (!user?.organizationId || isRetailer) return []
    return getNetworkFilterOptions(organizations, user.organizationId)
      .allRetailers
  }, [organizations, user?.organizationId, isRetailer])

  const scopedTransactions = useMemo(
    () =>
      filterTransactionsForRole(transactions, {
        role: user?.role,
        organizationId: user?.organizationId,
      }),
    [transactions, user?.role, user?.organizationId],
  )

  const allEntries = useMemo(
    () =>
      buildRevenueEntries({
        transactions: scopedTransactions,
        organizations,
        role: user?.role,
        revenueSharing,
      }),
    [scopedTransactions, organizations, user?.role, revenueSharing],
  )

  const filteredEntries = useMemo(
    () => filterRevenueEntries(allEntries, appliedFilters),
    [allEntries, appliedFilters],
  )

  // Same source as Wallet → Revenue Wallet card.
  const creditedRevenueBalance = useMemo(
    () =>
      resolveCreditedRevenueBalance({
        role: user?.role,
        organizationId: user?.organizationId,
        transactions,
        revenueSharing,
      }),
    [user?.role, user?.organizationId, transactions, revenueSharing],
  )

  const distributableTotal = useMemo(
    () =>
      filteredEntries.reduce(
        (sum, entry) => sum + (Number(entry.distributableRevenue) || 0),
        0,
      ),
    [filteredEntries],
  )

  const periodLabel = formatReportPeriodLabel(
    appliedFilters.dateRange,
    appliedFilters.customDateRange,
  )

  const {
    page: currentPage,
    items: paged,
  } = paginateItems(filteredEntries, page, DEFAULT_PAGE_SIZE)

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
      retailerId: isRetailer ? 'all' : retailerId,
      search,
      status: REVENUE_ENTRY_STATUS.CREDITED,
    })
    setPage(0)
  }

  if (!canViewRevenue) {
    return (
      <div>
        <PageHeader
          title="Revenue"
          description="Your revenue share and revenue wallet."
          breadcrumbs={[
            { label: 'Home', href: getHomePathForRole(user?.role) },
            { label: 'Revenue' },
          ]}
        />
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            Revenue for your role will be available in a later release.
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div>
      <PageHeader
        title="Revenue"
        description={
          isRetailer
            ? 'Track distributable revenue and your credited share from your completed transactions.'
            : 'Track distributable revenue and your credited share from completed transactions.'
        }
        breadcrumbs={[
          { label: 'Home', href: getHomePathForRole(user?.role) },
          { label: 'Revenue' },
        ]}
      />

      <div className="mb-4 grid gap-4 sm:grid-cols-2">
        <StatCard
          title="Distributable Revenue"
          value={formatCurrency(distributableTotal)}
          description={`For ${periodLabel}`}
          icon={Banknote}
          accent="wallet"
        />
        <StatCard
          title="Credited Revenue"
          value={formatCurrency(creditedRevenueBalance)}
          description="All-time credited revenue share"
          icon={Wallet}
          accent="success"
        />
      </div>

      <Card className="mb-4 shadow-sm">
        <CardContent
          className={cn(
            'grid gap-3 p-4 lg:items-end',
            isRetailer
              ? 'lg:grid-cols-[1fr_1fr_auto]'
              : 'lg:grid-cols-[1fr_1fr_1fr_auto]',
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

          {!isRetailer ? (
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
            <Label className="text-xs text-slate-500">Reference</Label>
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by reference"
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
                isRetailer ? 'lg:col-span-3' : 'lg:col-span-4',
              )}
            >
              <div className="space-y-2">
                <Label className="text-xs text-slate-500" htmlFor="revenue-from">
                  From
                </Label>
                <Input
                  id="revenue-from"
                  type="date"
                  value={customFrom}
                  onChange={(event) => setCustomFrom(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-slate-500" htmlFor="revenue-to">
                  To
                </Label>
                <Input
                  id="revenue-to"
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

      <Card className="overflow-hidden shadow-sm">
        <CardContent className="p-0">
          {paged.length === 0 ? (
            <div className="px-4 py-12 text-center text-sm text-muted-foreground">
              No revenue entries match the current filters.
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50 hover:bg-muted/50">
                      <TableHead>Reference</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>
                        {isRetailer ? 'Product / Service' : 'Retailer'}
                      </TableHead>
                      <TableHead>Distributable Rev.</TableHead>
                      <TableHead>Your Revenue</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paged.map((entry) => (
                      <TableRow key={entry.id}>
                        <TableCell className="font-medium text-slate-900">
                          {entry.reference}
                        </TableCell>
                        <TableCell>
                          <DateTimeCell value={entry.createdAt} />
                        </TableCell>
                        <TableCell>
                          {isRetailer ? (
                            <div className="max-w-[220px] truncate font-medium text-slate-900">
                              {entry.transaction?.productService || '—'}
                            </div>
                          ) : (
                            <>
                              <div className="font-semibold text-slate-900">
                                {entry.retailerName}
                              </div>
                              {user?.role === ROLES.SUBFRANCHISEE &&
                              entry.franchiseeName ? (
                                <div className="text-xs text-slate-400">
                                  {entry.franchiseeName}
                                </div>
                              ) : null}
                            </>
                          )}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          <SignedAmount
                            amount={entry.distributableRevenue}
                            direction="credit"
                          />
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          <SignedAmount
                            amount={entry.yourRevenue}
                            direction="credit"
                          />
                        </TableCell>
                        <TableCell>
                          <RevenueStatusBadge status={entry.status} />
                        </TableCell>
                        <TableCell>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="text-blue-600 hover:bg-blue-50 hover:text-blue-700"
                            onClick={() => setSelectedTx(entry.transaction)}
                            aria-label={`View ${entry.reference}`}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <TablePagination
                page={currentPage}
                pageSize={DEFAULT_PAGE_SIZE}
                total={filteredEntries.length}
                onPageChange={setPage}
              />
            </>
          )}
        </CardContent>
      </Card>

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
