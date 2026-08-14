import { useMemo, useState } from 'react'
import { Pencil } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import {
  buildDepositRateRows,
  getDepositRatesPageConfig,
  getHopDefaultRates,
  removeDepositRateOverride,
  upsertDepositRateOverride,
} from '@/lib/depositRates'
import { formatDateTimeShort } from '@/lib/date'
import { formatDepositRatePercent } from '@/lib/internetCredits'
import { DEFAULT_PAGE_SIZE, paginateItems } from '@/lib/pagination'
import { getHomePathForRole } from '@/lib/permissions'
import {
  getDepositRates,
  getOrganizations,
  saveDepositRates,
} from '@/services/storage'
import { DepositRateDialog } from '@/components/shared/DepositRateDialog'
import { PageHeader } from '@/components/shared/PageHeader'
import { TablePagination } from '@/components/shared/TablePagination'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { cn } from '@/lib/utils'

function SourceBadge({ source }) {
  const isCustom = source === 'custom'
  return (
    <Badge
      className={cn(
        'rounded-full border-transparent px-2.5 py-1 font-medium',
        isCustom ? 'bg-amber-50 text-amber-700' : 'bg-slate-100 text-slate-600',
      )}
    >
      {isCustom ? 'Custom' : 'Default'}
    </Badge>
  )
}

export default function DepositRatesPage() {
  const { user, dataVersion, bumpDataVersion } = useAuth()
  const pageConfig = getDepositRatesPageConfig(user?.role)

  const organizations = useMemo(() => getOrganizations(), [dataVersion])
  const rates = useMemo(() => getDepositRates(), [dataVersion])

  const rows = useMemo(
    () =>
      buildDepositRateRows({
        role: user?.role,
        organizationId: user?.organizationId,
        organizations,
        rates,
      }),
    [user?.role, user?.organizationId, organizations, rates],
  )

  const hopDefaults = useMemo(
    () => getHopDefaultRates(user?.role),
    [user?.role],
  )

  const [page, setPage] = useState(0)
  const [editingRow, setEditingRow] = useState(null)

  const {
    page: currentPage,
    items: paged,
  } = paginateItems(rows, page, DEFAULT_PAGE_SIZE)

  const handleSave = ({ organizationId, hop, depositRate, reason }) => {
    const row = rows.find((entry) => entry.organizationId === organizationId)
    const defaultRate = Number(row?.defaultRate)
    if (
      Number.isFinite(defaultRate) &&
      Math.abs(Number(depositRate) - defaultRate) < 0.0001
    ) {
      saveDepositRates(
        removeDepositRateOverride(
          getDepositRates(),
          organizationId,
          user.organizationId,
        ),
      )
      bumpDataVersion()
      return
    }

    const next = upsertDepositRateOverride(getDepositRates(), {
      organizationId,
      parentOrganizationId: user.organizationId,
      hop,
      depositRate,
      reason,
      updatedByUserId: user.id,
    })
    saveDepositRates(next)
    bumpDataVersion()
  }

  const handleReset = ({ organizationId }) => {
    const next = removeDepositRateOverride(
      getDepositRates(),
      organizationId,
      user.organizationId,
    )
    saveDepositRates(next)
    bumpDataVersion()
  }

  if (!pageConfig) {
    return (
      <div>
        <PageHeader
          title="Deposit Rates"
          description="Deposit rate configuration is not available for your role."
          breadcrumbs={[
            { label: 'Home', href: getHomePathForRole(user?.role) },
            { label: 'Deposit Rates' },
          ]}
        />
      </div>
    )
  }

  return (
    <div>
      <PageHeader
        title={pageConfig.title}
        description={pageConfig.description}
        breadcrumbs={[
          { label: 'Home', href: getHomePathForRole(user?.role) },
          { label: 'Deposit Rates' },
        ]}
      />

      {hopDefaults.length > 0 ? (
        <div
          className={cn(
            'mb-4 grid gap-4',
            hopDefaults.length >= 3
              ? 'sm:grid-cols-3'
              : hopDefaults.length === 2
                ? 'sm:grid-cols-2'
                : 'sm:grid-cols-1 max-w-sm',
          )}
        >
          {hopDefaults.map((entry) => (
            <Card key={entry.hop}>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {entry.label}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-semibold text-slate-900">
                  {formatDepositRatePercent(entry.depositRate)}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {user?.role === 'admin'
                    ? 'Platform hop default'
                    : 'Your sell-hop default'}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : null}

      <Card className="mb-4 overflow-hidden shadow-sm">
        <CardHeader className="border-b border-border px-4 py-3">
          <CardTitle className="text-base font-semibold">
            Your downlines
          </CardTitle>
          <p className="mt-1 text-xs text-muted-foreground">
            {pageConfig.hopLabel}
          </p>
        </CardHeader>
        <CardContent className="p-0">
          {paged.length === 0 ? (
            <div className="px-4 py-12 text-center text-sm text-muted-foreground">
              {pageConfig.emptyLabel}
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50 hover:bg-muted/50">
                      <TableHead>Downline</TableHead>
                      <TableHead>Type</TableHead>
                      {pageConfig.showHopColumn ? (
                        <TableHead>Hop</TableHead>
                      ) : null}
                      <TableHead>Deposit Rate</TableHead>
                      <TableHead>Source</TableHead>
                      <TableHead>Updated</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paged.map((row) => (
                      <TableRow key={row.organizationId}>
                        <TableCell>
                          <div className="font-semibold text-slate-900">
                            {row.ownerName}
                          </div>
                          {row.ownerCode ? (
                            <div className="text-xs text-slate-400">
                              {row.ownerCode}
                            </div>
                          ) : null}
                        </TableCell>
                        <TableCell className="text-sm text-slate-700">
                          {row.typeLabel}
                        </TableCell>
                        {pageConfig.showHopColumn ? (
                          <TableCell className="text-sm text-slate-600">
                            {row.hopLabel}
                          </TableCell>
                        ) : null}
                        <TableCell className="font-medium text-slate-900">
                          {formatDepositRatePercent(row.depositRate)}
                        </TableCell>
                        <TableCell>
                          <SourceBadge source={row.source} />
                        </TableCell>
                        <TableCell className="text-sm text-slate-600">
                          {row.updatedAt
                            ? formatDateTimeShort(row.updatedAt)
                            : '—'}
                        </TableCell>
                        <TableCell>
                          <div className="flex justify-end">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="text-blue-600 hover:bg-blue-50 hover:text-blue-700"
                              onClick={() => setEditingRow(row)}
                              aria-label={`Edit rate for ${row.ownerName}`}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <TablePagination
                page={currentPage}
                pageSize={DEFAULT_PAGE_SIZE}
                total={rows.length}
                onPageChange={setPage}
              />
            </>
          )}
        </CardContent>
      </Card>

      <DepositRateDialog
        open={Boolean(editingRow)}
        onOpenChange={(open) => {
          if (!open) setEditingRow(null)
        }}
        row={editingRow}
        onSave={handleSave}
        onReset={handleReset}
      />
    </div>
  )
}
