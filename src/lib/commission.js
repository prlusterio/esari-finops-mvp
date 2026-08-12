import { DEFAULT_SHARE_PERCENTAGES } from '@/lib/transactions'

export const DEFAULT_PLATFORM_FEE_PERCENTAGE = DEFAULT_SHARE_PERCENTAGES.company

export const COMMISSION_STATUS = {
  ACTIVE: 'active',
  INACTIVE: 'inactive',
}

export const COMMISSION_STATUS_LABELS = {
  [COMMISSION_STATUS.ACTIVE]: 'Active',
  [COMMISSION_STATUS.INACTIVE]: 'Inactive',
}

/** Same share set used by transactions; platform fee comes from that default. */
export const DEFAULT_COMMISSION_SHARES = {
  retailerPercentage: DEFAULT_SHARE_PERCENTAGES.retailer,
  franchiseePercentage: DEFAULT_SHARE_PERCENTAGES.franchisee,
  subfranchiseePercentage: DEFAULT_SHARE_PERCENTAGES.subfranchisee,
  companyPercentage: DEFAULT_PLATFORM_FEE_PERCENTAGE,
}

function roundPercent(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100
}

export function parsePercentInput(value) {
  if (value === '' || value === null || value === undefined) return 0
  const numeric = Number(value)
  return Number.isNaN(numeric) ? 0 : numeric
}

/**
 * Sub-franchisee / "your" share is whatever remains after platform fee + downline shares.
 */
export function computeSubFranchiseeShare({
  retailerPercentage = 0,
  franchiseePercentage = 0,
  companyPercentage = DEFAULT_PLATFORM_FEE_PERCENTAGE,
} = {}) {
  return roundPercent(
    Math.max(
      100 -
        Number(retailerPercentage || 0) -
        Number(franchiseePercentage || 0) -
        Number(companyPercentage || 0),
      0,
    ),
  )
}

export function normalizeCommissionShares({
  retailerPercentage = 0,
  franchiseePercentage = 0,
  companyPercentage = DEFAULT_PLATFORM_FEE_PERCENTAGE,
} = {}) {
  const platform = Number(companyPercentage) || DEFAULT_PLATFORM_FEE_PERCENTAGE
  const retailer = Number(retailerPercentage) || 0
  const franchisee = Number(franchiseePercentage) || 0
  return {
    retailerPercentage: roundPercent(retailer),
    franchiseePercentage: roundPercent(franchisee),
    companyPercentage: roundPercent(platform),
    subfranchiseePercentage: computeSubFranchiseeShare({
      retailerPercentage: retailer,
      franchiseePercentage: franchisee,
      companyPercentage: platform,
    }),
  }
}

export function sumCommissionPercentages(shares) {
  return roundPercent(
    Number(shares.retailerPercentage || 0) +
      Number(shares.franchiseePercentage || 0) +
      Number(shares.subfranchiseePercentage || 0) +
      Number(shares.companyPercentage || 0),
  )
}

export function isCommissionSplitValid(shares) {
  const normalized = normalizeCommissionShares(shares)
  if (Number(shares.retailerPercentage || 0) < 0) return false
  if (Number(shares.franchiseePercentage || 0) < 0) return false
  if (normalized.subfranchiseePercentage < 0) return false
  return Math.abs(sumCommissionPercentages(normalized) - 100) < 0.01
}

export function buildCommissionPreview(shares, samplePayment = 100, sampleDeduction = 97) {
  const payment = Number(samplePayment) || 0
  const deduction = Number(sampleDeduction) || 0
  const distributable = roundPercent(Math.max(payment - deduction, 0))

  const retailerAmount = roundPercent(
    (distributable * Number(shares.retailerPercentage || 0)) / 100,
  )
  const franchiseeAmount = roundPercent(
    (distributable * Number(shares.franchiseePercentage || 0)) / 100,
  )
  const subfranchiseeAmount = roundPercent(
    (distributable * Number(shares.subfranchiseePercentage || 0)) / 100,
  )
  const companyAmount = roundPercent(
    distributable - retailerAmount - franchiseeAmount - subfranchiseeAmount,
  )

  return {
    payment,
    deduction,
    distributable,
    retailerAmount,
    franchiseeAmount,
    subfranchiseeAmount,
    companyAmount,
    totalAllocated: roundPercent(
      retailerAmount + franchiseeAmount + subfranchiseeAmount + companyAmount,
    ),
  }
}

/**
 * Retailers under a sub-franchisee (via franchisee children).
 */
export function getNetworkRetailersForSubFranchisee(organizations, organizationId) {
  const franchisees = organizations.filter(
    (org) => org.parentId === organizationId && org.type === 'franchisee',
  )
  const franchiseeIds = new Set(franchisees.map((org) => org.id))
  const retailers = organizations
    .filter((org) => org.type === 'retailer' && franchiseeIds.has(org.parentId))
    .sort((a, b) => a.name.localeCompare(b.name))

  return { franchisees, retailers }
}

export function enrichCommissionRows(settings, organizations) {
  const orgById = Object.fromEntries(organizations.map((org) => [org.id, org]))

  return (settings || [])
    .map((entry) => {
      const retailer = orgById[entry.retailerOrganizationId]
      const franchisee =
        orgById[entry.franchiseeOrganizationId] ||
        (retailer?.parentId ? orgById[retailer.parentId] : null)
      const totalPercentage = sumCommissionPercentages(entry)

      return {
        ...entry,
        retailerName: retailer?.name || entry.retailerName || '—',
        retailerCode: retailer?.code || entry.retailerCode || '',
        franchiseeName: franchisee?.name || entry.franchiseeName || '—',
        franchiseeOrganizationId:
          entry.franchiseeOrganizationId || franchisee?.id || '',
        totalPercentage,
      }
    })
    .sort((a, b) => {
      if (a.status !== b.status) {
        return a.status === COMMISSION_STATUS.ACTIVE ? -1 : 1
      }
      return String(a.retailerName).localeCompare(String(b.retailerName))
    })
}

export function filterCommissionRows(
  rows,
  { retailerId = 'all', franchiseeId = 'all', status = 'all' } = {},
) {
  return rows.filter((row) => {
    if (retailerId && retailerId !== 'all') {
      if (row.retailerOrganizationId !== retailerId) return false
    }
    if (franchiseeId && franchiseeId !== 'all') {
      if (row.franchiseeOrganizationId !== franchiseeId) return false
    }
    if (status && status !== 'all') {
      if (row.status !== status) return false
    }
    return true
  })
}
