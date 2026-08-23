import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Info } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import {
  clampPercent,
  DEFAULT_REVENUE_SPLIT_DEFAULTS,
  DEFAULT_REVENUE_SPLIT_FRANCHISEE,
  DEFAULT_REVENUE_SPLIT_SUB_FRANCHISOR,
  ONBOARDING_STEP_PATHS,
  onboardingDownlineHint,
  summarizeOnboardingRevenueSplit,
} from '@/lib/onboardingSetup'
import { getHomePathForRole } from '@/lib/permissions'
import {
  getOnboardingClientType,
  getOnboardingRevenueSplit,
  saveOnboardingRevenueSplit,
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
import { cn } from '@/lib/utils'
import { OnboardingStepper, ShareCard, SummaryRow } from './onboarding-ui'

export default function OnboardingStep3Page() {
  const { user } = useAuth()
  const [clientType, setClientType] = useState(getOnboardingClientType)
  const [revenueDefaults, setRevenueDefaults] = useState(
    DEFAULT_REVENUE_SPLIT_DEFAULTS,
  )
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    setClientType(getOnboardingClientType())
    setRevenueDefaults(getOnboardingRevenueSplit())
    setLoaded(true)
  }, [])

  useEffect(() => {
    if (!loaded) return
    saveOnboardingRevenueSplit(revenueDefaults)
  }, [loaded, revenueDefaults])

  const summary = summarizeOnboardingRevenueSplit(revenueDefaults, clientType)
  const isSubFranchisor = summary.type === 'Sub-Franchisor'

  function patchActiveSplit(nextSplit) {
    setRevenueDefaults((prev) =>
      isSubFranchisor
        ? { ...prev, subFranchisor: nextSplit }
        : { ...prev, franchisee: nextSplit },
    )
  }

  function updateCompanyShare(raw) {
    const company = clampPercent(Number(raw) || 0)
    patchActiveSplit({ company, client: clampPercent(100 - company) })
  }

  function updateClientShare(raw) {
    const client = clampPercent(Number(raw) || 0)
    patchActiveSplit({ client, company: clampPercent(100 - client) })
  }

  return (
    <div>
      <PageHeader
        title="Revenue Split"
        description="Set the split between eSariSari (company) and this client. Downline shares are not set here."
        breadcrumbs={[
          { label: 'Home', href: getHomePathForRole(user?.role) },
          { label: 'Clients', href: '/franchise-setup/clients' },
          { label: 'Revenue Split' },
        ]}
      />

      <div className="grid grid-cols-12 gap-4">
        <div className="col-span-12 space-y-4 pb-8 lg:col-span-8">
          <OnboardingStepper currentStep={3} />

          <Card>
            <CardHeader className="flex flex-row items-start justify-between space-y-0 border-b border-border px-4 py-3">
              <div>
                <CardTitle className="text-base">Revenue Sharing</CardTitle>
                <CardDescription>
                  Company vs {summary.clientLabel.toLowerCase()}. Must total
                  100%.
                </CardDescription>
              </div>
              <Button
                type="button"
                variant="link"
                className="h-auto p-0"
                onClick={() =>
                  setRevenueDefaults((prev) =>
                    isSubFranchisor
                      ? {
                          ...prev,
                          subFranchisor: DEFAULT_REVENUE_SPLIT_SUB_FRANCHISOR,
                        }
                      : {
                          ...prev,
                          franchisee: DEFAULT_REVENUE_SPLIT_FRANCHISEE,
                        },
                  )
                }
              >
                Reset defaults
              </Button>
            </CardHeader>
            <CardContent className="space-y-4 p-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <ShareCard
                  label="Company"
                  value={summary.split.company}
                  onChange={updateCompanyShare}
                  hint="eSariSari platform"
                />
                <ShareCard
                  highlight
                  label={summary.clientLabel}
                  value={summary.split.client}
                  onChange={updateClientShare}
                  hint="This onboarded client"
                />
              </div>

              <div>
                <div className="mb-2 flex justify-between text-sm font-medium">
                  <span>Company</span>
                  <span>{summary.clientLabel}</span>
                </div>
                <div className="flex h-6 overflow-hidden bg-muted">
                  {summary.split.company > 0 ? (
                    <div
                      className="flex items-center bg-slate-400 px-2 text-[11px] font-semibold text-white"
                      style={{ width: `${summary.split.company}%` }}
                    >
                      {summary.split.company}%
                    </div>
                  ) : null}
                  {summary.split.client > 0 ? (
                    <div
                      className="flex items-center justify-end bg-primary px-2 text-[11px] font-semibold text-white"
                      style={{ width: `${summary.split.client}%` }}
                    >
                      {summary.split.client}%
                    </div>
                  ) : null}
                </div>
              </div>

              <div
                className={cn(
                  'flex items-center gap-2 border p-3 text-sm',
                  summary.ok
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                    : 'border-amber-200 bg-amber-50 text-amber-900',
                )}
              >
                <Info className="h-4 w-4 shrink-0" />
                {summary.ok
                  ? 'Revenue split validated: Company and this client equal 100%.'
                  : `Total is ${Math.round(summary.total * 10) / 10}% — ${
                      summary.delta > 0
                        ? `reduce ${summary.needs}%`
                        : `add ${summary.needs}%`
                    } to reach 100%.`}
              </div>

              <div className="flex items-start gap-2 border border-border bg-muted/30 p-3 text-sm text-muted-foreground">
                <Info className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{onboardingDownlineHint(summary.type)}</span>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="col-span-12 h-fit lg:sticky lg:top-6 lg:col-span-4">
          <Card className="overflow-hidden">
            <div className="bg-primary px-4 py-3 text-primary-foreground">
              <h2 className="text-[11px] font-semibold uppercase tracking-wide">
                Step 3 Summary
              </h2>
            </div>
            <CardContent className="space-y-4 p-4">
              <div className="space-y-2">
                <SummaryRow
                  label="Client Type"
                  value={isSubFranchisor ? 'Sub-franchisor' : 'Franchisee'}
                />
                <SummaryRow
                  label="Company"
                  value={`${summary.split.company}%`}
                />
                <SummaryRow
                  label={summary.clientLabel}
                  value={`${summary.split.client}%`}
                  emphasize
                />
                <SummaryRow
                  label="Total"
                  value={`${Math.round(summary.total * 10) / 10}%`}
                  emphasize
                />
              </div>
              <hr className="border-border" />
              <div className="border border-border bg-muted/30 p-3">
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Next step
                  </span>
                  <Badge variant="secondary" className="rounded-full">
                    Step 4
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  Review all onboarding details before creating this client.
                </p>
              </div>
              <div className="space-y-2 pt-1">
                <Button type="button" className="w-full" asChild>
                  <Link to={ONBOARDING_STEP_PATHS[4]}>
                    Continue to Review
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
                <Button type="button" variant="outline" className="w-full" asChild>
                  <Link to={ONBOARDING_STEP_PATHS[2]}>
                    Back to Franchise Setup
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
