import { Fragment, useEffect, useMemo, useState } from 'react'
import {
  Download,
  Eye,
  Banknote,
  Coins,
  CreditCard,
  Receipt,
} from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { ROLES, TRANSACTION_STATUS, TRANSACTION_STATUS_LABELS } from '@/lib/constants'
import { formatCurrency, formatSignedCurrency } from '@/lib/currency'
import { buildRevenuePageHref, formatDateLong, formatReportPeriodLabel } from '@/lib/date'
import {
  franchiseCollectionEntriesToCsv,
  loadFranchiseCollectionView,
} from '@/lib/franchiseCollectionLedger'
import { DEFAULT_PAGE_SIZE, paginateItems } from '@/lib/pagination'
import { DateTimeCell } from '@/components/shared/DateTimeCell'
import { SignedAmount } from '@/components/shared/SignedAmount'
import { TablePagination } from '@/components/shared/TablePagination'
import { getHomePathForRole } from '@/lib/permissions'
import {
  buildPartyRevenueDetailEntries,
  buildReportSnapshot,
  exportTransactionsCsv,
  fundingRequestsToCsv,
  fundingTransfersToCsv,
  getNetworkFilterOptions,
  getNetworkRevenueParties,
  getReportsPageConfig,
  partyRevenueDetailEntriesToCsv,
  revenueEntriesToCsv,
  creditLoadEntriesToCsv,
  buildSubFranchiseeRevenueShareReport,
  subFranchiseeRevenueShareToCsv,
  buildInternetRetailerBalanceReport,
  internetRetailerBalanceReportToCsv,
} from '@/lib/reports'
import {
  buildCreditRevenueSnapshot,
  rollupCreditEarningsByDownline,
} from '@/lib/creditEconomics'
import {
  getTransactionsPageConfig,
  getViewerShareAmountForRole,
  sortTransactionsNewest,
} from '@/lib/transactions'
import {
  buildCreditLedger,
  creditLedgerToCsv,
} from '@/lib/wallets'
import { getOperatingWallet } from '@/services/fundingActions'
import {
  getFundingRequests,
  getFundingTransfers,
  getOrganizations,
  getRevenueSharing,
  getTransactions,
  getWallets,
} from '@/services/storage'
import { FranchiseCollectionsPanel } from '@/components/shared/FranchiseCollectionsPanel'
import { PageHeader } from '@/components/shared/PageHeader'
import { StatCard } from '@/components/shared/StatCard'
import { TransactionDetailsDialog } from '@/components/shared/TransactionDetailsDialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { cn } from '@/lib/utils'

function downloadCsv(filename, content) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

function sumRows(rows, field) {
  return rows.reduce((sum, row) => sum + (Number(row[field]) || 0), 0)
}

function TransactionStatusBadge({ status }) {
  const isCompleted = status === TRANSACTION_STATUS.COMPLETED
  return (
    <Badge
      className={cn(
        'rounded-full border-transparent px-2.5 py-1 font-medium',
        isCompleted
          ? 'bg-emerald-50 text-emerald-700'
          : 'bg-amber-50 text-amber-700',
      )}
    >
      {TRANSACTION_STATUS_LABELS[status] || status}
    </Badge>
  )
}

function ExportCard({ title, description, count, onExport, disabled }) {
  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold text-slate-900">
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">{description}</p>
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-medium text-slate-700">
            {count} record{count === 1 ? '' : 's'}
          </p>
          <Button
            type="button"
            variant="outline"
            disabled={disabled || count === 0}
            onClick={onExport}
          >
            <Download className="h-4 w-4" />
            Export CSV
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

function NetworkRevenueTable({
  title,
  description,
  rows,
  emptyLabel,
  showParentColumn = false,
  showRetailerCount = false,
  showViewerCommission = false,
  showPoolColumn = false,
  entityLabel = 'Organization',
  partyCommissionLabel = 'Their Commission',
  viewerCommissionLabel = 'Your Commission',
  onView,
  onExport,
}) {
  const totals = {
    transactionCount: sumRows(rows, 'transactionCount'),
    retailerCount: sumRows(rows, 'retailerCount'),
    customerPayment: sumRows(rows, 'customerPayment'),
    distributable: sumRows(rows, 'distributable'),
    creditedRevenue: sumRows(rows, 'creditedRevenue'),
    viewerCommission: sumRows(rows, 'viewerCommission'),
  }

  return (
    <Card className="overflow-hidden shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 border-b border-border px-4 py-3">
        <div>
          <CardTitle className="text-base font-semibold">{title}</CardTitle>
          {description ? (
            <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
          ) : null}
        </div>
        <p className="text-sm text-muted-foreground">
          {rows.length} {rows.length === 1 ? entityLabel.toLowerCase() : `${entityLabel.toLowerCase()}s`}
        </p>
      </CardHeader>
      <CardContent className="p-0">
        {rows.length === 0 ? (
          <div className="px-4 py-12 text-center text-sm text-muted-foreground">
            {emptyLabel}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50 hover:bg-muted/50">
                  <TableHead>{entityLabel}</TableHead>
                  {showParentColumn ? <TableHead>Franchisee</TableHead> : null}
                  {showRetailerCount ? (
                    <TableHead className="text-right">Retailers</TableHead>
                  ) : null}
                  <TableHead className="text-right">Txns</TableHead>
                  <TableHead className="text-right">Sales Volume</TableHead>
                  {showPoolColumn ? (
                    <TableHead className="text-right">Commission pool</TableHead>
                  ) : null}
                  <TableHead className="text-right">{partyCommissionLabel}</TableHead>
                  {showViewerCommission ? (
                    <TableHead className="text-right">
                      {viewerCommissionLabel}
                    </TableHead>
                  ) : null}
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.organizationId}>
                    <TableCell>
                      <div className="font-semibold text-slate-900">
                        {row.name}
                      </div>
                      {row.code ? (
                        <div className="text-xs text-slate-400">{row.code}</div>
                      ) : null}
                    </TableCell>
                    {showParentColumn ? (
                      <TableCell className="text-slate-600">
                        {row.parentName || '—'}
                      </TableCell>
                    ) : null}
                    {showRetailerCount ? (
                      <TableCell className="text-right tabular-nums">
                        {row.retailerCount ?? 0}
                      </TableCell>
                    ) : null}
                    <TableCell className="text-right tabular-nums">
                      {row.transactionCount}
                    </TableCell>
                    <TableCell className="text-right tabular-nums font-medium">
                      {formatCurrency(row.customerPayment)}
                    </TableCell>
                    {showPoolColumn ? (
                      <TableCell className="text-right tabular-nums">
                        {formatCurrency(row.distributable)}
                      </TableCell>
                    ) : null}
                    <TableCell className="text-right tabular-nums">
                      {formatCurrency(row.creditedRevenue)}
                    </TableCell>
                    {showViewerCommission ? (
                      <TableCell className="text-right tabular-nums font-medium text-emerald-700">
                        {formatCurrency(row.viewerCommission)}
                      </TableCell>
                    ) : null}
                    <TableCell>
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="text-blue-600 hover:bg-blue-50 hover:text-blue-700"
                          onClick={() => onView?.(row)}
                          aria-label={`View ${row.name}`}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                          onClick={() => onExport?.(row)}
                          disabled={row.transactionCount === 0}
                          aria-label={`Export ${row.name}`}
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                <TableRow className="bg-muted/30 font-medium hover:bg-muted/30">
                  <TableCell>Total</TableCell>
                  {showParentColumn ? <TableCell /> : null}
                  {showRetailerCount ? (
                    <TableCell className="text-right tabular-nums">
                      {totals.retailerCount}
                    </TableCell>
                  ) : null}
                  <TableCell className="text-right tabular-nums">
                    {totals.transactionCount}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatCurrency(totals.customerPayment)}
                  </TableCell>
                  {showPoolColumn ? (
                    <TableCell className="text-right tabular-nums">
                      {formatCurrency(totals.distributable)}
                    </TableCell>
                  ) : null}
                  <TableCell className="text-right tabular-nums">
                    {formatCurrency(totals.creditedRevenue)}
                  </TableCell>
                  {showViewerCommission ? (
                    <TableCell className="text-right tabular-nums text-emerald-700">
                      {formatCurrency(totals.viewerCommission)}
                    </TableCell>
                  ) : null}
                  <TableCell />
                </TableRow>
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function DownlineCreditStatement({
  options = [],
  selectedId,
  onSelect,
  ledger,
  selectedName,
  periodLabel,
  onExport,
  onViewTransaction,
}) {
  const movements = [...(ledger?.movements || [])]
    .reverse()
    .filter(
      (entry) =>
        entry.source !== 'opening' && entry.source !== 'period_opening',
    )

  return (
    <Card className="mb-4 overflow-hidden shadow-sm">
      <CardHeader className="border-b border-border px-4 py-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0 flex-1 space-y-2">
            <CardTitle className="text-base font-semibold">
              Downline Credit Statement
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Select a downline, then review + / − movements like a bank
              statement · {periodLabel}
            </p>
            <div className="max-w-md space-y-1.5">
              <Label className="text-xs text-slate-500">Downline</Label>
              <Select
                value={selectedId || undefined}
                onValueChange={onSelect}
                disabled={options.length === 0}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a franchisee or retailer" />
                </SelectTrigger>
                <SelectContent>
                  {options.map((option) => (
                    <SelectItem key={option.id} value={option.id}>
                      {option.group === 'Retailers' ? 'Retailer' : 'Franchisee'}
                      {' · '}
                      {option.name}
                      {option.code ? ` (${option.code})` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <Button
            type="button"
            variant="outline"
            disabled={!selectedId || !ledger}
            onClick={onExport}
          >
            <Download className="h-4 w-4" />
            Download
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {!selectedId ? (
          <div className="px-4 py-12 text-center text-sm text-muted-foreground">
            Select a downline to see their credit movements.
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between border-b border-border bg-slate-50 px-4 py-3">
              <div>
                <p className="text-sm font-semibold text-slate-900">
                  {selectedName}
                </p>
                <p className="text-xs text-muted-foreground">Opening balance</p>
              </div>
              <p className="text-base font-semibold tabular-nums text-slate-900">
                {formatCurrency(ledger?.openingBalance ?? 0)}
              </p>
            </div>
            {movements.length === 0 ? (
              <div className="px-4 py-12 text-center text-sm text-muted-foreground">
                No + / − movements for this downline in the selected period.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50 hover:bg-muted/50">
                      <TableHead>Date</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {movements.map((entry) => (
                      <TableRow
                        key={entry.id}
                        className={
                          entry.transaction ? 'cursor-pointer' : undefined
                        }
                        onClick={() => {
                          if (entry.transaction) {
                            onViewTransaction?.(entry.transaction)
                          }
                        }}
                      >
                        <TableCell className="whitespace-nowrap">
                          <DateTimeCell value={entry.createdAt} />
                        </TableCell>
                        <TableCell>
                          <div className="text-sm font-medium text-slate-900">
                            {entry.typeLabel}
                          </div>
                          <div className="text-xs text-slate-500">
                            {entry.details}
                          </div>
                          {entry.counterpartyName ? (
                            <div className="mt-0.5 text-[11px] text-slate-400">
                              {entry.counterpartyName}
                            </div>
                          ) : null}
                        </TableCell>
                        <TableCell
                          className={cn(
                            'text-right text-sm font-semibold tabular-nums',
                            entry.direction === 'debit'
                              ? 'text-red-600'
                              : 'text-emerald-600',
                          )}
                        >
                          {formatSignedCurrency(entry.amount, entry.direction)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
            <div className="flex items-center justify-between border-t border-border bg-slate-50 px-4 py-4">
              <p className="text-sm font-medium text-slate-600">Balance</p>
              <p className="text-xl font-bold tabular-nums text-slate-900">
                {formatCurrency(ledger?.closingBalance ?? 0)}
              </p>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}

function blankMoney(value) {
  if (value == null || value === '') return ''
  return formatCurrency(value)
}

function InternetRetailerBalanceReport({
  options,
  selectedId,
  onSelect,
  report,
  periodLabel,
  hidePicker,
  onExport,
  onViewTransaction,
}) {
  const rows = report?.rows || []
  const totals = report?.totals || {
    depositAmount: 0,
    debitSales: 0,
    closingBalance: 0,
  }
  const selected = options.find((option) => option.id === selectedId)
  const canExport = Boolean(selectedId && rows.length > 0)

  return (
    <Card className="mb-4 overflow-hidden shadow-sm">
      <CardHeader className="border-b border-border px-4 py-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0 flex-1 space-y-2">
            <CardTitle className="text-base font-semibold">
              Internet Retailer Balance Report
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Credits loaded versus credits consumed on sales, with running
              wallet balance · {periodLabel}. One retailer at a time.
            </p>
            {hidePicker ? (
              selected ? (
                <p className="text-sm font-medium text-slate-800">
                  {selected.name}
                  {selected.code ? ` (${selected.code})` : ''}
                </p>
              ) : null
            ) : (
              <div className="max-w-md space-y-1.5">
                <Label className="text-xs text-slate-500">Retailer</Label>
                <Select
                  value={selectedId || undefined}
                  onValueChange={onSelect}
                  disabled={options.length === 0}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a retailer" />
                  </SelectTrigger>
                  <SelectContent>
                    {options.map((option) => (
                      <SelectItem key={option.id} value={option.id}>
                        {option.name}
                        {option.code ? ` (${option.code})` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <Button
            type="button"
            variant="outline"
            disabled={!canExport}
            onClick={onExport}
          >
            <Download className="h-4 w-4" />
            Download
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {!selectedId ? (
          <div className="px-4 py-12 text-center text-sm text-muted-foreground">
            Select a retailer to see their credit balance report.
          </div>
        ) : rows.length === 0 ? (
          <div className="px-4 py-12 text-center text-sm text-muted-foreground">
            No credit loads or sales for this retailer in the selected period.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50 hover:bg-muted/50">
                  <TableHead rowSpan={2} className="align-bottom">
                    Date
                  </TableHead>
                  <TableHead rowSpan={2} className="align-bottom">
                    Franchisee
                  </TableHead>
                  <TableHead colSpan={2} className="text-center">
                    Particulars
                  </TableHead>
                  <TableHead colSpan={3} className="text-center">
                    Details
                  </TableHead>
                </TableRow>
                <TableRow className="bg-muted/50 hover:bg-muted/50">
                  <TableHead>Credited</TableHead>
                  <TableHead>Debit</TableHead>
                  <TableHead className="text-right">Deposit Amount</TableHead>
                  <TableHead className="text-right">Less: Debit Sales</TableHead>
                  <TableHead className="text-right">Wallet Balance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow
                    key={row.id}
                    className={row.transaction ? 'cursor-pointer' : undefined}
                    onClick={() => {
                      if (row.transaction) onViewTransaction?.(row.transaction)
                    }}
                  >
                    <TableCell className="whitespace-nowrap">
                      {row.dateLabel}
                    </TableCell>
                    <TableCell>{row.franchiseeName}</TableCell>
                    <TableCell>{row.credited}</TableCell>
                    <TableCell>{row.debit}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {blankMoney(row.depositAmount)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-red-600">
                      {blankMoney(row.debitSales)}
                    </TableCell>
                    <TableCell className="text-right font-semibold tabular-nums">
                      {formatCurrency(row.walletBalance)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell />
                  <TableCell className="font-semibold">Total</TableCell>
                  <TableCell />
                  <TableCell />
                  <TableCell className="text-right font-semibold tabular-nums">
                    {formatCurrency(totals.depositAmount)}
                  </TableCell>
                  <TableCell className="text-right font-semibold tabular-nums">
                    {formatCurrency(totals.debitSales)}
                  </TableCell>
                  <TableCell className="text-right font-semibold tabular-nums">
                    {formatCurrency(totals.closingBalance)}
                  </TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function NetworkPartyRevenueDialog({
  open,
  onOpenChange,
  selection,
  entries,
  periodLabel,
  showViewerCommission,
  viewerCommissionLabel = 'Your Commission',
  onExport,
}) {
  const party = selection?.row
  const partyLabel = selection?.entityLabel || 'Party'
  const partyCommissionLabel = `${partyLabel} Commission`
  const viewerTotal = sumRows(entries, 'viewerRevenue')
  const partyTotal = sumRows(entries, 'partyRevenue')

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] max-w-4xl flex-col gap-0 overflow-hidden p-0 sm:rounded-xl">
        <DialogHeader className="border-b border-border px-6 py-4 text-left">
          <DialogTitle>{party?.name || partyLabel} Commission</DialogTitle>
          <DialogDescription>
            {party?.code ? `${party.code} · ` : ''}
            {party?.parentName ? `${party.parentName} · ` : ''}
            Commission detail for {periodLabel}.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 overflow-y-auto px-6 py-4">
            <div
              className={cn(
                'grid gap-3',
                showViewerCommission ? 'sm:grid-cols-4' : 'sm:grid-cols-3',
              )}
            >
            <div className="rounded-lg border border-border px-3 py-2">
              <p className="text-xs text-muted-foreground">Transactions</p>
              <p className="mt-1 text-lg font-semibold tabular-nums">
                {party?.transactionCount ?? 0}
              </p>
            </div>
            <div className="rounded-lg border border-border px-3 py-2">
              <p className="text-xs text-muted-foreground">Sales Volume</p>
              <p className="mt-1 text-lg font-semibold tabular-nums">
                {formatCurrency(party?.customerPayment ?? 0)}
              </p>
            </div>
            <div className="rounded-lg border border-border px-3 py-2">
              <p className="text-xs text-muted-foreground">{partyCommissionLabel}</p>
              <p className="mt-1 text-lg font-semibold tabular-nums">
                {formatCurrency(party?.creditedRevenue ?? partyTotal)}
              </p>
            </div>
            {showViewerCommission ? (
              <div className="rounded-lg border border-border px-3 py-2">
                <p className="text-xs text-muted-foreground">
                  {viewerCommissionLabel}
                </p>
                <p className="mt-1 text-lg font-semibold tabular-nums text-emerald-700">
                  {formatCurrency(party?.viewerCommission ?? viewerTotal)}
                </p>
              </div>
            ) : null}
          </div>

          {entries.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
              No transactions for this {partyLabel.toLowerCase()} in the selected
              period.
            </div>
          ) : (
            <div className="overflow-hidden rounded-lg border border-border">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50 hover:bg-muted/50">
                      <TableHead>Reference</TableHead>
                      <TableHead>Date</TableHead>
                      {selection?.partyType === 'franchisee' ? (
                        <TableHead>Retailer</TableHead>
                      ) : null}
                      <TableHead className="text-right">Sales Volume</TableHead>
                      <TableHead className="text-right">{partyCommissionLabel}</TableHead>
                      {showViewerCommission ? (
                        <TableHead className="text-right">
                          {viewerCommissionLabel}
                        </TableHead>
                      ) : null}
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {entries.map((entry) => (
                      <TableRow key={entry.id}>
                        <TableCell className="font-medium text-slate-900">
                          {entry.reference}
                        </TableCell>
                        <TableCell>
                          <DateTimeCell value={entry.createdAt} />
                        </TableCell>
                        {selection?.partyType === 'franchisee' ? (
                          <TableCell>
                            <div className="font-medium text-slate-900">
                              {entry.retailerName || '—'}
                            </div>
                            {entry.retailerCode ? (
                              <div className="text-xs text-slate-400">
                                {entry.retailerCode}
                              </div>
                            ) : null}
                          </TableCell>
                        ) : null}
                        <TableCell className="text-right tabular-nums">
                          {formatCurrency(entry.customerPayment)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatCurrency(entry.partyRevenue)}
                        </TableCell>
                        {showViewerCommission ? (
                          <TableCell className="text-right tabular-nums font-medium text-emerald-700">
                            {formatCurrency(entry.viewerRevenue ?? 0)}
                          </TableCell>
                        ) : null}
                        <TableCell>
                          <TransactionStatusBadge status={entry.transactionStatus} />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="border-t border-border px-6 py-4 sm:justify-between">
          <p className="text-sm text-muted-foreground">
            {entries.length} transaction{entries.length === 1 ? '' : 's'}
          </p>
          <Button
            type="button"
            variant="outline"
            disabled={entries.length === 0}
            onClick={onExport}
          >
            <Download className="h-4 w-4" />
            Export CSV
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function CreditEarningsByDownlineTable({
  title,
  description,
  rows,
  emptyLabel,
}) {
  const totals = {
    cashIn: sumRows(rows, 'cashIn'),
    credits: sumRows(rows, 'credits'),
    earnings: sumRows(rows, 'earnings'),
  }

  return (
    <Card className="mb-4 overflow-hidden shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 border-b border-border px-4 py-3">
        <div>
          <CardTitle className="text-base font-semibold">{title}</CardTitle>
          {description ? (
            <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
          ) : null}
        </div>
        <p className="text-sm text-muted-foreground">
          {rows.length} downline{rows.length === 1 ? '' : 's'}
        </p>
      </CardHeader>
      <CardContent className="p-0">
        {rows.length === 0 ? (
          <div className="px-4 py-12 text-center text-sm text-muted-foreground">
            {emptyLabel}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50 hover:bg-muted/50">
                  <TableHead>Downline</TableHead>
                  <TableHead className="text-right">Cash in</TableHead>
                  <TableHead className="text-right">Credits</TableHead>
                  <TableHead className="text-right">Earnings</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>
                      <div className="font-semibold text-slate-900">{row.name}</div>
                      {row.code || row.releaseCount ? (
                        <div className="text-xs text-slate-400">
                          {[
                            row.code,
                            row.releaseCount
                              ? `${row.releaseCount} release${row.releaseCount === 1 ? '' : 's'}`
                              : null,
                          ]
                            .filter(Boolean)
                            .join(' · ')}
                        </div>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatCurrency(row.cashIn)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatCurrency(row.credits)}
                    </TableCell>
                    <TableCell
                      className={cn(
                        'text-right font-semibold tabular-nums',
                        (row.earnings ?? 0) >= 0
                          ? 'text-emerald-700'
                          : 'text-red-600',
                      )}
                    >
                      {formatCurrency(row.earnings)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell>Total</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatCurrency(totals.cashIn)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatCurrency(totals.credits)}
                  </TableCell>
                  <TableCell className="text-right font-semibold tabular-nums">
                    {formatCurrency(totals.earnings)}
                  </TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function RevenueSharingSubTable({ report, periodLabel }) {
  const groups = report?.groups || []
  const total = report?.grandTotal || {
    sales: 0,
    subShare: 0,
    franchiseeShare: 0,
    retailerShare: 0,
    totalRevenue: 0,
  }

  return (
    <Card className="overflow-hidden shadow-sm">
      <CardHeader className="border-b border-border px-4 py-3">
        <CardTitle className="text-base font-semibold">
          Revenue Sharing Sub-Franchisee
        </CardTitle>
        <p className="mt-0.5 text-sm text-muted-foreground">
          % of sales from each sale&apos;s Commission Settings · {periodLabel}.
          Total Revenue is Sub + Franchisee + Retailer (platform fee is separate).
        </p>
      </CardHeader>
      <CardContent className="p-0">
        {groups.length === 0 ? (
          <div className="px-4 py-12 text-center text-sm text-muted-foreground">
            No retailer sales in the selected period.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50 hover:bg-muted/50">
                  <TableHead>Date</TableHead>
                  <TableHead>Franchisee / Retailers</TableHead>
                  <TableHead className="text-right">Sales</TableHead>
                  <TableHead className="text-right">
                    Revenue Share Sub-Franchisee
                  </TableHead>
                  <TableHead className="text-right">
                    Revenue Share Franchisee
                  </TableHead>
                  <TableHead className="text-right">
                    Retailer Revenue Share
                  </TableHead>
                  <TableHead className="text-right">Total Revenue</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {groups.map((group) => (
                  <Fragment key={group.franchiseeId}>
                    <TableRow className="bg-slate-50 hover:bg-slate-50">
                      <TableCell />
                      <TableCell className="font-semibold">
                        {group.franchiseeName} (Franchisee)
                      </TableCell>
                      <TableCell />
                      <TableCell />
                      <TableCell />
                      <TableCell />
                      <TableCell />
                    </TableRow>
                    {group.retailers.map((row) => (
                      <TableRow key={row.retailerId}>
                        <TableCell className="whitespace-nowrap">
                          {formatDateLong(row.date)}
                        </TableCell>
                        <TableCell>{row.retailerName}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatCurrency(row.sales)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatCurrency(row.subShare)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatCurrency(row.franchiseeShare)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatCurrency(row.retailerShare)}
                        </TableCell>
                        <TableCell className="text-right font-medium tabular-nums">
                          {formatCurrency(row.totalRevenue)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </Fragment>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell />
                  <TableCell className="font-semibold">Total</TableCell>
                  <TableCell className="text-right font-semibold tabular-nums">
                    {formatCurrency(total.sales)}
                  </TableCell>
                  <TableCell className="text-right font-semibold tabular-nums">
                    {formatCurrency(total.subShare)}
                  </TableCell>
                  <TableCell className="text-right font-semibold tabular-nums">
                    {formatCurrency(total.franchiseeShare)}
                  </TableCell>
                  <TableCell className="text-right font-semibold tabular-nums">
                    {formatCurrency(total.retailerShare)}
                  </TableCell>
                  <TableCell className="text-right font-semibold tabular-nums">
                    {formatCurrency(total.totalRevenue)}
                  </TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export default function ReportsPage() {
  const { user, dataVersion } = useAuth()
  const config = useMemo(
    () => getReportsPageConfig(user?.role),
    [user?.role],
  )
  const txConfig = useMemo(
    () => getTransactionsPageConfig(user?.role),
    [user?.role],
  )
  const organizations = useMemo(() => getOrganizations(), [dataVersion])
  const networkOptions = useMemo(
    () => getNetworkFilterOptions(organizations, user?.organizationId),
    [organizations, user?.organizationId],
  )

  const [dateRange, setDateRange] = useState(config.defaultDateRange || 'all')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const [franchiseeId, setFranchiseeId] = useState('all')
  const [retailerId, setRetailerId] = useState('all')
  const [appliedFilters, setAppliedFilters] = useState({
    dateRange: config.defaultDateRange || 'all',
    customFrom: '',
    customTo: '',
    franchiseeId: 'all',
    retailerId: 'all',
  })
  const [page, setPage] = useState(0)
  const [selectedTx, setSelectedTx] = useState(null)
  const [selectedParty, setSelectedParty] = useState(null)
  const [selectedDownlineId, setSelectedDownlineId] = useState('')
  const [selectedBalanceRetailerId, setSelectedBalanceRetailerId] = useState('')

  useEffect(() => {
    const nextRange = config.defaultDateRange || 'all'
    setDateRange(nextRange)
    setCustomFrom('')
    setCustomTo('')
    setFranchiseeId('all')
    setRetailerId('all')
    setAppliedFilters({
      dateRange: nextRange,
      customFrom: '',
      customTo: '',
      franchiseeId: 'all',
      retailerId: 'all',
    })
    setPage(0)
    setSelectedParty(null)
    setSelectedDownlineId('')
    setSelectedBalanceRetailerId('')
  }, [user?.role, config.defaultDateRange])

  const retailerOptions = useMemo(() => {
    if (config.showRetailerFilter) return networkOptions.allRetailers
    if (franchiseeId === 'all') return networkOptions.allRetailers
    return networkOptions.retailersByFranchisee[franchiseeId] || []
  }, [config.showRetailerFilter, franchiseeId, networkOptions])

  const customDateInvalid =
    dateRange === 'custom' &&
    Boolean(customFrom && customTo && new Date(customFrom) > new Date(customTo))

  const customDateIncomplete =
    dateRange === 'custom' && (!customFrom || !customTo)

  useEffect(() => {
    if (customDateIncomplete || customDateInvalid) return

    setAppliedFilters({
      dateRange,
      customFrom,
      customTo,
      franchiseeId: config.showNetworkFilters ? franchiseeId : 'all',
      retailerId:
        config.showNetworkFilters || config.showRetailerFilter
          ? retailerId
          : 'all',
    })
    setPage(0)
  }, [
    dateRange,
    customFrom,
    customTo,
    franchiseeId,
    retailerId,
    customDateIncomplete,
    customDateInvalid,
    config.showNetworkFilters,
    config.showRetailerFilter,
  ])

  const periodLabel = useMemo(
    () =>
      formatReportPeriodLabel(appliedFilters.dateRange, {
        from: appliedFilters.customFrom,
        to: appliedFilters.customTo,
      }),
    [appliedFilters],
  )

  const snapshot = useMemo(() => {
    return buildReportSnapshot({
      role: user?.role,
      organizationId: user?.organizationId,
      dateRange: appliedFilters.dateRange,
      customDateRange: {
        from: appliedFilters.customFrom,
        to: appliedFilters.customTo,
      },
      franchiseeId: appliedFilters.franchiseeId,
      retailerId: appliedFilters.retailerId,
      organizations,
      transactions: getTransactions(),
      fundingRequests: getFundingRequests(),
      fundingTransfers: getFundingTransfers(),
      wallets: getWallets(),
      revenueSharing: getRevenueSharing(),
    })
  }, [
    user?.role,
    user?.organizationId,
    appliedFilters,
    organizations,
    dataVersion,
  ])

  const creditRevenue = useMemo(
    () =>
      buildCreditRevenueSnapshot({
        role: user?.role,
        organizationId: user?.organizationId,
        organizations,
        fundingRequests: getFundingRequests(),
        transactions: getTransactions(),
        dateRange: appliedFilters.dateRange,
        customDateRange: {
          from: appliedFilters.customFrom,
          to: appliedFilters.customTo,
        },
      }),
    [
      user?.role,
      user?.organizationId,
      organizations,
      appliedFilters,
      dataVersion,
    ],
  )

  const {
    kpis,
    datasets,
    orgById,
    franchiseeRevenueRows = [],
    retailerRevenueRows = [],
    networkEarnings,
  } = snapshot
  const earningsPrimary = networkEarnings?.yourCommission ?? 0
  const creditEarnings = creditRevenue.kpis?.primaryValue ?? 0
  const showCreditEarningsCard = user?.role !== ROLES.RETAILER
  const combinedEarnings =
    Math.round((creditEarnings + earningsPrimary + Number.EPSILON) * 100) / 100
  const isAdmin = user?.role === ROLES.ADMIN
  const franchiseView = useMemo(() => {
    if (!isAdmin) return null
    void dataVersion
    return loadFranchiseCollectionView({
      dateRange: appliedFilters.dateRange,
      customDateRange: {
        from: appliedFilters.customFrom,
        to: appliedFilters.customTo,
      },
    })
  }, [appliedFilters, dataVersion, isAdmin])
  const revenueShareReport = useMemo(() => {
    if (!config.showRevenueShareTable) return null
    void dataVersion
    return buildSubFranchiseeRevenueShareReport({
      transactions: datasets.transactions,
      organizations,
      revenueSharing: getRevenueSharing(),
    })
  }, [
    config.showRevenueShareTable,
    dataVersion,
    datasets.transactions,
    organizations,
  ])
  const roleSlug = user?.role || 'export'
  const showViewerCommission = Boolean(config.showViewerCommissionColumn)
  const revenueCreditsHref = buildRevenuePageHref({
    dateRange: appliedFilters.dateRange,
    customFrom: appliedFilters.customFrom,
    customTo: appliedFilters.customTo,
  })
  const creditDownlineRows = useMemo(() => {
    if (!showCreditEarningsCard) return []
    return rollupCreditEarningsByDownline(creditRevenue.entries || []).map(
      (row) => ({
        ...row,
        code: orgById[row.id]?.code || '',
      }),
    )
  }, [showCreditEarningsCard, creditRevenue.entries, orgById])

  const detailedTransactions = useMemo(
    () => sortTransactionsNewest(datasets.transactions),
    [datasets.transactions],
  )

  const creditLedgerParties = useMemo(() => {
    if (user?.role === ROLES.RETAILER) {
      const self = organizations.find((org) => org.id === user?.organizationId)
      return { franchisees: [], retailers: self ? [self] : [] }
    }
    return getNetworkRevenueParties({
      role: user?.role,
      organizationId: user?.organizationId,
      organizations,
      franchiseeId: appliedFilters.franchiseeId,
      retailerId: appliedFilters.retailerId,
    })
  }, [
    user?.role,
    user?.organizationId,
    organizations,
    appliedFilters.franchiseeId,
    appliedFilters.retailerId,
  ])

  const downlineOptions = useMemo(() => {
    const franchisees = (creditLedgerParties.franchisees || []).map((org) => ({
      id: org.id,
      name: org.name,
      code: org.code || '',
      group: 'Franchisees',
    }))
    const retailers = (creditLedgerParties.retailers || []).map((org) => ({
      id: org.id,
      name: org.name,
      code: org.code || '',
      group: 'Retailers',
    }))
    return [...franchisees, ...retailers]
  }, [creditLedgerParties])

  useEffect(() => {
    const ids = new Set(downlineOptions.map((option) => option.id))
    if (selectedDownlineId && ids.has(selectedDownlineId)) return
    setSelectedDownlineId(
      downlineOptions.length === 1 ? downlineOptions[0].id : '',
    )
  }, [downlineOptions, selectedDownlineId])

  const retailerBalanceOptions = useMemo(
    () =>
      (creditLedgerParties.retailers || []).map((org) => ({
        id: org.id,
        name: org.name,
        code: org.code || '',
      })),
    [creditLedgerParties],
  )

  useEffect(() => {
    const ids = new Set(retailerBalanceOptions.map((option) => option.id))
    if (selectedBalanceRetailerId && ids.has(selectedBalanceRetailerId)) return
    const filteredId = appliedFilters.retailerId
    if (filteredId && filteredId !== 'all' && ids.has(filteredId)) {
      setSelectedBalanceRetailerId(filteredId)
      return
    }
    setSelectedBalanceRetailerId(
      retailerBalanceOptions.length === 1 ? retailerBalanceOptions[0].id : '',
    )
  }, [
    retailerBalanceOptions,
    selectedBalanceRetailerId,
    appliedFilters.retailerId,
  ])

  const selectedDownline = useMemo(
    () => downlineOptions.find((option) => option.id === selectedDownlineId) || null,
    [downlineOptions, selectedDownlineId],
  )

  const selectedDownlineLedger = useMemo(() => {
    if (!selectedDownlineId) return null
    const wallets = getWallets()
    return buildCreditLedger({
      organizationId: selectedDownlineId,
      organizations,
      transfers: getFundingTransfers(),
      transactions: getTransactions(),
      wallet: getOperatingWallet(wallets, selectedDownlineId),
      dateRange: appliedFilters.dateRange,
      customDateRange: {
        from: appliedFilters.customFrom,
        to: appliedFilters.customTo,
      },
    })
  }, [
    selectedDownlineId,
    organizations,
    appliedFilters,
    dataVersion,
  ])

  const selectedBalanceRetailer = useMemo(
    () =>
      organizations.find((org) => org.id === selectedBalanceRetailerId) || null,
    [organizations, selectedBalanceRetailerId],
  )

  const selectedBalanceLedger = useMemo(() => {
    if (!selectedBalanceRetailerId) return null
    const wallets = getWallets()
    return buildCreditLedger({
      organizationId: selectedBalanceRetailerId,
      organizations,
      transfers: getFundingTransfers(),
      transactions: getTransactions(),
      wallet: getOperatingWallet(wallets, selectedBalanceRetailerId),
      dateRange: appliedFilters.dateRange,
      customDateRange: {
        from: appliedFilters.customFrom,
        to: appliedFilters.customTo,
      },
    })
  }, [selectedBalanceRetailerId, organizations, appliedFilters, dataVersion])

  const retailerBalanceReport = useMemo(
    () =>
      buildInternetRetailerBalanceReport({
        retailer: selectedBalanceRetailer,
        organizations,
        ledger: selectedBalanceLedger,
      }),
    [selectedBalanceRetailer, organizations, selectedBalanceLedger],
  )

  const {
    page: currentPage,
    items: paged,
  } = paginateItems(detailedTransactions, page, DEFAULT_PAGE_SIZE)

  const selectedPartyEntries = useMemo(() => {
    if (!selectedParty) return []
    return buildPartyRevenueDetailEntries({
      transactions: datasets.transactions,
      revenueSharing: getRevenueSharing(),
      partyRole: selectedParty.partyRole,
      organizationId: selectedParty.row.organizationId,
      partyType: selectedParty.partyType,
      viewerRole: showViewerCommission ? user?.role : null,
    })
  }, [
    selectedParty,
    datasets.transactions,
    dataVersion,
    showViewerCommission,
    user?.role,
  ])

  const exportPartyRevenue = (selection, entries) => {
    if (!selection) return
    const slug = selection.row.code || selection.row.organizationId || 'party'
    downloadCsv(
      `esarisari-${selection.partyType}-revenue-${slug}.csv`,
      partyRevenueDetailEntriesToCsv(entries, {
        partyLabel: selection.entityLabel,
        includeViewerCommission: showViewerCommission,
        viewerLabel: config.viewerCommissionLabel || 'Your Commission',
      }),
    )
  }

  const handleViewParty = (row, partyType) => {
    setSelectedParty({
      row,
      partyType,
      partyRole:
        partyType === 'franchisee' ? ROLES.FRANCHISEE : ROLES.RETAILER,
      entityLabel: partyType === 'franchisee' ? 'Franchisee' : 'Retailer',
    })
  }

  const handleExportParty = (row, partyType) => {
    const selection = {
      row,
      partyType,
      partyRole:
        partyType === 'franchisee' ? ROLES.FRANCHISEE : ROLES.RETAILER,
      entityLabel: partyType === 'franchisee' ? 'Franchisee' : 'Retailer',
    }
    const entries = buildPartyRevenueDetailEntries({
      transactions: datasets.transactions,
      revenueSharing: getRevenueSharing(),
      partyRole: selection.partyRole,
      organizationId: row.organizationId,
      partyType,
      viewerRole: showViewerCommission ? user?.role : null,
    })
    exportPartyRevenue(selection, entries)
  }

  const exportSelectedDownlineStatement = () => {
    if (!selectedDownline || !selectedDownlineLedger) return
    const slug = selectedDownline.code || selectedDownline.id || 'downline'
    downloadCsv(
      `esarisari-credit-statement-${slug}.csv`,
      creditLedgerToCsv(selectedDownlineLedger),
    )
  }

  const exportRetailerBalanceReport = () => {
    if (!selectedBalanceRetailer || !retailerBalanceReport?.rows?.length) return
    const slug =
      selectedBalanceRetailer.code || selectedBalanceRetailer.id || 'retailer'
    downloadCsv(
      `esarisari-internet-retailer-balance-${slug}.csv`,
      internetRetailerBalanceReportToCsv(retailerBalanceReport),
    )
  }

  const handleFranchiseeChange = (value) => {
    setFranchiseeId(value)
    setRetailerId('all')
  }

  const filterGridClass = config.showNetworkFilters
    ? 'lg:grid-cols-3'
    : config.showRetailerFilter
      ? 'sm:grid-cols-2'
      : 'sm:grid-cols-1'

  return (
    <div>
      <PageHeader
        title="Reports"
        description={config.subtitle}
        breadcrumbs={[
          { label: 'Home', href: getHomePathForRole(user?.role) },
          { label: 'Reports' },
        ]}
      />

      <Card className="mb-4 shadow-sm">
        <CardContent className={cn('grid gap-3 p-4', filterGridClass)}>
          <div className="space-y-2">
            <Label className="text-xs text-slate-500">Date Range</Label>
            <Select value={dateRange} onValueChange={setDateRange}>
              <SelectTrigger>
                <SelectValue placeholder="Select range" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="this_month">This Month</SelectItem>
                <SelectItem value="7d">Last 7 Days</SelectItem>
                <SelectItem value="30d">Last 30 Days</SelectItem>
                <SelectItem value="3m">Last 3 Months</SelectItem>
                <SelectItem value="6m">Last 6 Months</SelectItem>
                <SelectItem value="this_year">This Year</SelectItem>
                <SelectItem value="last_year">Last Year</SelectItem>
                <SelectItem value="all">All Time</SelectItem>
                {config.showCustomDateRange ? (
                  <SelectItem value="custom">Custom Range</SelectItem>
                ) : null}
              </SelectContent>
            </Select>
          </div>

          {config.showNetworkFilters ? (
            <>
              <div className="space-y-2">
                <Label className="text-xs text-slate-500">Franchisee</Label>
                <Select value={franchiseeId} onValueChange={handleFranchiseeChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Franchisees" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Franchisees</SelectItem>
                    {networkOptions.franchisees.map((org) => (
                      <SelectItem key={org.id} value={org.id}>
                        {org.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-xs text-slate-500">Retailer</Label>
                <Select value={retailerId} onValueChange={setRetailerId}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Retailers" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Retailers</SelectItem>
                    {retailerOptions.map((org) => (
                      <SelectItem key={org.id} value={org.id}>
                        {org.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </>
          ) : null}

          {config.showRetailerFilter ? (
            <div className="space-y-2">
              <Label className="text-xs text-slate-500">Retailer</Label>
              <Select value={retailerId} onValueChange={setRetailerId}>
                <SelectTrigger>
                  <SelectValue placeholder="All Retailers" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Retailers</SelectItem>
                  {retailerOptions.map((org) => (
                    <SelectItem key={org.id} value={org.id}>
                      {org.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}

          {config.showCustomDateRange && dateRange === 'custom' ? (
            <div
              className={cn(
                'grid gap-3 sm:grid-cols-2',
                config.showNetworkFilters
                  ? 'lg:col-span-3'
                  : config.showRetailerFilter
                    ? 'sm:col-span-2'
                    : 'sm:col-span-1',
              )}
            >
              <div className="space-y-2">
                <Label className="text-xs text-slate-500" htmlFor="report-from">
                  From
                </Label>
                <Input
                  id="report-from"
                  type="date"
                  value={customFrom}
                  onChange={(event) => setCustomFrom(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-slate-500" htmlFor="report-to">
                  To
                </Label>
                <Input
                  id="report-to"
                  type="date"
                  value={customTo}
                  onChange={(event) => setCustomTo(event.target.value)}
                />
              </div>
              {customDateInvalid ? (
                <p className="text-sm text-red-600 sm:col-span-2">
                  From date must be on or before To date.
                </p>
              ) : null}
            </div>
          ) : null}
        </CardContent>
      </Card>

      {config.showNetworkEarningsHero ? (
        <div
          className={cn(
            'mb-4 grid gap-4 sm:grid-cols-2',
            showCreditEarningsCard ? 'xl:grid-cols-4' : 'xl:grid-cols-2',
          )}
        >
          {showCreditEarningsCard ? (
            <StatCard
              title={config.creditEarningsLabel || 'Internet Credits earnings'}
              value={formatCurrency(creditEarnings)}
              description={`For ${periodLabel} · View line items on Revenue`}
              descriptionBelowTitle
              icon={Coins}
              to={revenueCreditsHref}
              toLabel="View Internet Credits line items on Revenue"
            />
          ) : null}
          <StatCard
            title={config.yourCommissionLabel || 'Sales Commission'}
            value={formatCurrency(earningsPrimary)}
            description={`For ${periodLabel} · from sale distribution %`}
            descriptionBelowTitle
            icon={Banknote}
            accent="success"
          />
          {showCreditEarningsCard ? (
            <StatCard
              title="Total earnings"
              value={formatCurrency(combinedEarnings)}
              description={`Internet Credits + sales · ${periodLabel}`}
              descriptionBelowTitle
              icon={Coins}
            />
          ) : null}
          <StatCard
            title="Sales Volume"
            value={formatCurrency(networkEarnings?.salesVolume ?? kpis.customerPaymentTotal)}
            description={`${kpis.completedTxCount} transactions · ${periodLabel}`}
            descriptionBelowTitle
            icon={Receipt}
          />
        </div>
      ) : (
        <div className="mb-4 grid gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <div>
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Transaction Activity
                </CardTitle>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  {kpis.completedTxCount} completed · {periodLabel}
                </p>
              </div>
              <Receipt className="h-4 w-4 shrink-0 text-foreground" />
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 divide-x divide-border">
                <div className="pr-3">
                  <p className="truncate text-xs text-muted-foreground">Count</p>
                  <p className="mt-1 truncate text-lg font-semibold tabular-nums text-foreground">
                    {kpis.transactionCount}
                  </p>
                </div>
                <div className="px-3">
                  <p className="truncate text-xs text-muted-foreground">
                    Sales Volume
                  </p>
                  <p className="mt-1 truncate text-lg font-semibold tabular-nums text-success">
                    {formatCurrency(kpis.customerPaymentTotal)}
                  </p>
                </div>
                <div className="pl-3">
                  <p className="truncate text-xs text-muted-foreground">
                    Credits Consumed
                  </p>
                  <p className="mt-1 truncate text-lg font-semibold tabular-nums text-success">
                    {formatCurrency(
                      datasets.transactions.reduce(
                        (sum, tx) => sum + (Number(tx.walletDeduction) || 0),
                        0,
                      ),
                    )}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          <StatCard
            title={config.yourCommissionLabel || 'Earnings'}
            value={formatCurrency(earningsPrimary)}
            description={`For ${periodLabel}`}
            descriptionBelowTitle
            icon={Banknote}
            accent="success"
          />
        </div>
      )}

      {isAdmin ? (
        <>
          <div className="mb-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              title="Franchise collections"
              value={formatCurrency(franchiseView?.kpis.collected || 0)}
              description={`Setup + billable monthly · pending ${formatCurrency(franchiseView?.kpis.remaining || 0)} · ${periodLabel}`}
              descriptionBelowTitle
              icon={CreditCard}
              accent="wallet"
            />
          </div>
          <FranchiseCollectionsPanel
            className="mb-4"
            dateRange={appliedFilters.dateRange}
            customDateRange={{
              from: appliedFilters.customFrom,
              to: appliedFilters.customTo,
            }}
            showRollup
          />
        </>
      ) : null}

      {showCreditEarningsCard ? (
        <CreditEarningsByDownlineTable
          title="Internet Credits by downline"
          description={`Cash in, credits released, and deposit-rate earnings by downline · ${periodLabel}. Line items are on Revenue.`}
          rows={creditDownlineRows}
          emptyLabel="No Internet Credits earnings for the selected period."
        />
      ) : null}

      {retailerBalanceOptions.length > 0 ? (
        <InternetRetailerBalanceReport
          options={retailerBalanceOptions}
          selectedId={selectedBalanceRetailerId}
          onSelect={setSelectedBalanceRetailerId}
          report={retailerBalanceReport}
          periodLabel={periodLabel}
          hidePicker={user?.role === ROLES.RETAILER}
          onExport={exportRetailerBalanceReport}
          onViewTransaction={(tx) => setSelectedTx(tx)}
        />
      ) : null}

      {downlineOptions.length > 0 ? (
        <DownlineCreditStatement
          options={downlineOptions}
          selectedId={selectedDownlineId}
          onSelect={setSelectedDownlineId}
          ledger={selectedDownlineLedger}
          selectedName={
            selectedDownline
              ? `${selectedDownline.name}${
                  selectedDownline.code ? ` (${selectedDownline.code})` : ''
                }`
              : ''
          }
          periodLabel={periodLabel}
          onExport={exportSelectedDownlineStatement}
          onViewTransaction={(tx) => setSelectedTx(tx)}
        />
      ) : null}

      {config.showFranchiseeRevenueTable || config.showRetailerRevenueTable ? (
        <div className="mb-4 space-y-4">
          {config.showRevenueShareTable ? (
            <RevenueSharingSubTable
              report={revenueShareReport}
              periodLabel={periodLabel}
            />
          ) : null}
          {config.showFranchiseeRevenueTable ? (
            <NetworkRevenueTable
              title="Franchisee Commissions"
              description={`What each franchisee earned, and ${
                user?.role === ROLES.ADMIN ? 'platform' : 'your'
              } commission from their volume · ${periodLabel}.`}
              rows={franchiseeRevenueRows}
              emptyLabel="No franchisees in your network for the selected filters."
              entityLabel="Franchisee"
              showRetailerCount
              showViewerCommission={showViewerCommission}
              partyCommissionLabel="Their Commission"
              viewerCommissionLabel={
                config.viewerCommissionLabel || 'Your Commission'
              }
              onView={(row) => handleViewParty(row, 'franchisee')}
              onExport={(row) => handleExportParty(row, 'franchisee')}
            />
          ) : null}
          {config.showRetailerRevenueTable ? (
            <NetworkRevenueTable
              title="Retailer Commissions"
              description={`What each retailer earned, and ${
                user?.role === ROLES.ADMIN ? 'platform' : 'your'
              } commission from their volume · ${periodLabel}.`}
              rows={retailerRevenueRows}
              emptyLabel="No retailers in your network for the selected filters."
              entityLabel="Retailer"
              showParentColumn={Boolean(config.showFranchiseeRevenueTable)}
              showViewerCommission={showViewerCommission}
              partyCommissionLabel="Their Commission"
              viewerCommissionLabel={
                config.viewerCommissionLabel || 'Your Commission'
              }
              onView={(row) => handleViewParty(row, 'retailer')}
              onExport={(row) => handleExportParty(row, 'retailer')}
            />
          ) : null}
        </div>
      ) : null}

      <Card className="mb-4 overflow-hidden shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 border-b border-border px-4 py-3">
          <CardTitle className="text-base font-semibold">
            Transactions
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            {detailedTransactions.length} in selected period
          </p>
        </CardHeader>
        <CardContent className="p-0">
          {paged.length === 0 ? (
            <div className="px-4 py-12 text-center text-sm text-muted-foreground">
              No transactions in the selected period.
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50 hover:bg-muted/50">
                      <TableHead>Reference</TableHead>
                      <TableHead>Date</TableHead>
                      {txConfig.showRetailerColumn ? (
                        <TableHead>Retailer</TableHead>
                      ) : null}
                      <TableHead>Customer Payment</TableHead>
                      <TableHead>Credits Consumed</TableHead>
                      {txConfig.showShareColumns ? (
                        <TableHead>
                          {txConfig.yourShareLabel || 'Your Share'}
                        </TableHead>
                      ) : null}
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paged.map((tx) => {
                      const retailer = orgById[tx.retailerOrganizationId] || null
                      const yourShare = getViewerShareAmountForRole(
                        tx,
                        user?.role,
                        getRevenueSharing(),
                      )
                      return (
                        <TableRow key={tx.id}>
                          <TableCell className="font-medium text-slate-900">
                            {tx.reference || tx.id}
                          </TableCell>
                          <TableCell>
                            <DateTimeCell value={tx.createdAt} />
                          </TableCell>
                          {txConfig.showRetailerColumn ? (
                            <TableCell>
                              <div className="font-semibold text-slate-900">
                                {tx.retailerName || retailer?.name || '—'}
                              </div>
                              <div className="text-xs text-slate-400">
                                {orgById[tx.franchiseeOrganizationId]?.name ||
                                  (retailer?.parentId
                                    ? orgById[retailer.parentId]?.name
                                    : null) ||
                                  '—'}
                              </div>
                            </TableCell>
                          ) : null}
                          <TableCell className="whitespace-nowrap font-medium">
                            {formatCurrency(tx.customerPayment)}
                          </TableCell>
                          <TableCell className="whitespace-nowrap">
                            <SignedAmount
                              amount={tx.walletDeduction}
                              direction="debit"
                            />
                          </TableCell>
                          {txConfig.showShareColumns ? (
                            <TableCell className="whitespace-nowrap">
                              <SignedAmount
                                amount={yourShare}
                                direction="credit"
                                showSign={false}
                              />
                            </TableCell>
                          ) : null}
                          <TableCell>
                            <TransactionStatusBadge status={tx.status} />
                          </TableCell>
                          <TableCell>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="text-blue-600 hover:bg-blue-50 hover:text-blue-700"
                              onClick={() => setSelectedTx(tx)}
                              aria-label={`View ${tx.reference || tx.id}`}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>

              <TablePagination
                page={currentPage}
                pageSize={DEFAULT_PAGE_SIZE}
                total={detailedTransactions.length}
                onPageChange={setPage}
              />
            </>
          )}
        </CardContent>
      </Card>

      <div className="mb-4">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
          Export Reports
        </h2>
        <div className="grid gap-4 md:grid-cols-2">
          <ExportCard
            title="Transactions"
            description="Sales volume, credits consumed, and your commission share for your scope."
            count={datasets.transactions.length}
            onExport={() =>
              downloadCsv(
                `esarisari-transactions-report-${roleSlug}.csv`,
                exportTransactionsCsv(datasets.transactions, orgById, {
                  revenueSharing: getRevenueSharing(),
                  role: user?.role,
                }),
              )
            }
          />
          {config.showRevenueShareTable ? (
            <ExportCard
              title="Revenue Sharing Sub-Franchisee"
              description="Sales and Sub / Franchisee / Retailer shares for the selected period (platform fee not included in Total Revenue)."
              count={(revenueShareReport?.groups || []).reduce(
                (sum, group) => sum + group.retailers.length,
                0,
              )}
              onExport={() =>
                downloadCsv(
                  `esarisari-revenue-sharing-subfranchisee-${roleSlug}.csv`,
                  subFranchiseeRevenueShareToCsv(revenueShareReport),
                )
              }
            />
          ) : null}
          <ExportCard
            title="Internet Retailer Balance Report"
            description="Credits loaded, credits consumed on sales, and running wallet balance for the selected retailer."
            count={retailerBalanceReport?.rows?.length || 0}
            disabled={!selectedBalanceRetailerId}
            onExport={exportRetailerBalanceReport}
          />
          {config.showRevenueExport ? (
            <ExportCard
              title="Sales Commission"
              description="Sales, your share %, and your commission per sale for the selected period."
              count={datasets.revenueEntries.length}
              onExport={() =>
                downloadCsv(
                  `esarisari-sales-commission-report-${roleSlug}.csv`,
                  revenueEntriesToCsv(datasets.revenueEntries),
                )
              }
            />
          ) : null}
          {isAdmin ? (
            <ExportCard
              title="Franchise collections"
              description="Upfront and billable monthly collected versus remaining for Activated clients."
              count={franchiseView?.entries.length || 0}
              onExport={() =>
                downloadCsv(
                  `esarisari-franchise-collections-report-${roleSlug}.csv`,
                  franchiseCollectionEntriesToCsv(franchiseView?.entries || []),
                )
              }
            />
          ) : null}
          {showCreditEarningsCard ? (
            <ExportCard
              title={config.creditEarningsLabel || 'Internet Credits earnings'}
              description="Cash in, credits released, and deposit-rate earnings when downlines bought credits from you."
              count={creditRevenue.entries?.length || 0}
              onExport={() =>
                downloadCsv(
                  `esarisari-internet-credits-earnings-report-${roleSlug}.csv`,
                  creditLoadEntriesToCsv(creditRevenue.entries || []),
                )
              }
            />
          ) : null}
          {config.showFundingExports ? (
            <>
              <ExportCard
                title="Internet Credits Requests"
                description="Deposit cash, suggested/released credits, rate, and payment refs."
                count={datasets.fundingRequests.length}
                onExport={() =>
                  downloadCsv(
                    `esarisari-internet-credits-requests-${roleSlug}.csv`,
                    fundingRequestsToCsv(datasets.fundingRequests, orgById),
                  )
                }
              />
              <ExportCard
                title="Internet Credits Releases"
                description="Credit release ledger with deposit, rate, and payment reference."
                count={datasets.transfers.length}
                onExport={() =>
                  downloadCsv(
                    `esarisari-internet-credits-releases-${roleSlug}.csv`,
                    fundingTransfersToCsv(datasets.transfers, orgById),
                  )
                }
              />
            </>
          ) : null}
        </div>
      </div>

      <NetworkPartyRevenueDialog
        open={Boolean(selectedParty)}
        onOpenChange={(open) => {
          if (!open) setSelectedParty(null)
        }}
        selection={selectedParty}
        entries={selectedPartyEntries}
        periodLabel={periodLabel}
        showViewerCommission={showViewerCommission}
        viewerCommissionLabel={
          config.viewerCommissionLabel || 'Your Commission'
        }
        onExport={() =>
          exportPartyRevenue(selectedParty, selectedPartyEntries)
        }
      />

      <TransactionDetailsDialog
        open={Boolean(selectedTx)}
        onOpenChange={(open) => {
          if (!open) setSelectedTx(null)
        }}
        transaction={selectedTx}
        organizations={organizations}
        role={user?.role}
      />
    </div>
  )
}
