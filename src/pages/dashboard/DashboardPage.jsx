import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  BarChart3,
  CreditCard,
  MapPin,
  ArrowRight,
  Briefcase,
} from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { formatCompactCurrency, formatCurrency } from '@/lib/currency'
import {
  allocateMonthlyPayment,
  applyUpfrontCollection,
  buildDashboardMetrics,
  collectionPeriodOptions,
  computeMoney,
  emptyCollectionState,
  getFranchisePortfolio,
  loadSharedCollections,
  monthKey,
  monthLabel,
  monthlyCoverageLabel,
} from '@/lib/financialsDashboard'
import { getHomePathForRole } from '@/lib/permissions'
import {
  getFranchiseCollections,
  saveFranchiseCollections,
} from '@/services/storage'
import { PageHeader } from '@/components/shared/PageHeader'
import { StatCard } from '@/components/shared/StatCard'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
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

function FranchiseStatusBadge({ status }) {
  return (
    <Badge
      className={cn(
        'rounded-full border-transparent px-2.5 py-1 font-medium',
        status === 'Activated' && 'bg-emerald-50 text-emerald-700',
        status === 'Pending Activation' && 'bg-amber-50 text-amber-700',
        status === 'Pending Review' && 'bg-sky-50 text-sky-700',
        status === 'In Progress' && 'bg-slate-100 text-slate-700',
      )}
    >
      {status}
    </Badge>
  )
}

function CollectionProgress({
  label,
  collectedCount,
  activeCount,
  percent,
  extraLabel,
  collectedAmount,
  pendingAmount,
  pendingSuffix = '',
  barClassName = 'bg-primary',
}) {
  const pct = Math.max(0, Math.min(100, Number(percent) || 0))
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          {label}
        </span>
        <span className="text-xs text-muted-foreground">
          {extraLabel ? `${extraLabel} • ` : ''}
          {collectedCount}/{activeCount} active collected • {pct}%
        </span>
      </div>
      <div className="h-2 overflow-hidden bg-muted">
        <div
          className={cn('h-full', barClassName)}
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="flex justify-between text-sm">
        <span className="text-muted-foreground">Collected</span>
        <span className="font-medium tabular-nums">{collectedAmount}</span>
      </div>
      <div className="flex justify-between text-sm">
        <span className="text-muted-foreground">Pending</span>
        <span className="font-medium tabular-nums">
          {pendingAmount}
          {pendingSuffix}
        </span>
      </div>
    </div>
  )
}

function SummaryRow({ label, value, emphasize = false }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span
        className={cn(
          'tabular-nums',
          emphasize ? 'font-semibold' : 'font-medium',
        )}
      >
        {value}
      </span>
    </div>
  )
}

function CollectionAction({
  isActivated,
  isCollected,
  isPartial,
  paid,
  due,
  disabled,
  onConfirm,
}) {
  if (!isActivated) {
    return (
      <Badge variant="secondary" className="rounded-full">
        Not active
      </Badge>
    )
  }

  if (isCollected) {
    return (
      <Badge variant="success" className="rounded-full">
        Collected
      </Badge>
    )
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button size="sm" onClick={onConfirm} disabled={disabled}>
        Confirm Collection
      </Button>
      {isPartial ? (
        <div className="text-[11px] tabular-nums text-muted-foreground">
          Paid {formatCurrency(paid)} • remaining{' '}
          {formatCurrency(Math.max(0, due - paid))}
        </div>
      ) : null}
    </div>
  )
}

export default function DashboardPage() {
  const { user, dataVersion, bumpDataVersion } = useAuth()
  const franchises = useMemo(() => getFranchisePortfolio(), [])
  const money = useMemo(() => computeMoney(franchises), [franchises])
  const [monthlyPeriod, setMonthlyPeriod] = useState(() => monthKey(new Date()))
  const monthlyPeriodOptions = useMemo(
    () => collectionPeriodOptions(new Date()),
    [],
  )
  const monthlyPeriodLabel = monthLabel(monthlyPeriod)

  const collections = useMemo(() => {
    void dataVersion
    return loadSharedCollections(franchises, getFranchiseCollections())
  }, [dataVersion, franchises])

  const [upfrontDraft, setUpfrontDraft] = useState(null)
  const [monthlyDraft, setMonthlyDraft] = useState(null)

  const metrics = useMemo(
    () =>
      buildDashboardMetrics({
        franchises,
        money,
        collections,
        monthlyPeriod,
      }),
    [franchises, money, collections, monthlyPeriod],
  )

  const persistCollections = (next) => {
    saveFranchiseCollections(next)
    bumpDataVersion()
  }

  const openUpfrontConfirm = (franchiseId, franchiseName, upfrontAmount) => {
    const alreadyPaid = Math.max(0, collections[franchiseId]?.upfrontPaid ?? 0)
    const remainingDue = Math.max(0, upfrontAmount - alreadyPaid)
    setUpfrontDraft({
      franchiseId,
      franchiseName,
      upfrontAmount,
      amountCollected: String(remainingDue > 0 ? remainingDue : upfrontAmount),
    })
  }

  const confirmUpfrontCollection = () => {
    if (!upfrontDraft) return
    const upfrontAmount = Math.max(0, upfrontDraft.upfrontAmount)
    const amountCollected = Math.max(0, Number(upfrontDraft.amountCollected) || 0)
    if (upfrontAmount <= 0 || amountCollected <= 0) return

    persistCollections({
      ...collections,
      [upfrontDraft.franchiseId]: applyUpfrontCollection(
        collections[upfrontDraft.franchiseId],
        upfrontAmount,
        amountCollected,
      ),
    })
    setUpfrontDraft(null)
  }

  const openMonthlyConfirm = (franchiseId, franchiseName, perMonthAmount) => {
    const alreadyPaid = Math.max(
      0,
      collections[franchiseId]?.monthlyPaidByPeriod?.[monthlyPeriod] ?? 0,
    )
    const remainingDue = Math.max(0, perMonthAmount - alreadyPaid)
    setMonthlyDraft({
      franchiseId,
      franchiseName,
      perMonthAmount,
      startPeriod: monthlyPeriod,
      amountCollected: String(remainingDue > 0 ? remainingDue : perMonthAmount),
    })
  }

  const confirmMonthlyCollection = () => {
    if (!monthlyDraft) return
    const startPeriod = monthlyDraft.startPeriod || monthlyPeriod
    const perMonthAmount = monthlyDraft.perMonthAmount
    const amountCollected = Math.max(0, Number(monthlyDraft.amountCollected) || 0)
    if (perMonthAmount <= 0 || amountCollected <= 0) return

    const current = collections[monthlyDraft.franchiseId] ?? emptyCollectionState()
    const allocation = allocateMonthlyPayment({
      existingPaidByPeriod: current.monthlyPaidByPeriod,
      startPeriod,
      perMonthAmount,
      amountCollected,
    })
    if (allocation.appliedAmount <= 0) return

    persistCollections({
      ...collections,
      [monthlyDraft.franchiseId]: {
        ...current,
        monthlyPaidByPeriod: allocation.nextMonthlyPaidByPeriod,
      },
    })
    setMonthlyDraft(null)
  }

  const upfrontPct =
    metrics.upfrontTotal > 0
      ? Math.round((metrics.upfrontCollectedTotal / metrics.upfrontTotal) * 100)
      : 0
  const monthlyPct =
    metrics.fixedMonthlyTotal > 0
      ? Math.round(
          (metrics.monthlyCollectedTotal / metrics.fixedMonthlyTotal) * 100,
        )
      : 0

  const upfrontPreview = (() => {
    if (!upfrontDraft) return null
    const upfrontAmount = Math.max(0, upfrontDraft.upfrontAmount)
    const amountCollected = Math.max(0, Number(upfrontDraft.amountCollected) || 0)
    const alreadyPaid = Math.max(
      0,
      collections[upfrontDraft.franchiseId]?.upfrontPaid ?? 0,
    )
    const remainingDue = Math.max(0, upfrontAmount - alreadyPaid)
    const appliedAmount = Math.min(remainingDue, amountCollected)
    return {
      upfrontAmount,
      amountCollected,
      alreadyPaid,
      appliedAmount,
      nextRemaining: Math.max(0, upfrontAmount - Math.min(upfrontAmount, alreadyPaid + appliedAmount)),
      unallocatedAmount: Math.max(0, amountCollected - appliedAmount),
      confirmDisabled:
        upfrontAmount <= 0 || amountCollected <= 0 || appliedAmount <= 0,
    }
  })()

  const monthlyPreview = (() => {
    if (!monthlyDraft) return null
    const startPeriod = monthlyDraft.startPeriod || monthlyPeriod
    const perMonthAmount = monthlyDraft.perMonthAmount
    const amountCollected = Math.max(0, Number(monthlyDraft.amountCollected) || 0)
    const existingPaidByPeriod =
      collections[monthlyDraft.franchiseId]?.monthlyPaidByPeriod ?? {}
    const startPaid = Math.max(0, existingPaidByPeriod[startPeriod] ?? 0)
    const allocation = allocateMonthlyPayment({
      existingPaidByPeriod,
      startPeriod,
      perMonthAmount,
      amountCollected,
    })
    return {
      startPeriod,
      perMonthAmount,
      amountCollected,
      startPaid,
      startRemaining: Math.max(0, perMonthAmount - startPaid),
      allocation,
      confirmDisabled:
        perMonthAmount <= 0 || amountCollected <= 0 || allocation.appliedAmount <= 0,
    }
  })()

  return (
    <div>
      <PageHeader
        title="Financials Dashboard"
        description="Track franchise setup fees, monthly collections, and revenue commitments."
        breadcrumbs={[
          { label: 'Home', href: getHomePathForRole(user?.role) },
          { label: 'Financials Dashboard' },
        ]}
        actions={
          <Button asChild variant="outline">
            <Link to="/franchise-setup/onboarding/step-1">
              <Briefcase className="h-4 w-4" />
              Open Franchise Setup
            </Link>
          </Button>
        }
      />

      <div className="space-y-4">
        <Card>
          <CardHeader className="border-b border-border px-4 py-3">
            <CardTitle className="text-base">General</CardTitle>
            <CardDescription>
              Active collection totals, with configured commitments shown
              separately by status.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 p-4">
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <StatCard
                title="Active Upfront"
                value={formatCompactCurrency(metrics.upfrontTotal)}
                description={`${metrics.upfrontCollectedCount}/${metrics.activeFranchises} active collected • pending ${formatCompactCurrency(metrics.upfrontRemainingTotal)}`}
                icon={BarChart3}
                accent="wallet"
              />
              <StatCard
                title="Active Billable Monthly"
                value={formatCompactCurrency(metrics.fixedMonthlyTotal)}
                description={`${monthlyPeriodLabel} • ${metrics.monthlyCollectedCount}/${metrics.activeFranchises} active collected • pending ${formatCompactCurrency(metrics.monthlyRemainingTotal)}/mo`}
                icon={CreditCard}
              />
              <StatCard
                title="Activated Portfolio"
                value={formatCompactCurrency(metrics.activatedFixedMonthly)}
                description={`${metrics.activeFranchises} activated • upfront ${formatCompactCurrency(metrics.activatedUpfront)}`}
                icon={ArrowRight}
                accent="success"
              />
              <StatCard
                title="Coverage"
                value={`${metrics.allTerritories.length} territories`}
                description={`${metrics.allTerritories.reduce((sum, territory) => sum + territory.areas.length, 0)} areas • ${metrics.missingBoundaries.length} missing boundary`}
                icon={MapPin}
                accent={metrics.missingBoundaries.length ? 'warning' : 'success'}
              />
            </div>

            <Card>
              <CardHeader className="border-b border-border px-4 py-3">
                <CardTitle className="text-base">
                  Financial Commitments by Status
                </CardTitle>
                <CardDescription>
                  Configured amounts grouped by activation status
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Franchises</TableHead>
                      <TableHead className="text-right">
                        Upfront (Committed)
                      </TableHead>
                      <TableHead className="text-right">
                        Billable Monthly (Subtotal)
                      </TableHead>
                      <TableHead className="text-right">Status Meaning</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {metrics.byStatus.map((row) => (
                      <TableRow key={row.status}>
                        <TableCell>
                          <FranchiseStatusBadge status={row.status} />
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {row.count}
                        </TableCell>
                        <TableCell className="text-right font-medium tabular-nums">
                          {formatCurrency(row.upfront)}
                        </TableCell>
                        <TableCell className="text-right font-medium tabular-nums">
                          {formatCurrency(row.fixedMonthly)} / mo
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground">
                          {row.status === 'Activated'
                            ? 'Active account'
                            : 'Configured, not yet active'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <div className="grid gap-4 lg:grid-cols-2">
              <Card>
                <CardHeader className="border-b border-border px-4 py-3">
                  <CardTitle className="text-base">Collections Overview</CardTitle>
                  <CardDescription>
                    Activated accounts only. Use Confirm Collection to mark
                    received payments.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6 p-4">
                  <CollectionProgress
                    label="Upfront"
                    collectedCount={metrics.upfrontCollectedCount}
                    activeCount={metrics.activeFranchises}
                    percent={upfrontPct}
                    collectedAmount={formatCurrency(metrics.upfrontCollectedTotal)}
                    pendingAmount={formatCurrency(metrics.upfrontRemainingTotal)}
                  />
                  <CollectionProgress
                    label="Billable fixed monthly"
                    collectedCount={metrics.monthlyCollectedCount}
                    activeCount={metrics.activeFranchises}
                    percent={monthlyPct}
                    extraLabel={monthlyPeriodLabel}
                    collectedAmount={`${formatCurrency(metrics.monthlyCollectedTotal)} / mo`}
                    pendingAmount={formatCurrency(metrics.monthlyRemainingTotal)}
                    pendingSuffix=" / mo"
                    barClassName="bg-wallet"
                  />
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-start justify-between space-y-0 border-b border-border px-4 py-3">
                  <div>
                    <CardTitle className="text-base">Coverage Issues</CardTitle>
                    <CardDescription>
                      Territories missing boundaries (geolocation not finalized).
                    </CardDescription>
                  </div>
                  <Badge
                    variant={
                      metrics.missingBoundaries.length === 0
                        ? 'success'
                        : 'warning'
                    }
                    className="rounded-full"
                  >
                    {metrics.missingBoundaries.length === 0
                      ? 'All set'
                      : `${metrics.missingBoundaries.length} missing`}
                  </Badge>
                </CardHeader>
                <CardContent className="space-y-3 p-4">
                  {metrics.missingBoundaries.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No pending boundary work right now.
                    </p>
                  ) : (
                    metrics.missingBoundaries.slice(0, 6).map((territory) => (
                      <div
                        key={`${territory.franchiseId}:${territory.id}`}
                        className="flex items-start justify-between gap-3"
                      >
                        <div className="min-w-0">
                          <div className="truncate text-sm font-medium">
                            {territory.coverageName}
                          </div>
                          <div className="truncate text-xs text-muted-foreground">
                            {territory.franchiseName} • {territory.city},{' '}
                            {territory.province}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                  {metrics.missingBoundaries.length > 6 ? (
                    <p className="text-sm text-muted-foreground">
                      +{metrics.missingBoundaries.length - 6} more
                    </p>
                  ) : null}
                </CardContent>
              </Card>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="border-b border-border px-4 py-3">
            <CardTitle className="text-base">One-time / Upfront</CardTitle>
            <CardDescription>
              Active package fees + included one-time fees for activated
              accounts.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 p-4 lg:grid-cols-12">
            <Card className="lg:col-span-8">
              <CardHeader className="border-b border-border px-4 py-3">
                <CardTitle className="text-base">Top Upfront</CardTitle>
                <CardDescription>
                  All configured accounts • collections only for activated
                  accounts
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Franchise</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Package</TableHead>
                      <TableHead className="text-right">One-time</TableHead>
                      <TableHead className="text-right">Upfront</TableHead>
                      <TableHead className="text-right">
                        Upfront Collection
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {metrics.topUpfront.map((franchise) => {
                      const due = Math.max(0, franchise.upfrontTotal)
                      const paid = Math.max(
                        0,
                        collections[franchise.id]?.upfrontPaid ?? 0,
                      )
                      return (
                        <TableRow key={franchise.id}>
                          <TableCell>
                            <div className="font-medium">{franchise.name}</div>
                            <div className="text-xs text-muted-foreground">
                              {franchise.territories} territories
                            </div>
                          </TableCell>
                          <TableCell>
                            <FranchiseStatusBadge status={franchise.status} />
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {formatCurrency(franchise.packageFees)}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {formatCurrency(franchise.oneTimeEnabled)}
                          </TableCell>
                          <TableCell className="text-right font-semibold tabular-nums">
                            {formatCurrency(franchise.upfrontTotal)}
                          </TableCell>
                          <TableCell className="text-right">
                            <CollectionAction
                              isActivated={franchise.status === 'Activated'}
                              isCollected={due > 0 && paid >= due}
                              isPartial={due > 0 && paid > 0 && paid < due}
                              paid={paid}
                              due={due}
                              disabled={due <= 0}
                              onConfirm={() =>
                                openUpfrontConfirm(
                                  franchise.id,
                                  franchise.name,
                                  due,
                                )
                              }
                            />
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <div className="space-y-4 lg:col-span-4">
              <Card>
                <CardHeader className="border-b border-border px-4 py-3">
                  <CardTitle className="text-base">Upfront Summary</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 p-4">
                  <div className="border border-border bg-muted/40 p-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                        Active upfront
                      </span>
                      <Badge variant="wallet" className="rounded-full">
                        Active
                      </Badge>
                    </div>
                    <div className="mt-2 flex items-baseline justify-between">
                      <span className="text-sm text-muted-foreground">
                        Active total
                      </span>
                      <span className="font-semibold tabular-nums">
                        {formatCurrency(metrics.upfrontTotal)}
                      </span>
                    </div>
                  </div>
                  <SummaryRow
                    label="Package fees"
                    value={formatCurrency(metrics.packageFeesTotal)}
                  />
                  <SummaryRow
                    label="One-time fees (included)"
                    value={formatCurrency(metrics.oneTimeEnabledTotal)}
                  />
                  <SummaryRow
                    label={`Collected (${metrics.upfrontCollectedCount}/${metrics.activeFranchises})`}
                    value={formatCurrency(metrics.upfrontCollectedTotal)}
                  />
                  <SummaryRow
                    label="Remaining"
                    value={formatCurrency(metrics.upfrontRemainingTotal)}
                  />
                  <div className="border-t border-border pt-3">
                    <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Package adoption
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      {Object.entries(metrics.packageAdoption).map(
                        ([code, count]) => (
                          <div
                            key={code}
                            className="border border-border bg-muted/40 p-2"
                          >
                            <div className="text-[11px] text-muted-foreground">
                              {code}
                            </div>
                            <div className="font-semibold">{count}</div>
                          </div>
                        ),
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="border-b border-border px-4 py-3">
                  <CardTitle className="text-base">
                    One-time Breakdown (Included)
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 p-4">
                  {metrics.oneTimeByName.map((item) => (
                    <SummaryRow
                      key={item.name}
                      label={`${item.name} (${item.enabledCount})`}
                      value={formatCurrency(item.total)}
                    />
                  ))}
                </CardContent>
              </Card>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-col gap-3 space-y-0 border-b border-border px-4 py-3 md:flex-row md:items-start md:justify-between">
            <div>
              <CardTitle className="text-base">Monthly Recurring</CardTitle>
              <CardDescription>
                Billable fixed monthly fees and % of gross configurations.
                Cost-deduction items are excluded from collection. Collection
                period: {monthlyPeriodLabel}.
              </CardDescription>
            </div>
            <div className="w-full max-w-[220px] space-y-1.5">
              <Label htmlFor="collection-period">Collection period</Label>
              <Select value={monthlyPeriod} onValueChange={setMonthlyPeriod}>
                <SelectTrigger id="collection-period">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {monthlyPeriodOptions.map((period) => (
                    <SelectItem key={period} value={period}>
                      {monthLabel(period)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent className="grid gap-4 p-4 lg:grid-cols-12">
            <Card className="lg:col-span-8">
              <CardHeader className="border-b border-border px-4 py-3">
                <CardTitle className="text-base">
                  Top Billable Fixed Monthly Fees
                </CardTitle>
                <CardDescription>
                  Excludes cost-deduction-only items • collections only for
                  activated accounts
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Franchise</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">
                        Billable Fixed Monthly
                      </TableHead>
                      <TableHead className="text-right">% Gross Items</TableHead>
                      <TableHead className="text-right">
                        Monthly Collection
                        <div className="font-medium normal-case tracking-normal text-muted-foreground">
                          {monthlyPeriodLabel}
                        </div>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {metrics.topMonthly.map((franchise) => {
                      const due = Math.max(0, franchise.fixedMonthly)
                      const paid = Math.max(
                        0,
                        collections[franchise.id]?.monthlyPaidByPeriod?.[
                          monthlyPeriod
                        ] ?? 0,
                      )
                      const isActivated = franchise.status === 'Activated'
                      return (
                        <TableRow key={franchise.id}>
                          <TableCell>
                            <div className="font-medium">{franchise.name}</div>
                            <div className="text-xs text-muted-foreground">
                              {franchise.territories} territories
                            </div>
                          </TableCell>
                          <TableCell>
                            <FranchiseStatusBadge status={franchise.status} />
                          </TableCell>
                          <TableCell className="text-right font-semibold tabular-nums">
                            {formatCurrency(franchise.fixedMonthly)}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {franchise.percentGrossCount === 0
                              ? '—'
                              : franchise.percentGrossCount}
                          </TableCell>
                          <TableCell className="text-right">
                            <CollectionAction
                              isActivated={isActivated}
                              isCollected={due > 0 && paid >= due}
                              isPartial={due > 0 && paid > 0 && paid < due}
                              paid={paid}
                              due={due}
                              disabled={due <= 0 || !isActivated}
                              onConfirm={() =>
                                openMonthlyConfirm(
                                  franchise.id,
                                  franchise.name,
                                  due,
                                )
                              }
                            />
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <div className="space-y-4 lg:col-span-4">
              <Card>
                <CardHeader className="border-b border-border px-4 py-3">
                  <CardTitle className="text-base">
                    Active Monthly Summary
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 p-4">
                  <div className="border border-border bg-muted/40 p-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                        Active billable fixed monthly
                      </span>
                      <Badge variant="secondary" className="rounded-full">
                        Subtotal
                      </Badge>
                    </div>
                    <div className="mt-2 flex items-baseline justify-between">
                      <span className="text-sm text-muted-foreground">
                        Active total
                      </span>
                      <span className="font-semibold tabular-nums">
                        {formatCurrency(metrics.fixedMonthlyTotal)}
                        <span className="text-sm font-normal text-muted-foreground">
                          {' '}
                          / mo
                        </span>
                      </span>
                    </div>
                  </div>
                  <SummaryRow
                    label={`Collected (${monthlyPeriodLabel}) (${metrics.monthlyCollectedCount}/${metrics.activeFranchises})`}
                    value={`${formatCurrency(metrics.monthlyCollectedTotal)} / mo`}
                  />
                  <SummaryRow
                    label="Pending"
                    value={`${formatCurrency(metrics.monthlyRemainingTotal)} / mo`}
                  />
                  <SummaryRow
                    label="% of gross configured"
                    value={`${metrics.percentGrossConfigured}/${metrics.activeFranchises}`}
                  />
                  <SummaryRow
                    label="% of gross items"
                    value={metrics.percentGrossItemsTotal}
                  />
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="border-b border-border px-4 py-3">
                  <CardTitle className="text-base">
                    Billable Monthly Items
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 p-4">
                  {metrics.monthlyByName.slice(0, 8).map((item) => (
                    <SummaryRow
                      key={`${item.billingType}:${item.name}`}
                      label={`${item.name} (${item.billingType === 'FixedMonthly' ? 'Fixed' : '% Gross'} • ${item.count})`}
                      value={
                        item.billingType === 'FixedMonthly'
                          ? `${formatCurrency(item.total)}/mo`
                          : `${item.total}%`
                      }
                    />
                  ))}
                </CardContent>
              </Card>
            </div>
          </CardContent>
        </Card>
      </div>

      <Dialog
        open={Boolean(upfrontDraft)}
        onOpenChange={(open) => {
          if (!open) setUpfrontDraft(null)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm upfront collection</DialogTitle>
            <DialogDescription>{upfrontDraft?.franchiseName}</DialogDescription>
          </DialogHeader>
          {upfrontPreview ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="upfront-amount">Amount collected</Label>
                <Input
                  id="upfront-amount"
                  type="number"
                  min={0}
                  step={0.01}
                  inputMode="decimal"
                  className="tabular-nums"
                  value={upfrontDraft.amountCollected}
                  onChange={(event) =>
                    setUpfrontDraft((draft) =>
                      draft
                        ? { ...draft, amountCollected: event.target.value }
                        : draft,
                    )
                  }
                />
              </div>
              <div className="space-y-2 border border-border bg-muted/40 p-3">
                <SummaryRow
                  label="Upfront due"
                  value={formatCurrency(upfrontPreview.upfrontAmount)}
                />
                <SummaryRow
                  label="Already paid"
                  value={formatCurrency(upfrontPreview.alreadyPaid)}
                />
                <SummaryRow
                  label="Applied"
                  value={formatCurrency(upfrontPreview.appliedAmount)}
                  emphasize
                />
                <SummaryRow
                  label="Remaining after payment"
                  value={formatCurrency(upfrontPreview.nextRemaining)}
                />
                <SummaryRow
                  label="Unallocated"
                  value={formatCurrency(upfrontPreview.unallocatedAmount)}
                />
              </div>
              <p className="text-sm text-muted-foreground">
                Partial payments are saved. The upfront item is marked collected
                only when the full upfront amount is covered.
              </p>
            </div>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setUpfrontDraft(null)}>
              Cancel
            </Button>
            <Button
              onClick={confirmUpfrontCollection}
              disabled={upfrontPreview?.confirmDisabled}
            >
              Confirm Collection
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(monthlyDraft)}
        onOpenChange={(open) => {
          if (!open) setMonthlyDraft(null)
        }}
      >
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Confirm collection</DialogTitle>
            <DialogDescription>{monthlyDraft?.franchiseName}</DialogDescription>
          </DialogHeader>
          {monthlyPreview ? (
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="monthly-start-period">Start period</Label>
                  <Select
                    value={monthlyPreview.startPeriod}
                    onValueChange={(value) =>
                      setMonthlyDraft((draft) =>
                        draft ? { ...draft, startPeriod: value } : draft,
                      )
                    }
                  >
                    <SelectTrigger id="monthly-start-period">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {monthlyPeriodOptions.map((period) => (
                        <SelectItem key={period} value={period}>
                          {monthLabel(period)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="monthly-amount">Amount collected</Label>
                  <Input
                    id="monthly-amount"
                    type="number"
                    min={0}
                    step={0.01}
                    inputMode="decimal"
                    className="tabular-nums"
                    value={monthlyDraft.amountCollected}
                    onChange={(event) =>
                      setMonthlyDraft((draft) =>
                        draft
                          ? { ...draft, amountCollected: event.target.value }
                          : draft,
                      )
                    }
                  />
                  <div className="flex flex-wrap gap-2">
                    {[1, 3, 6, 12].map((months) => (
                      <Button
                        key={months}
                        type="button"
                        size="sm"
                        variant="secondary"
                        onClick={() => {
                          const quick =
                            Math.max(0, monthlyPreview.startRemaining) +
                            Math.max(0, monthlyPreview.perMonthAmount) *
                              Math.max(0, months - 1)
                          setMonthlyDraft((draft) =>
                            draft
                              ? { ...draft, amountCollected: String(quick) }
                              : draft,
                          )
                        }}
                      >
                        {months} mo
                      </Button>
                    ))}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {monthlyPreview.startPaid > 0 ? (
                      <>
                        Already paid (start):{' '}
                        <span className="font-medium text-foreground">
                          {formatCurrency(monthlyPreview.startPaid)}
                        </span>{' '}
                        • remaining{' '}
                        <span className="font-medium text-foreground">
                          {formatCurrency(monthlyPreview.startRemaining)}
                        </span>
                      </>
                    ) : (
                      <>
                        Monthly due:{' '}
                        <span className="font-medium text-foreground">
                          {formatCurrency(monthlyPreview.perMonthAmount)}
                        </span>
                      </>
                    )}
                  </p>
                </div>
              </div>
              <div className="space-y-2 border border-border bg-muted/40 p-3">
                <SummaryRow
                  label="Monthly subtotal"
                  value={`${formatCurrency(monthlyPreview.perMonthAmount)} / mo`}
                />
                <SummaryRow
                  label="Amount collected"
                  value={formatCurrency(monthlyPreview.amountCollected)}
                  emphasize
                />
                <SummaryRow
                  label="Covers"
                  value={monthlyCoverageLabel(
                    monthlyPreview.allocation,
                    monthlyPreview.startPeriod,
                  )}
                />
                <SummaryRow
                  label="Applied"
                  value={formatCurrency(monthlyPreview.allocation.appliedAmount)}
                />
                <SummaryRow
                  label="Unallocated"
                  value={formatCurrency(
                    monthlyPreview.allocation.unallocatedAmount,
                  )}
                />
              </div>
              <p className="text-sm text-muted-foreground">
                This applies to billable fixed monthly fees only.
                Cost-deduction items are not collected here. The amount is
                applied to the start period first, then future periods. Partial
                payments are tracked.
              </p>
            </div>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setMonthlyDraft(null)}>
              Cancel
            </Button>
            <Button
              onClick={confirmMonthlyCollection}
              disabled={monthlyPreview?.confirmDisabled}
            >
              Confirm Collection
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
