import { useMemo, useState } from 'react'
import { Pencil, Plus } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import {
  COMMISSION_STATUS,
  COMMISSION_STATUS_LABELS,
  DEFAULT_PLATFORM_FEE_PERCENTAGE,
  DIRECT_TO_ADMIN,
  enrichCommissionRows,
  filterCommissionRows,
  getCommissionNetworkScope,
  normalizeCommissionShares,
  resolveCommissionHierarchy,
} from '@/lib/commission'
import { formatDateLong } from '@/lib/date'
import { DEFAULT_PAGE_SIZE, paginateItems } from '@/lib/pagination'
import { getHomePathForRole } from '@/lib/permissions'
import { ROLES } from '@/lib/constants'
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

const EMPTY_APPLIED = {
  retailerId: 'all',
  franchiseeId: 'all',
  subfranchiseeId: 'all',
  status: 'all',
}

export default function CommissionSettingsPage() {
  const { user, dataVersion, bumpDataVersion } = useAuth()
  const isAdmin = user?.role === ROLES.ADMIN
  const organizations = useMemo(() => getOrganizations(), [dataVersion])
  const settings = useMemo(() => getCommissionSettings(), [dataVersion])

  const { subfranchisees, franchisees, retailers } = useMemo(
    () =>
      getCommissionNetworkScope({
        role: user?.role,
        organizationId: user?.organizationId,
        organizations,
      }),
    [organizations, user?.role, user?.organizationId],
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
  const [subfranchiseeId, setSubfranchiseeId] = useState('all')
  const [status, setStatus] = useState('all')
  const [applied, setApplied] = useState(EMPTY_APPLIED)
  const [page, setPage] = useState(0)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState(null)

  const franchiseeOptions = useMemo(() => {
    if (!isAdmin || subfranchiseeId === 'all') return franchisees
    if (subfranchiseeId === DIRECT_TO_ADMIN) {
      return franchisees.filter((org) => {
        const parent = orgById[org.parentId]
        return !parent || parent.type === 'platform'
      })
    }
    return franchisees.filter((org) => org.parentId === subfranchiseeId)
  }, [franchisees, isAdmin, subfranchiseeId, orgById])

  const retailerOptions = useMemo(() => {
    let scoped = retailers
    if (franchiseeId === DIRECT_TO_ADMIN) {
      scoped = scoped.filter((org) => {
        const parent = orgById[org.parentId]
        return parent?.type === 'platform'
      })
    } else if (franchiseeId !== 'all') {
      scoped = scoped.filter((org) => org.parentId === franchiseeId)
    } else if (isAdmin && subfranchiseeId === DIRECT_TO_ADMIN) {
      scoped = scoped.filter((org) => {
        const hierarchy = resolveCommissionHierarchy(org, orgById)
        return !hierarchy.hasSubfranchisee
      })
    } else if (isAdmin && subfranchiseeId !== 'all') {
      const franchiseeIds = new Set(
        franchisees
          .filter((org) => org.parentId === subfranchiseeId)
          .map((org) => org.id),
      )
      scoped = scoped.filter((org) => franchiseeIds.has(org.parentId))
    }
    return [...scoped].sort((a, b) => a.name.localeCompare(b.name))
  }, [
    retailers,
    franchisees,
    franchiseeId,
    isAdmin,
    subfranchiseeId,
    orgById,
  ])

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
    setSubfranchiseeId('all')
    setStatus('all')
    setApplied(EMPTY_APPLIED)
    setPage(0)
  }

  const applyFilters = () => {
    setApplied({ retailerId, franchiseeId, subfranchiseeId, status })
    setPage(0)
  }

  const resetRetailerIfInvalid = (nextFranchiseeId, nextSubfranchiseeId) => {
    if (retailerId === 'all') return
    const retailer = orgById[retailerId]
    if (!retailer) {
      setRetailerId('all')
      return
    }
    const hierarchy = resolveCommissionHierarchy(retailer, orgById)

    if (nextFranchiseeId === DIRECT_TO_ADMIN) {
      if (hierarchy.hasFranchisee) setRetailerId('all')
      return
    }
    if (
      nextFranchiseeId !== 'all' &&
      hierarchy.franchisee?.id !== nextFranchiseeId
    ) {
      setRetailerId('all')
      return
    }
    if (nextSubfranchiseeId === DIRECT_TO_ADMIN) {
      if (hierarchy.hasSubfranchisee) setRetailerId('all')
      return
    }
    if (
      isAdmin &&
      nextSubfranchiseeId !== 'all' &&
      hierarchy.subfranchisee?.id !== nextSubfranchiseeId
    ) {
      setRetailerId('all')
    }
  }

  const handleSubfranchiseeChange = (value) => {
    setSubfranchiseeId(value)
    if (franchiseeId !== 'all' && franchiseeId !== DIRECT_TO_ADMIN) {
      const stillValid = franchisees.some((org) => {
        if (org.id !== franchiseeId) return false
        if (value === 'all') return true
        if (value === DIRECT_TO_ADMIN) {
          const parent = orgById[org.parentId]
          return !parent || parent.type === 'platform'
        }
        return org.parentId === value
      })
      if (!stillValid) {
        setFranchiseeId('all')
        resetRetailerIfInvalid('all', value)
        return
      }
    }
    if (franchiseeId === DIRECT_TO_ADMIN && value !== 'all' && value !== DIRECT_TO_ADMIN) {
      setFranchiseeId('all')
      resetRetailerIfInvalid('all', value)
      return
    }
    resetRetailerIfInvalid(franchiseeId, value)
  }

  const handleFranchiseeChange = (value) => {
    setFranchiseeId(value)
    resetRetailerIfInvalid(value, subfranchiseeId)
  }

  const handleSave = (payload) => {
    const existing = getCommissionSettings()
    const now = new Date().toISOString()
    const entryId =
      payload.id || `comm-${payload.retailerOrganizationId}-${Date.now()}`

    const retailer = orgById[payload.retailerOrganizationId]
    const hierarchy = resolveCommissionHierarchy(retailer, orgById)
    const remainderTarget =
      payload.remainderTarget || hierarchy.remainderTarget

    const normalized = normalizeCommissionShares({
      retailerPercentage: payload.retailerPercentage,
      franchiseePercentage: hierarchy.hasFranchisee
        ? payload.franchiseePercentage
        : 0,
      companyPercentage: DEFAULT_PLATFORM_FEE_PERCENTAGE,
      remainderTarget,
    })

    const savedEntry = {
      ...(payload.id
        ? existing.find((entry) => entry.id === payload.id) || {}
        : {}),
      ...payload,
      ...normalized,
      id: entryId,
      franchiseeOrganizationId: hierarchy.franchisee?.id || '',
      subfranchiseeOrganizationId: isAdmin
        ? hierarchy.subfranchisee?.id || ''
        : user.organizationId,
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

  const filterCols = isAdmin
    ? 'lg:grid-cols-[1fr_1fr_1fr_1fr_auto]'
    : 'lg:grid-cols-[1fr_1fr_1fr_auto]'

  return (
    <div>
      <PageHeader
        title="Commission Settings"
        description={
          isAdmin
            ? 'Set retailer and franchisee commission shares across sub-franchisees, franchisees, and retailers.'
            : 'Set retailer and franchisee commission shares for your downlines.'
        }
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
        <CardContent
          className={cn('grid gap-3 p-4 lg:items-end', filterCols)}
        >
          {isAdmin ? (
            <div className="space-y-2">
              <Label className="text-xs text-slate-500">Sub-Franchisee</Label>
              <Select
                value={subfranchiseeId}
                onValueChange={handleSubfranchiseeChange}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All Sub-Franchisees" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Sub-Franchisees</SelectItem>
                  <SelectItem value={DIRECT_TO_ADMIN}>
                    Direct to Admin
                  </SelectItem>
                  {subfranchisees.map((org) => (
                    <SelectItem key={org.id} value={org.id}>
                      {org.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}
          <div className="space-y-2">
            <Label className="text-xs text-slate-500">Franchisee</Label>
            <Select value={franchiseeId} onValueChange={handleFranchiseeChange}>
              <SelectTrigger>
                <SelectValue placeholder="All Franchisees" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Franchisees</SelectItem>
                {isAdmin ? (
                  <SelectItem value={DIRECT_TO_ADMIN}>
                    Direct to Admin
                  </SelectItem>
                ) : null}
                {franchiseeOptions.map((org) => (
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
        {isAdmin
          ? 'Showing sub-franchisees, franchisees, and retailers — including direct-to-admin downlines.'
          : 'Showing franchisees and retailers in your network.'}
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
                      {isAdmin ? <TableHead>Sub-Franchisee</TableHead> : null}
                      <TableHead>Retailer %</TableHead>
                      <TableHead>Franchisee %</TableHead>
                      <TableHead>
                        {isAdmin ? 'Sub-Franchisee %' : 'Your Share %'}
                      </TableHead>
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
                        {isAdmin ? (
                          <TableCell className="text-slate-700">
                            {row.subfranchiseeName}
                          </TableCell>
                        ) : null}
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
        viewerRole={user?.role}
        retailers={retailers}
        orgById={orgById}
        initial={editing}
        onSave={handleSave}
      />
    </div>
  )
}
