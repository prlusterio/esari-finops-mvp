import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, Calculator, CheckCircle2, Save } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { formatCurrency } from '@/lib/currency'
import { getHomePathForRole } from '@/lib/permissions'
import { getRevenueSharing, saveRevenueSharing } from '@/services/storage'
import { PageHeader } from '@/components/shared/PageHeader'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

function roundMoney(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100
}

function parsePercent(value) {
  if (value === '' || value === null || value === undefined) return 0
  const numeric = Number(value)
  return Number.isNaN(numeric) ? 0 : numeric
}

function PercentField({ id, label, value, onChange }) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id} className="text-sm text-slate-600">
        {label}
      </Label>
      <div className="relative">
        <Input
          id={id}
          inputMode="decimal"
          value={value}
          onChange={(event) => {
            const raw = event.target.value.replace(/[^\d.]/g, '')
            const parts = raw.split('.')
            const normalized =
              parts.length > 1
                ? `${parts[0]}.${parts.slice(1).join('').slice(0, 2)}`
                : parts[0]
            onChange(normalized)
          }}
          className="pr-8"
        />
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">
          %
        </span>
      </div>
    </div>
  )
}

function MoneyField({ id, label, value, onChange }) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id} className="text-sm text-slate-600">
        {label}
      </Label>
      <Input
        id={id}
        inputMode="decimal"
        value={value}
        onChange={(event) => {
          const raw = event.target.value.replace(/[^\d.]/g, '')
          const parts = raw.split('.')
          const normalized =
            parts.length > 1
              ? `${parts[0]}.${parts.slice(1).join('').slice(0, 2)}`
              : parts[0]
          onChange(normalized)
        }}
      />
    </div>
  )
}

function getActiveConfig() {
  const configs = getRevenueSharing()
  if (!Array.isArray(configs) || configs.length === 0) return null
  return (
    configs.find((entry) => entry.status === 'active') ||
    configs[0]
  )
}

export default function RevenueSharingPage() {
  const { user, dataVersion, bumpDataVersion } = useAuth()
  const [retailer, setRetailer] = useState('30')
  const [franchisee, setFranchisee] = useState('20')
  const [subfranchisee, setSubfranchisee] = useState('10')
  const [company, setCompany] = useState('40')
  const [samplePayment, setSamplePayment] = useState('100.00')
  const [sampleDeduction, setSampleDeduction] = useState('97.00')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const homePath = getHomePathForRole(user?.role)

  useEffect(() => {
    const active = getActiveConfig()
    if (!active) return
    setRetailer(String(active.retailerPercentage ?? 30))
    setFranchisee(String(active.franchiseePercentage ?? 20))
    setSubfranchisee(String(active.subfranchiseePercentage ?? 10))
    setCompany(String(active.companyPercentage ?? 40))
  }, [dataVersion])

  const percentages = useMemo(
    () => ({
      retailer: parsePercent(retailer),
      franchisee: parsePercent(franchisee),
      subfranchisee: parsePercent(subfranchisee),
      company: parsePercent(company),
    }),
    [retailer, franchisee, subfranchisee, company],
  )

  const total = useMemo(
    () =>
      roundMoney(
        percentages.retailer +
          percentages.franchisee +
          percentages.subfranchisee +
          percentages.company,
      ),
    [percentages],
  )

  const isValid = Math.abs(total - 100) < 0.001

  const preview = useMemo(() => {
    const payment = parsePercent(samplePayment)
    const deduction = parsePercent(sampleDeduction)
    const distributable = roundMoney(Math.max(payment - deduction, 0))

    const retailerAmount = roundMoney((distributable * percentages.retailer) / 100)
    const franchiseeAmount = roundMoney((distributable * percentages.franchisee) / 100)
    const subfranchiseeAmount = roundMoney(
      (distributable * percentages.subfranchisee) / 100,
    )
    const companyAmount = roundMoney((distributable * percentages.company) / 100)
    const distributed = roundMoney(
      retailerAmount + franchiseeAmount + subfranchiseeAmount + companyAmount,
    )

    return {
      distributable,
      retailerAmount,
      franchiseeAmount,
      subfranchiseeAmount,
      companyAmount,
      distributed,
    }
  }, [samplePayment, sampleDeduction, percentages])

  const handleSave = () => {
    setMessage('')
    setError('')

    if (!isValid) {
      setError('Total allocation must equal 100% before saving.')
      return
    }

    const existing = getRevenueSharing()
    const now = new Date().toISOString()
    const active = getActiveConfig()
    const nextConfig = {
      id: active?.id || 'revshare-default',
      retailerPercentage: percentages.retailer,
      franchiseePercentage: percentages.franchisee,
      subfranchiseePercentage: percentages.subfranchisee,
      companyPercentage: percentages.company,
      status: 'active',
      createdAt: active?.createdAt || now,
      updatedAt: now,
    }

    const nextList = Array.isArray(existing) && existing.length > 0
      ? existing.map((entry) =>
          entry.id === nextConfig.id ? nextConfig : { ...entry, status: 'inactive' },
        )
      : [nextConfig]

    if (!nextList.some((entry) => entry.id === nextConfig.id)) {
      nextList.push(nextConfig)
    }

    saveRevenueSharing(nextList)
    bumpDataVersion()
    setMessage('Commission settings saved successfully.')
  }

  return (
    <div>
      <PageHeader
        title="Commission Settings"
        description="Configure default commission and platform fee percentages for new transactions."
        breadcrumbs={[
          { label: 'Home', href: homePath },
          { label: 'Commission Settings' },
        ]}
      />

      <div className="mb-6 flex gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
        <p>
          <span className="font-semibold">Important Notice:</span> This change
          applies only to new transactions. Existing completed transactions keep
          their recorded percentages and amounts.
        </p>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
            <CardTitle className="text-base font-semibold text-slate-900">
              Percentage Configuration
            </CardTitle>
            <Badge
              className={cn(
                'gap-1.5 rounded-full border-transparent px-2.5 py-1 font-medium',
                isValid
                  ? 'bg-emerald-50 text-emerald-700'
                  : 'bg-red-50 text-red-600',
              )}
            >
              {isValid ? (
                <CheckCircle2 className="h-3.5 w-3.5" />
              ) : (
                <AlertTriangle className="h-3.5 w-3.5" />
              )}
              {isValid ? 'Valid (100%)' : `Invalid (${total}%)`}
            </Badge>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <PercentField
                id="retailer-share"
                label="Retailer Share %"
                value={retailer}
                onChange={setRetailer}
              />
              <PercentField
                id="franchisee-share"
                label="Franchisee Share %"
                value={franchisee}
                onChange={setFranchisee}
              />
              <PercentField
                id="subfranchisee-share"
                label="Sub-Franchisee Share %"
                value={subfranchisee}
                onChange={setSubfranchisee}
              />
              <PercentField
                id="company-share"
                label="Platform Fee %"
                value={company}
                onChange={setCompany}
              />
            </div>

            <div className="flex flex-col gap-4 border-t border-slate-200 pt-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <div className="text-sm text-slate-500">Total Allocation</div>
                <div
                  className={cn(
                    'mt-1 text-3xl font-bold',
                    isValid ? 'text-blue-600' : 'text-red-600',
                  )}
                >
                  {total}%
                </div>
              </div>
              <Button
                type="button"
                className="bg-blue-600 text-white hover:bg-blue-700"
                onClick={handleSave}
                disabled={!isValid}
              >
                <Save className="h-4 w-4" />
                Save Configuration
              </Button>
            </div>

            {error ? (
              <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
                {error}
              </div>
            ) : null}
            {message ? (
              <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                {message}
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center gap-2 space-y-0 pb-4">
            <Calculator className="h-4 w-4 text-slate-500" />
            <CardTitle className="text-base font-semibold text-slate-900">
              Preview Calculator
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <MoneyField
                id="sample-payment"
                label="Sample Customer Payment (₱)"
                value={samplePayment}
                onChange={setSamplePayment}
              />
              <MoneyField
                id="sample-deduction"
                label="Sample Wallet Deduction (₱)"
                value={sampleDeduction}
                onChange={setSampleDeduction}
              />
            </div>

            <div className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-4">
              <div className="text-sm text-slate-500">Distributable Revenue</div>
              <div className="mt-1 text-3xl font-bold text-blue-600">
                {formatCurrency(preview.distributable)}
              </div>
            </div>

            <div>
              <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
                Distribution Breakdown
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between text-slate-700">
                  <span>Retailer ({percentages.retailer}%)</span>
                  <span className="font-medium">
                    {formatCurrency(preview.retailerAmount)}
                  </span>
                </div>
                <div className="flex items-center justify-between text-slate-700">
                  <span>Franchisee ({percentages.franchisee}%)</span>
                  <span className="font-medium">
                    {formatCurrency(preview.franchiseeAmount)}
                  </span>
                </div>
                <div className="flex items-center justify-between text-slate-700">
                  <span>Sub-Franchisee ({percentages.subfranchisee}%)</span>
                  <span className="font-medium">
                    {formatCurrency(preview.subfranchiseeAmount)}
                  </span>
                </div>
                <div className="flex items-center justify-between text-slate-700">
                  <span>Platform Fee ({percentages.company}%)</span>
                  <span className="font-medium">
                    {formatCurrency(preview.companyAmount)}
                  </span>
                </div>
                <div className="mt-2 flex items-center justify-between border-t border-slate-200 pt-3 font-semibold text-slate-900">
                  <span>Total Distributed</span>
                  <span>{formatCurrency(preview.distributed)}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
