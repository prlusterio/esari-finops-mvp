import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Banknote, Info, MapPin } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { formatCurrency } from '@/lib/currency'
import {
  applyClientCollection,
  buildClientTransactions,
  DEFAULT_HISTORY_END_DATE,
  DEFAULT_HISTORY_START_DATE,
  filterTransactionsByDate,
  fixedMonthlyTotal,
  formatClientDate,
  formatUpdatedAt,
  getClientById,
  getClientPortfolio,
  GROSS_SALES_BY_CLIENT_ID,
  splitIsValid,
  splitTotal,
  stakeholders as buildStakeholders,
  standardCosts,
  summarizeHistory,
  transactionBasis,
  transactionStatusClass,
  treatmentLabel,
  treatmentVariant,
  upfrontSetupTotal,
} from '@/lib/clientFinancials'
import {
  emptyCollectionState,
  loadSharedCollections,
} from '@/lib/financialsDashboard'
import { getHomePathForRole } from '@/lib/permissions'
import {
  getFranchiseCollections,
  saveFranchiseCollections,
} from '@/services/storage'
import { PageHeader } from '@/components/shared/PageHeader'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { cn } from '@/lib/utils'

function StatusBadge({ status }) {
  return (
    <Badge
      className={cn(
        'rounded-full border-transparent px-2.5 py-1 font-medium',
        status === 'Activated' && 'bg-emerald-50 text-emerald-700',
        status === 'Pending Activation' && 'bg-amber-50 text-amber-700',
        status === 'Pending Review' && 'bg-sky-50 text-sky-700',
        status === 'In Progress' && 'bg-slate-100 text-slate-700',
      )}
    >
      {status}
    </Badge>
  )
}

export default function ClientDetailPage() {
  const { user, dataVersion, bumpDataVersion } = useAuth()
  const { clientId } = useParams()
  const selectedClient = getClientById(clientId)
  const [historyStartDate, setHistoryStartDate] = useState(
    DEFAULT_HISTORY_START_DATE,
  )
  const [historyEndDate, setHistoryEndDate] = useState(DEFAULT_HISTORY_END_DATE)
  const [paymentDraft, setPaymentDraft] = useState(null)

  const collections = useMemo(() => {
    void dataVersion
    return loadSharedCollections(getClientPortfolio(), getFranchiseCollections())
  }, [dataVersion])
  const collectionState =
    (selectedClient && collections[selectedClient.id]) || emptyCollectionState()

  const grossSale = GROSS_SALES_BY_CLIENT_ID[selectedClient?.id] ?? 15_000
  const costs = useMemo(
    () => (selectedClient ? standardCosts(selectedClient) : []),
    [selectedClient],
  )
  const totalCosts = useMemo(
    () => costs.reduce((sum, cost) => sum + cost.amount, 0),
    [costs],
  )
  const netRevenueForSharing = Math.max(0, grossSale - totalCosts)
  const totalShare = selectedClient ? splitTotal(selectedClient) : 0
  const splitOk = selectedClient ? splitIsValid(selectedClient) : false
  const hasFinancialHistory = selectedClient?.status === 'Activated'
  const stakeholderRows = selectedClient ? buildStakeholders(selectedClient) : []

  const transactions = useMemo(
    () =>
      selectedClient && hasFinancialHistory
        ? buildClientTransactions(
            selectedClient,
            grossSale,
            costs,
            collectionState,
            historyStartDate,
            historyEndDate,
          )
        : [],
    [
      collectionState,
      costs,
      grossSale,
      hasFinancialHistory,
      historyEndDate,
      historyStartDate,
      selectedClient,
    ],
  )
  const filteredTransactions = useMemo(
    () => filterTransactionsByDate(transactions, historyStartDate, historyEndDate),
    [historyEndDate, historyStartDate, transactions],
  )
  const historySummary = useMemo(
    () => summarizeHistory(filteredTransactions),
    [filteredTransactions],
  )
  const historyNetRevenue = Math.max(
    0,
    historySummary.grossSales - historySummary.standardCostDeductions,
  )
  const outstandingBalance = filteredTransactions.reduce((sum, transaction) => {
    if (transaction.type !== 'Billable Monthly Collection') return sum
    return sum + Math.max(0, Number(transaction.remainingDue ?? 0))
  }, 0)

  function openConfirmPayment(transaction) {
    if (!transaction.paymentKey) return
    const remainingDue = Math.max(
      0,
      Number(transaction.remainingDue ?? transaction.amount ?? 0),
    )
    setPaymentDraft({
      key: transaction.paymentKey,
      label: transaction.type,
      kind: transaction.collectionKind,
      periodKey: transaction.periodKey,
      dueAmount: remainingDue,
      amountCollected: String(remainingDue),
      referenceNumber: '',
    })
  }

  function confirmPayment() {
    if (!paymentDraft || !selectedClient) return
    const amount = Math.max(0, Number(paymentDraft.amountCollected) || 0)
    const reference = paymentDraft.referenceNumber.trim()
    if (amount <= 0 || !reference) return

    const nextEntry = applyClientCollection({
      current: collectionState,
      kind: paymentDraft.kind,
      periodKey: paymentDraft.periodKey,
      amountCollected: amount,
      reference,
      date: new Date().toISOString().slice(0, 10),
      upfrontDue: upfrontSetupTotal(selectedClient),
      monthlyDue: fixedMonthlyTotal(selectedClient),
      paymentKey: paymentDraft.key,
    })
    saveFranchiseCollections({
      ...collections,
      [selectedClient.id]: nextEntry,
    })
    bumpDataVersion()
    setPaymentDraft(null)
  }

  const collectedAmount = Math.max(0, Number(paymentDraft?.amountCollected) || 0)
  const confirmDisabled =
    collectedAmount <= 0 || !paymentDraft?.referenceNumber.trim()

  if (!selectedClient) {
    return (
      <div>
        <PageHeader
          title="Client not found"
          description="This client is not in the demo portfolio."
          breadcrumbs={[
            { label: 'Home', href: getHomePathForRole(user?.role) },
            { label: 'Clients', href: '/franchise-setup/clients' },
            { label: 'Details' },
          ]}
        />
        <Button asChild variant="outline">
          <Link to="/franchise-setup/clients">Back to Clients</Link>
        </Button>
      </div>
    )
  }

  return (
    <div>
      <PageHeader
        title="Client Details"
        description="View franchise/sub-franchise setup, fees, territories, financial history, and revenue split breakdown."
        breadcrumbs={[
          { label: 'Home', href: getHomePathForRole(user?.role) },
          { label: 'Clients', href: '/franchise-setup/clients' },
          { label: selectedClient.name },
        ]}
        actions={
          <Button asChild variant="outline">
            <Link to="/franchise-setup/clients">Back to Clients</Link>
          </Button>
        }
      />

      <div className="space-y-4">
        <Card>
          <CardContent className="flex flex-col gap-3 p-4 md:flex-row md:items-start md:justify-between">
            <div>
              <h2 className="text-xl font-semibold">{selectedClient.name}</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {selectedClient.clientType} • {selectedClient.status}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Last updated {formatUpdatedAt(selectedClient.updatedAt)}
              </p>
            </div>
            <StatusBadge status={selectedClient.status} />
          </CardContent>
        </Card>

        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardContent className="p-4">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Upfront Setup
              </div>
              <div className="mt-1 text-2xl font-semibold tabular-nums">
                {formatCurrency(upfrontSetupTotal(selectedClient))}
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                Package + included one-time fees
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Billable Fixed Monthly
              </div>
              <div className="mt-1 text-2xl font-semibold tabular-nums">
                {formatCurrency(fixedMonthlyTotal(selectedClient))}
                <span className="text-sm font-normal text-muted-foreground">
                  {' '}
                  / mo
                </span>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                Excludes cost-deduction-only and % gross sales items
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Revenue Split
              </div>
              <div className="mt-1 text-2xl font-semibold text-success">
                {splitOk ? '100%' : `${totalShare}%`}
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                {splitOk
                  ? 'Company vs this client'
                  : 'Must equal 100% from onboarding'}
              </p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader className="flex flex-row items-start gap-2 space-y-0 border-b border-border px-4 py-3">
            <Banknote className="mt-0.5 h-4 w-4 text-primary" />
            <div>
              <CardTitle className="text-base">Revenue Split Breakdown</CardTitle>
              <CardDescription>
                Gross sales less standard cost deductions. Admin split is
                company vs this client only.
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 p-4">
            <div className="grid gap-3 md:grid-cols-3">
              <div className="border border-border bg-muted/30 p-3">
                <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Gross Sale
                </div>
                <div className="mt-1 text-lg font-semibold tabular-nums">
                  {formatCurrency(grossSale)}
                </div>
              </div>
              <div className="border border-border bg-muted/30 p-3">
                <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Standard Cost Deductions
                </div>
                <div className="mt-1 text-lg font-semibold tabular-nums">
                  {formatCurrency(totalCosts)}
                </div>
              </div>
              <div className="border border-primary/30 bg-primary/5 p-3">
                <div className="text-[11px] font-semibold uppercase tracking-wide text-primary">
                  Net Revenue for Sharing
                </div>
                <div className="mt-1 text-lg font-semibold tabular-nums text-primary">
                  {formatCurrency(netRevenueForSharing)}
                </div>
              </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              <div className="space-y-2">
                <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Standard Cost Deduction Details
                </div>
                {costs.length > 0 ? (
                  costs.map((cost) => (
                    <div
                      className="flex items-center justify-between gap-3 text-sm"
                      key={cost.label}
                    >
                      <span className="flex min-w-0 items-center gap-2 text-muted-foreground">
                        <span className="truncate">{cost.label}</span>
                        <Badge
                          variant={treatmentVariant(cost.treatment)}
                          className="rounded-full"
                        >
                          {treatmentLabel(cost.treatment)}
                        </Badge>
                      </span>
                      <span className="shrink-0 font-medium tabular-nums">
                        {formatCurrency(cost.amount)}
                      </span>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">
                    No monthly operational fees are tagged as cost deductions.
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Stakeholder Payouts
                </div>
                {stakeholderRows.map((stakeholder) => (
                  <div
                    className="flex justify-between text-sm"
                    key={stakeholder.label}
                  >
                    <span className="text-muted-foreground">
                      {stakeholder.label} ({stakeholder.share}%)
                    </span>
                    <span className="font-medium tabular-nums">
                      {formatCurrency(
                        (netRevenueForSharing * stakeholder.share) / 100,
                      )}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div
              className={cn(
                'flex items-center gap-2 border p-3 text-sm',
                splitOk
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                  : 'border-amber-200 bg-amber-50 text-amber-900',
              )}
            >
              <Info className="h-4 w-4 shrink-0" />
              {splitOk
                ? 'Company and this client equal 100%. Franchisee and retailer shares are set by the client, not by platform admin.'
                : `Revenue split totals ${totalShare}% and must equal 100%.`}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-col gap-3 space-y-0 border-b border-border px-4 py-3 xl:flex-row xl:items-start xl:justify-between">
            <div>
              <CardTitle className="text-base">Client Financial History</CardTitle>
              <CardDescription>
                Activated accounts only. Track payments, gross sales, cost
                deductions, and revenue share activity for the selected client.
              </CardDescription>
            </div>
            {hasFinancialHistory ? (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="history-start">Start date</Label>
                  <Input
                    id="history-start"
                    type="date"
                    value={historyStartDate}
                    onChange={(event) => setHistoryStartDate(event.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="history-end">End date</Label>
                  <Input
                    id="history-end"
                    type="date"
                    value={historyEndDate}
                    onChange={(event) => setHistoryEndDate(event.target.value)}
                  />
                </div>
              </div>
            ) : null}
          </CardHeader>
          {hasFinancialHistory ? (
            <CardContent className="space-y-4 p-4">
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <div className="border border-border bg-muted/30 p-3">
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Gross Sales
                  </div>
                  <div className="mt-1 text-lg font-semibold tabular-nums">
                    {formatCurrency(historySummary.grossSales)}
                  </div>
                </div>
                <div className="border border-border bg-muted/30 p-3">
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Standard Cost Deductions
                  </div>
                  <div className="mt-1 text-lg font-semibold tabular-nums">
                    {formatCurrency(historySummary.standardCostDeductions)}
                  </div>
                </div>
                <div className="border border-primary/30 bg-primary/5 p-3">
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-primary">
                    Net Revenue for Sharing
                  </div>
                  <div className="mt-1 text-lg font-semibold tabular-nums text-primary">
                    {formatCurrency(historyNetRevenue)}
                  </div>
                </div>
                <div className="border border-border bg-muted/30 p-3">
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Outstanding Monthly
                  </div>
                  <div className="mt-1 text-lg font-semibold tabular-nums">
                    {formatCurrency(outstandingBalance)}
                  </div>
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-3">
                <div className="flex items-center justify-between border border-border bg-muted/30 p-3">
                  <span className="text-sm text-muted-foreground">
                    Stakeholder payouts
                  </span>
                  <span className="font-semibold tabular-nums">
                    {formatCurrency(historySummary.stakeholderPayouts)}
                  </span>
                </div>
                <div className="flex items-center justify-between border border-border bg-muted/30 p-3">
                  <span className="text-sm text-muted-foreground">
                    Billable monthly collected
                  </span>
                  <span className="font-semibold tabular-nums">
                    {formatCurrency(historySummary.billableMonthlyCollected)}
                  </span>
                </div>
                <div className="flex items-center justify-between border border-border bg-muted/30 p-3">
                  <span className="text-sm text-muted-foreground">
                    Upfront collected
                  </span>
                  <span className="font-semibold tabular-nums">
                    {formatCurrency(historySummary.upfrontCollected)}
                  </span>
                </div>
              </div>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Reference</TableHead>
                    <TableHead>Basis / Description</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead className="text-right">Status</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTransactions.length > 0 ? (
                    filteredTransactions.map((transaction) => (
                      <TableRow key={transaction.id}>
                        <TableCell>
                          <div className="font-medium">
                            {formatClientDate(transaction.date)}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {transaction.period}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="font-medium">{transaction.type}</div>
                          <div className="text-sm text-muted-foreground">
                            {transaction.remarks}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {transaction.reference}
                        </TableCell>
                        <TableCell className="max-w-xs text-sm text-muted-foreground">
                          {transactionBasis(transaction, formatCurrency)}
                        </TableCell>
                        <TableCell className="text-right font-medium tabular-nums">
                          {formatCurrency(transaction.amount)}
                        </TableCell>
                        <TableCell className="text-right">
                          <Badge
                            className={cn(
                              'rounded-full border-transparent px-2.5 py-1 font-medium',
                              transactionStatusClass(transaction.status),
                            )}
                          >
                            {transaction.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          {transaction.paymentKey &&
                          transaction.status === 'Unpaid' ? (
                            <Button
                              type="button"
                              size="sm"
                              onClick={() => openConfirmPayment(transaction)}
                            >
                              Confirm Collection
                            </Button>
                          ) : (
                            <span className="text-sm text-muted-foreground">
                              —
                            </span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell
                        colSpan={7}
                        className="text-center text-sm text-muted-foreground"
                      >
                        No financial transactions found for the selected date
                        range.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          ) : (
            <CardContent className="p-4">
              <div className="border border-border bg-muted/30 p-6 text-center">
                <div className="font-semibold">No financial history yet</div>
                <p className="mt-1 text-sm text-muted-foreground">
                  Financial history records are created only after the client
                  account is activated. This client is currently {selectedClient.status}.
                </p>
              </div>
            </CardContent>
          )}
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center gap-2 space-y-0 border-b border-border px-4 py-3">
            <MapPin className="h-4 w-4 text-primary" />
            <CardTitle className="text-base">Territories and Areas</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 p-4 md:grid-cols-2">
            {selectedClient.territories.map((territory) => (
              <div
                className="border border-border bg-muted/30 p-3"
                key={territory.id}
              >
                <div className="font-semibold">{territory.coverageName}</div>
                <div className="mt-1 text-sm text-muted-foreground">
                  {territory.city}, {territory.province}
                </div>
                <div className="mt-2 text-sm text-muted-foreground">
                  {territory.areas.length} areas •{' '}
                  {territory.boundaryDefined
                    ? 'Boundary set'
                    : 'Boundary pending'}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Dialog
        open={Boolean(paymentDraft)}
        onOpenChange={(open) => {
          if (!open) setPaymentDraft(null)
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Confirm collection</DialogTitle>
            <DialogDescription>
              {selectedClient.name} • {paymentDraft?.label}
            </DialogDescription>
          </DialogHeader>
          {paymentDraft ? (
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="client-amount-collected">Amount collected</Label>
                  <Input
                    id="client-amount-collected"
                    className="tabular-nums"
                    type="number"
                    min={0}
                    step={0.01}
                    inputMode="decimal"
                    value={paymentDraft.amountCollected}
                    onChange={(event) =>
                      setPaymentDraft((draft) =>
                        draft
                          ? { ...draft, amountCollected: event.target.value }
                          : draft,
                      )
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="client-reference">Reference number</Label>
                  <Input
                    id="client-reference"
                    placeholder="OR / bank ref / receipt no."
                    value={paymentDraft.referenceNumber}
                    onChange={(event) =>
                      setPaymentDraft((draft) =>
                        draft
                          ? { ...draft, referenceNumber: event.target.value }
                          : draft,
                      )
                    }
                  />
                </div>
              </div>
              <div className="space-y-2 border border-border bg-muted/30 p-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Amount due</span>
                  <span className="font-medium tabular-nums">
                    {formatCurrency(paymentDraft.dueAmount)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Amount collected</span>
                  <span className="font-semibold tabular-nums">
                    {formatCurrency(collectedAmount)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">
                    Remaining after collection
                  </span>
                  <span className="font-medium tabular-nums">
                    {formatCurrency(
                      Math.max(0, paymentDraft.dueAmount - collectedAmount),
                    )}
                  </span>
                </div>
              </div>
              <p className="text-sm text-muted-foreground">
                Reference number is required so finance can trace the collection
                to an official receipt, bank transfer, or collection record.
              </p>
            </div>
          ) : null}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setPaymentDraft(null)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={confirmPayment}
              disabled={confirmDisabled}
            >
              Confirm Collection
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
