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

/** Filter / display token for orgs attached straight to CWPC Admin. */
export const DIRECT_TO_ADMIN = 'direct'

export const REMAINDER_TARGET = {
  SUBFRANCHISEE: 'subfranchisee',
  COMPANY: 'company',
}

/**
 * Resolve franchisee / sub-franchisee parents for a retailer.
 * Supports:
 * - Retailer → Franchisee → Sub-Franchisee → Platform
 * - Retailer → Franchisee → Platform (franchisee direct to admin)
 * - Retailer → Platform (retailer direct to admin)
 */
export function resolveCommissionHierarchy(retailerOrg, orgById = {}) {
  if (!retailerOrg) {
    return {
      retailer: null,
      franchisee: null,
      subfranchisee: null,
      hasFranchisee: false,
      hasSubfranchisee: false,
      remainderTarget: REMAINDER_TARGET.COMPANY,
    }
  }

  const parent = retailerOrg.parentId ? orgById[retailerOrg.parentId] : null
  let franchisee = null
  let subfranchisee = null

  if (parent?.type === 'franchisee') {
    franchisee = parent
    const grandparent = parent.parentId ? orgById[parent.parentId] : null
    if (grandparent?.type === 'subfranchisee') {
      subfranchisee = grandparent
    }
  }

  return {
    retailer: retailerOrg,
    franchisee,
    subfranchisee,
    hasFranchisee: Boolean(franchisee),
    hasSubfranchisee: Boolean(subfranchisee),
    remainderTarget: subfranchisee
      ? REMAINDER_TARGET.SUBFRANCHISEE
      : REMAINDER_TARGET.COMPANY,
  }
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

/**
 * When there is no sub-franchisee (direct-to-admin), platform absorbs the remainder.
 * Otherwise platform fee stays fixed and sub-franchisee gets the remainder.
 */
export function normalizeCommissionShares({
  retailerPercentage = 0,
  franchiseePercentage = 0,
  companyPercentage = DEFAULT_PLATFORM_FEE_PERCENTAGE,
  remainderTarget = REMAINDER_TARGET.SUBFRANCHISEE,
} = {}) {
  const retailer = Number(retailerPercentage) || 0
  const franchisee = Number(franchiseePercentage) || 0

  if (remainderTarget === REMAINDER_TARGET.COMPANY) {
    return {
      retailerPercentage: roundPercent(retailer),
      franchiseePercentage: roundPercent(franchisee),
      subfranchiseePercentage: 0,
      companyPercentage: roundPercent(Math.max(100 - retailer - franchisee, 0)),
    }
  }

  const platform = Number(companyPercentage) || DEFAULT_PLATFORM_FEE_PERCENTAGE
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
  if (normalized.companyPercentage < 0) return false
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

  return { franchisees, retailers, subfranchisees: [] }
}

/**
 * Platform-wide commission network for admin:
 * all sub-franchisees, franchisees, and retailers.
 */
export function getNetworkOrgsForAdmin(organizations = []) {
  const subfranchisees = organizations
    .filter((org) => org.type === 'subfranchisee')
    .sort((a, b) => a.name.localeCompare(b.name))
  const franchisees = organizations
    .filter((org) => org.type === 'franchisee')
    .sort((a, b) => a.name.localeCompare(b.name))
  const retailers = organizations
    .filter((org) => org.type === 'retailer')
    .sort((a, b) => a.name.localeCompare(b.name))

  return { subfranchisees, franchisees, retailers }
}

/**
 * Role-scoped org lists used by Commission Settings.
 */
export function getCommissionNetworkScope({
  role,
  organizationId,
  organizations = [],
} = {}) {
  if (role === 'admin') {
    return getNetworkOrgsForAdmin(organizations)
  }
  return getNetworkRetailersForSubFranchisee(organizations, organizationId)
}

export function enrichCommissionRows(settings, organizations) {
  const orgById = Object.fromEntries(organizations.map((org) => [org.id, org]))

  return (settings || [])
    .map((entry) => {
      const retailer = orgById[entry.retailerOrganizationId]
      const hierarchy = resolveCommissionHierarchy(retailer, orgById)
      const franchisee =
        (entry.franchiseeOrganizationId
          ? orgById[entry.franchiseeOrganizationId]
          : null) || hierarchy.franchisee
      const subfranchisee =
        (entry.subfranchiseeOrganizationId
          ? orgById[entry.subfranchiseeOrganizationId]
          : null) || hierarchy.subfranchisee
      const shares = normalizeCommissionShares({
        ...entry,
        remainderTarget: hierarchy.remainderTarget,
      })
      const totalPercentage = sumCommissionPercentages(shares)

      return {
        ...entry,
        ...shares,
        retailerName: retailer?.name || entry.retailerName || '—',
        retailerCode: retailer?.code || entry.retailerCode || '',
        franchiseeName: franchisee?.name || 'Direct to Admin',
        franchiseeOrganizationId: franchisee?.id || '',
        hasFranchisee: Boolean(franchisee),
        subfranchiseeName: subfranchisee?.name || 'Direct to Admin',
        subfranchiseeOrganizationId: subfranchisee?.id || '',
        hasSubfranchisee: Boolean(subfranchisee),
        remainderTarget: hierarchy.remainderTarget,
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
  {
    retailerId = 'all',
    franchiseeId = 'all',
    subfranchiseeId = 'all',
    status = 'all',
  } = {},
) {
  return rows.filter((row) => {
    if (retailerId && retailerId !== 'all') {
      if (row.retailerOrganizationId !== retailerId) return false
    }
    if (franchiseeId && franchiseeId !== 'all') {
      if (franchiseeId === DIRECT_TO_ADMIN) {
        if (row.franchiseeOrganizationId) return false
      } else if (row.franchiseeOrganizationId !== franchiseeId) {
        return false
      }
    }
    if (subfranchiseeId && subfranchiseeId !== 'all') {
      if (subfranchiseeId === DIRECT_TO_ADMIN) {
        if (row.subfranchiseeOrganizationId) return false
      } else if (row.subfranchiseeOrganizationId !== subfranchiseeId) {
        return false
      }
    }
    if (status && status !== 'all') {
      if (row.status !== status) return false
    }
    return true
  })
}
