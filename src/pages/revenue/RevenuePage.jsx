import { useEffect, useMemo, useState } from 'react'
import { Banknote, Coins, Eye, Filter, Wallet } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { ROLES } from '@/lib/constants'
import { buildCreditRevenueSnapshot } from '@/lib/creditEconomics'
import { formatCurrency } from '@/lib/currency'
import { formatReportPeriodLabel } from '@/lib/date'
import { formatDepositRatePercent } from '@/lib/internetCredits'
import { DEFAULT_PAGE_SIZE, paginateItems } from '@/lib/pagination'
import { getHomePathForRole } from '@/lib/permissions'
import {
  getFundingRequests,
  getOrganizations,
  getTransactions,
} from '@/services/storage'
import { DateTimeCell } from '@/components/shared/DateTimeCell'
import { PageHeader } from '@/components/shared/PageHeader'
import { StatCard } from '@/components/shared/StatCard'
import { TablePagination } from '@/components/shared/TablePagination'
import { TransactionDetailsDialog } from '@/components/shared/TransactionDetailsDialog'
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

export default function RevenuePage() {
  const { user, dataVersion } = useAuth()
  const organizations = useMemo(() => getOrganizations(), [dataVersion])
  const fundingRequests = useMemo(() => getFundingRequests(), [dataVersion])
  const transactions = useMemo(() => getTransactions(), [dataVersion])

  const [dateRange, setDateRange] = useState('all')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const [search, setSearch] = useState('')
  const [appliedFilters, setAppliedFilters] = useState({
    dateRange: 'all',
    customDateRange: null,
    search: '',
  })
  const [page, setPage] = useState(0)
  const [selectedTx, setSelectedTx] = useState(null)

  useEffect(() => {
    setPage(0)
    setDateRange('all')
    setCustomFrom('')
    setCustomTo('')
    setSearch('')
    setAppliedFilters({
      dateRange: 'all',
      customDateRange: null,
      search: '',
    })
  }, [user?.role])

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

  const {
    page: currentPage,
    items: paged,
  } = paginateItems(filteredEntries, page, DEFAULT_PAGE_SIZE)

  const periodLabel = formatReportPeriodLabel(
    appliedFilters.dateRange,
    appliedFilters.customDateRange,
  )

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
  }

  const mode = snapshot.mode
  const kpis = snapshot.kpis

  return (
    <div>
      <PageHeader
        title={snapshot.title}
        description={snapshot.description}
        breadcrumbs={[
          { label: 'Home', href: getHomePathForRole(user?.role) },
          { label: 'Revenue' },
        ]}
      />

      <div className="mb-4 grid gap-4 sm:grid-cols-3">
        <StatCard
          title={kpis.primaryLabel}
          value={formatCurrency(kpis.primaryValue)}
          description={`For ${periodLabel}`}
          descriptionBelowTitle
          icon={Banknote}
          accent="success"
        />
        <StatCard
          title={kpis.secondaryLabel}
          value={formatCurrency(kpis.secondaryValue)}
          description={`For ${periodLabel}`}
          descriptionBelowTitle
          icon={mode === 'sale_margin' ? Wallet : Coins}
        />
        <StatCard
          title={kpis.tertiaryLabel}
          value={
            kpis.tertiaryIsCount
              ? String(kpis.tertiaryValue)
              : formatCurrency(kpis.tertiaryValue)
          }
          description={`For ${periodLabel}`}
          descriptionBelowTitle
          icon={Coins}
        />
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

      <Card className="mb-4 overflow-hidden shadow-sm">
        <CardContent className="p-0">
          {paged.length === 0 ? (
            <div className="px-4 py-12 text-center text-sm text-muted-foreground">
              No revenue entries for the selected period.
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50 hover:bg-muted/50">
                      <TableHead>Date</TableHead>
                      <TableHead>Reference</TableHead>
                      <TableHead>
                        {mode === 'sale_margin' ? 'Product / Service' : 'Counterparty'}
                      </TableHead>
                      {mode === 'platform_load' ? (
                        <>
                          <TableHead className="text-right">Cash in</TableHead>
                          <TableHead className="text-right">Credits</TableHead>
                          <TableHead className="text-right">Load revenue</TableHead>
                        </>
                      ) : null}
                      {mode === 'credit_spread' ? (
                        <>
                          <TableHead className="text-right">Cash in</TableHead>
                          <TableHead className="text-right">Credits</TableHead>
                          <TableHead className="text-right">Cost basis</TableHead>
                          <TableHead className="text-right">Spread</TableHead>
                        </>
                      ) : null}
                      {mode === 'sale_margin' ? (
                        <>
                          <TableHead className="text-right">
                            Customer payment
                          </TableHead>
                          <TableHead className="text-right">
                            Credits consumed
                          </TableHead>
                          <TableHead className="text-right">Margin</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </>
                      ) : null}
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
                          {mode === 'credit_spread' && entry.buyRate ? (
                            <div className="text-xs text-slate-400">
                              Buy rate {formatDepositRatePercent(entry.buyRate)}
                            </div>
                          ) : null}
                        </TableCell>
                        {mode === 'platform_load' ? (
                          <>
                            <TableCell className="text-right tabular-nums">
                              {formatCurrency(entry.cashIn)}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              {formatCurrency(entry.credits)}
                            </TableCell>
                            <TableCell
                              className={cn(
                                'text-right font-semibold tabular-nums text-emerald-700',
                              )}
                            >
                              {formatCurrency(entry.revenue)}
                            </TableCell>
                          </>
                        ) : null}
                        {mode === 'credit_spread' ? (
                          <>
                            <TableCell className="text-right tabular-nums">
                              {formatCurrency(entry.cashIn)}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              {formatCurrency(entry.credits)}
                            </TableCell>
                            <TableCell className="text-right tabular-nums text-slate-600">
                              {formatCurrency(entry.costBasis)}
                            </TableCell>
                            <TableCell
                              className={cn(
                                'text-right font-semibold tabular-nums',
                                entry.spread >= 0
                                  ? 'text-emerald-700'
                                  : 'text-red-600',
                              )}
                            >
                              {formatCurrency(entry.spread)}
                            </TableCell>
                          </>
                        ) : null}
                        {mode === 'sale_margin' ? (
                          <>
                            <TableCell className="text-right tabular-nums">
                              {formatCurrency(entry.customerPayment)}
                            </TableCell>
                            <TableCell className="text-right tabular-nums text-slate-600">
                              {formatCurrency(entry.creditsConsumed)}
                            </TableCell>
                            <TableCell
                              className={cn(
                                'text-right font-semibold tabular-nums',
                                entry.margin >= 0
                                  ? 'text-emerald-700'
                                  : 'text-red-600',
                              )}
                            >
                              {formatCurrency(entry.margin)}
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
                          </>
                        ) : null}
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
