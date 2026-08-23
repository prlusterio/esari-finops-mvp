import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Lightbulb, MapPin } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { formatCurrency } from '@/lib/currency'
import {
  DEFAULT_ONBOARDING_CLIENT_TYPE,
  ONBOARDING_CLIENT_TYPES,
  ONBOARDING_STEP_PATHS,
  PACKAGE_OPTIONS,
} from '@/lib/onboardingSetup'
import { getHomePathForRole } from '@/lib/permissions'
import {
  getOnboardingClientType,
  getOnboardingFranchiseSetup,
  saveOnboardingClientType,
  saveOnboardingFranchiseSetup,
} from '@/services/storage'
import { PageHeader } from '@/components/shared/PageHeader'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { cn } from '@/lib/utils'
import { MonthlyOperationalFees } from './MonthlyOperationalFees'
import { OneTimeFranchiseFees } from './OneTimeFranchiseFees'
import { TerritoriesAndAreas } from './TerritoriesAndAreas'
import { OnboardingStepper, SummaryRow } from './onboarding-ui'

export default function OnboardingStep2Page() {
  const { user } = useAuth()
  const [clientType, setClientType] = useState(DEFAULT_ONBOARDING_CLIENT_TYPE)
  const [clientTypeLoaded, setClientTypeLoaded] = useState(false)
  const [packageState, setPackageState] = useState(() => {
    const stored = getOnboardingFranchiseSetup()
    return stored.packageState
  })
  const [oneTimeSummary, setOneTimeSummary] = useState(() => {
    const stored = getOnboardingFranchiseSetup()
    return {
      totalEnabled: stored.oneTimeFees
        .filter((fee) => fee.enabled)
        .reduce((sum, fee) => sum + fee.amount, 0),
      enabledCount: stored.oneTimeFees.filter((fee) => fee.enabled).length,
      totalCount: stored.oneTimeFees.length,
      fees: stored.oneTimeFees,
    }
  })
  const [monthlySummary, setMonthlySummary] = useState(() => {
    const stored = getOnboardingFranchiseSetup()
    return {
      fixedMonthlySubtotal: 1_700,
      fixedMonthlyCount: 2,
      percentGrossCount: 1,
      costDeductionSubtotal: 10_100,
      costDeductionCount: 3,
      fees: stored.monthlyFees,
    }
  })
  const [territorySelection, setTerritorySelection] = useState(() => {
    const stored = getOnboardingFranchiseSetup()
    return {
      territory: stored.territory,
      areas: stored.areas,
      areasCount: stored.areas.length,
    }
  })

  const packageQuantities = packageState.quantities
  const primaryPackage = packageState.primary

  useEffect(() => {
    setClientType(getOnboardingClientType())
    setClientTypeLoaded(true)
  }, [])

  useEffect(() => {
    if (!clientTypeLoaded) return
    saveOnboardingClientType(clientType)
  }, [clientTypeLoaded, clientType])

  useEffect(() => {
    if (!clientTypeLoaded) return
    saveOnboardingFranchiseSetup({
      packageState,
      oneTimeFees: oneTimeSummary.fees,
      monthlyFees: monthlySummary.fees,
      territory: territorySelection?.territory,
      areas: territorySelection?.areas,
    })
  }, [
    clientTypeLoaded,
    packageState,
    oneTimeSummary.fees,
    monthlySummary.fees,
    territorySelection,
  ])

  const updatePackageQuantity = useCallback((code, qty) => {
    setPackageState((prev) => {
      const nextQuantities = { ...prev.quantities, [code]: qty }
      let nextPrimary = prev.primary
      if (nextQuantities[nextPrimary] === 0) {
        const candidate = PACKAGE_OPTIONS.find(
          (item) => nextQuantities[item.code] > 0,
        )?.code
        if (candidate) nextPrimary = candidate
      }
      return { quantities: nextQuantities, primary: nextPrimary }
    })
  }, [])

  const packageSubtotal = useMemo(
    () =>
      PACKAGE_OPTIONS.reduce(
        (sum, item) => sum + item.unitFee * (packageQuantities[item.code] ?? 0),
        0,
      ),
    [packageQuantities],
  )

  const primaryPackageLabel =
    PACKAGE_OPTIONS.find((item) => item.code === primaryPackage)?.label ??
    primaryPackage
  const upfrontDue = packageSubtotal + oneTimeSummary.totalEnabled
  const territoryLocation = territorySelection?.territory
    ? `${territorySelection.territory.city}, ${territorySelection.territory.province} • ${territorySelection.territory.region}`
    : ''

  return (
    <div>
      <PageHeader
        title="Franchise Setup"
        description="Configure package units, territories, one-time fees, and monthly fees."
        breadcrumbs={[
          { label: 'Home', href: getHomePathForRole(user?.role) },
          { label: 'Clients', href: '/franchise-setup/clients' },
          { label: 'Franchise Setup' },
        ]}
      />

      <div className="grid grid-cols-12 gap-4">
        <div className="col-span-12 space-y-4 pb-8 lg:col-span-8">
          <OnboardingStepper currentStep={2} />

          <Card>
            <CardHeader className="border-b border-border px-4 py-3">
              <CardTitle className="text-base">Client Type</CardTitle>
              <CardDescription>
                Choose who will operate this coverage. Revenue-split defaults on
                the next step follow this selection.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4">
              <div className="inline-flex border border-border bg-muted p-1">
                {ONBOARDING_CLIENT_TYPES.map((type) => (
                  <button
                    key={type}
                    type="button"
                    aria-pressed={clientType === type}
                    className={cn(
                      'px-5 py-2 text-sm font-semibold transition-colors',
                      clientType === type
                        ? 'bg-card text-primary shadow-sm'
                        : 'text-muted-foreground hover:bg-card/60',
                    )}
                    onClick={() => setClientType(type)}
                  >
                    {type === 'Sub-Franchisor' ? 'Sub-franchisor' : 'Franchisee'}
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="border-b border-border px-4 py-3">
              <CardTitle className="text-base">Franchise Package</CardTitle>
              <CardDescription>
                Set the units per package tier. Mark one tier as the primary
                coverage package.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Package</TableHead>
                    <TableHead className="w-20 text-center">Primary</TableHead>
                    <TableHead className="text-right">Unit fee</TableHead>
                    <TableHead className="w-32 text-center">Units</TableHead>
                    <TableHead className="text-right">Line total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {PACKAGE_OPTIONS.map((item) => {
                    const qty = packageQuantities[item.code] ?? 0
                    const isPrimary = primaryPackage === item.code
                    return (
                      <TableRow
                        key={item.code}
                        className={cn(isPrimary && 'bg-primary/5')}
                      >
                        <TableCell
                          className={cn(qty === 0 && 'text-muted-foreground')}
                        >
                          <div className="font-semibold text-primary">
                            {item.label}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {item.description}
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <input
                            className="h-4 w-4 accent-primary"
                            type="radio"
                            name="primaryPackage"
                            aria-label={`Set ${item.label} as primary package`}
                            checked={isPrimary}
                            disabled={qty === 0}
                            onChange={() =>
                              setPackageState((prev) => ({
                                ...prev,
                                primary: item.code,
                              }))
                            }
                            title={
                              qty === 0
                                ? 'Set units > 0 to select'
                                : 'Primary package'
                            }
                          />
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatCurrency(item.unitFee)}
                        </TableCell>
                        <TableCell className="text-center">
                          <Input
                            className="mx-auto h-9 w-16 text-center tabular-nums"
                            type="number"
                            min={0}
                            step={1}
                            inputMode="numeric"
                            aria-label={`Units for ${item.label}`}
                            value={qty}
                            onChange={(event) => {
                              const v = Number(event.target.value)
                              const next = Number.isFinite(v)
                                ? Math.max(0, Math.floor(v))
                                : 0
                              updatePackageQuantity(item.code, next)
                            }}
                          />
                        </TableCell>
                        <TableCell className="text-right font-semibold tabular-nums">
                          {formatCurrency(item.unitFee * qty)}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
                <TableFooter>
                  <TableRow>
                    <TableCell colSpan={4} className="uppercase">
                      Package subtotal
                    </TableCell>
                    <TableCell className="text-right font-semibold tabular-nums">
                      {formatCurrency(packageSubtotal)}
                    </TableCell>
                  </TableRow>
                </TableFooter>
              </Table>
            </CardContent>
          </Card>

          <TerritoriesAndAreas onSelectionChange={setTerritorySelection} />
          <OneTimeFranchiseFees
            initialFees={oneTimeSummary.fees}
            onSummaryChange={setOneTimeSummary}
          />
          <MonthlyOperationalFees
            initialFees={monthlySummary.fees}
            onSummaryChange={setMonthlySummary}
          />
        </div>

        <div className="col-span-12 h-fit lg:sticky lg:top-6 lg:col-span-4">
          <Card className="overflow-hidden">
            <div className="bg-primary px-4 py-3 text-primary-foreground">
              <h2 className="text-[11px] font-semibold uppercase tracking-wide">
                Step 2 Summary
              </h2>
            </div>
            <CardContent className="space-y-4 p-4">
              <div className="space-y-2">
                <SummaryRow
                  label="Client Type"
                  value={
                    clientType === 'Sub-Franchisor'
                      ? 'Sub-franchisor'
                      : 'Franchisee'
                  }
                />
                <SummaryRow
                  label="Primary package"
                  value={
                    packageQuantities[primaryPackage] > 0
                      ? `${primaryPackageLabel} × ${packageQuantities[primaryPackage]}`
                      : 'Not set'
                  }
                  emphasize
                />
              </div>
              <hr className="border-border" />
              <div className="space-y-2">
                <SummaryRow
                  label="Package subtotal"
                  value={formatCurrency(packageSubtotal)}
                />
                <SummaryRow
                  label="One-time fees (included)"
                  value={formatCurrency(oneTimeSummary.totalEnabled)}
                />
                <SummaryRow
                  label="Upfront due"
                  value={formatCurrency(upfrontDue)}
                  emphasize
                />
              </div>
              <div className="space-y-2">
                <SummaryRow
                  label="Billable fixed monthly"
                  value={`${formatCurrency(monthlySummary.fixedMonthlySubtotal)}/mo`}
                />
                <SummaryRow
                  label="Standard cost deductions"
                  value={`${formatCurrency(monthlySummary.costDeductionSubtotal)}/mo`}
                />
                <SummaryRow
                  label="% of gross items"
                  value={
                    monthlySummary.percentGrossCount === 0
                      ? '—'
                      : monthlySummary.percentGrossCount
                  }
                />
              </div>
              <hr className="border-border" />
              <div className="space-y-2">
                <span className="block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Primary Territory
                </span>
                <div className="flex items-start gap-2">
                  <MapPin className="mt-0.5 h-4 w-4 text-primary" />
                  <div>
                    <div className="font-semibold">
                      {territorySelection?.territory?.coverageName ??
                        'Select a territory'}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {territorySelection?.territory
                        ? `${territoryLocation} • ${territorySelection.areasCount} areas`
                        : ''}
                    </div>
                  </div>
                </div>
              </div>
              <hr className="border-border" />
              <div className="border border-border bg-muted/30 p-3">
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Next step
                  </span>
                  <Badge variant="secondary" className="rounded-full">
                    Step 3
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  Next: set the company vs this client revenue split.
                  Downline shares are not configured here.
                </p>
              </div>
              <div className="space-y-2 pt-1">
                <Button type="button" className="w-full" asChild>
                  <Link to={ONBOARDING_STEP_PATHS[3]}>
                    Continue to Step 3
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
                <Button type="button" variant="outline" className="w-full" asChild>
                  <Link to={ONBOARDING_STEP_PATHS[1]}>Back to Client Info</Link>
                </Button>
              </div>
            </CardContent>
          </Card>

          <div className="mt-4 flex gap-3 border border-border bg-muted/30 p-4">
            <Lightbulb className="h-5 w-5 shrink-0 text-warning" />
            <div>
              <div className="text-sm font-semibold">Pro Tip</div>
              <p className="text-sm text-muted-foreground">
                Fixed monthly fees are included in dashboard totals. % of gross
                fees are tracked separately.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
