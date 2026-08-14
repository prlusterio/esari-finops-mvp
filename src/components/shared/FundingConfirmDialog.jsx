import { formatCurrency } from '@/lib/currency'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'

/**
 * Confirmation dialog before funding mutations.
 */
export function FundingConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  rows = [],
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  confirmVariant = 'default',
  busy = false,
  error = '',
  reasonEnabled = false,
  reason = '',
  onReasonChange,
  reasonLabel = 'Reason (optional)',
  onConfirm,
  creditFieldsEnabled = false,
  paymentReferenceId = '',
  onPaymentReferenceChange,
  creditsToRelease = '',
  onCreditsToReleaseChange,
  creditsHint = '',
  duplicatePaymentWarning = '',
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description ? (
            <DialogDescription>{description}</DialogDescription>
          ) : null}
        </DialogHeader>

        {rows.length > 0 ? (
          <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
            {rows.map((row) => (
              <div
                key={row.label}
                className="flex items-start justify-between gap-3 text-sm"
              >
                <span className="text-slate-500">{row.label}</span>
                <span
                  className={
                    row.emphasize
                      ? 'text-right font-semibold text-blue-600'
                      : 'text-right font-medium text-slate-900'
                  }
                >
                  {row.value}
                </span>
              </div>
            ))}
          </div>
        ) : null}

        {creditFieldsEnabled ? (
          <div className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="funding-payment-ref">Payment reference ID</Label>
              <Input
                id="funding-payment-ref"
                value={paymentReferenceId}
                onChange={(event) =>
                  onPaymentReferenceChange?.(event.target.value)
                }
                placeholder="Enter payment reference ID"
                disabled={busy}
              />
              {duplicatePaymentWarning ? (
                <p className="text-sm text-amber-700">{duplicatePaymentWarning}</p>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="funding-credits-release">Credits to release</Label>
              <Input
                id="funding-credits-release"
                type="number"
                min="0"
                step="0.01"
                value={creditsToRelease}
                onChange={(event) =>
                  onCreditsToReleaseChange?.(event.target.value)
                }
                disabled={busy}
              />
              {creditsHint ? (
                <p className="text-xs text-muted-foreground">{creditsHint}</p>
              ) : null}
            </div>
          </div>
        ) : null}

        {reasonEnabled ? (
          <div className="space-y-2">
            <Label htmlFor="funding-reject-reason">{reasonLabel}</Label>
            <Textarea
              id="funding-reject-reason"
              value={reason}
              onChange={(event) => onReasonChange?.(event.target.value)}
              placeholder="Add a short note..."
              className="min-h-[88px] resize-none"
              disabled={busy}
            />
          </div>
        ) : null}

        {error ? (
          <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
            {error}
          </div>
        ) : null}

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={busy}
          >
            {cancelLabel}
          </Button>
          <Button
            type="button"
            variant={confirmVariant === 'destructive' ? 'destructive' : 'default'}
            className={
              confirmVariant === 'destructive'
                ? undefined
                : 'bg-blue-600 text-white hover:bg-blue-700'
            }
            onClick={onConfirm}
            disabled={busy}
          >
            {busy ? 'Processing...' : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/**
 * Build standard amount/balance rows for confirm dialogs.
 */
export function buildAmountConfirmRows({
  amount,
  balanceAfter,
  counterpartyLabel,
  counterpartyName,
  amountLabel = 'Amount',
  balanceLabel = 'Wallet balance after',
}) {
  const rows = []
  if (counterpartyLabel && counterpartyName) {
    rows.push({ label: counterpartyLabel, value: counterpartyName })
  }
  rows.push({
    label: amountLabel,
    value: formatCurrency(amount),
    emphasize: true,
  })
  if (balanceAfter !== undefined && balanceAfter !== null) {
    rows.push({
      label: balanceLabel,
      value: formatCurrency(balanceAfter),
    })
  }
  return rows
}
