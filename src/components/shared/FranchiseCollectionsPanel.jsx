import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import {
  applyClientCollection,
  fixedMonthlyTotal,
  formatClientDate,
  getClientById,
  upfrontSetupTotal,
} from '@/lib/clientFinancials'
import { formatCurrency } from '@/lib/currency'
import { loadFranchiseCollectionView } from '@/lib/franchiseCollectionLedger'
import { DEFAULT_PAGE_SIZE, paginateItems } from '@/lib/pagination'
import { saveFranchiseCollections } from '@/services/storage'
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
import { TablePagination } from '@/components/shared/TablePagination'
import { cn } from '@/lib/utils'

function StatusBadge({ status }) {
  return (
    <Badge
      className={cn(
        'rounded-full border-transparent px-2.5 py-1 font-medium',
        status === 'Collected' && 'bg-emerald-50 text-emerald-700',
        status === 'Partial' && 'bg-amber-50 text-amber-700',
        status === 'Unpaid' && 'bg-slate-100 text-slate-700',
      )}
    >
      {status}
    </Badge>
  )
}

export function FranchiseCollectionsPanel({
  dateRange = 'all',
  customDateRange = null,
  search = '',
  title = 'Franchise Setup Collections',
  description = 'Upfront and billable monthly collections for Activated clients. Same ledger as Financials Dashboard and Client Details.',
  id,
  showRollup = false,
  className,
}) {
  const { dataVersion, bumpDataVersion } = useAuth()
  const [page, setPage] = useState(0)
  const [paymentDraft, setPaymentDraft] = useState(null)

  useEffect(() => {
    setPage(0)
  }, [customDateRange, dateRange, search])

  const view = useMemo(() => {
    void dataVersion
    return loadFranchiseCollectionView({
      dateRange,
      customDateRange,
      search,
    })
  }, [customDateRange, dataVersion, dateRange, search])

  const { page: currentPage, items: paged } = paginateItems(
    view.entries,
    page,
    DEFAULT_PAGE_SIZE,
  )

  function openConfirm(entry) {
    if (entry.status === 'Collected' || entry.remaining <= 0) return
    setPaymentDraft({
      key: entry.paymentKey,
      label: `${entry.type} · ${entry.clientName}`,
      kind: entry.collectionKind,
      periodKey: entry.periodKey,
      clientId: entry.clientId,
      dueAmount: entry.remaining,
      amountCollected: String(entry.remaining),
      referenceNumber: '',
    })
  }

  function confirmPayment() {
    if (!paymentDraft) return
    const amount = Math.max(0, Number(paymentDraft.amountCollected) || 0)
    const reference = paymentDraft.referenceNumber.trim()
    if (amount <= 0 || !reference) return

    const client = getClientById(paymentDraft.clientId)
    if (!client) return
    const current = view.collections[paymentDraft.clientId]
    const nextEntry = applyClientCollection({
      current,
      kind: paymentDraft.kind,
      periodKey: paymentDraft.periodKey,
      amountCollected: amount,
      reference,
      date: new Date().toISOString().slice(0, 10),
      upfrontDue: upfrontSetupTotal(client),
      monthlyDue: fixedMonthlyTotal(client),
      paymentKey: paymentDraft.key,
    })
    saveFranchiseCollections({
      ...view.collections,
      [paymentDraft.clientId]: nextEntry,
    })
    bumpDataVersion()
    setPaymentDraft(null)
  }

  const collectedAmount = Math.max(0, Number(paymentDraft?.amountCollected) || 0)
  const confirmDisabled =
    collectedAmount <= 0 || !paymentDraft?.referenceNumber.trim()

  return (
    <div className={cn('space-y-4', className)}>
      {showRollup ? (
        <Card className="overflow-hidden shadow-sm">
          <CardHeader className="border-b border-border px-4 py-3">
            <CardTitle className="text-base">Collections by client</CardTitle>
            <CardDescription>
              Upfront and billable monthly collected versus remaining in the
              selected period.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {view.rollup.length === 0 ? (
              <div className="px-4 py-10 text-center text-sm text-muted-foreground">
                No franchise collections in this period.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50 hover:bg-muted/50">
                      <TableHead>Client</TableHead>
                      <TableHead className="text-right">Upfront collected</TableHead>
                      <TableHead className="text-right">Monthly collected</TableHead>
                      <TableHead className="text-right">Collected</TableHead>
                      <TableHead className="text-right">Remaining</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {view.rollup.map((row) => (
                      <TableRow key={row.clientId}>
                        <TableCell>
                          <div className="font-medium">{row.name}</div>
                          <div className="text-xs text-muted-foreground">
                            {row.clientType} · Company {row.companyPct}% / client{' '}
                            {row.clientPct}%
                          </div>
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatCurrency(row.upfrontPaid)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatCurrency(row.monthlyPaid)}
                        </TableCell>
                        <TableCell className="text-right font-medium tabular-nums">
                          {formatCurrency(row.collected)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatCurrency(row.remaining)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      ) : null}

      <Card id={id} className="overflow-hidden shadow-sm">
        <CardHeader className="border-b border-border px-4 py-3">
          <CardTitle className="text-base">{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {view.entries.length === 0 ? (
            <div className="px-4 py-10 text-center text-sm text-muted-foreground">
              No franchise setup collections for the selected period.
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50 hover:bg-muted/50">
                      <TableHead>Client</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Period</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead className="text-right">Due</TableHead>
                      <TableHead className="text-right">Paid</TableHead>
                      <TableHead className="text-right">Remaining</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paged.map((entry) => (
                      <TableRow key={entry.id}>
                        <TableCell>
                          <Link
                            to={`/franchise-setup/clients/${entry.clientId}`}
                            className="font-medium hover:underline"
                          >
                            {entry.clientName}
                          </Link>
                          <div className="text-xs text-muted-foreground">
                            Company {entry.companyPct}% / client {entry.clientPct}%
                          </div>
                        </TableCell>
                        <TableCell>{entry.type}</TableCell>
                        <TableCell>{entry.periodLabel}</TableCell>
                        <TableCell>{formatClientDate(entry.date)}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatCurrency(entry.due)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatCurrency(entry.paid)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatCurrency(entry.remaining)}
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={entry.status} />
                        </TableCell>
                        <TableCell className="text-right">
                          {entry.status === 'Collected' ? (
                            <span className="text-sm text-muted-foreground">—</span>
                          ) : (
                            <Button
                              type="button"
                              size="sm"
                              onClick={() => openConfirm(entry)}
                            >
                              Confirm Collection
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <TablePagination
                page={currentPage}
                pageSize={DEFAULT_PAGE_SIZE}
                total={view.entries.length}
                onPageChange={setPage}
              />
            </>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={Boolean(paymentDraft)}
        onOpenChange={(open) => {
          if (!open) setPaymentDraft(null)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Collection</DialogTitle>
            <DialogDescription>
              {paymentDraft?.label}. This updates Financials Dashboard and Client
              Details.
            </DialogDescription>
          </DialogHeader>
          {paymentDraft ? (
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="ledger-amount-collected">Amount collected</Label>
                  <Input
                    id="ledger-amount-collected"
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
                  <Label htmlFor="ledger-reference">Reference number</Label>
                  <Input
                    id="ledger-reference"
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
