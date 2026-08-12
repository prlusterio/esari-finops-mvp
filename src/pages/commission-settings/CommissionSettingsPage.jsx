import { useMemo, useState } from 'react'
import { Pencil, Plus } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import {
  COMMISSION_STATUS,
  COMMISSION_STATUS_LABELS,
  DEFAULT_PLATFORM_FEE_PERCENTAGE,
  enrichCommissionRows,
  filterCommissionRows,
  getNetworkRetailersForSubFranchisee,
  normalizeCommissionShares,
} from '@/lib/commission'
import { formatDateLong } from '@/lib/date'
import { DEFAULT_PAGE_SIZE, paginateItems } from '@/lib/pagination'
import { getHomePathForRole } from '@/lib/permissions'
import {
  getCommissionSettings,
  getOrganizations,
  saveCommissionSettings,
} from '@/services/storage'
import { CommissionConfigDialog } from '@/components/shared/CommissionConfigDialog'
import { PageHeader } from '@/components/shared/PageHeader'
import { TablePagination } from '@/components/shared/TablePagination'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
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
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { cn } from '@/lib/utils'

function StatusBadge({ status }) {
  const isActive = status === COMMISSION_STATUS.ACTIVE
  return (
    <Badge
      className={cn(
        'rounded-full border-transparent px-2.5 py-1 font-medium uppercase',
        isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500',
      )}
    >
      {COMMISSION_STATUS_LABELS[status] || status}
    </Badge>
  )
}

export default function CommissionSettingsPage() {
  const { user, dataVersion, bumpDataVersion } = useAuth()
  const organizations = useMemo(() => getOrganizations(), [dataVersion])
  const settings = useMemo(() => getCommissionSettings(), [dataVersion])

  const { franchisees, retailers } = useMemo(
    () =>
      getNetworkRetailersForSubFranchisee(
        organizations,
        user?.organizationId,
      ),
    [organizations, user?.organizationId],
  )

  const orgById = useMemo(
    () => Object.fromEntries(organizations.map((org) => [org.id, org])),
    [organizations],
  )

  const networkRetailerIds = useMemo(
    () => new Set(retailers.map((org) => org.id)),
    [retailers],
  )

  const [retailerId, setRetailerId] = useState('all')
  const [franchiseeId, setFranchiseeId] = useState('all')
  const [status, setStatus] = useState('all')
  const [applied, setApplied] = useState({
    retailerId: 'all',
    franchiseeId: 'all',
    status: 'all',
  })
  const [page, setPage] = useState(0)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState(null)

  const retailerOptions = useMemo(() => {
    const scoped =
      franchiseeId === 'all'
        ? retailers
        : retailers.filter((org) => org.parentId === franchiseeId)
    return [...scoped].sort((a, b) => a.name.localeCompare(b.name))
  }, [retailers, franchiseeId])

  const rows = useMemo(() => {
    const scoped = enrichCommissionRows(settings, organizations).filter((row) =>
      networkRetailerIds.has(row.retailerOrganizationId),
    )
    return filterCommissionRows(scoped, applied)
  }, [settings, organizations, networkRetailerIds, applied])

  const {
    page: currentPage,
    items: paged,
  } = paginateItems(rows, page, DEFAULT_PAGE_SIZE)

  const clearFilters = () => {
    setRetailerId('all')
    setFranchiseeId('all')
    setStatus('all')
    setApplied({ retailerId: 'all', franchiseeId: 'all', status: 'all' })
    setPage(0)
  }

  const applyFilters = () => {
    setApplied({ retailerId, franchiseeId, status })
    setPage(0)
  }

  const handleFranchiseeChange = (value) => {
    setFranchiseeId(value)
    if (retailerId !== 'all') {
      const stillValid = retailers.some(
        (org) =>
          org.id === retailerId &&
          (value === 'all' || org.parentId === value),
      )
      if (!stillValid) setRetailerId('all')
    }
  }

  const handleSave = (payload) => {
    const existing = getCommissionSettings()
    const now = new Date().toISOString()
    const entryId =
      payload.id || `comm-${payload.retailerOrganizationId}-${Date.now()}`

    const normalized = normalizeCommissionShares({
      retailerPercentage: payload.retailerPercentage,
      franchiseePercentage: payload.franchiseePercentage,
      companyPercentage: DEFAULT_PLATFORM_FEE_PERCENTAGE,
    })

    const savedEntry = {
      ...(payload.id
        ? existing.find((entry) => entry.id === payload.id) || {}
        : {}),
      ...payload,
      ...normalized,
      id: entryId,
      subfranchiseeOrganizationId: user.organizationId,
      createdAt:
        payload.id
          ? existing.find((entry) => entry.id === payload.id)?.createdAt || now
          : now,
      updatedAt: now,
    }

    let next = payload.id
      ? existing.map((entry) => (entry.id === payload.id ? savedEntry : entry))
      : [...existing, savedEntry]

    if (payload.status === COMMISSION_STATUS.ACTIVE) {
      next = next.map((entry) => {
        if (
          entry.retailerOrganizationId === payload.retailerOrganizationId &&
          entry.id !== entryId &&
          entry.status === COMMISSION_STATUS.ACTIVE
        ) {
          return {
            ...entry,
            status: COMMISSION_STATUS.INACTIVE,
            updatedAt: now,
          }
        }
        return entry
      })
    }

    saveCommissionSettings(next)
    bumpDataVersion()
  }

  return (
    <div>
      <PageHeader
        title="Commission Settings"
        description="Set retailer and franchisee commission shares for your downlines."
        breadcrumbs={[
          { label: 'Home', href: getHomePathForRole(user?.role) },
          { label: 'Commission Settings' },
        ]}
        actions={
          <Button
            type="button"
            className="bg-blue-600 text-white hover:bg-blue-700"
            onClick={() => {
              setEditing(null)
              setDialogOpen(true)
            }}
          >
            <Plus className="h-4 w-4" />
            Add Commission Settings
          </Button>
        }
      />

      <Card className="mb-4 shadow-sm">
        <CardContent className="grid gap-3 p-4 lg:grid-cols-[1fr_1fr_1fr_auto] lg:items-end">
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
          <div className="space-y-2">
            <Label className="text-xs text-slate-500">Franchisee</Label>
            <Select value={franchiseeId} onValueChange={handleFranchiseeChange}>
              <SelectTrigger>
                <SelectValue placeholder="All Franchisees" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Franchisees</SelectItem>
                {franchisees.map((org) => (
                  <SelectItem key={org.id} value={org.id}>
                    {org.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label className="text-xs text-slate-500">Status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger>
                <SelectValue placeholder="All Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value={COMMISSION_STATUS.ACTIVE}>Active</SelectItem>
                <SelectItem value={COMMISSION_STATUS.INACTIVE}>
                  Inactive
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={clearFilters}>
              Clear Filters
            </Button>
            <Button
              type="button"
              className="bg-blue-600 text-white hover:bg-blue-700"
              onClick={applyFilters}
            >
              Apply
            </Button>
          </div>
        </CardContent>
      </Card>

      <p className="mb-3 text-xs text-slate-500">
        Showing franchisees and retailers in your network.
      </p>

      <Card className="mb-4 overflow-hidden shadow-sm">
        <CardContent className="p-0">
          {paged.length === 0 ? (
            <div className="px-4 py-12 text-center text-sm text-muted-foreground">
              No commission settings found for your network.
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50 hover:bg-muted/50">
                      <TableHead>Retailer</TableHead>
                      <TableHead>Franchisee</TableHead>
                      <TableHead>Retailer %</TableHead>
                      <TableHead>Franchisee %</TableHead>
                      <TableHead>Your Share %</TableHead>
                      <TableHead>Platform Fee %</TableHead>
                      <TableHead>Total %</TableHead>
                      <TableHead>Effective Date</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paged.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell>
                          <div className="font-semibold text-slate-900">
                            {row.retailerName}
                          </div>
                          <div className="text-xs text-slate-400">
                            {row.retailerCode || row.retailerOrganizationId}
                          </div>
                        </TableCell>
                        <TableCell className="text-slate-700">
                          {row.franchiseeName}
                        </TableCell>
                        <TableCell>{row.retailerPercentage}%</TableCell>
                        <TableCell>{row.franchiseePercentage}%</TableCell>
                        <TableCell>{row.subfranchiseePercentage}%</TableCell>
                        <TableCell>{row.companyPercentage}%</TableCell>
                        <TableCell className="font-semibold">
                          {row.totalPercentage}%
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-slate-700">
                          {formatDateLong(row.effectiveDate)}
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={row.status} />
                        </TableCell>
                        <TableCell>
                          <div className="flex justify-end">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="text-blue-600 hover:bg-blue-50 hover:text-blue-700"
                              onClick={() => {
                                setEditing(row)
                                setDialogOpen(true)
                              }}
                              aria-label={`Edit ${row.retailerName}`}
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

      <CommissionConfigDialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open)
          if (!open) setEditing(null)
        }}
        retailers={retailers}
        orgById={orgById}
        initial={editing}
        onSave={handleSave}
      />
    </div>
  )
}
