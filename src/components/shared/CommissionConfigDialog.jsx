import { useEffect, useMemo, useState } from 'react'
import { CheckCircle2, Info } from 'lucide-react'
import { formatCurrency } from '@/lib/currency'
import {
  buildCommissionPreview,
  computeSubFranchiseeShare,
  COMMISSION_STATUS,
  DEFAULT_COMMISSION_SHARES,
  isCommissionSplitValid,
  normalizeCommissionShares,
  parsePercentInput,
  pickStoredPlatformPercentage,
  resolveCommissionHierarchy,
  sumCommissionPercentages,
} from '@/lib/commission'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
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
import { cn } from '@/lib/utils'

function PercentField({ id, label, value, onChange, disabled, hint }) {
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
          disabled={disabled}
          onChange={(event) => {
            const raw = event.target.value.replace(/[^\d.]/g, '')
            const parts = raw.split('.')
            const normalized =
              parts.length > 1
                ? `${parts[0]}.${parts.slice(1).join('').slice(0, 2)}`
                : parts[0]
            onChange(normalized)
          }}
          className={cn('pr-8', disabled && 'bg-slate-50 text-slate-500')}
        />
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">
          %
        </span>
      </div>
      {hint ? <p className="text-xs text-slate-400">{hint}</p> : null}
    </div>
  )
}

export function CommissionConfigDialog({
  open,
  onOpenChange,
  viewerRole = 'subfranchisee',
  retailers = [],
  orgById = {},
  existingSettings = [],
  initial = null,
  onSave,
}) {
  const isAdmin = viewerRole === 'admin'
  const isEdit = Boolean(initial?.id)
  const [retailerId, setRetailerId] = useState('')
  const [effectiveDate, setEffectiveDate] = useState('')
  const [retailerPct, setRetailerPct] = useState(
    String(DEFAULT_COMMISSION_SHARES.retailerPercentage),
  )
  const [franchiseePct, setFranchiseePct] = useState(
    String(DEFAULT_COMMISSION_SHARES.franchiseePercentage),
  )
  const [platformPct, setPlatformPct] = useState(
    String(DEFAULT_COMMISSION_SHARES.companyPercentage),
  )
  const [subPct, setSubPct] = useState(
    String(DEFAULT_COMMISSION_SHARES.subfranchiseePercentage),
  )
  const [status, setStatus] = useState(COMMISSION_STATUS.ACTIVE)
  const [error, setError] = useState('')

  const selectedRetailer = orgById[retailerId] || null
  const hierarchy = useMemo(
    () => resolveCommissionHierarchy(selectedRetailer, orgById),
    [selectedRetailer, orgById],
  )
  const { franchisee, subfranchisee, hasFranchisee, hasSubfranchisee } =
    hierarchy

  useEffect(() => {
    if (!open) return
    if (initial) {
      const initialRetailer = orgById[initial.retailerOrganizationId]
      const initialHierarchy = resolveCommissionHierarchy(
        initialRetailer,
        orgById,
      )
      const normalized = normalizeCommissionShares({
        retailerPercentage: initial.retailerPercentage,
        franchiseePercentage: initialHierarchy.hasFranchisee
          ? initial.franchiseePercentage
          : 0,
        subfranchiseePercentage: initial.subfranchiseePercentage,
        companyPercentage: initial.companyPercentage,
        remainderTarget: initialHierarchy.remainderTarget,
        lockSubShare: !isAdmin && initialHierarchy.hasSubfranchisee,
      })
      setRetailerId(initial.retailerOrganizationId || '')
      setEffectiveDate(initial.effectiveDate || '')
      setRetailerPct(String(normalized.retailerPercentage))
      setFranchiseePct(String(normalized.franchiseePercentage))
      setSubPct(String(normalized.subfranchiseePercentage))
      setPlatformPct(String(normalized.companyPercentage))
      setStatus(initial.status || COMMISSION_STATUS.ACTIVE)
    } else {
      setRetailerId('')
      setEffectiveDate(new Date().toISOString().slice(0, 10))
      setRetailerPct(String(DEFAULT_COMMISSION_SHARES.retailerPercentage))
      setFranchiseePct(String(DEFAULT_COMMISSION_SHARES.franchiseePercentage))
      setSubPct(String(DEFAULT_COMMISSION_SHARES.subfranchiseePercentage))
      setPlatformPct(String(DEFAULT_COMMISSION_SHARES.companyPercentage))
      setStatus(COMMISSION_STATUS.ACTIVE)
    }
    setError('')
  }, [open, initial, orgById, isAdmin])

  useEffect(() => {
    if (!open || !retailerId || isEdit) return
    if (!hasFranchisee && franchiseePct !== '0') {
      setFranchiseePct('0')
    }
  }, [open, retailerId, isEdit, hasFranchisee, franchiseePct])

  useEffect(() => {
    if (!open || isEdit || !retailerId) return
    const stored = pickStoredPlatformPercentage(existingSettings, {
      retailerOrganizationId: retailerId,
    })
    if (stored != null) setPlatformPct(String(stored))
    if (isAdmin) return
    const nextHierarchy = resolveCommissionHierarchy(
      orgById[retailerId],
      orgById,
    )
    const platform = stored ?? DEFAULT_COMMISSION_SHARES.companyPercentage
    setSubPct(
      String(
        computeSubFranchiseeShare({
          retailerPercentage: DEFAULT_COMMISSION_SHARES.retailerPercentage,
          franchiseePercentage: nextHierarchy.hasFranchisee
            ? DEFAULT_COMMISSION_SHARES.franchiseePercentage
            : 0,
          companyPercentage: platform,
        }),
      ),
    )
  }, [open, isEdit, retailerId, existingSettings, isAdmin, orgById])

  const canEditSubShare = !isAdmin && hasSubfranchisee
  const shares = useMemo(
    () =>
      normalizeCommissionShares({
        retailerPercentage: parsePercentInput(retailerPct),
        franchiseePercentage: hasFranchisee
          ? parsePercentInput(franchiseePct)
          : 0,
        subfranchiseePercentage: parsePercentInput(subPct),
        companyPercentage: parsePercentInput(platformPct),
        remainderTarget: hierarchy.remainderTarget,
        lockSubShare: canEditSubShare,
      }),
    [
      retailerPct,
      franchiseePct,
      subPct,
      platformPct,
      hasFranchisee,
      hierarchy.remainderTarget,
      canEditSubShare,
    ],
  )

  const total = sumCommissionPercentages(shares)
  const valid = isCommissionSplitValid({
    ...shares,
    remainderTarget: hierarchy.remainderTarget,
    lockSubShare: canEditSubShare,
  })
  const preview = buildCommissionPreview(shares)
  const downlineTotal =
    Math.round(
      (shares.retailerPercentage + shares.franchiseePercentage + Number.EPSILON) *
        100,
    ) / 100

  const canEditPlatformFee = isAdmin && hasSubfranchisee
  const sfLabel = isAdmin ? 'Sub-Franchisee Share' : 'Your Share'
  const platformLabel = hasSubfranchisee ? 'Platform Fee' : 'Platform Share'
  const infoText = !retailerId
    ? isAdmin
      ? 'Select a retailer to configure commission. Percentages apply to sales (customer payment). Admin sets the platform fee; sub-franchisee is the remainder.'
      : 'Configure commission for your franchisee and retailer downlines. Set your share of sales. Platform fee is set by Admin. Total must equal 100%.'
    : hasSubfranchisee
      ? isAdmin
        ? 'Sub-franchisee share is the remainder after retailer, franchisee, and the platform fee you set.'
        : 'Set your share and downline shares. Platform fee is set by Admin. Combined they must equal 100% of sales.'
      : hasFranchisee
        ? 'This franchisee reports directly to CWPC Admin. There is no sub-franchisee share — platform absorbs the remainder.'
        : 'This retailer reports directly to CWPC Admin. Franchisee and sub-franchisee shares are zero — platform absorbs the remainder.'

  const hierarchyHint = (() => {
    if (!selectedRetailer) return null
    const parts = []
    parts.push(
      hasFranchisee
        ? `Franchisee: ${franchisee.name}`
        : 'Franchisee: Direct to Admin',
    )
    if (isAdmin) {
      parts.push(
        hasSubfranchisee
          ? `Sub-Franchisee: ${subfranchisee.name}`
          : 'Sub-Franchisee: Direct to Admin',
      )
    }
    return parts.join(' · ')
  })()

  const handleSave = () => {
    setError('')
    if (!retailerId) {
      setError('Select a retailer.')
      return
    }
    if (!effectiveDate) {
      setError('Choose an effective date.')
      return
    }
    if (!valid) {
      setError(
        canEditSubShare
          ? 'Retailer + Franchisee + Your share + Platform fee must equal 100%.'
          : hasSubfranchisee
            ? 'Retailer + Franchisee + Platform fee cannot exceed 100%.'
            : 'Retailer + Franchisee shares cannot exceed 100%.',
      )
      return
    }

    onSave?.({
      id: initial?.id,
      retailerOrganizationId: retailerId,
      franchiseeOrganizationId: franchisee?.id || '',
      subfranchiseeOrganizationId: subfranchisee?.id || '',
      retailerPercentage: shares.retailerPercentage,
      franchiseePercentage: shares.franchiseePercentage,
      subfranchiseePercentage: shares.subfranchiseePercentage,
      companyPercentage: shares.companyPercentage,
      remainderTarget: hierarchy.remainderTarget,
      effectiveDate,
      status,
    })
    onOpenChange?.(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-xl overflow-y-auto sm:rounded-xl">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold text-slate-900">
            {isEdit ? 'Edit Commission Settings' : 'Commission Settings'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          <div className="flex gap-2 rounded-xl border border-blue-100 bg-blue-50 px-3.5 py-3 text-sm text-slate-600">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />
            <p>{infoText}</p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label className="text-sm text-slate-600">Retailer</Label>
              <Select
                value={retailerId}
                onValueChange={setRetailerId}
                disabled={isEdit}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a retailer..." />
                </SelectTrigger>
                <SelectContent>
                  {retailers.map((retailer) => (
                    <SelectItem key={retailer.id} value={retailer.id}>
                      {retailer.name}
                      {retailer.code ? ` (${retailer.code})` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {hierarchyHint ? (
                <p className="text-xs text-slate-400">{hierarchyHint}</p>
              ) : null}
            </div>

            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="commission-effective-date" className="text-sm text-slate-600">
                Effective Date
              </Label>
              <Input
                id="commission-effective-date"
                type="date"
                value={effectiveDate}
                onChange={(event) => setEffectiveDate(event.target.value)}
              />
            </div>

            <PercentField
              id="commission-retailer"
              label="Retailer Share %"
              value={retailerPct}
              onChange={setRetailerPct}
            />
            <PercentField
              id="commission-franchisee"
              label="Franchisee Share %"
              value={hasFranchisee ? franchiseePct : '0'}
              onChange={setFranchiseePct}
              disabled={!hasFranchisee}
              hint={
                hasFranchisee
                  ? undefined
                  : 'Not applicable — retailer reports directly to CWPC Admin.'
              }
            />
            {hasSubfranchisee ? (
              <PercentField
                id="commission-your-share"
                label={`${sfLabel} %`}
                value={
                  canEditSubShare
                    ? subPct
                    : String(shares.subfranchiseePercentage)
                }
                onChange={setSubPct}
                disabled={!canEditSubShare}
                hint={
                  canEditSubShare
                    ? 'Your share of sales. Combined with downlines and the Admin platform fee, this must equal 100%.'
                    : isAdmin
                      ? 'Auto-calculated remainder for the sub-franchisee.'
                      : 'Auto-calculated remainder for your sub-franchisee share.'
                }
              />
            ) : (
              <PercentField
                id="commission-your-share"
                label={`${sfLabel} %`}
                value="0"
                onChange={() => {}}
                disabled
                hint="Not applicable — no sub-franchisee on this path."
              />
            )}
            <PercentField
              id="commission-platform"
              label={`${platformLabel} %`}
              value={
                hasSubfranchisee
                  ? platformPct
                  : String(shares.companyPercentage)
              }
              onChange={setPlatformPct}
              disabled={!canEditPlatformFee}
              hint={
                hasSubfranchisee
                  ? isAdmin
                    ? 'Editable by Admin. Sub-franchisee receives the remainder so the split totals 100% of sales.'
                    : 'Set by Admin. Adjust your share and downline shares so the total equals 100%.'
                  : 'Includes the platform fee plus any unassigned mid-tier shares.'
              }
            />
          </div>

          <div
            className={cn(
              'rounded-xl border px-4 py-3',
              valid
                ? 'border-emerald-200 bg-emerald-50'
                : 'border-amber-200 bg-amber-50',
            )}
          >
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-semibold uppercase tracking-wide text-slate-700">
                Total Allocation
              </span>
              <span className="text-sm font-bold text-slate-900">{total}%</span>
            </div>
            <p className="mt-1 text-xs text-slate-500">
              Downlines {downlineTotal}%
              {hasSubfranchisee
                ? ` · ${sfLabel} ${shares.subfranchiseePercentage}%`
                : ''}{' '}
              · {platformLabel} {shares.companyPercentage}%
            </p>
            <p
              className={cn(
                'mt-1 text-xs',
                valid ? 'text-emerald-700' : 'text-amber-700',
              )}
            >
              {valid
                ? 'Commission split validated: Total equals 100%'
                : canEditSubShare
                  ? 'Adjust shares so retailer, franchisee, your share, and platform fee equal 100%'
                  : 'Reduce retailer/franchisee shares so the total can equal 100%'}
            </p>
          </div>

          <div className="space-y-2">
            <Label className="text-sm text-slate-600">Status</Label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="radio"
                  name="commission-status"
                  checked={status === COMMISSION_STATUS.ACTIVE}
                  onChange={() => setStatus(COMMISSION_STATUS.ACTIVE)}
                />
                Active
              </label>
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="radio"
                  name="commission-status"
                  checked={status === COMMISSION_STATUS.INACTIVE}
                  onChange={() => setStatus(COMMISSION_STATUS.INACTIVE)}
                />
                Inactive
              </label>
            </div>
          </div>

          <div className="rounded-xl border border-blue-100 bg-blue-50/70 px-4 py-4">
            <div className="mb-3 flex items-center justify-between gap-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Transaction Calculation Preview
              </p>
              <span className="rounded-full bg-blue-600 px-2 py-0.5 text-[10px] font-semibold uppercase text-white">
                Sample Case
              </span>
            </div>
            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between gap-3">
                <span className="text-slate-500">Sample Payment</span>
                <span className="font-medium text-slate-900">
                  {formatCurrency(preview.payment)}
                </span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-slate-500">Credits Consumed</span>
                <span className="font-medium text-red-600">
                  -{formatCurrency(preview.deduction)}
                </span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-slate-500">Sales (share base)</span>
                <span className="font-semibold text-blue-700">
                  {formatCurrency(preview.distributable)}
                </span>
              </div>
            </div>
            <div className="my-3 border-t border-blue-100" />
            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between gap-3">
                <span className="text-slate-500">Retailer Share</span>
                <span>{formatCurrency(preview.retailerAmount)}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-slate-500">Franchisee Share</span>
                <span>{formatCurrency(preview.franchiseeAmount)}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-slate-500">{sfLabel}</span>
                <span>{formatCurrency(preview.subfranchiseeAmount)}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-slate-500">{platformLabel}</span>
                <span>{formatCurrency(preview.companyAmount)}</span>
              </div>
            </div>
            <div className="mt-3 flex items-center justify-between border-t border-blue-100 pt-3 text-sm font-semibold">
              <span>Total Allocated</span>
              <span className="inline-flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                {formatCurrency(preview.totalAllocated)}
              </span>
            </div>
          </div>

          {error ? <p className="text-sm text-red-600">{error}</p> : null}
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange?.(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            className="bg-blue-600 text-white hover:bg-blue-700"
            onClick={handleSave}
          >
            Save Configuration
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
