import { CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

/**
 * Success dialog after a funding mutation.
 *
 * @param {{
 *   open: boolean,
 *   onOpenChange: (open: boolean) => void,
 *   title?: string,
 *   message: string,
 *   details?: Array<{ label: string, value: string }>,
 *   doneLabel?: string,
 * }} props
 */
export function FundingSuccessDialog({
  open,
  onOpenChange,
  title = 'Success',
  message,
  details = [],
  doneLabel = 'Done',
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="items-center text-center sm:items-center sm:text-center">
          <div className="mb-2 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
            <CheckCircle2 className="h-8 w-8" />
          </div>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription className="text-center">{message}</DialogDescription>
        </DialogHeader>

        {details.length > 0 ? (
          <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
            {details.map((row) => (
              <div
                key={row.label}
                className="flex items-start justify-between gap-3 text-sm"
              >
                <span className="text-slate-500">{row.label}</span>
                <span className="text-right font-medium text-slate-900">
                  {row.value}
                </span>
              </div>
            ))}
          </div>
        ) : null}

        <DialogFooter className="sm:justify-center">
          <Button
            type="button"
            className="bg-blue-600 text-white hover:bg-blue-700"
            onClick={() => onOpenChange(false)}
          >
            {doneLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
