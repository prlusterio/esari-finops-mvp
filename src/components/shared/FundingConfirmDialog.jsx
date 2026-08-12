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
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'

/**
 * Confirmation dialog before funding mutations.
 *
 * @param {{
 *   open: boolean,
 *   onOpenChange: (open: boolean) => void,
 *   title: string,
 *   description?: string,
 *   rows?: Array<{ label: string, value: string, emphasize?: boolean }>,
 *   confirmLabel?: string,
 *   cancelLabel?: string,
 *   confirmVariant?: 'default' | 'destructive',
 *   busy?: boolean,
 *   error?: string,
 *   reasonEnabled?: boolean,
 *   reason?: string,
 *   onReasonChange?: (value: string) => void,
 *   reasonLabel?: string,
 *   onConfirm: () => void,
 * }} props
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

        {reasonEnabled ? (
          <div className="space-y-2">
            <Label htmlFor="funding-reject-reason">{reasonLabel}</Label>
            <Textarea
              id="funding-reject-reason"
              value={reason}
              onChange={(event) => onReasonChange?.(event.target.value)}
              placeholder="Add a short rejection note..."
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
}) {
  const rows = []
  if (counterpartyLabel && counterpartyName) {
    rows.push({ label: counterpartyLabel, value: counterpartyName })
  }
  rows.push({
    label: 'Amount',
    value: formatCurrency(amount),
    emphasize: true,
  })
  if (balanceAfter !== undefined && balanceAfter !== null) {
    rows.push({
      label: 'Wallet balance after',
      value: formatCurrency(balanceAfter),
    })
  }
  return rows
}
