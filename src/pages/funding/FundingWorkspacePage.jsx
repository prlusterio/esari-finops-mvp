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
import { DEFAULT_PAGE_SIZE, paginateItems } from '@/lib/pagination'
import { getHomePathForRole } from '@/lib/permissions'
import {
  approveAndTransferFundingRequest,
  createFundingRequest,
  executeWalletTransfer,
  rejectFundingRequest,
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

function sumAmounts(items) {
  return items.reduce((total, item) => total + (Number(item.amount) || 0), 0)
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
    const pendingIncomingAmount = sumAmounts(datasets.incoming)
    const myPendingAmount = sumAmounts(
      datasets.mine.filter((request) => request.status === FUNDING_STATUS.PENDING),
    )

    return {
      pendingIncomingAmount,
      myPendingAmount,
    }
  }, [datasets])

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
    setConfirmAction(action)
  }

  const closeConfirm = () => {
    if (actionBusy) return
    setConfirmAction(null)
    setActionError('')
    setRejectReason('')
  }

  const showSuccess = (payload) => {
    setSuccessAction(payload)
  }

  const handleConfirmAction = () => {
    if (!confirmAction) return
    setActionBusy(true)
    setActionError('')

    try {
      if (confirmAction.type === 'approve') {
        const result = approveAndTransferFundingRequest(
          confirmAction.request,
          user.organizationId,
        )
        setConfirmAction(null)
        bumpDataVersion()
        setTab('transfers')
        setPageByTab((prev) => ({ ...prev, transfers: 0, incoming: 0 }))
        showSuccess({
          title: 'Transfer completed',
          message: 'The funding request was approved and funds were transferred.',
          details: [
            { label: 'Request', value: result.request.id },
            { label: 'Transfer', value: result.transfer.id },
            { label: 'Amount', value: formatCurrency(result.transfer.amount) },
          ],
        })
      } else if (confirmAction.type === 'reject') {
        const result = rejectFundingRequest(confirmAction.request, {
          reason: rejectReason,
        })
        setConfirmAction(null)
        bumpDataVersion()
        setPageByTab((prev) => ({ ...prev, incoming: 0 }))
        showSuccess({
          title: 'Request rejected',
          message: 'The funding request was rejected and the requester can see the updated status.',
          details: [
            { label: 'Request', value: result.request.id },
            { label: 'Amount', value: formatCurrency(result.request.amount) },
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
          message: 'Your funding request is pending review by your parent organization.',
          details: [
            { label: 'Request', value: result.request.id },
            { label: 'Amount', value: formatCurrency(result.request.amount) },
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
      }
    }

    if (confirmAction.type === 'approve') {
      const org = orgById[confirmAction.request.organizationId]
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
      }
    }

    if (confirmAction.type === 'reject') {
      const org = orgById[confirmAction.request.organizationId]
      return {
        title: 'Confirm rejection',
        description: 'The requester will see this request as rejected.',
        rows: buildAmountConfirmRows({
          amount: confirmAction.request.amount,
          counterpartyLabel: 'Requester',
          counterpartyName: org?.name || confirmAction.request.organizationId,
        }),
        confirmLabel: 'Reject Request',
        confirmVariant: 'destructive',
        reasonEnabled: true,
      }
    }

    if (confirmAction.type === 'new-request') {
      return {
        title: 'Confirm funding request',
        description: 'Submit this request for parent organization review.',
        rows: buildAmountConfirmRows({
          amount: confirmAction.payload.amount,
        }),
        confirmLabel: 'Submit Request',
        confirmVariant: 'default',
        reasonEnabled: false,
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
    }
  }, [confirmAction, orgById, walletBalance])

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
          New Funding Request
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

      <div
        className={cn(
          'mb-4 grid gap-4',
          config.showIncoming && config.showMine
            ? 'sm:grid-cols-2 xl:grid-cols-3'
            : 'sm:grid-cols-2',
        )}
      >
        {config.showIncoming ? (
          <FundingMetricCard
            label="Pending Incoming"
            value={formatCurrency(summaryMetrics.pendingIncomingAmount)}
            icon={TrendingUp}
            iconClassName="bg-emerald-50 text-emerald-600"
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
          label="Available Balance"
          value={formatCurrency(walletBalance)}
          icon={Landmark}
          valueClassName="text-blue-600"
          iconClassName="bg-blue-50 text-blue-600"
        />
      </div>

      <Tabs value={tab} onValueChange={setTab} className="space-y-4">
        <TabsList className="w-full justify-start overflow-x-auto">
          {config.showIncoming ? (
            <TabsTrigger value="incoming">Incoming Requests</TabsTrigger>
          ) : null}
          {config.showMine ? (
            <TabsTrigger value="mine">My Requests</TabsTrigger>
          ) : null}
          <TabsTrigger value="approved">Approved / Completed</TabsTrigger>
          <TabsTrigger value="transfers">Transfer History</TabsTrigger>
        </TabsList>

        {config.showIncoming ? (
          <TabsContent value="incoming">
            <Card className="overflow-hidden shadow-sm">
              <CardContent className="p-0">
                {datasets.incoming.length === 0 ? (
                  <EmptyState message="No incoming funding requests at the moment." />
                ) : (
                  <>
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/50 hover:bg-muted/50">
                          <TableHead>Request ID</TableHead>
                          <TableHead>Date</TableHead>
                          <TableHead>{config.incomingColumnLabel}</TableHead>
                          <TableHead>Amount (PHP)</TableHead>
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
                              {formatCurrency(request.amount)}
                            </TableCell>
                            <TableCell>
                              <FundingStatusBadge status={request.status} />
                            </TableCell>
                            <TableCell>
                              <button
                                type="button"
                                className="text-sm font-medium text-wallet hover:underline"
                                onClick={() => openRequestDialog(request, 'review')}
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
                  <EmptyState message="You have not submitted any funding requests yet." />
                ) : (
                  <>
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/50 hover:bg-muted/50">
                          <TableHead>Request ID</TableHead>
                          <TableHead>Date</TableHead>
                          <TableHead>Submitted To</TableHead>
                          <TableHead>Amount (PHP)</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Action</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {pagedMine.map((request) => (
                          <TableRow key={request.id}>
                            <TableCell className="font-medium">{request.id}</TableCell>
                            <TableCell>
                              <DateTimeCell value={request.createdAt} />
                            </TableCell>
                            <TableCell>
                              <OrganizationCell
                                organization={orgById[request.parentOrganizationId]}
                              />
                            </TableCell>
                            <TableCell className="font-semibold">
                              {formatCurrency(request.amount)}
                            </TableCell>
                            <TableCell>
                              <FundingStatusBadge status={request.status} />
                            </TableCell>
                            <TableCell>
                              <button
                                type="button"
                                className="text-sm font-medium text-wallet hover:underline"
                                onClick={() => openRequestDialog(request, 'view')}
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

        <TabsContent value="approved">
          <Card className="overflow-hidden shadow-sm">
            <CardContent className="p-0">
              {datasets.approved.length === 0 ? (
                <EmptyState message="No approved or completed funding requests yet." />
              ) : (
                <>
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50 hover:bg-muted/50">
                        <TableHead>Request ID</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Organization</TableHead>
                        <TableHead>Amount (PHP)</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pagedApproved.map((request) => (
                        <TableRow key={request.id}>
                          <TableCell className="font-medium">{request.id}</TableCell>
                          <TableCell>
                            <DateTimeCell value={request.createdAt} />
                          </TableCell>
                          <TableCell>
                            <OrganizationCell
                              organization={orgById[request.organizationId]}
                            />
                          </TableCell>
                          <TableCell className="font-semibold">
                            {formatCurrency(request.amount)}
                          </TableCell>
                          <TableCell>
                            <FundingStatusBadge status={request.status} />
                          </TableCell>
                          <TableCell>
                            <button
                              type="button"
                              className="text-sm font-medium text-wallet hover:underline"
                              onClick={() => openRequestDialog(request, 'view')}
                            >
                              View
                            </button>
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
                        } else if (orgId && transfer.fromOrganizationId === orgId) {
                          direction = 'debit'
                        }

                        return (
                          <TableRow key={transfer.id}>
                            <TableCell className="font-medium">{transfer.id}</TableCell>
                            <TableCell>
                              <DateTimeCell value={transfer.createdAt} />
                            </TableCell>
                            <TableCell>
                              <OrganizationCell
                                organization={orgById[transfer.fromOrganizationId]}
                              />
                            </TableCell>
                            <TableCell>
                              <OrganizationCell
                                organization={orgById[transfer.toOrganizationId]}
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
        busy={actionBusy}
        error={actionError}
        onConfirm={handleConfirmAction}
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
