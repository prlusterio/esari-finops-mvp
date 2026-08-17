import {
  CREDIT_DEPOSIT_RATES,
  ROLE_LABELS,
  ROLES,
} from '@/lib/constants'
import { getChildOrganizations } from '@/lib/funding'

export const CREDIT_HOPS = {
  ADMIN_TO_SUB: 'admin_to_sub',
  SUB_TO_FRANCHISEE: 'sub_to_franchisee',
  FRANCHISEE_TO_RETAILER: 'franchisee_to_retailer',
}

export const DEPOSIT_RATE_HOP_LABELS = {
  [CREDIT_HOPS.ADMIN_TO_SUB]: 'Admin → Sub-Franchisee',
  [CREDIT_HOPS.SUB_TO_FRANCHISEE]: 'Sub-Franchisee → Franchisee',
  [CREDIT_HOPS.FRANCHISEE_TO_RETAILER]: 'Franchisee → Retailer',
}

const HOP_DEFAULTS = {
  [CREDIT_HOPS.ADMIN_TO_SUB]: CREDIT_DEPOSIT_RATES.ADMIN_TO_SUB,
  [CREDIT_HOPS.SUB_TO_FRANCHISEE]: CREDIT_DEPOSIT_RATES.SUB_TO_FRANCHISEE,
  [CREDIT_HOPS.FRANCHISEE_TO_RETAILER]: CREDIT_DEPOSIT_RATES.FRANCHISEE_TO_RETAILER,
}

const ORG_TYPE_HOP = {
  subfranchisee: CREDIT_HOPS.ADMIN_TO_SUB,
  franchisee: CREDIT_HOPS.SUB_TO_FRANCHISEE,
  retailer: CREDIT_HOPS.FRANCHISEE_TO_RETAILER,
}

const TYPE_LABELS = {
  platform: 'Platform',
  subfranchisee: ROLE_LABELS[ROLES.SUBFRANCHISEE],
  franchisee: ROLE_LABELS[ROLES.FRANCHISEE],
  retailer: ROLE_LABELS[ROLES.RETAILER],
}

/**
 * Default deposit rate for a hop / requester role / buyer org type.
 */
export function getDefaultDepositRate({ hop, requesterRole, orgType } = {}) {
  if (hop && HOP_DEFAULTS[hop] != null) return HOP_DEFAULTS[hop]
  if (orgType && ORG_TYPE_HOP[orgType]) {
    return HOP_DEFAULTS[ORG_TYPE_HOP[orgType]]
  }
  if (requesterRole === ROLES.SUBFRANCHISEE) {
    return CREDIT_DEPOSIT_RATES.ADMIN_TO_SUB
  }
  if (requesterRole === ROLES.FRANCHISEE) {
    return CREDIT_DEPOSIT_RATES.SUB_TO_FRANCHISEE
  }
  if (requesterRole === ROLES.RETAILER) {
    return CREDIT_DEPOSIT_RATES.FRANCHISEE_TO_RETAILER
  }
  return CREDIT_DEPOSIT_RATES.ADMIN_TO_SUB
}

export function hopForOrgType(orgType) {
  return ORG_TYPE_HOP[orgType] || CREDIT_HOPS.ADMIN_TO_SUB
}

export function hopForRequesterRole(requesterRole) {
  if (requesterRole === ROLES.SUBFRANCHISEE) return CREDIT_HOPS.ADMIN_TO_SUB
  if (requesterRole === ROLES.FRANCHISEE) return CREDIT_HOPS.SUB_TO_FRANCHISEE
  if (requesterRole === ROLES.RETAILER) {
    return CREDIT_HOPS.FRANCHISEE_TO_RETAILER
  }
  return CREDIT_HOPS.ADMIN_TO_SUB
}

/**
 * Prefer override owned by this parent when resolving a downline rate.
 * Prevents upline rate cards from applying on a mid-tier's page.
 */
export function findDepositRateOverride(
  rates = [],
  organizationId,
  parentOrganizationId,
) {
  if (!organizationId) return null
  const matches = (rates || []).filter(
    (entry) => entry.organizationId === organizationId,
  )
  if (matches.length === 0) return null
  if (parentOrganizationId) {
    return (
      matches.find(
        (entry) => entry.parentOrganizationId === parentOrganizationId,
      ) || null
    )
  }
  return matches[0] || null
}

/**
 * Resolve effective deposit rate for a buyer organization.
 * @returns {{ depositRate: number, source: 'custom' | 'default', override: object | null, hop: string }}
 */
export function resolveDepositRate({
  rates = [],
  organizationId,
  parentOrganizationId,
  hop,
  requesterRole,
  orgType,
} = {}) {
  const resolvedHop =
    hop ||
    (orgType ? hopForOrgType(orgType) : null) ||
    hopForRequesterRole(requesterRole)

  const override = findDepositRateOverride(
    rates,
    organizationId,
    parentOrganizationId,
  )
  const customRate = Number(override?.depositRate)
  if (override && customRate > 0 && customRate < 1) {
    return {
      depositRate: customRate,
      source: 'custom',
      override,
      hop: override.hop || resolvedHop,
    }
  }

  return {
    depositRate: getDefaultDepositRate({
      hop: resolvedHop,
      requesterRole,
      orgType,
    }),
    source: 'default',
    override: null,
    hop: resolvedHop,
  }
}

/**
 * Page copy + expected child types for Deposit Rates settings.
 */
export function getDepositRatesPageConfig(role) {
  if (role === ROLES.ADMIN) {
    return {
      title: 'Deposit Rates',
      description:
        'Set Internet Credits deposit rates for each direct downline. Credits = deposit ÷ rate. Sale commission splits are configured separately in Commission Settings.',
      hopLabel: 'Per downline (Admin hop defaults to 60%)',
      defaultHop: CREDIT_HOPS.ADMIN_TO_SUB,
      emptyLabel: 'No direct downlines found under the platform.',
      showHopColumn: true,
    }
  }
  if (role === ROLES.SUBFRANCHISEE) {
    return {
      title: 'Deposit Rates',
      description:
        'Set the deposit rate charged when each franchisee buys credits from you. Internet Credits earnings come from this rate card; sale commissions are configured separately in Commission Settings.',
      hopLabel: DEPOSIT_RATE_HOP_LABELS[CREDIT_HOPS.SUB_TO_FRANCHISEE],
      defaultHop: CREDIT_HOPS.SUB_TO_FRANCHISEE,
      emptyLabel: 'No franchisees found under your organization.',
      showHopColumn: false,
    }
  }
  if (role === ROLES.FRANCHISEE) {
    return {
      title: 'Deposit Rates',
      description:
        'Set the deposit rate charged when each retailer buys credits from you. Internet Credits earnings come from this rate card; sale commissions still use the distribution % on each sale.',
      hopLabel: DEPOSIT_RATE_HOP_LABELS[CREDIT_HOPS.FRANCHISEE_TO_RETAILER],
      defaultHop: CREDIT_HOPS.FRANCHISEE_TO_RETAILER,
      emptyLabel: 'No retailers found under your organization.',
      showHopColumn: false,
    }
  }
  return null
}

/**
 * Direct downlines the viewer can configure rates for.
 */
export function getDownlinesForDepositRates({
  role,
  organizationId,
  organizations = [],
} = {}) {
  if (role === ROLES.ADMIN) {
    return getChildOrganizations(organizations, organizationId).sort((a, b) =>
      a.name.localeCompare(b.name),
    )
  }
  if (role === ROLES.SUBFRANCHISEE) {
    return getChildOrganizations(
      organizations,
      organizationId,
      'franchisee',
    ).sort((a, b) => a.name.localeCompare(b.name))
  }
  if (role === ROLES.FRANCHISEE) {
    return getChildOrganizations(organizations, organizationId, 'retailer').sort(
      (a, b) => a.name.localeCompare(b.name),
    )
  }
  return []
}

/**
 * Table rows: one per downline with effective rate.
 */
export function buildDepositRateRows({
  role,
  organizationId,
  organizations = [],
  rates = [],
} = {}) {
  const downlines = getDownlinesForDepositRates({
    role,
    organizationId,
    organizations,
  })
  const pageConfig = getDepositRatesPageConfig(role)

  return downlines.map((org) => {
    const hop = hopForOrgType(org.type) || pageConfig?.defaultHop
    const resolved = resolveDepositRate({
      rates,
      organizationId: org.id,
      parentOrganizationId: organizationId,
      hop,
      orgType: org.type,
    })
    return {
      organizationId: org.id,
      ownerName: org.name,
      ownerCode: org.code || '',
      orgType: org.type,
      typeLabel: TYPE_LABELS[org.type] || org.type,
      hop,
      hopLabel: DEPOSIT_RATE_HOP_LABELS[hop] || hop,
      depositRate: resolved.depositRate,
      defaultRate: getDefaultDepositRate({ hop, orgType: org.type }),
      source: resolved.source,
      reason: resolved.override?.reason || '',
      updatedAt: resolved.override?.updatedAt || null,
      override: resolved.override,
    }
  })
}

/**
 * Validate percent input (1–99). Returns decimal rate or throws.
 */
export function parseDepositRatePercent(percentInput) {
  const pct = Number(percentInput)
  if (!Number.isFinite(pct) || pct < 1 || pct > 99) {
    throw new Error('Deposit rate must be between 1% and 99%.')
  }
  return Math.round(pct * 100) / 10000
}

export function depositRateToPercentInput(rate) {
  const value = Number(rate)
  if (!(value > 0)) return ''
  const pct = Math.round(value * 1000) / 10
  return Number.isInteger(pct) ? String(pct) : String(pct)
}

/**
 * Upsert override for a downline. Returns next rates array.
 */
export function upsertDepositRateOverride(
  rates = [],
  {
    organizationId,
    parentOrganizationId,
    hop,
    depositRate,
    reason,
    updatedByUserId,
  },
) {
  const rate = Number(depositRate)
  if (!(rate > 0) || !(rate < 1)) {
    throw new Error('Deposit rate must be between 1% and 99%.')
  }
  const trimmedReason = String(reason || '').trim()
  if (!trimmedReason) {
    throw new Error('Enter a reason when setting a custom deposit rate.')
  }
  if (!organizationId || !parentOrganizationId) {
    throw new Error('Organization details are required.')
  }

  const existing = findDepositRateOverride(
    rates,
    organizationId,
    parentOrganizationId,
  )
  const resolvedHop =
    hop || existing?.hop || CREDIT_HOPS.ADMIN_TO_SUB
  const now = new Date().toISOString()
  const entry = {
    id: existing?.id || `dr-${parentOrganizationId}-${organizationId}`,
    organizationId,
    parentOrganizationId,
    hop: resolvedHop,
    depositRate: rate,
    reason: trimmedReason,
    updatedAt: now,
    updatedByUserId: updatedByUserId || existing?.updatedByUserId || '',
  }

  if (existing) {
    return rates.map((row) =>
      row.id === existing.id ||
      (row.organizationId === organizationId &&
        row.parentOrganizationId === parentOrganizationId)
        ? entry
        : row,
    )
  }
  return [entry, ...rates]
}

/**
 * Remove override so downline falls back to hop default.
 */
export function removeDepositRateOverride(
  rates = [],
  organizationId,
  parentOrganizationId,
) {
  return (rates || []).filter((row) => {
    if (row.organizationId !== organizationId) return true
    if (parentOrganizationId) {
      return row.parentOrganizationId !== parentOrganizationId
    }
    return false
  })
}

/**
 * Hop default cards visible on Deposit Rates.
 * Mid-tiers only see their own sell-hop default — never upline rates.
 */
export function getHopDefaultRates(role) {
  const all = [
    {
      hop: CREDIT_HOPS.ADMIN_TO_SUB,
      label: DEPOSIT_RATE_HOP_LABELS[CREDIT_HOPS.ADMIN_TO_SUB],
      depositRate: CREDIT_DEPOSIT_RATES.ADMIN_TO_SUB,
    },
    {
      hop: CREDIT_HOPS.SUB_TO_FRANCHISEE,
      label: DEPOSIT_RATE_HOP_LABELS[CREDIT_HOPS.SUB_TO_FRANCHISEE],
      depositRate: CREDIT_DEPOSIT_RATES.SUB_TO_FRANCHISEE,
    },
    {
      hop: CREDIT_HOPS.FRANCHISEE_TO_RETAILER,
      label: DEPOSIT_RATE_HOP_LABELS[CREDIT_HOPS.FRANCHISEE_TO_RETAILER],
      depositRate: CREDIT_DEPOSIT_RATES.FRANCHISEE_TO_RETAILER,
    },
  ]

  if (role === ROLES.ADMIN) return all
  if (role === ROLES.SUBFRANCHISEE) {
    return all.filter((entry) => entry.hop === CREDIT_HOPS.SUB_TO_FRANCHISEE)
  }
  if (role === ROLES.FRANCHISEE) {
    return all.filter(
      (entry) => entry.hop === CREDIT_HOPS.FRANCHISEE_TO_RETAILER,
    )
  }
  return []
}
