import { useEffect, useMemo, useState } from 'react'
import { CheckCircle2, Download, FileImage, FileText } from 'lucide-react'
import { FUNDING_STATUS } from '@/lib/constants'
import { formatCurrency } from '@/lib/currency'
import { DateTimeCell } from '@/components/shared/DateTimeCell'
import { FundingStatusBadge } from '@/components/shared/FundingStatusBadge'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import {
  formatDepositRatePercent,
  getDepositRate,
  getRequestCredits,
  getRequestDepositAmount,
  suggestCredits,
} from '@/lib/internetCredits'
import { cn } from '@/lib/utils'

function DetailLabel({ children, className }) {
  return (
    <div className={cn('text-xs text-slate-400', className)}>{children}</div>
  )
}

function SectionDivider() {
  return <div className="border-t border-slate-200" />
}

function getBalanceAfterDisplay({
  request,
  walletBalance,
  viewerOrganizationId,
  mode,
  internetCredits = false,
  releaseSource = 'mint',
  creditsAmount,
}) {
  const balance = Number(walletBalance ?? 0)
  const deposit = getRequestDepositAmount(request)
  const credits =
    creditsAmount != null
      ? Number(creditsAmount)
      : getRequestCredits(request) || deposit
  const isRequester = request?.organizationId === viewerOrganizationId
  const isApprover = request?.parentOrganizationId === viewerOrganizationId
  const isPending = request?.status === FUNDING_STATUS.PENDING

  if (internetCredits) {
    if (mode === 'review' || (isApprover && isPending)) {
      if (releaseSource === 'balance') {
        const balanceAfter = balance - credits
        return {
          label: 'Available Credits After Release',
          value: balanceAfter,
          insufficientFunds: balanceAfter < 0,
        }
      }
      return {
        label: 'Your Current Available Credits',
        value: balance,
        insufficientFunds: false,
      }
    }
    if (isRequester && isPending) {
      return {
        label: 'Your Credits After Approval',
        value: balance + credits,
        insufficientFunds: false,
      }
    }
    return {
      label: 'Your Current Available Credits',
      value: balance,
      insufficientFunds: false,
    }
  }

  const amount = Number(request?.amount ?? 0)
  if (mode === 'review' || (isApprover && isPending)) {
    const balanceAfter = balance - amount
    return {
      label: 'Your Wallet After Transfer',
      value: balanceAfter,
      insufficientFunds: balanceAfter < 0,
    }
  }

  if (isRequester && isPending) {
    return {
      label: 'Your Wallet After Funding',
      value: balance + amount,
      insufficientFunds: false,
    }
  }

  return {
    label: 'Your Current Wallet Balance',
    value: balance,
    insufficientFunds: false,
  }
}

/**
 * @param {'review' | 'view'} mode
 */
export function ReviewFundingRequestDialog({
  open,
  onOpenChange,
  request,
  organization,
  walletBalance,
  viewerOrganizationId,
  mode = 'review',
  onReject,
  onApprove,
  internetCredits = false,
  releaseSource = 'mint',
}) {
  if (!request) return null

  const depositAmount = getRequestDepositAmount(request)
  const depositRate =
    Number(request.depositRate) ||
    getDepositRate({
      organizationId: request.organizationId,
      requesterRole: request.requesterRole,
    })
  const suggestedCredits =
    Number(request.suggestedCredits) ||
    suggestCredits(depositAmount, depositRate)
  const releasedCredits = Number(request.creditsReleased) || 0

  const {
    label: balanceLabel,
    value: balanceAfter,
    insufficientFunds,
  } = getBalanceAfterDisplay({
    request,
    walletBalance,
    viewerOrganizationId,
    mode,
    internetCredits,
    releaseSource,
    creditsAmount: suggestedCredits,
  })

  const proof = request.proofOfPayment
  const orgLabel =
    request.requesterRole === 'franchisee'
      ? 'Franchisee Name'
      : request.requesterRole === 'subfranchisee'
        ? 'Sub-Franchisee Name'
        : request.requesterRole === 'retailer'
          ? 'Retailer Name'
          : 'Organization'
  const isReview = mode === 'review'

  const handleDownload = () => {
    if (!proof?.url) return
    const link = document.createElement('a')
    link.href = proof.url
    link.download = proof.fileName || 'proof-of-payment'
    document.body.appendChild(link)
    link.click()
    link.remove()
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full gap-0 p-0 sm:max-w-[28rem]"
      >
        <SheetHeader className="border-b border-slate-200 px-6 py-5 pr-12">
          <SheetTitle className="text-xl font-semibold text-slate-900">
            {isReview
              ? internetCredits
                ? 'Review Credits Request'
                : 'Review Funding Request'
              : internetCredits
                ? 'Credits Request Details'
                : 'Funding Request Details'}
          </SheetTitle>
          <SheetDescription className="text-sm text-slate-400">
            #{request.id}
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            <div className="flex items-center justify-between gap-3 px-4 py-3.5">
              <DetailLabel className="font-medium uppercase tracking-wide">
                Status
              </DetailLabel>
              <FundingStatusBadge status={request.status} />
            </div>

            <SectionDivider />

            <div className="grid gap-4 px-4 py-4 sm:grid-cols-2">
              <div>
                <DetailLabel>{orgLabel}</DetailLabel>
                <div className="mt-1 text-sm font-semibold text-slate-900">
                  {organization?.name || 'Unknown Organization'}
                </div>
              </div>
              <div>
                <DetailLabel>Date Submitted</DetailLabel>
                <div className="mt-1">
                  <DateTimeCell value={request.createdAt} />
                </div>
              </div>
            </div>

            <SectionDivider />

            <div className="grid gap-4 px-4 py-4 sm:grid-cols-2">
              <div>
                <DetailLabel>
                  {internetCredits ? 'Deposited Amount' : 'Requested Amount'}
                </DetailLabel>
                <div className="mt-1 text-2xl font-bold tracking-tight text-blue-600 sm:text-[1.75rem]">
                  {formatCurrency(depositAmount)}
                </div>
              </div>
              <div className="sm:text-right">
                <DetailLabel>{balanceLabel}</DetailLabel>
                <div
                  className={cn(
                    'mt-1 text-sm font-semibold',
                    insufficientFunds ? 'text-red-600' : 'text-slate-900',
                  )}
                >
                  {formatCurrency(balanceAfter)}
                </div>
              </div>
            </div>

            {internetCredits ? (
              <div className="grid gap-4 px-4 pb-4 sm:grid-cols-2">
                <div>
                  <DetailLabel>Deposit rate</DetailLabel>
                  <div className="mt-1 text-sm font-semibold text-slate-900">
                    {formatDepositRatePercent(depositRate)}
                  </div>
                </div>
                <div className="sm:text-right">
                  <DetailLabel>
                    {releasedCredits > 0
                      ? 'Credits released'
                      : 'Suggested credits'}
                  </DetailLabel>
                  <div className="mt-1 text-sm font-semibold text-slate-900">
                    {formatCurrency(
                      releasedCredits > 0 ? releasedCredits : suggestedCredits,
                    )}
                  </div>
                </div>
              </div>
            ) : null}

            {request.paymentReferenceId ? (
              <div className="px-4 pb-4">
                <DetailLabel>Payment reference</DetailLabel>
                <div className="mt-1 text-sm font-medium text-slate-900">
                  {request.paymentReferenceId}
                </div>
              </div>
            ) : null}

            {isReview && insufficientFunds ? (
              <div className="mx-4 mb-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                {internetCredits
                  ? 'Insufficient Available Credits to release this request.'
                  : 'Insufficient wallet balance to approve and transfer this request.'}
              </div>
            ) : null}

            <div className="px-4 pb-4">
              <DetailLabel>Notes</DetailLabel>
              <div className="mt-2 rounded-lg border border-slate-200 bg-white px-3 py-3 text-sm leading-relaxed text-slate-700">
                {request.notes ||
                  (internetCredits
                    ? 'No notes provided for this credits request.'
                    : 'No notes provided for this funding request.')}
              </div>
            </div>
          </div>

          <div>
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-900">
              <FileText className="h-4 w-4 text-blue-600" />
              Proof of Payment
            </div>

            {proof ? (
              <div className="space-y-3">
                <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
                  <img
                    src={proof.url}
                    alt={`Proof of payment for ${request.id}`}
                    className="h-48 w-full object-cover object-center"
                  />
                </div>

                <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
                    <FileImage className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium text-slate-900">
                      {proof.fileName}
                    </div>
                    <div className="text-xs text-slate-400">{proof.fileSize}</div>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="text-blue-600 hover:bg-blue-50 hover:text-blue-700"
                    onClick={handleDownload}
                    aria-label="Download proof of payment"
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-400">
                No proof of payment was attached to this request.
              </div>
            )}
          </div>
        </div>

        {isReview ? (
          <SheetFooter className="border-t border-slate-200 bg-slate-50 px-6 py-4">
            <Button
              type="button"
              variant="ghost"
              className="text-red-600 hover:bg-red-50 hover:text-red-700"
              onClick={() => onReject?.(request)}
            >
              Reject
            </Button>
            <Button
              type="button"
              className="bg-blue-600 text-white hover:bg-blue-700"
              onClick={() => onApprove?.(request)}
              disabled={insufficientFunds}
            >
              <CheckCircle2 className="h-4 w-4" />
              {internetCredits ? 'Approve & Release' : 'Approve & Transfer'}
            </Button>
          </SheetFooter>
        ) : null}
      </SheetContent>
    </Sheet>
  )
}
