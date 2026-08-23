import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { CheckCircle2, CircleAlert } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { formatCurrency } from '@/lib/currency'
import {
  formatOnboardingMonthlyFeeAmount,
  isOnboardingClientInfoComplete,
  monthlyFeeTreatmentLabel,
  ONBOARDING_CLIENT_TYPE_META,
  ONBOARDING_STEP_PATHS,
  PACKAGE_OPTIONS,
  summarizeOnboardingRevenueSplit,
} from '@/lib/onboardingSetup'
import { getHomePathForRole } from '@/lib/permissions'
import {
  getOnboardingClientInfo,
  getOnboardingClientType,
  getOnboardingFranchiseSetup,
  getOnboardingRevenueSplit,
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
import { OnboardingStepper, ReviewField, SummaryRow } from './onboarding-ui'

const SPLIT_BAR_COLORS = {
  client: 'bg-primary',
  company: 'bg-slate-400',
}

function EditLink({ to, label }) {
  return (
    <Button type="button" variant="link" className="h-auto p-0" asChild>
      <Link to={to}>{label}</Link>
    </Button>
  )
}

function ReviewCard({ title, description, editTo, children }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between space-y-0 border-b border-border px-4 py-3">
        <div>
          <CardTitle className="text-base">{title}</CardTitle>
          {description ? <CardDescription>{description}</CardDescription> : null}
        </div>
        {editTo ? <EditLink to={editTo} label="Edit" /> : null}
      </CardHeader>
      <CardContent className="p-4">{children}</CardContent>
    </Card>
  )
}

export default function OnboardingStep4Page() {
  const { user } = useAuth()
  const clientInfo = getOnboardingClientInfo()
  const clientType = getOnboardingClientType()
  const setup = getOnboardingFranchiseSetup()
  const revenueDefaults = getOnboardingRevenueSplit()
  const [created, setCreated] = useState(false)
  const [createError, setCreateError] = useState('')

  const typeMeta =
    ONBOARDING_CLIENT_TYPE_META[clientType] ??
    ONBOARDING_CLIENT_TYPE_META['Sub-Franchisor']
  const splitSummary = summarizeOnboardingRevenueSplit(revenueDefaults, clientType)
  const clientInfoComplete = isOnboardingClientInfoComplete(clientInfo)

  const packageRows = useMemo(
    () =>
      PACKAGE_OPTIONS.map((item) => ({
        ...item,
        quantity: setup.packageState.quantities[item.code] ?? 0,
        isPrimary: setup.packageState.primary === item.code,
      })),
    [setup.packageState],
  )
  const packageSubtotal = packageRows.reduce(
    (sum, item) => sum + item.unitFee * item.quantity,
    0,
  )
  const enabledOneTime = setup.oneTimeFees.filter((fee) => fee.enabled)
  const oneTimeTotal = enabledOneTime.reduce((sum, fee) => sum + fee.amount, 0)
  const upfrontDue = packageSubtotal + oneTimeTotal
  const locationLine = [clientInfo.city_municipality, clientInfo.state_province_region]
    .filter(Boolean)
    .join(', ')
  const territoryLocation = setup.territory
    ? `${setup.territory.city}, ${setup.territory.province} • ${setup.territory.region}`
    : ''

  const splitSegments = [
    { key: 'company', label: 'Company', value: splitSummary.split.company },
    {
      key: 'client',
      label: splitSummary.clientLabel,
      value: splitSummary.split.client,
    },
  ]

  function handleCreate() {
    if (!clientInfoComplete) {
      setCreateError('Complete required Client Info fields before creating this franchisee.')
      return
    }
    if (!splitSummary.ok) {
      setCreateError('Revenue split must total 100% before creating this franchisee.')
      return
    }
    setCreateError('')
    setCreated(true)
  }

  return (
    <div>
      <PageHeader
        title="Review"
        description="Please review the information before creating the client."
        breadcrumbs={[
          { label: 'Home', href: getHomePathForRole(user?.role) },
          { label: 'Clients', href: '/franchise-setup/clients' },
          { label: 'Review' },
        ]}
      />

      <div className="grid grid-cols-12 gap-4">
        <div className="col-span-12 space-y-4 pb-8 lg:col-span-8">
          <OnboardingStepper currentStep={4} />

          <ReviewCard
            title="Client Type"
            editTo={ONBOARDING_STEP_PATHS[2]}
          >
            <div className="flex items-start gap-2">
              <CheckCircle2 className="mt-0.5 h-5 w-5 text-success" />
              <div>
                <div className="font-semibold">{typeMeta.label}</div>
                <p className="text-sm text-muted-foreground">{typeMeta.description}</p>
              </div>
            </div>
          </ReviewCard>

          <ReviewCard
            title="Admin Profile"
            description="Login for the client super admin."
            editTo={ONBOARDING_STEP_PATHS[1]}
          >
            <div className="grid gap-4 sm:grid-cols-3">
              <ReviewField label="First Name" value={clientInfo.admin_first_name} />
              <ReviewField label="Last Name" value={clientInfo.admin_last_name} />
              <ReviewField label="Email" value={clientInfo.admin_email} />
            </div>
          </ReviewCard>

          <ReviewCard
            title="Company Profile"
            editTo={ONBOARDING_STEP_PATHS[1]}
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-4">
                <ReviewField label="Company Name" value={clientInfo.company_name} />
                <ReviewField
                  label="Registration Number"
                  value={clientInfo.registration_number}
                />
                <ReviewField label="Tax ID" value={clientInfo.tax_id} />
                <ReviewField label="Corporate Email" value={clientInfo.company_email} />
                <ReviewField label="Phone" value={clientInfo.company_phone} />
              </div>
              <div className="space-y-4">
                <ReviewField label="Address 1" value={clientInfo.address_line_1} />
                <ReviewField label="Address 2" value={clientInfo.address_line_2} />
                <ReviewField
                  label="City/Municipality"
                  value={clientInfo.city_municipality}
                />
                <ReviewField
                  label="State/Province/Region"
                  value={clientInfo.state_province_region}
                />
                <ReviewField label="Postal/ZIP" value={clientInfo.postal} />
                <ReviewField label="Country" value={clientInfo.country} />
              </div>
            </div>
          </ReviewCard>

          <ReviewCard title="Contact Person" editTo={ONBOARDING_STEP_PATHS[1]}>
            <div className="grid gap-4 sm:grid-cols-3">
              <ReviewField label="Full Name" value={clientInfo.contact_person} />
              <ReviewField label="Email" value={clientInfo.contact_email} />
              <ReviewField label="Phone" value={clientInfo.contact_phone} />
            </div>
          </ReviewCard>

          <ReviewCard
            title="eSariSari Franchise Options"
            editTo={ONBOARDING_STEP_PATHS[2]}
          >
            <div className="space-y-3">
              {packageRows.map((item) => (
                <div
                  key={item.code}
                  className={cn(
                    'flex items-center justify-between gap-3 border border-border px-3 py-2',
                    item.quantity === 0 && 'text-muted-foreground',
                    item.isPrimary && item.quantity > 0 && 'border-primary/40 bg-primary/5',
                  )}
                >
                  <div>
                    <div className="font-semibold text-primary">{item.label}</div>
                    <div className="text-sm text-muted-foreground">
                      {item.description}
                      {item.isPrimary && item.quantity > 0 ? ' • Primary' : ''}
                    </div>
                  </div>
                  <div className="text-right text-sm tabular-nums">
                    <div>
                      {item.quantity} × {formatCurrency(item.unitFee)}
                    </div>
                    <div className="font-semibold">
                      {formatCurrency(item.unitFee * item.quantity)}
                    </div>
                  </div>
                </div>
              ))}
              <div className="flex justify-between text-sm font-semibold">
                <span>Package subtotal</span>
                <span className="tabular-nums">{formatCurrency(packageSubtotal)}</span>
              </div>
            </div>
          </ReviewCard>

          <ReviewCard title="Territories & Areas" editTo={ONBOARDING_STEP_PATHS[2]}>
            <div className="space-y-2">
              <div className="font-semibold">
                {setup.territory?.coverageName || 'No territory selected'}
              </div>
              <p className="text-sm text-muted-foreground">
                {territoryLocation}
                {setup.areas.length ? ` • ${setup.areas.length} areas` : ''}
              </p>
              {setup.areas.length > 0 ? (
                <div className="flex flex-wrap gap-2 pt-1">
                  {setup.areas.map((area) => (
                    <Badge key={area.id} variant="secondary">
                      {area.name}
                    </Badge>
                  ))}
                </div>
              ) : null}
            </div>
          </ReviewCard>

          <ReviewCard title="Fee Configuration" editTo={ONBOARDING_STEP_PATHS[2]}>
            <div className="space-y-4">
              <div>
                <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  One-time fees
                </div>
                <div className="flex flex-wrap gap-2">
                  {enabledOneTime.length === 0 ? (
                    <span className="text-sm text-muted-foreground">None included</span>
                  ) : (
                    enabledOneTime.map((fee) => (
                      <Badge key={fee.id} variant="secondary">
                        {fee.name} • {formatCurrency(fee.amount)}
                      </Badge>
                    ))
                  )}
                </div>
              </div>
              <div>
                <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Monthly & operational
                </div>
                <div className="flex flex-wrap gap-2">
                  {setup.monthlyFees.map((fee) => (
                    <Badge key={fee.id} variant="secondary">
                      {fee.name} • {formatOnboardingMonthlyFeeAmount(fee)} •{' '}
                      {monthlyFeeTreatmentLabel(fee.treatment)}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
          </ReviewCard>

          <ReviewCard title="Revenue Split" editTo={ONBOARDING_STEP_PATHS[3]}>
            <div className="space-y-3">
              <div className="flex h-6 overflow-hidden bg-muted">
                {splitSegments.map((segment) =>
                  segment.value > 0 ? (
                    <div
                      key={segment.key}
                      className={cn(
                        'flex items-center px-2 text-[11px] font-semibold text-white',
                        SPLIT_BAR_COLORS[segment.key],
                      )}
                      style={{ width: `${segment.value}%` }}
                    >
                      {segment.value}%
                    </div>
                  ) : null,
                )}
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {splitSegments.map((segment) => (
                  <SummaryRow
                    key={segment.key}
                    label={segment.label}
                    value={`${segment.value}%`}
                    emphasize={segment.key === 'client'}
                  />
                ))}
              </div>
              <p
                className={cn(
                  'text-sm',
                  splitSummary.ok ? 'text-emerald-700' : 'text-amber-800',
                )}
              >
                {splitSummary.ok
                  ? 'Company and this client equal 100%. Downline shares are set by the client.'
                  : `Total is ${Math.round(splitSummary.total * 10) / 10}% — adjust on step 3.`}
              </p>
            </div>
          </ReviewCard>
        </div>

        <div className="col-span-12 h-fit lg:sticky lg:top-6 lg:col-span-4">
          <Card className="overflow-hidden">
            <div className="bg-primary px-4 py-3 text-primary-foreground">
              <h2 className="text-[11px] font-semibold uppercase tracking-wide">
                Confirmation Summary
              </h2>
            </div>
            <CardContent className="space-y-4 p-4">
              <div className="space-y-2">
                <SummaryRow label="Client Type" value={typeMeta.label} />
                <SummaryRow
                  label="Admin"
                  value={
                    [clientInfo.admin_first_name, clientInfo.admin_last_name]
                      .filter(Boolean)
                      .join(' ') || '—'
                  }
                />
                <SummaryRow
                  label="Company"
                  value={clientInfo.company_name || '—'}
                  emphasize
                />
                <SummaryRow label="Location" value={locationLine || '—'} />
              </div>
              <hr className="border-border" />
              <div className="space-y-2">
                <SummaryRow
                  label="Package subtotal"
                  value={formatCurrency(packageSubtotal)}
                />
                <SummaryRow
                  label="One-time fees"
                  value={formatCurrency(oneTimeTotal)}
                />
                <SummaryRow
                  label="Upfront due"
                  value={formatCurrency(upfrontDue)}
                  emphasize
                />
              </div>
              <hr className="border-border" />
              <SummaryRow
                label="Revenue split"
                value={
                  splitSummary.ok
                    ? '100%'
                    : `${Math.round(splitSummary.total * 10) / 10}%`
                }
              />

              {createError ? (
                <div className="flex items-start gap-2 border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                  <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{createError}</span>
                </div>
              ) : null}

              {created ? (
                <div className="flex items-start gap-2 border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>
                    Review confirmed. Saving this client into the live portfolio
                    is not wired in this demo yet.
                  </span>
                </div>
              ) : null}

              <div className="space-y-2 pt-1">
                <Button
                  type="button"
                  className="w-full"
                  onClick={handleCreate}
                  disabled={created}
                >
                  {created ? 'Franchisee created' : 'Create Franchisee'}
                </Button>
                <Button type="button" variant="outline" className="w-full" asChild>
                  <Link to={ONBOARDING_STEP_PATHS[3]}>Back to Revenue Split</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
