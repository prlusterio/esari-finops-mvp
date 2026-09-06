import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { isApiWired } from '@/lib/api/config'
import { useResourceData, toRows, apiErrorMessage } from '@/hooks/useResourceData'
import {
  createAdminCollectionForRole,
  listAdminCollectionsForRole,
} from '@/services/api/adminResources'
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

/**
 * []-safe mapping for GET /admin/collections payloads (or a bare array of
 * entries) onto the local ledger shape. Missing fields degrade to empty
 * strings/zeros, never null crashes.
 */
function normalizeServerLedger(payload) {
  const source =
    payload && typeof payload === 'object' && !Array.isArray(payload)
      ? (payload.entries ?? payload.items ?? payload.data ?? [])
      : payload
  const entries = (Array.isArray(source) ? source : []).map((entry, index) => ({
    id: entry?.id ?? entry?.collectionId ?? `server-${index}`,
    clientId: entry?.clientId ?? entry?.companyId ?? '',
    clientName: entry?.clientName ?? entry?.companyName ?? '',
    clientType: entry?.clientType ?? '',
    type: entry?.type ?? '',
    period: entry?.period ?? '',
    periodKey: entry?.periodKey ?? null,
    periodLabel: entry?.periodLabel ?? entry?.period ?? '',
    date: entry?.date ?? '',
    due: Number(entry?.due) || 0,
    paid: Number(entry?.paid) || 0,
    remaining: Number(entry?.remaining ?? Math.max(0, Number(entry?.due || 0) - Number(entry?.paid || 0))) || 0,
    status: entry?.status ?? 'Unpaid',
    companyPct: entry?.companyPct ?? 0,
    clientPct: entry?.clientPct ?? 0,
    reference: entry?.reference ?? '',
    paymentKey: entry?.paymentKey ?? null,
    collectionKind: entry?.collectionKind ?? 'upfront',
  }))
  const collected = entries.reduce((sum, entry) => sum + (Number(entry.paid) || 0), 0)
  const remaining = entries.reduce((sum, entry) => sum + (Number(entry.remaining) || 0), 0)
  return { entries, rollup: [], kpis: { collected, remaining } }
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
  const { user, dataVersion, bumpDataVersion } = useAuth()
  const [page, setPage] = useState(0)
  const [paymentDraft, setPaymentDraft] = useState(null)
  const [collectionError, setCollectionError] = useState('')
  // T9b/T10: GET /admin/collections feeds the ledger when wired (local
  // ledger stays as fallback until verify; no mixed-source rows).
  const useApi = isApiWired()
  const apiCollections = useResourceData({
    loadFromApi: () =>
      listAdminCollectionsForRole(user?.role, {
        dateRange,
        search,
      }),
    loadFromStorage: () => [],
    fallbackEnabled: false,
    deps: [user?.role],
  })
  const serverLedger = useMemo(() => {
    if (!useApi) return null
    if (apiCollections.error) return { entries: [], rollup: [], kpis: null }
    return normalizeServerLedger(toRows(apiCollections.data))
  }, [useApi, apiCollections.data, apiCollections.error])

  useEffect(() => {
    setPage(0)
  }, [customDateRange, dateRange, search])

  const view = useMemo(() => {
    void dataVersion
    const local = loadFranchiseCollectionView({
      dateRange,
      customDateRange,
      search,
    })
    // No mixed-source page: wired + verified server ledger replaces local;
    // on API error the panel shows []-safe rows + the error, not a blend.
    if (!useApi || !serverLedger) return local
    return {
      ...local,
      entries: serverLedger.entries,
      rollup: showRollup ? serverLedger.rollup : local.rollup,
      kpis: serverLedger.kpis ?? local.kpis,
      collections: local.collections,
    }
  }, [customDateRange, dataVersion, dateRange, search, useApi, serverLedger, showRollup])

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

  async function confirmPayment() {
    if (!paymentDraft) return
    const amount = Math.max(0, Number(paymentDraft.amountCollected) || 0)
    const reference = paymentDraft.referenceNumber.trim()
    if (amount <= 0 || !reference) return
    setCollectionError('')

    // G4 open: POST /admin/collections is 503-as-expected while wired.
    // Surface the 503; never persist locally when wired.
    if (useApi) {
      try {
        await createAdminCollectionForRole(user?.role, {
          clientId: paymentDraft.clientId,
          kind: paymentDraft.kind,
          periodKey: paymentDraft.periodKey,
          amountCollected: amount,
          referenceNumber: reference,
          paymentKey: paymentDraft.key,
        })
        apiCollections.reload()
        bumpDataVersion()
        setPaymentDraft(null)
      } catch (error) {
        setCollectionError(apiErrorMessage(error, 'Unable to record this collection.'))
      }
      return
    }

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
      {useApi && apiCollections.error ? (
        <div className="rounded-md border border-danger/20 bg-danger/5 px-3 py-2 text-sm text-danger">
          {apiErrorMessage(apiCollections.error)}
        </div>
      ) : null}
      {collectionError ? (
        <div className="rounded-md border border-danger/20 bg-danger/5 px-3 py-2 text-sm text-danger">
          {collectionError}
        </div>
      ) : null}
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
