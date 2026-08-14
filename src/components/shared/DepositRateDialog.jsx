import { useEffect, useMemo, useState } from 'react'
import { formatCurrency } from '@/lib/currency'
import {
  depositRateToPercentInput,
  getDefaultDepositRate,
  parseDepositRatePercent,
} from '@/lib/depositRates'
import {
  formatDepositRatePercent,
  suggestCredits,
} from '@/lib/internetCredits'
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
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'

const SAMPLE_DEPOSIT = 10000

export function DepositRateDialog({
  open,
  onOpenChange,
  row = null,
  onSave,
  onReset,
}) {
  const defaultRate = row
    ? Number(row.defaultRate) ||
      getDefaultDepositRate({ hop: row.hop, orgType: row.orgType })
    : 0.6

  const [percent, setPercent] = useState('')
  const [reason, setReason] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!open || !row) return
    setPercent(depositRateToPercentInput(row.depositRate))
    setReason(row.reason || '')
    setError('')
    setBusy(false)
  }, [open, row])

  const preview = useMemo(() => {
    try {
      const rate = parseDepositRatePercent(percent)
      return {
        rate,
        credits: suggestCredits(SAMPLE_DEPOSIT, rate),
        valid: true,
      }
    } catch {
      return { rate: null, credits: 0, valid: false }
    }
  }, [percent])

  const isCustomFromDefault =
    preview.valid &&
    Math.abs(Number(preview.rate) - Number(defaultRate)) > 0.0001

  const handleSave = async () => {
    setError('')
    setBusy(true)
    try {
      const depositRate = parseDepositRatePercent(percent)
      if (Math.abs(depositRate - defaultRate) > 0.0001 && !String(reason).trim()) {
        throw new Error('Enter a reason when setting a custom deposit rate.')
      }
      await onSave?.({
        organizationId: row.organizationId,
        hop: row.hop,
        depositRate,
        reason: String(reason).trim() || 'Aligned to hop default',
      })
      onOpenChange?.(false)
    } catch (err) {
      setError(err.message || 'Unable to save deposit rate.')
    } finally {
      setBusy(false)
    }
  }

  const handleReset = async () => {
    setError('')
    setBusy(true)
    try {
      await onReset?.({ organizationId: row.organizationId })
      onOpenChange?.(false)
    } catch (err) {
      setError(err.message || 'Unable to reset deposit rate.')
    } finally {
      setBusy(false)
    }
  }

  if (!row) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit deposit rate</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-1">
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
            <p className="text-sm font-semibold text-slate-900">{row.ownerName}</p>
            <p className="mt-0.5 text-xs text-slate-500">
              {row.typeLabel}
              {row.ownerCode ? ` · ${row.ownerCode}` : ''}
            </p>
            <p className="mt-2 text-xs text-slate-500">{row.hopLabel}</p>
            <p className="mt-1 text-xs text-slate-400">
              Hop default: {formatDepositRatePercent(defaultRate)}
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="deposit-rate-pct" className="text-sm text-slate-600">
              Deposit rate
            </Label>
            <div className="relative">
              <Input
                id="deposit-rate-pct"
                inputMode="decimal"
                value={percent}
                onChange={(event) => {
                  const raw = event.target.value.replace(/[^\d.]/g, '')
                  const parts = raw.split('.')
                  const normalized =
                    parts.length > 1
                      ? `${parts[0]}.${parts.slice(1).join('').slice(0, 2)}`
                      : parts[0]
                  setPercent(normalized)
                }}
                className="pr-8"
              />
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">
                %
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Credits = deposit ÷ rate. Example: {formatCurrency(SAMPLE_DEPOSIT)}{' '}
              →{' '}
              {preview.valid
                ? preview.credits.toLocaleString('en-PH', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })
                : '—'}{' '}
              credits
              {isCustomFromDefault ? ' (custom)' : ''}.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="deposit-rate-reason" className="text-sm text-slate-600">
              Reason {isCustomFromDefault ? '(required)' : '(optional)'}
            </Label>
            <Textarea
              id="deposit-rate-reason"
              rows={3}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Why this rate for this downline?"
            />
          </div>

          {error ? (
            <p className={cn('text-sm text-red-600')} role="alert">
              {error}
            </p>
          ) : null}
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-between">
          <Button
            type="button"
            variant="outline"
            disabled={busy || row.source === 'default'}
            onClick={handleReset}
          >
            Reset to default
          </Button>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => onOpenChange?.(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              className="bg-blue-600 text-white hover:bg-blue-700"
              disabled={busy || !preview.valid}
              onClick={handleSave}
            >
              Save rate
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
