import { Download, Info, RadioTower, Wallet } from 'lucide-react'
import { formatCurrency, formatSignedCurrency } from '@/lib/currency'
import { formatDateTimeShort, formatDateTimeStacked } from '@/lib/date'
import { buildTransactionDistribution, matchProductServiceToPayment } from '@/lib/transactions'
import { getRevenueSharing } from '@/services/storage'
import { SignedAmount } from '@/components/shared/SignedAmount'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { cn } from '@/lib/utils'

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
  const { costs } = distribution
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
    `Retailer Wallet Deduction: ${formatSignedCurrency(costs.netWalletDeduction, 'debit')}`,
    `Total Distributable Revenue: ${formatCurrency(costs.distributable)}`,
    '',
    'Distribution Breakdown',
    ...distribution.tiers.map(
      (tier) =>
        `${tier.label} (${tier.percentage}%): ${formatCurrency(tier.amount)} — ${tier.entity}`,
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

function DistributionTier({ tier, isLast }) {
  return (
    <div className="relative flex gap-3 pl-1">
      {!isLast ? (
        <div
          className="absolute bottom-[-0.75rem] left-[1.15rem] top-10 border-l border-dashed border-slate-200"
          aria-hidden
        />
      ) : null}
      <div
        className={cn(
          'relative z-10 mt-3 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold',
          tier.avatarClassName,
        )}
      >
        {tier.initials}
      </div>
      <div
        className={cn(
          'min-w-0 flex-1 rounded-xl border bg-white px-3.5 py-3',
          tier.isViewer
            ? 'border-blue-500 shadow-[inset_3px_0_0_0_#3b82f6]'
            : 'border-slate-200',
        )}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-800">
              {tier.label}{' '}
              <span className="font-medium text-slate-400">
                ({tier.percentage}%)
              </span>
            </p>
            <p className="mt-1 truncate text-xs text-slate-400">{tier.entity}</p>
            {tier.isViewer ? (
              <div className="mt-2 flex flex-wrap gap-1.5">
                <Badge className="rounded-md border-transparent bg-blue-600 px-2 py-0.5 text-[10px] font-semibold text-white hover:bg-blue-600">
                  Your Account
                </Badge>
                <Badge className="rounded-md border-transparent bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 hover:bg-emerald-100">
                  Credited
                </Badge>
              </div>
            ) : null}
          </div>
          <SignedAmount
            amount={tier.amount}
            direction="credit"
            showSign={false}
            className="shrink-0 text-sm"
          />
        </div>
      </div>
    </div>
  )
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
  const { costs, viewerTier } = distribution
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
              <span className="text-slate-500">Retailer Wallet Deduction</span>
              <SignedAmount
                amount={costs.netWalletDeduction}
                direction="debit"
              />
            </div>

            <div className="my-3 border-t border-dashed border-slate-200" />

            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="font-medium text-slate-700">
                Total Distributable Revenue
              </span>
              <SignedAmount
                amount={costs.distributable}
                direction="credit"
                showSign={false}
                className="font-bold"
              />
            </div>
          </div>

          <div>
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
              4-Tier Distribution Breakdown
            </p>
            <div className="space-y-3">
              {distribution.tiers.map((tier, index) => (
                <DistributionTier
                  key={tier.key}
                  tier={tier}
                  isLast={index === distribution.tiers.length - 1}
                />
              ))}
            </div>
          </div>

          {viewerTier ? (
            <div className="flex gap-3 rounded-xl border border-emerald-100 bg-emerald-50/80 px-4 py-3.5">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                <Wallet className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-800">
                  <SignedAmount
                    amount={viewerTier.amount}
                    direction="credit"
                    showSign={false}
                    className="font-semibold"
                  />{' '}
                  credited to your revenue wallet
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Automatically credited when the transaction completed. No
                  settlement wait required.
                </p>
              </div>
            </div>
          ) : null}

          {viewerTier ? (
            <div>
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                Revenue Explanation
              </p>
              <p className="text-sm leading-relaxed text-slate-500">
                This revenue is calculated as {viewerTier.percentage}% of the
                Distributable Revenue ({formatCurrency(costs.distributable)})
                generated from this transaction. The Distributable Revenue is the
                remaining amount after the Retailer Wallet Deduction is taken
                from the Customer Payment. Your share is credited to your revenue
                wallet immediately on completion.
              </p>
            </div>
          ) : null}
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
