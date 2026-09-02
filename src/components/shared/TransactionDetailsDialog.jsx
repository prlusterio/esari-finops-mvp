import { Download, Info, RadioTower } from 'lucide-react'
import { formatCurrency, formatSignedCurrency } from '@/lib/currency'
import { formatDateTimeShort, formatDateTimeStacked } from '@/lib/date'
import { buildTransactionDistribution, matchProductServiceToPayment } from '@/lib/transactions'
import { getRevenueSharing } from '@/services/storage'
import { SignedAmount } from '@/components/shared/SignedAmount'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'

function SummaryField({ label, value }) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
        {label}
      </p>
      <p className="mt-1 truncate text-sm font-semibold text-slate-900">
        {value || '—'}
      </p>
    </div>
  )
}

function downloadReceipt(tx, distribution, summary) {
  const { costs, tiers, distributable } = distribution
  const lines = [
    'eSariSari Transaction Receipt',
    `Reference: ${summary.reference}`,
    `Date: ${formatDateTimeStacked(tx.createdAt)}`,
    `Retailer: ${summary.retailerName}`,
    `Franchisee: ${summary.franchiseeName}`,
    `Sub-Franchisee: ${summary.subfranchiseeName}`,
    `Customer Reference: ${summary.customerReference}`,
    `Product/Service: ${summary.productService}`,
    '',
    `Total Customer Payment: ${formatCurrency(costs.customerPayment)}`,
    `Credits Consumed: ${formatSignedCurrency(costs.netWalletDeduction, 'debit')}`,
    `Sales (share base): ${formatCurrency(distributable)}`,
    '',
    'Commission Distribution',
    ...(tiers || []).map(
      (tier) =>
        `${tier.roleLabel} (${tier.percentage}%)${tier.isViewer ? ' [You]' : ''}: ${formatCurrency(tier.amount)} — ${tier.entity}`,
    ),
  ]

  const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `${tx.reference || tx.id}-receipt.txt`
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

function resolveTransactionSummary(tx, organizations = []) {
  const orgById = Object.fromEntries(organizations.map((org) => [org.id, org]))
  const retailer = orgById[tx?.retailerOrganizationId] || null
  const franchisee =
    orgById[tx?.franchiseeOrganizationId] ||
    (retailer?.parentId ? orgById[retailer.parentId] : null) ||
    null
  const subfranchisee =
    orgById[tx?.subfranchiseeOrganizationId] ||
    (franchisee?.parentId ? orgById[franchisee.parentId] : null) ||
    null

  return {
    reference: tx?.reference || tx?.id || '—',
    retailerName: tx?.retailerName || retailer?.name || '—',
    franchiseeName: franchisee?.name || '—',
    subfranchiseeName: subfranchisee?.name || '—',
    customerReference: tx?.customerReference || '—',
    productService: matchProductServiceToPayment(
      tx?.productService,
      tx?.customerPayment,
    ),
  }
}

export function TransactionDetailsDialog({
  open,
  onOpenChange,
  transaction,
  organizations = [],
  role,
}) {
  if (!transaction) return null

  const distribution = buildTransactionDistribution(transaction, {
    organizations,
    role,
    revenueSharing: getRevenueSharing(),
  })
  const { costs, tiers, distributable } = distribution
  const summary = resolveTransactionSummary(transaction, organizations)

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full gap-0 p-0 sm:max-w-[28rem]"
      >
        <SheetHeader className="border-b border-slate-200 px-6 py-5 pr-12">
          <SheetTitle className="text-xl font-semibold text-slate-900">
            Transaction Details
          </SheetTitle>
          <SheetDescription className="text-sm text-slate-400">
            {summary.reference}
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
          <div className="rounded-xl border border-slate-200 bg-white px-4 py-4">
            <div className="mb-4 flex items-center gap-2">
              <Info className="h-4 w-4 text-blue-600" />
              <h3 className="text-sm font-semibold text-slate-900">
                Transaction Summary
              </h3>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <SummaryField
                label="Transaction Reference"
                value={summary.reference}
              />
              <SummaryField
                label="Date and Time"
                value={formatDateTimeShort(transaction.createdAt)}
              />
              <SummaryField label="Retailer" value={summary.retailerName} />
              <SummaryField label="Franchisee" value={summary.franchiseeName} />
              <SummaryField
                label="Sub-Franchisee"
                value={summary.subfranchiseeName}
              />
              <SummaryField
                label="Customer Reference"
                value={summary.customerReference}
              />
            </div>

            <div className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-blue-100 bg-blue-50 px-3.5 py-3">
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                  Product/Service
                </p>
                <p className="mt-1 truncate text-sm font-semibold text-blue-700">
                  {summary.productService}
                </p>
              </div>
              <RadioTower className="h-5 w-5 shrink-0 text-slate-400" />
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white px-4 py-4">
            <div className="flex items-start justify-between gap-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                Total Customer Payment
              </p>
              <p className="text-lg font-bold text-slate-900">
                {formatCurrency(costs.customerPayment)}
              </p>
            </div>

            <div className="mt-3 flex items-center justify-between gap-3 text-sm">
              <span className="text-slate-500">Credits Consumed</span>
              <SignedAmount
                amount={costs.netWalletDeduction}
                direction="debit"
              />
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white px-4 py-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">
                  Commission Distribution
                </h3>
                <p className="mt-0.5 text-xs text-slate-400">
                  % of sales (customer payment) stamped on this sale
                </p>
              </div>
              <p className="text-sm font-semibold text-slate-900">
                {formatCurrency(distributable)}
              </p>
            </div>

            <div className="space-y-2.5">
              {(tiers || []).map((tier) => (
                <div
                  key={tier.key}
                  className="flex items-center justify-between gap-3"
                >
                  <div className="flex min-w-0 items-center gap-2.5">
                    <span
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${tier.avatarClassName}`}
                    >
                      {tier.initials}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-slate-800">
                        {tier.label}
                        {tier.isViewer ? (
                          <span className="ml-1.5 rounded-full bg-blue-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-blue-700">
                            You
                          </span>
                        ) : null}
                      </p>
                      <p className="truncate text-xs text-slate-400">
                        {tier.entity} · {tier.percentage}%
                      </p>
                    </div>
                  </div>
                  <p className={`shrink-0 text-sm font-semibold ${tier.amountClassName}`}>
                    {formatCurrency(tier.amount)}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
            <p className="text-sm leading-relaxed text-slate-500">
              Commission settings split customer payment (sales). Credits consumed
              equal that payment (inventory).
            </p>
          </div>
        </div>

        <SheetFooter className="border-t border-slate-200 px-6 py-4">
          <Button
            type="button"
            variant="outline"
            className="border-blue-600 text-blue-600 hover:bg-blue-50 hover:text-blue-700"
            onClick={() => onOpenChange?.(false)}
          >
            Close
          </Button>
          <Button
            type="button"
            className="bg-blue-600 text-white hover:bg-blue-700"
            onClick={() =>
              downloadReceipt(transaction, distribution, summary)
            }
          >
            <Download className="h-4 w-4" />
            Download Receipt
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
