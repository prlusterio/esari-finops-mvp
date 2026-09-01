import { useEffect, useMemo, useState } from 'react'
import { useLocation, useSearchParams } from 'react-router-dom'
import { Banknote, Coins, CreditCard, Eye, Filter, PieChart, Wallet } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { ROLE_LABELS, ROLES } from '@/lib/constants'
import { buildCreditRevenueSnapshot } from '@/lib/creditEconomics'
import { formatCurrency } from '@/lib/currency'
import { formatReportPeriodLabel, parseRevenuePeriodSearch } from '@/lib/date'
import { loadFranchiseCollectionView } from '@/lib/franchiseCollectionLedger'
import { getParentOrganization } from '@/lib/funding'
import { DEFAULT_PAGE_SIZE, paginateItems } from '@/lib/pagination'
import { getHomePathForRole } from '@/lib/permissions'
import {
  buildRevenueEntries,
  filterRevenueEntries,
  REVENUE_ENTRY_STATUS,
  REVENUE_ENTRY_STATUS_LABELS,
  sumRevenueByStatus,
} from '@/lib/revenue'
import { filterTransactionsForRole } from '@/lib/transactions'
import {
  getFundingRequests,
  getOrganizations,
  getRevenueSharing,
  getTransactions,
} from '@/services/storage'
import { DateTimeCell } from '@/components/shared/DateTimeCell'
import { InfoTooltip } from '@/components/shared/InfoTooltip'
import { LedgerScopeNotice } from '@/components/shared/LedgerScopeNotice'
import { FranchiseCollectionsPanel } from '@/components/shared/FranchiseCollectionsPanel'
import { PageHeader } from '@/components/shared/PageHeader'
import { StatCard } from '@/components/shared/StatCard'
import { TablePagination } from '@/components/shared/TablePagination'
import { TransactionDetailsDialog } from '@/components/shared/TransactionDetailsDialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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

function formatRatePercent(rate) {
  if (rate == null || Number.isNaN(Number(rate))) return null
  return `${Math.round(Number(rate) * 100)}%`
}

function uplineRoleLabel(parentOrg) {
  if (!parentOrg) return 'your upline'
  if (parentOrg.type === 'platform') return ROLE_LABELS[ROLES.ADMIN]
  return ROLE_LABELS[parentOrg.type] || parentOrg.name || 'your upline'
}

function LoadEarningsExplanation({ entry, viewerName, uplineLabel }) {
  if (entry?.kind === 'credit_spread' && entry.buyRate != null) {
    const buyPct = formatRatePercent(entry.buyRate)
    const sellPct = formatRatePercent(entry.sellRate)
    const credits = formatCurrency(entry.credits)
    const cashIn = formatCurrency(entry.cashIn)
    const cost = formatCurrency(entry.costBasis)
    const earnings = formatCurrency(entry.revenue)
    const buyer = viewerName || 'you'

    return (
      <div className="space-y-2">
        <p>
          Those {credits} credits cost {buyer}{' '}
          <strong className="font-semibold text-slate-800">
            {credits} × {buyPct} = {cost}
          </strong>{' '}
          to buy from the {uplineLabel}.
        </p>
        <p>
          Cash collected − replacement cost = Internet Credits earnings:
          <span className="mt-1 block font-semibold tabular-nums text-slate-800">
            {cashIn} − {cost} = {earnings}
          </span>
        </p>
        {sellPct ? (
          <p>
            Same result as the rate gap:{' '}
            <strong className="font-semibold text-slate-800">
              {credits} × ({sellPct} − {buyPct}) = {earnings}
            </strong>
            .
          </p>
        ) : null}
        <p>
          That {earnings} is inventory markup from deposit rates. It is
          separate from sale commission, which only appears when a retailer
          sells internet to a customer.
        </p>
      </div>
    )
  }

  if (entry?.kind === 'platform_load') {
    const rate = formatRatePercent(entry.depositRate)
    const cashIn = formatCurrency(entry.cashIn)
    const credits = formatCurrency(entry.credits)
    return (
      <div className="space-y-2">
        <p>
          Internet Credits earnings are the cash collected when you released{' '}
          {credits}{' '}
          credits{rate ? ` at ${rate}` : ''}:
          <span className="mt-1 block font-semibold tabular-nums text-slate-800">
            {cashIn}
          </span>
        </p>
        <p>
          This is separate from sale commission, which only appears when a
          retailer sells internet to a customer.
        </p>
      </div>
    )
  }

  return null
}

export default function RevenuePage() {
  const { user, dataVersion } = useAuth()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const organizations = useMemo(() => getOrganizations(), [dataVersion])
  const fundingRequests = useMemo(() => getFundingRequests(), [dataVersion])
  const transactions = useMemo(() => getTransactions(), [dataVersion])

  const [dateRange, setDateRange] = useState('this_month')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const [search, setSearch] = useState('')
  const [appliedFilters, setAppliedFilters] = useState({
    dateRange: 'this_month',
    customDateRange: null,
    search: '',
  })
  const [page, setPage] = useState(0)
  const [commissionPage, setCommissionPage] = useState(0)
  const [selectedTx, setSelectedTx] = useState(null)

  const periodQuery = searchParams.toString()

  useEffect(() => {
    const fromUrl = parseRevenuePeriodSearch(periodQuery)
    const nextRange = fromUrl?.dateRange || 'this_month'
    const nextFrom = fromUrl?.customFrom || ''
    const nextTo = fromUrl?.customTo || ''
    setPage(0)
    setCommissionPage(0)
    setDateRange(nextRange)
    setCustomFrom(nextFrom)
    setCustomTo(nextTo)
    setSearch('')
    setAppliedFilters({
      dateRange: nextRange,
      customDateRange:
        nextRange === 'custom'
          ? { from: nextFrom || null, to: nextTo || null }
          : null,
      search: '',
    })
  }, [user?.role, periodQuery])

  const viewerOrgName = useMemo(() => {
    const org = organizations.find((item) => item.id === user?.organizationId)
    return org?.name || ROLE_LABELS[user?.role] || 'you'
  }, [organizations, user?.organizationId, user?.role])

  const viewerUplineLabel = useMemo(
    () =>
      uplineRoleLabel(
        getParentOrganization(organizations, user?.organizationId),
      ),
    [organizations, user?.organizationId],
  )

  const customDateInvalid =
    appliedFilters.dateRange === 'custom' &&
    appliedFilters.customDateRange?.from &&
    appliedFilters.customDateRange?.to &&
    appliedFilters.customDateRange.from > appliedFilters.customDateRange.to

  const snapshot = useMemo(
    () =>
      buildCreditRevenueSnapshot({
        role: user?.role,
        organizationId: user?.organizationId,
        organizations,
        fundingRequests,
        transactions,
        dateRange: appliedFilters.dateRange,
        customDateRange: appliedFilters.customDateRange,
      }),
    [
      user?.role,
      user?.organizationId,
      organizations,
      fundingRequests,
      transactions,
      appliedFilters,
    ],
  )

  const filteredEntries = useMemo(() => {
    const query = String(appliedFilters.search || '')
      .trim()
      .toLowerCase()
    if (!query) return snapshot.entries
    return snapshot.entries.filter((entry) => {
      const haystack = [
        entry.reference,
        entry.counterpartyName,
        entry.id,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      return haystack.includes(query)
    })
  }, [snapshot.entries, appliedFilters.search])

  const commissionEntries = useMemo(() => {
    const scoped = filterTransactionsForRole(transactions, {
      role: user?.role,
      organizationId: user?.organizationId,
    })
    const entries = buildRevenueEntries({
      transactions: scoped,
      organizations,
      role: user?.role,
      revenueSharing: getRevenueSharing(),
    })
    return filterRevenueEntries(entries, {
      dateRange: appliedFilters.dateRange,
      customDateRange: appliedFilters.customDateRange,
      search: appliedFilters.search,
    })
  }, [
    transactions,
    organizations,
    user?.role,
    user?.organizationId,
    appliedFilters,
    dataVersion,
  ])

  const commissionTotals = useMemo(
    () => sumRevenueByStatus(commissionEntries),
    [commissionEntries],
  )

  const {
    page: currentPage,
    items: paged,
  } = paginateItems(filteredEntries, page, DEFAULT_PAGE_SIZE)

  const {
    page: currentCommissionPage,
    items: pagedCommission,
  } = paginateItems(commissionEntries, commissionPage, DEFAULT_PAGE_SIZE)

  const periodLabel = formatReportPeriodLabel(
    appliedFilters.dateRange,
    appliedFilters.customDateRange,
  )
  const isAdmin = user?.role === ROLES.ADMIN
  const franchiseView = useMemo(() => {
    if (!isAdmin) return null
    void dataVersion
    return loadFranchiseCollectionView({
      dateRange: appliedFilters.dateRange,
      customDateRange: appliedFilters.customDateRange,
      search: appliedFilters.search,
    })
  }, [appliedFilters, dataVersion, isAdmin])

  const applyFilters = () => {
    setAppliedFilters({
      dateRange,
      customDateRange:
        dateRange === 'custom'
          ? { from: customFrom || null, to: customTo || null }
          : null,
      search,
    })
    setPage(0)
    setCommissionPage(0)
  }

  const mode = snapshot.mode
  const kpis = snapshot.kpis
  const isRetailer = user?.role === ROLES.RETAILER
  const showCreditTable = mode === 'platform_load' || mode === 'credit_spread'
  const salesCommission = commissionTotals.credited
  const creditEarnings = showCreditTable ? Number(kpis.primaryValue) || 0 : 0
  const combinedEarnings =
    Math.round((creditEarnings + salesCommission + Number.EPSILON) * 100) / 100

  const pageDescription = isRetailer
    ? 'Your commission from each internet sale.'
    : 'Earnings from loading Internet Credits to downlines, plus your commission from sales.'

  useEffect(() => {
    if (location.hash !== '#internet-credits' || !showCreditTable) return
    const node = document.getElementById('internet-credits')
    if (!node) return
    node.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [location.hash, showCreditTable, appliedFilters.dateRange])

  return (
    <div>
      <PageHeader
        title={snapshot.title}
        description={pageDescription}
        breadcrumbs={[
          { label: 'Home', href: getHomePathForRole(user?.role) },
          { label: 'Revenue' },
        ]}
      />

      <LedgerScopeNotice />

      <div
        className={cn(
          'mb-4 grid gap-4',
          isRetailer
            ? 'sm:grid-cols-3'
            : isAdmin
              ? 'sm:grid-cols-2 xl:grid-cols-4'
              : 'sm:grid-cols-3',
        )}
      >
        {isRetailer ? (
          <>
            <StatCard
              title="Your Commission"
              value={formatCurrency(salesCommission)}
              description={`For ${periodLabel}`}
              descriptionBelowTitle
              icon={PieChart}
              accent="success"
            />
            <StatCard
              title={kpis.secondaryLabel}
              value={formatCurrency(kpis.secondaryValue)}
              description={`For ${periodLabel}`}
              descriptionBelowTitle
              icon={Wallet}
            />
            <StatCard
              title={kpis.tertiaryLabel}
              value={formatCurrency(kpis.tertiaryValue)}
              description={`For ${periodLabel}`}
              descriptionBelowTitle
              icon={Coins}
            />
          </>
        ) : (
          <>
            <StatCard
              title="Internet Credits earnings"
              value={formatCurrency(kpis.primaryValue)}
              description={`For ${periodLabel}`}
              descriptionBelowTitle
              icon={Banknote}
            />
            <StatCard
              title="Sales Commission"
              value={formatCurrency(salesCommission)}
              description={`For ${periodLabel}`}
              descriptionBelowTitle
              icon={PieChart}
              accent="success"
            />
            <StatCard
              title="Total earnings"
              value={formatCurrency(combinedEarnings)}
              description={`Internet Credits + sales · ${periodLabel}`}
              descriptionBelowTitle
              icon={Coins}
            />
            {isAdmin ? (
              <StatCard
                title="Franchise collections"
                value={formatCurrency(franchiseView?.kpis.collected || 0)}
                description={`Setup + billable monthly · pending ${formatCurrency(franchiseView?.kpis.remaining || 0)} · ${periodLabel}`}
                descriptionBelowTitle
                icon={CreditCard}
                accent="wallet"
              />
            ) : null}
          </>
        )}
      </div>

      <Card className="mb-4 shadow-sm">
        <CardContent className="grid gap-3 p-4 sm:grid-cols-[1fr_1fr_auto] lg:items-end">
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

          <div className="space-y-2">
            <Label className="text-xs text-slate-500">Search</Label>
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Reference or name"
            />
          </div>

          <Button
            type="button"
            className="bg-blue-600 text-white hover:bg-blue-700"
            onClick={applyFilters}
          >
            <Filter className="h-4 w-4" />
            Apply
          </Button>

          {dateRange === 'custom' ? (
            <div className="grid gap-3 sm:col-span-2 sm:grid-cols-2">
              <div className="space-y-2">
                <Label className="text-xs text-slate-500">From</Label>
                <Input
                  type="date"
                  value={customFrom}
                  onChange={(event) => setCustomFrom(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-slate-500">To</Label>
                <Input
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

      {isAdmin ? (
        <FranchiseCollectionsPanel
          className="mb-4"
          dateRange={appliedFilters.dateRange}
          customDateRange={appliedFilters.customDateRange}
          search={appliedFilters.search}
        />
      ) : null}

      {showCreditTable ? (
        <Card
          id="internet-credits"
          className="mb-4 scroll-mt-20 overflow-hidden shadow-sm"
        >
          <CardHeader className="border-b border-border px-4 py-3">
            <CardTitle className="text-base font-semibold">
              Internet Credits
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              What you earned when downlines bought credits from you.
            </p>
          </CardHeader>
          <CardContent className="p-0">
            {paged.length === 0 ? (
              <div className="px-4 py-12 text-center text-sm text-muted-foreground">
                No Internet Credits earnings for the selected period.
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50 hover:bg-muted/50">
                        <TableHead>Date</TableHead>
                        <TableHead>Reference</TableHead>
                        <TableHead>Downline</TableHead>
                        <TableHead className="text-right">Cash in</TableHead>
                        <TableHead className="text-right">Credits</TableHead>
                        <TableHead className="text-right">Earnings</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paged.map((entry) => (
                        <TableRow key={entry.id}>
                          <TableCell>
                            <DateTimeCell value={entry.createdAt} />
                          </TableCell>
                          <TableCell className="font-medium text-slate-900">
                            {entry.reference}
                          </TableCell>
                          <TableCell>
                            <div className="font-semibold text-slate-900">
                              {entry.counterpartyName}
                            </div>
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {formatCurrency(entry.cashIn)}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {formatCurrency(entry.credits)}
                          </TableCell>
                          <TableCell className="text-right">
                            <span className="inline-flex items-center justify-end gap-1">
                              <span
                                className={cn(
                                  'font-semibold tabular-nums',
                                  (entry.revenue ?? 0) >= 0
                                    ? 'text-emerald-700'
                                    : 'text-red-600',
                                )}
                              >
                                {formatCurrency(entry.revenue)}
                              </span>
                              <InfoTooltip
                                align="end"
                                label={`How ${formatCurrency(entry.revenue)} was calculated`}
                              >
                                <LoadEarningsExplanation
                                  entry={entry}
                                  viewerName={viewerOrgName}
                                  uplineLabel={viewerUplineLabel}
                                />
                              </InfoTooltip>
                            </span>
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
      ) : null}

      <Card className="mb-4 overflow-hidden shadow-sm">
        <CardHeader className="border-b border-border px-4 py-3">
          <CardTitle className="text-base font-semibold">
            Sales Commission
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Your share of each sale, from the distribution percentages on that
            transaction.
          </p>
        </CardHeader>
        <CardContent className="p-0">
          {pagedCommission.length === 0 ? (
            <div className="px-4 py-12 text-center text-sm text-muted-foreground">
              No sales commission entries for the selected period.
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50 hover:bg-muted/50">
                      <TableHead>Date</TableHead>
                      <TableHead>Reference</TableHead>
                      <TableHead>Retailer</TableHead>
                      <TableHead className="text-right">Commission pool</TableHead>
                      <TableHead className="text-right">Your share %</TableHead>
                      <TableHead className="text-right">Your commission</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pagedCommission.map((entry) => (
                      <TableRow key={entry.id}>
                        <TableCell>
                          <DateTimeCell value={entry.createdAt} />
                        </TableCell>
                        <TableCell className="font-medium text-slate-900">
                          {entry.reference}
                        </TableCell>
                        <TableCell>
                          <div className="font-semibold text-slate-900">
                            {entry.retailerName}
                          </div>
                          {entry.retailerCode ? (
                            <div className="text-xs text-slate-400">
                              {entry.retailerCode}
                            </div>
                          ) : null}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatCurrency(entry.distributableRevenue)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-slate-600">
                          {entry.sharePercentage}%
                        </TableCell>
                        <TableCell
                          className={cn(
                            'text-right font-semibold tabular-nums',
                            entry.yourRevenue >= 0
                              ? 'text-emerald-700'
                              : 'text-red-600',
                          )}
                        >
                          {formatCurrency(entry.yourRevenue)}
                        </TableCell>
                        <TableCell>
                          <Badge
                            className={cn(
                              'rounded-full border-transparent px-2.5 py-1 font-medium',
                              entry.status === REVENUE_ENTRY_STATUS.CREDITED
                                ? 'bg-emerald-50 text-emerald-700'
                                : 'bg-amber-50 text-amber-700',
                            )}
                          >
                            {REVENUE_ENTRY_STATUS_LABELS[entry.status] ||
                              entry.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="text-blue-600 hover:bg-blue-50 hover:text-blue-700"
                            onClick={() =>
                              setSelectedTx(entry.transaction || null)
                            }
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
                page={currentCommissionPage}
                pageSize={DEFAULT_PAGE_SIZE}
                total={commissionEntries.length}
                onPageChange={setCommissionPage}
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
