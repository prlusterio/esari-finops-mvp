import { useEffect, useMemo, useState } from 'react'
import { formatCurrency } from '@/lib/currency'
import {
  DEMO_PRODUCT_CATALOG,
  estimateDemoSaleCosts,
} from '@/lib/transactions'
import { createRetailerDemoSale } from '@/services/transactionActions'
import { getOperatingWallet } from '@/services/fundingActions'
import { getWallets } from '@/services/storage'
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
import { Label } from '@/components/ui/label'

export function DummyTransactionDialog({
  open,
  onOpenChange,
  organizationId,
  onCreated,
}) {
  const [productService, setProductService] = useState('')
  const [amount, setAmount] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const availableCredits = useMemo(() => {
    if (!open || !organizationId) return 0
    const wallet = getOperatingWallet(getWallets(), organizationId)
    return Number(wallet?.availableBalance) || 0
  }, [open, organizationId])

  useEffect(() => {
    if (!open) return
    setProductService('')
    setAmount('')
    setError('')
    setBusy(false)
  }, [open])

  const preview = useMemo(() => {
    const payment = Number(amount)
    if (!Number.isFinite(payment) || payment <= 0) return null
    return estimateDemoSaleCosts(payment)
  }, [amount])

  const remainingAfterSale = preview
    ? availableCredits - preview.walletDeduction
    : availableCredits
  const insufficient =
    Boolean(preview) && preview.walletDeduction > availableCredits

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError('')
    setBusy(true)
    try {
      const result = createRetailerDemoSale({
        organizationId,
        customerPayment: amount,
        productService,
      })
      onCreated?.(result.transaction)
      onOpenChange?.(false)
    } catch (err) {
      setError(err?.message || 'Unable to record this sale.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Record demo sale</DialogTitle>
            <DialogDescription>
              Creates a completed internet sale so you can walk it through
              Transactions, Revenue, and Reports for this retailer and uplines.
              Credits consumed come out of Available Credits.
            </DialogDescription>
          </DialogHeader>

          <div className="mt-4 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="demo-product">Product / service</Label>
              <Input
                id="demo-product"
                list="demo-product-options"
                value={productService}
                onChange={(event) => setProductService(event.target.value)}
                placeholder="Leave blank to pick a random product"
                autoComplete="off"
              />
              <datalist id="demo-product-options">
                {DEMO_PRODUCT_CATALOG.map((label) => (
                  <option key={label} value={label} />
                ))}
              </datalist>
            </div>

            <div className="space-y-2">
              <Label htmlFor="demo-amount">Customer payment</Label>
              <Input
                id="demo-amount"
                type="number"
                min="1"
                step="0.01"
                inputMode="decimal"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                placeholder="e.g. 1000"
                required
              />
            </div>

            <div className="rounded-md border border-border bg-muted/40 px-3 py-2 text-sm">
              <p className="text-muted-foreground">
                Available Credits {formatCurrency(availableCredits)}
              </p>
              {preview ? (
                <div className="mt-2 grid gap-1 text-slate-700">
                  <p>Credits consumed {formatCurrency(preview.walletDeduction)}</p>
                  <p className={insufficient ? 'text-red-600' : ''}>
                    Remaining after sale {formatCurrency(remainingAfterSale)}
                  </p>
                </div>
              ) : (
                <p className="mt-1 text-muted-foreground">
                  Credits consumed equal the customer payment (100%). Commission
                  settings split that same payment (sales).
                </p>
              )}
            </div>

            {error ? <p className="text-sm text-red-600">{error}</p> : null}
          </div>

          <DialogFooter className="mt-6">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange?.(false)}
              disabled={busy}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="bg-blue-600 text-white hover:bg-blue-700"
              disabled={busy || insufficient}
            >
              {busy ? 'Recording…' : 'Record sale'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
