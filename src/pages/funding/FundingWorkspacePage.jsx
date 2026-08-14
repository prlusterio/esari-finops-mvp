import { useEffect, useMemo, useState } from 'react'
import {
  ArrowLeftRight,
  Clock3,
  Landmark,
  Plus,
  TrendingUp,
} from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { FUNDING_STATUS } from '@/lib/constants'
import { formatCurrency } from '@/lib/currency'
import { DateTimeCell } from '@/components/shared/DateTimeCell'
import {
  getFundingDatasets,
  getFundingWorkspaceConfig,
} from '@/lib/funding'
import {
  buildSuggestedCreditsCopy,
  findDuplicatePaymentReference,
  getDepositRate,
  getRequestCredits,
  getRequestDepositAmount,
  isReleasedStatus,
  suggestCredits,
} from '@/lib/internetCredits'
import { DEFAULT_PAGE_SIZE, paginateItems } from '@/lib/pagination'
import { getHomePathForRole } from '@/lib/permissions'
import {
  approveAndTransferFundingRequest,
  createFundingRequest,
  executeWalletTransfer,
  rejectFundingRequest,
  releaseInternetCredits,
  reverseInternetCredits,
} from '@/services/fundingActions'
import {
  getFundingRequests,
  getFundingTransfers,
  getOrganizations,
  getWallets,
} from '@/services/storage'
import { SignedAmount } from '@/components/shared/SignedAmount'
import { PageHeader } from '@/components/shared/PageHeader'
import { TablePagination } from '@/components/shared/TablePagination'
import { FundingStatusBadge } from '@/components/shared/FundingStatusBadge'
import {
  FundingConfirmDialog,
  buildAmountConfirmRows,
} from '@/components/shared/FundingConfirmDialog'
import { FundingSuccessDialog } from '@/components/shared/FundingSuccessDialog'
import { ReviewFundingRequestDialog } from '@/components/shared/ReviewFundingRequestDialog'
import { NewFundingRequestSheet } from '@/components/shared/NewFundingRequestSheet'
import { DirectTransferSheet } from '@/components/shared/DirectTransferSheet'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { cn } from '@/lib/utils'

function sumDeposits(items) {
  return items.reduce(
    (total, item) => total + getRequestDepositAmount(item),
    0,
  )
}

function FundingMetricCard({ label, value, icon: Icon, valueClassName, iconClassName }) {
  return (
    <Card className="shadow-sm">
      <CardContent className="relative flex min-h-[7.5rem] flex-col justify-between p-5">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
          {label}
        </p>
        <div className="flex items-end justify-between gap-3">
          <p
            className={cn(
              'text-2xl font-bold tracking-tight text-slate-900 sm:text-[1.75rem]',
              valueClassName,
            )}
          >
            {value}
          </p>
          {Icon ? (
            <div
              className={cn(
                'flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-50',
                iconClassName,
              )}
            >
              <Icon className="h-5 w-5" />
            </div>
          ) : null}
        </div>
      </CardContent>
    </Card>
  )
}

function EmptyState({ message }) {
  return (
    <div className="px-4 py-12 text-center text-sm text-muted-foreground">
      {message}
    </div>
  )
}

function OrganizationCell({ organization }) {
  return (
    <div>
      <div className="font-semibold text-foreground">
        {organization?.name || 'Unknown Organization'}
      </div>
      <div className="text-xs text-muted-foreground">
        {organization?.code || organization?.id || '—'}
      </div>
    </div>
  )
}

export default function FundingWorkspacePage() {
  const { user, dataVersion, bumpDataVersion } = useAuth()
  const organizations = useMemo(() => getOrganizations(), [dataVersion])

  const config = useMemo(
    () =>
      getFundingWorkspaceConfig({
        role: user?.role,
        organizationId: user?.organizationId,
        organizations,
      }),
    [user?.role, user?.organizationId, organizations],
  )

  const internetCredits = config.mode === 'internetCredits'
  const releaseSource = config.releaseSource === 'balance' ? 'balance' : 'mint'
  const showTransfersTab = config.showTransfersTab !== false
  const showApprovedTab = config.showApprovedTab !== false

  const [tab, setTab] = useState(config.defaultTab)
  const [pageByTab, setPageByTab] = useState({
    incoming: 0,
    mine: 0,
    approved: 0,
    transfers: 0,
  })
  const [selectedRequest, setSelectedRequest] = useState(null)
  const [dialogMode, setDialogMode] = useState('review')
  const [newRequestOpen, setNewRequestOpen] = useState(false)
  const [directTransferOpen, setDirectTransferOpen] = useState(false)
  const [confirmAction, setConfirmAction] = useState(null)
  const [successAction, setSuccessAction] = useState(null)
  const [actionBusy, setActionBusy] = useState(false)
  const [actionError, setActionError] = useState('')
  const [rejectReason, setRejectReason] = useState('')
  const [paymentReferenceId, setPaymentReferenceId] = useState('')
  const [creditsToRelease, setCreditsToRelease] = useState('')

  useEffect(() => {
    setTab(config.defaultTab)
    setPageByTab({
      incoming: 0,
      mine: 0,
      approved: 0,
      transfers: 0,
    })
  }, [config.defaultTab, user?.role])

  const orgById = useMemo(() => {
    return Object.fromEntries(organizations.map((org) => [org.id, org]))
  }, [organizations])

  const walletBalance = useMemo(() => {
    const wallets = getWallets()
    const wallet = wallets.find(
      (entry) =>
        entry.organizationId === user?.organizationId &&
        entry.walletType !== 'revenue',
    )
    return wallet?.availableBalance ?? 0
  }, [user?.organizationId, dataVersion])

  const datasets = useMemo(
    () =>
      getFundingDatasets({
        role: user?.role,
        organizationId: user?.organizationId,
        requests: getFundingRequests(),
        transfers: getFundingTransfers(),
        config,
      }),
    [user?.role, user?.organizationId, dataVersion, config],
  )

  const summaryMetrics = useMemo(() => {
    const pendingIncomingAmount = sumDeposits(datasets.incoming)
    const myPendingAmount = sumDeposits(
      datasets.mine.filter((request) => request.status === FUNDING_STATUS.PENDING),
    )
    const pendingCredits = datasets.incoming.reduce((sum, request) => {
      const rate =
        Number(request.depositRate) ||
        getDepositRate({
          organizationId: request.organizationId,
          requesterRole: request.requesterRole,
        })
      return (
        sum +
        (Number(request.suggestedCredits) ||
          suggestCredits(getRequestDepositAmount(request), rate))
      )
    }, 0)
    const creditsReleased = datasets.approved
      .filter(
        (request) =>
          isReleasedStatus(request.status) &&
          request.parentOrganizationId === user?.organizationId,
      )
      .reduce(
        (sum, request) =>
          sum + (Number(request.creditsReleased) || getRequestCredits(request)),
        0,
      )

    return {
      pendingIncomingAmount,
      myPendingAmount,
      pendingCredits,
      creditsReleased,
    }
  }, [datasets, user?.organizationId])

  const myRequestDepositRate = useMemo(() => {
    return getDepositRate({
      organizationId: user?.organizationId,
      parentOrganizationId: config.newRequestParentId,
      hop: config.myRequestHop,
      requesterRole: user?.role,
    })
  }, [
    config.myRequestHop,
    config.newRequestParentId,
    user?.organizationId,
    user?.role,
    dataVersion,
  ])

  const openRequestDialog = (request, mode) => {
    setSelectedRequest(request)
    setDialogMode(mode)
  }

  const closeRequestDialog = () => {
    setSelectedRequest(null)
  }

  const openConfirm = (action) => {
    setActionError('')
    setRejectReason('')
    setPaymentReferenceId('')
    if (action.type === 'approve' && internetCredits) {
      const deposit = getRequestDepositAmount(action.request)
      const rate =
        Number(action.request.depositRate) ||
        getDepositRate({
          organizationId: action.request.organizationId,
          requesterRole: action.request.requesterRole,
        })
      const suggested =
        Number(action.request.suggestedCredits) ||
        suggestCredits(deposit, rate)
      setCreditsToRelease(String(suggested))
    } else {
      setCreditsToRelease('')
    }
    setConfirmAction(action)
  }

  const closeConfirm = () => {
    if (actionBusy) return
    setConfirmAction(null)
    setActionError('')
    setRejectReason('')
    setPaymentReferenceId('')
    setCreditsToRelease('')
  }

  const showSuccess = (payload) => {
    setSuccessAction(payload)
  }

  const duplicatePaymentWarning = useMemo(() => {
    if (!confirmAction || confirmAction.type !== 'approve' || !internetCredits) {
      return ''
    }
    const duplicate = findDuplicatePaymentReference(
      getFundingRequests(),
      paymentReferenceId,
      confirmAction.request?.id,
    )
    return duplicate
      ? `Soft warning: this payment reference was already used on ${duplicate.id}.`
      : ''
  }, [confirmAction, internetCredits, paymentReferenceId])

  const handleConfirmAction = () => {
    if (!confirmAction) return
    setActionBusy(true)
    setActionError('')

    try {
      if (confirmAction.type === 'approve') {
        if (internetCredits) {
          const result = releaseInternetCredits(confirmAction.request, {
            actorOrganizationId: user.organizationId,
            actorUserId: user.id,
            paymentReferenceId,
            creditsToRelease: Number(creditsToRelease),
            source: releaseSource,
          })
          setConfirmAction(null)
          bumpDataVersion()
          if (showApprovedTab) setTab('approved')
          else setTab(config.showIncoming ? 'incoming' : 'mine')
          setPageByTab((prev) => ({ ...prev, approved: 0, incoming: 0 }))
          showSuccess({
            title: 'Credits released',
            message: result.duplicatePaymentReference
              ? `Credits released. Note: payment reference was also used on ${result.duplicatePaymentReference.id}.`
              : 'Internet credits were released successfully.',
            details: [
              { label: 'Request', value: result.request.id },
              {
                label: 'Credits released',
                value: formatCurrency(result.request.creditsReleased),
              },
              {
                label: 'Payment reference',
                value: result.request.paymentReferenceId,
              },
            ],
          })
        } else {
          const result = approveAndTransferFundingRequest(
            confirmAction.request,
            user.organizationId,
          )
          setConfirmAction(null)
          bumpDataVersion()
          setTab(showTransfersTab ? 'transfers' : 'approved')
          setPageByTab((prev) => ({ ...prev, transfers: 0, incoming: 0 }))
          showSuccess({
            title: 'Transfer completed',
            message:
              'The funding request was approved and funds were transferred.',
            details: [
              { label: 'Request', value: result.request.id },
              { label: 'Transfer', value: result.transfer.id },
              { label: 'Amount', value: formatCurrency(result.transfer.amount) },
            ],
          })
        }
      } else if (confirmAction.type === 'reject') {
        const result = rejectFundingRequest(confirmAction.request, {
          reason: rejectReason,
          requireReason: internetCredits,
        })
        setConfirmAction(null)
        bumpDataVersion()
        setPageByTab((prev) => ({ ...prev, incoming: 0 }))
        showSuccess({
          title: 'Request rejected',
          message:
            'The request was rejected and the requester can see the updated status.',
          details: [
            { label: 'Request', value: result.request.id },
            {
              label: 'Deposit',
              value: formatCurrency(getRequestDepositAmount(result.request)),
            },
          ],
        })
      } else if (confirmAction.type === 'reverse') {
        const result = reverseInternetCredits(confirmAction.request, {
          actorOrganizationId: user.organizationId,
          reason: rejectReason,
        })
        setConfirmAction(null)
        bumpDataVersion()
        showSuccess({
          title: 'Credits reversed',
          message:
            releaseSource === 'balance'
              ? 'Credits were clawed back and restored to your Available Credits.'
              : 'Released credits were clawed back from the requester.',
          details: [
            { label: 'Request', value: result.request.id },
            {
              label: 'Credits',
              value: formatCurrency(
                Number(result.request.creditsReleased) ||
                  getRequestCredits(result.request),
              ),
            },
          ],
        })
      } else if (confirmAction.type === 'new-request') {
        const result = createFundingRequest(confirmAction.payload)
        setConfirmAction(null)
        bumpDataVersion()
        setTab('mine')
        setPageByTab((prev) => ({ ...prev, mine: 0 }))
        showSuccess({
          title: 'Request submitted',
          message: internetCredits
            ? 'Your credits request is pending review by your upline.'
            : 'Your funding request is pending review by your parent organization.',
          details: [
            { label: 'Request', value: result.request.id },
            {
              label: 'Deposit',
              value: formatCurrency(result.request.depositAmount || result.request.amount),
            },
            ...(internetCredits
              ? [
                  {
                    label: 'Suggested credits',
                    value: formatCurrency(result.request.suggestedCredits),
                  },
                ]
              : []),
          ],
        })
      } else if (confirmAction.type === 'direct-transfer') {
        const result = executeWalletTransfer(confirmAction.payload)
        setConfirmAction(null)
        bumpDataVersion()
        setTab('transfers')
        setPageByTab((prev) => ({ ...prev, transfers: 0 }))
        showSuccess({
          title: 'Transfer completed',
          message: 'Funds were transferred successfully.',
          details: [
            { label: 'Transfer', value: result.transfer.id },
            { label: 'Amount', value: formatCurrency(result.transfer.amount) },
          ],
        })
      }
    } catch (error) {
      setActionError(error.message || 'Unable to complete this action.')
    } finally {
      setActionBusy(false)
    }
  }

  const confirmDialogProps = useMemo(() => {
    if (!confirmAction) {
      return {
        title: '',
        description: '',
        rows: [],
        confirmLabel: 'Confirm',
        confirmVariant: 'default',
        reasonEnabled: false,
        creditFieldsEnabled: false,
        creditsHint: '',
      }
    }

    if (confirmAction.type === 'approve') {
      const org = orgById[confirmAction.request.organizationId]
      const deposit = getRequestDepositAmount(confirmAction.request)
      const rate =
        Number(confirmAction.request.depositRate) ||
        getDepositRate({
          organizationId: confirmAction.request.organizationId,
          requesterRole: confirmAction.request.requesterRole,
        })
      const suggested =
        Number(confirmAction.request.suggestedCredits) ||
        suggestCredits(deposit, rate)
      const creditsValue = Number(creditsToRelease) || suggested
      const copy = buildSuggestedCreditsCopy({
        depositAmount: deposit,
        depositRate: rate,
        credits: suggested,
      })

      if (internetCredits) {
        return {
          title: 'Confirm approve & release',
          description:
            releaseSource === 'balance'
              ? 'This will debit your Available Credits and credit the requester.'
              : 'This will mint internet credits to the requester (no Admin wallet debit).',
          rows: buildAmountConfirmRows({
            amount: deposit,
            balanceAfter:
              releaseSource === 'balance'
                ? Number(walletBalance) - creditsValue
                : undefined,
            counterpartyLabel: 'Requester',
            counterpartyName: org?.name || confirmAction.request.organizationId,
            amountLabel: 'Deposit',
            balanceLabel: 'Available Credits after',
          }),
          confirmLabel: 'Approve & Release',
          confirmVariant: 'default',
          reasonEnabled: false,
          creditFieldsEnabled: true,
          creditsHint: copy.formula,
        }
      }

      return {
        title: 'Confirm approve & transfer',
        description:
          'This will debit your wallet and credit the requester immediately.',
        rows: buildAmountConfirmRows({
          amount: confirmAction.request.amount,
          balanceAfter:
            Number(walletBalance) - Number(confirmAction.request.amount),
          counterpartyLabel: 'Requester',
          counterpartyName: org?.name || confirmAction.request.organizationId,
        }),
        confirmLabel: 'Approve & Transfer',
        confirmVariant: 'default',
        reasonEnabled: false,
        creditFieldsEnabled: false,
        creditsHint: '',
      }
    }

    if (confirmAction.type === 'reject') {
      const org = orgById[confirmAction.request.organizationId]
      return {
        title: 'Confirm rejection',
        description: 'The requester will see this request as rejected.',
        rows: buildAmountConfirmRows({
          amount: getRequestDepositAmount(confirmAction.request),
          counterpartyLabel: 'Requester',
          counterpartyName: org?.name || confirmAction.request.organizationId,
          amountLabel: internetCredits ? 'Deposit' : 'Amount',
        }),
        confirmLabel: 'Reject Request',
        confirmVariant: 'destructive',
        reasonEnabled: true,
        creditFieldsEnabled: false,
        creditsHint: '',
      }
    }

    if (confirmAction.type === 'reverse') {
      const org = orgById[confirmAction.request.organizationId]
      return {
        title: 'Confirm reverse credits',
        description:
          releaseSource === 'balance'
            ? 'Credits will be clawed back from the requester and restored to you.'
            : 'Credits will be clawed back from the requester.',
        rows: buildAmountConfirmRows({
          amount:
            Number(confirmAction.request.creditsReleased) ||
            getRequestCredits(confirmAction.request),
          counterpartyLabel: 'Requester',
          counterpartyName: org?.name || confirmAction.request.organizationId,
          amountLabel: 'Credits',
        }),
        confirmLabel: 'Reverse Credits',
        confirmVariant: 'destructive',
        reasonEnabled: true,
        creditFieldsEnabled: false,
        creditsHint: '',
      }
    }

    if (confirmAction.type === 'new-request') {
      return {
        title: internetCredits ? 'Confirm credits request' : 'Confirm funding request',
        description: 'Submit this request for parent organization review.',
        rows: buildAmountConfirmRows({
          amount: confirmAction.payload.amount,
          amountLabel: internetCredits ? 'Deposit' : 'Amount',
        }),
        confirmLabel: 'Submit Request',
        confirmVariant: 'default',
        reasonEnabled: false,
        creditFieldsEnabled: false,
        creditsHint: '',
      }
    }

    return {
      title: 'Confirm direct transfer',
      description: 'This will debit your wallet and credit the recipient.',
      rows: buildAmountConfirmRows({
        amount: confirmAction.payload.amount,
        balanceAfter: confirmAction.payload.balanceAfter,
        counterpartyLabel:
          confirmAction.payload.recipientLabel || 'Recipient',
        counterpartyName: confirmAction.payload.recipientName,
      }),
      confirmLabel: 'Confirm Transfer',
      confirmVariant: 'default',
      reasonEnabled: false,
      creditFieldsEnabled: false,
      creditsHint: '',
    }
  }, [
    confirmAction,
    creditsToRelease,
    internetCredits,
    orgById,
    releaseSource,
    walletBalance,
  ])

  const setPage = (key, value) => {
    setPageByTab((prev) => ({ ...prev, [key]: value }))
  }

  const pagedIncoming = paginateItems(
    datasets.incoming,
    pageByTab.incoming,
    DEFAULT_PAGE_SIZE,
  ).items
  const pagedMine = paginateItems(
    datasets.mine,
    pageByTab.mine,
    DEFAULT_PAGE_SIZE,
  ).items
  const pagedApproved = paginateItems(
    datasets.approved,
    pageByTab.approved,
    DEFAULT_PAGE_SIZE,
  ).items
  const pagedTransfers = paginateItems(
    datasets.transfers,
    pageByTab.transfers,
    DEFAULT_PAGE_SIZE,
  ).items

  const metricCols =
    internetCredits && config.showIncoming
      ? config.showMine
        ? 'sm:grid-cols-2 xl:grid-cols-4'
        : 'sm:grid-cols-2 xl:grid-cols-3'
      : config.showIncoming && config.showMine
        ? 'sm:grid-cols-2 xl:grid-cols-3'
        : 'sm:grid-cols-2'

  const headerActions = (
    <>
      {config.showDirectTransfer ? (
        <Button
          type="button"
          variant="outline"
          className="border-wallet text-wallet hover:bg-wallet/5 hover:text-wallet"
          onClick={() => setDirectTransferOpen(true)}
        >
          <ArrowLeftRight className="h-4 w-4" />
          Direct Transfer
        </Button>
      ) : null}
      {config.showNewRequest ? (
        <Button
          type="button"
          className="bg-wallet text-white hover:bg-wallet/90"
          onClick={() => setNewRequestOpen(true)}
        >
          <Plus className="h-4 w-4" />
          {internetCredits ? 'New Credits Request' : 'New Funding Request'}
        </Button>
      ) : null}
    </>
  )

  return (
    <div>
      <PageHeader
        title={config.title}
        description={config.description}
        breadcrumbs={[
          { label: 'Home', href: getHomePathForRole(user?.role) },
          { label: config.breadcrumb },
        ]}
        actions={headerActions}
      />

      <div className={cn('mb-4 grid gap-4', metricCols)}>
        {config.showIncoming ? (
          <FundingMetricCard
            label={internetCredits ? 'Pending Deposits' : 'Pending Incoming'}
            value={formatCurrency(summaryMetrics.pendingIncomingAmount)}
            icon={TrendingUp}
            iconClassName="bg-emerald-50 text-emerald-600"
          />
        ) : null}
        {internetCredits && config.showIncoming ? (
          <FundingMetricCard
            label="Pending Credits"
            value={formatCurrency(summaryMetrics.pendingCredits)}
            icon={Clock3}
            iconClassName="bg-amber-50 text-amber-700"
          />
        ) : null}
        {config.showMine ? (
          <FundingMetricCard
            label="My Pending Requests"
            value={formatCurrency(summaryMetrics.myPendingAmount)}
            icon={Clock3}
            iconClassName="bg-amber-50 text-amber-700"
          />
        ) : null}
        <FundingMetricCard
          label={internetCredits ? 'Available Credits' : 'Available Balance'}
          value={formatCurrency(walletBalance)}
          icon={Landmark}
          valueClassName="text-blue-600"
          iconClassName="bg-blue-50 text-blue-600"
        />
      </div>

      <Tabs value={tab} onValueChange={setTab} className="space-y-4">
        <TabsList className="w-full justify-start overflow-x-auto">
          {config.showIncoming ? (
            <TabsTrigger value="incoming">
              {config.incomingTabLabel || 'Incoming Requests'}
            </TabsTrigger>
          ) : null}
          {config.showMine ? (
            <TabsTrigger value="mine">
              {config.mineTabLabel || 'My Requests'}
            </TabsTrigger>
          ) : null}
          {showApprovedTab ? (
            <TabsTrigger value="approved">
              {internetCredits ? 'Released / History' : 'Approved / Completed'}
            </TabsTrigger>
          ) : null}
          {showTransfersTab ? (
            <TabsTrigger value="transfers">Transfer History</TabsTrigger>
          ) : null}
        </TabsList>

        {config.showIncoming ? (
          <TabsContent value="incoming">
            <Card className="overflow-hidden shadow-sm">
              <CardContent className="p-0">
                {datasets.incoming.length === 0 ? (
                  <EmptyState
                    message={
                      internetCredits
                        ? 'No incoming credits requests at the moment.'
                        : 'No incoming funding requests at the moment.'
                    }
                  />
                ) : (
                  <>
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/50 hover:bg-muted/50">
                          <TableHead>Request ID</TableHead>
                          <TableHead>Date</TableHead>
                          <TableHead>{config.incomingColumnLabel}</TableHead>
                          <TableHead>
                            {internetCredits ? 'Deposit (PHP)' : 'Amount (PHP)'}
                          </TableHead>
                          {internetCredits ? (
                            <TableHead>Credits</TableHead>
                          ) : null}
                          <TableHead>Status</TableHead>
                          <TableHead>Action</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {pagedIncoming.map((request) => (
                          <TableRow key={request.id}>
                            <TableCell className="font-medium text-foreground">
                              {request.id}
                            </TableCell>
                            <TableCell>
                              <DateTimeCell value={request.createdAt} />
                            </TableCell>
                            <TableCell>
                              <OrganizationCell
                                organization={orgById[request.organizationId]}
                              />
                            </TableCell>
                            <TableCell className="font-semibold text-foreground">
                              {formatCurrency(getRequestDepositAmount(request))}
                            </TableCell>
                            {internetCredits ? (
                              <TableCell className="font-semibold">
                                {formatCurrency(0)}
                              </TableCell>
                            ) : null}
                            <TableCell>
                              <FundingStatusBadge status={request.status} />
                            </TableCell>
                            <TableCell>
                              <button
                                type="button"
                                className="text-sm font-medium text-wallet hover:underline"
                                onClick={() =>
                                  openRequestDialog(request, 'review')
                                }
                              >
                                Review
                              </button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                    <TablePagination
                      page={pageByTab.incoming}
                      pageSize={DEFAULT_PAGE_SIZE}
                      total={datasets.incoming.length}
                      onPageChange={(page) => setPage('incoming', page)}
                      itemLabel="requests"
                    />
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        ) : null}

        {config.showMine ? (
          <TabsContent value="mine">
            <Card className="overflow-hidden shadow-sm">
              <CardContent className="p-0">
                {datasets.mine.length === 0 ? (
                  <EmptyState message="You have not submitted any requests yet." />
                ) : (
                  <>
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/50 hover:bg-muted/50">
                          <TableHead>Request ID</TableHead>
                          <TableHead>Date</TableHead>
                          <TableHead>Submitted To</TableHead>
                          <TableHead>
                            {internetCredits ? 'Deposit (PHP)' : 'Amount (PHP)'}
                          </TableHead>
                          {internetCredits ? (
                            <TableHead>Credits</TableHead>
                          ) : null}
                          <TableHead>Status</TableHead>
                          <TableHead>Action</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {pagedMine.map((request) => (
                          <TableRow key={request.id}>
                            <TableCell className="font-medium">
                              {request.id}
                            </TableCell>
                            <TableCell>
                              <DateTimeCell value={request.createdAt} />
                            </TableCell>
                            <TableCell>
                              <OrganizationCell
                                organization={
                                  orgById[request.parentOrganizationId]
                                }
                              />
                            </TableCell>
                            <TableCell className="font-semibold">
                              {formatCurrency(getRequestDepositAmount(request))}
                            </TableCell>
                            {internetCredits ? (
                              <TableCell className="font-semibold">
                                {isReleasedStatus(request.status)
                                  ? formatCurrency(
                                      Number(request.creditsReleased) ||
                                        getRequestCredits(request),
                                    )
                                  : formatCurrency(getRequestCredits(request))}
                              </TableCell>
                            ) : null}
                            <TableCell>
                              <FundingStatusBadge status={request.status} />
                            </TableCell>
                            <TableCell>
                              <button
                                type="button"
                                className="text-sm font-medium text-wallet hover:underline"
                                onClick={() =>
                                  openRequestDialog(request, 'view')
                                }
                              >
                                View
                              </button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                    <TablePagination
                      page={pageByTab.mine}
                      pageSize={DEFAULT_PAGE_SIZE}
                      total={datasets.mine.length}
                      onPageChange={(page) => setPage('mine', page)}
                      itemLabel="requests"
                    />
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        ) : null}

        {showApprovedTab ? (
          <TabsContent value="approved">
            <Card className="overflow-hidden shadow-sm">
              <CardContent className="p-0">
                {datasets.approved.length === 0 ? (
                  <EmptyState message="No released or completed requests yet." />
                ) : (
                  <>
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/50 hover:bg-muted/50">
                          <TableHead>Request ID</TableHead>
                          <TableHead>Date</TableHead>
                          <TableHead>Organization</TableHead>
                          <TableHead>
                            {internetCredits ? 'Deposit (PHP)' : 'Amount (PHP)'}
                          </TableHead>
                          {internetCredits ? (
                            <TableHead>Credits</TableHead>
                          ) : null}
                          <TableHead>Status</TableHead>
                          <TableHead>Action</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {pagedApproved.map((request) => (
                          <TableRow key={request.id}>
                            <TableCell className="font-medium">
                              {request.id}
                            </TableCell>
                            <TableCell>
                              <DateTimeCell value={request.createdAt} />
                            </TableCell>
                            <TableCell>
                              <OrganizationCell
                                organization={orgById[request.organizationId]}
                              />
                            </TableCell>
                            <TableCell className="font-semibold">
                              {formatCurrency(getRequestDepositAmount(request))}
                            </TableCell>
                            {internetCredits ? (
                              <TableCell className="font-semibold">
                                {formatCurrency(
                                  Number(request.creditsReleased) ||
                                    getRequestCredits(request),
                                )}
                              </TableCell>
                            ) : null}
                            <TableCell>
                              <FundingStatusBadge status={request.status} />
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-wrap gap-3">
                                <button
                                  type="button"
                                  className="text-sm font-medium text-wallet hover:underline"
                                  onClick={() =>
                                    openRequestDialog(request, 'view')
                                  }
                                >
                                  View
                                </button>
                                {internetCredits &&
                                isReleasedStatus(request.status) &&
                                request.parentOrganizationId ===
                                  user?.organizationId ? (
                                  <button
                                    type="button"
                                    className="text-sm font-medium text-red-600 hover:underline"
                                    onClick={() =>
                                      openConfirm({ type: 'reverse', request })
                                    }
                                  >
                                    Reverse
                                  </button>
                                ) : null}
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                    <TablePagination
                      page={pageByTab.approved}
                      pageSize={DEFAULT_PAGE_SIZE}
                      total={datasets.approved.length}
                      onPageChange={(page) => setPage('approved', page)}
                      itemLabel="requests"
                    />
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        ) : null}

        {showTransfersTab ? (
          <TabsContent value="transfers">
            <Card className="overflow-hidden shadow-sm">
              <CardContent className="p-0">
                {datasets.transfers.length === 0 ? (
                  <EmptyState message="No transfer history available yet." />
                ) : (
                  <>
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/50 hover:bg-muted/50">
                          <TableHead>Transfer ID</TableHead>
                          <TableHead>Date</TableHead>
                          <TableHead>From</TableHead>
                          <TableHead>To</TableHead>
                          <TableHead>Amount (PHP)</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {pagedTransfers.map((transfer) => {
                          const orgId = user?.organizationId
                          let direction = null
                          if (orgId && transfer.toOrganizationId === orgId) {
                            direction = 'credit'
                          } else if (
                            orgId &&
                            transfer.fromOrganizationId === orgId
                          ) {
                            direction = 'debit'
                          }

                          return (
                            <TableRow key={transfer.id}>
                              <TableCell className="font-medium">
                                {transfer.id}
                              </TableCell>
                              <TableCell>
                                <DateTimeCell value={transfer.createdAt} />
                              </TableCell>
                              <TableCell>
                                <OrganizationCell
                                  organization={
                                    orgById[transfer.fromOrganizationId]
                                  }
                                />
                              </TableCell>
                              <TableCell>
                                <OrganizationCell
                                  organization={
                                    orgById[transfer.toOrganizationId]
                                  }
                                />
                              </TableCell>
                              <TableCell>
                                <SignedAmount
                                  amount={transfer.amount}
                                  direction={direction}
                                />
                              </TableCell>
                              <TableCell>
                                <FundingStatusBadge status={transfer.status} />
                              </TableCell>
                            </TableRow>
                          )
                        })}
                      </TableBody>
                    </Table>
                    <TablePagination
                      page={pageByTab.transfers}
                      pageSize={DEFAULT_PAGE_SIZE}
                      total={datasets.transfers.length}
                      onPageChange={(page) => setPage('transfers', page)}
                      itemLabel="transfers"
                    />
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        ) : null}
      </Tabs>

      <ReviewFundingRequestDialog
        open={Boolean(selectedRequest)}
        onOpenChange={(open) => {
          if (!open) closeRequestDialog()
        }}
        request={selectedRequest}
        organization={
          selectedRequest ? orgById[selectedRequest.organizationId] : null
        }
        walletBalance={walletBalance}
        viewerOrganizationId={user?.organizationId}
        mode={dialogMode}
        internetCredits={internetCredits}
        releaseSource={releaseSource}
        onReject={(request) => {
          closeRequestDialog()
          openConfirm({ type: 'reject', request })
        }}
        onApprove={(request) => {
          closeRequestDialog()
          openConfirm({ type: 'approve', request })
        }}
      />

      {config.showNewRequest ? (
        <NewFundingRequestSheet
          open={newRequestOpen}
          onOpenChange={setNewRequestOpen}
          user={user}
          parentOrganizationId={config.newRequestParentId}
          infoMessage={config.newRequestInfo}
          internetCredits={internetCredits}
          depositRate={internetCredits ? myRequestDepositRate : null}
          onConfirmIntent={(payload) => {
            openConfirm({ type: 'new-request', payload })
          }}
        />
      ) : null}

      {config.showDirectTransfer ? (
        <DirectTransferSheet
          open={directTransferOpen}
          onOpenChange={setDirectTransferOpen}
          user={user}
          recipients={config.recipients}
          recipientLabel={config.recipientLabel}
          availableBalance={walletBalance}
          onConfirmIntent={(payload) => {
            openConfirm({ type: 'direct-transfer', payload })
          }}
        />
      ) : null}

      <FundingConfirmDialog
        open={Boolean(confirmAction)}
        onOpenChange={(open) => {
          if (!open) closeConfirm()
        }}
        title={confirmDialogProps.title}
        description={confirmDialogProps.description}
        rows={confirmDialogProps.rows}
        confirmLabel={confirmDialogProps.confirmLabel}
        confirmVariant={confirmDialogProps.confirmVariant}
        reasonEnabled={confirmDialogProps.reasonEnabled}
        reason={rejectReason}
        onReasonChange={setRejectReason}
        reasonLabel={
          confirmAction?.type === 'reverse' || confirmAction?.type === 'reject'
            ? 'Reason (required)'
            : 'Reason (optional)'
        }
        busy={actionBusy}
        error={actionError}
        onConfirm={handleConfirmAction}
        creditFieldsEnabled={confirmDialogProps.creditFieldsEnabled}
        paymentReferenceId={paymentReferenceId}
        onPaymentReferenceChange={setPaymentReferenceId}
        creditsToRelease={creditsToRelease}
        onCreditsToReleaseChange={setCreditsToRelease}
        creditsHint={confirmDialogProps.creditsHint}
        duplicatePaymentWarning={duplicatePaymentWarning}
      />

      <FundingSuccessDialog
        open={Boolean(successAction)}
        onOpenChange={(open) => {
          if (!open) setSuccessAction(null)
        }}
        title={successAction?.title}
        message={successAction?.message || ''}
        details={successAction?.details || []}
      />
    </div>
  )
}
