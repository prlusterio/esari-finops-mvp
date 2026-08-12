import {
  FUNDING_STATUS,
  ORG_IDS,
  ROLES,
  STORAGE_KEYS,
  TRANSACTION_STATUS,
  TRANSACTIONS_SEED_VERSION,
  COMMISSION_SETTINGS_SEED_VERSION,
  WALLET_LEDGER_VERSION,
  ADMIN_DEMO_PASSWORD,
  DEMO_PASSWORD,
} from '@/lib/constants'
import { sumCreditedShareForOrg } from '@/lib/revenue'
import {
  DEFAULT_PLATFORM_FEE_PERCENTAGE,
  normalizeCommissionShares,
  resolveCommissionHierarchy,
} from '@/lib/commission'
import { matchProductServiceToPayment } from '@/lib/transactions'
import {
  collectionNeedsSeed,
  getCommissionSettings,
  getFundingRequests,
  getFundingTransfers,
  getOrganizations,
  getRevenueSharing,
  getTransactions,
  getUsers,
  getWallets,
  saveCommissionSettings,
  saveFundingRequests,
  saveFundingTransfers,
  saveOrganizations,
  saveRevenueSharing,
  saveSettlements,
  saveTransactions,
  saveUsers,
  saveWallets,
  clearAllBusinessData,
} from '@/services/storage'

function isEmptyCollection(name) {
  if (name === 'fundingRequests') {
    return getFundingRequests().length === 0
  }
  if (name === 'fundingTransfers') {
    return getFundingTransfers().length === 0
  }
  if (name === 'transactions') {
    return getTransactions().length === 0
  }
  return false
}

const now = '2026-01-01T00:00:00.000Z'

function daysAgoAt(daysAgo, hours = 10, minutes = 0) {
  const date = new Date()
  date.setDate(date.getDate() - daysAgo)
  date.setHours(hours, minutes, 0, 0)
  return date.toISOString()
}

function roundMoney(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100
}

export function getSeedUsers() {
  return [
    {
      id: 'user-admin',
      name: 'eSariSari Admin',
      email: 'admin@esarisari.local',
      password: ADMIN_DEMO_PASSWORD,
      role: ROLES.ADMIN,
      organizationId: ORG_IDS.PLATFORM,
      status: 'active',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'user-subfranchisee',
      name: 'Northern Mindanao Sub-Franchisee',
      email: 'subfranchisee@esarisari.local',
      password: DEMO_PASSWORD,
      role: ROLES.SUBFRANCHISEE,
      organizationId: ORG_IDS.SUB_001,
      status: 'active',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'user-franchisee',
      name: 'CDO Franchisee',
      email: 'franchisee@esarisari.local',
      password: DEMO_PASSWORD,
      role: ROLES.FRANCHISEE,
      organizationId: ORG_IDS.FRANCHISE_001,
      status: 'active',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'user-retailer',
      name: 'Retailer A',
      email: 'retailer@esarisari.local',
      password: DEMO_PASSWORD,
      role: ROLES.RETAILER,
      organizationId: ORG_IDS.RETAILER_001,
      status: 'active',
      createdAt: now,
      updatedAt: now,
    },
  ]
}

export function getSeedOrganizations() {
  return [
    {
      id: ORG_IDS.PLATFORM,
      name: 'eSariSari Platform',
      code: 'PLAT-001',
      type: 'platform',
      parentId: null,
      status: 'active',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: ORG_IDS.SUB_001,
      name: 'Northern Mindanao Sub-Franchisee',
      code: 'SF-00001',
      type: 'subfranchisee',
      parentId: ORG_IDS.PLATFORM,
      status: 'active',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: ORG_IDS.FRANCHISE_001,
      name: 'CDO Franchisee',
      code: 'FR-01010',
      type: 'franchisee',
      parentId: ORG_IDS.SUB_001,
      status: 'active',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: ORG_IDS.FRANCHISE_002,
      name: 'Manila Central Retailers',
      code: 'FR-00892',
      type: 'franchisee',
      parentId: ORG_IDS.SUB_001,
      status: 'active',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: ORG_IDS.FRANCHISE_003,
      name: 'Cebu Southern Hub',
      code: 'FR-00945',
      type: 'franchisee',
      parentId: ORG_IDS.SUB_001,
      status: 'active',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: ORG_IDS.FRANCHISE_004,
      name: 'Davao East Distributors',
      code: 'FR-01002',
      type: 'franchisee',
      parentId: ORG_IDS.SUB_001,
      status: 'active',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: ORG_IDS.FRANCHISE_005,
      name: 'NCR Direct Franchisee',
      code: 'FR-02001',
      type: 'franchisee',
      parentId: ORG_IDS.PLATFORM,
      status: 'active',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: ORG_IDS.RETAILER_001,
      name: 'Retailer A',
      code: 'RT-00001',
      type: 'retailer',
      parentId: ORG_IDS.FRANCHISE_001,
      status: 'active',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: ORG_IDS.RETAILER_002,
      name: 'Retailer B',
      code: 'RT-00002',
      type: 'retailer',
      parentId: ORG_IDS.FRANCHISE_001,
      status: 'active',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: ORG_IDS.RETAILER_003,
      name: 'SariSari Central',
      code: 'RT-00291',
      type: 'retailer',
      parentId: ORG_IDS.FRANCHISE_001,
      status: 'active',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: ORG_IDS.RETAILER_004,
      name: 'QuickStop Mart',
      code: 'RT-00882',
      type: 'retailer',
      parentId: ORG_IDS.FRANCHISE_001,
      status: 'active',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: ORG_IDS.RETAILER_005,
      name: 'Neighborhood Hub',
      code: 'RT-00104',
      type: 'retailer',
      parentId: ORG_IDS.FRANCHISE_002,
      status: 'active',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: ORG_IDS.RETAILER_006,
      name: 'Pasig Direct Store',
      code: 'RT-03001',
      type: 'retailer',
      parentId: ORG_IDS.FRANCHISE_005,
      status: 'active',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: ORG_IDS.RETAILER_007,
      name: 'CWPC Direct Retailer',
      code: 'RT-04001',
      type: 'retailer',
      parentId: ORG_IDS.PLATFORM,
      status: 'active',
      createdAt: now,
      updatedAt: now,
    },
  ]
}

function buildRevenueWallet(id, organizationId, role, transactions, revenueSharing) {
  return {
    id,
    organizationId,
    walletType: 'revenue',
    availableBalance: sumCreditedShareForOrg(transactions, {
      role,
      organizationId,
      revenueSharing,
    }),
    minimumBalance: 0,
    status: 'active',
    createdAt: now,
    updatedAt: now,
  }
}

const REVENUE_WALLET_SPECS = [
  { id: 'wallet-platform-revenue', organizationId: ORG_IDS.PLATFORM, role: ROLES.ADMIN },
  { id: 'wallet-sub-001-revenue', organizationId: ORG_IDS.SUB_001, role: ROLES.SUBFRANCHISEE },
  {
    id: 'wallet-franchise-001-revenue',
    organizationId: ORG_IDS.FRANCHISE_001,
    role: ROLES.FRANCHISEE,
  },
  {
    id: 'wallet-franchise-002-revenue',
    organizationId: ORG_IDS.FRANCHISE_002,
    role: ROLES.FRANCHISEE,
  },
  {
    id: 'wallet-franchise-003-revenue',
    organizationId: ORG_IDS.FRANCHISE_003,
    role: ROLES.FRANCHISEE,
  },
  {
    id: 'wallet-franchise-004-revenue',
    organizationId: ORG_IDS.FRANCHISE_004,
    role: ROLES.FRANCHISEE,
  },
  {
    id: 'wallet-franchise-005-revenue',
    organizationId: ORG_IDS.FRANCHISE_005,
    role: ROLES.FRANCHISEE,
  },
  {
    id: 'wallet-retailer-001-revenue',
    organizationId: ORG_IDS.RETAILER_001,
    role: ROLES.RETAILER,
  },
  {
    id: 'wallet-retailer-002-revenue',
    organizationId: ORG_IDS.RETAILER_002,
    role: ROLES.RETAILER,
  },
  {
    id: 'wallet-retailer-003-revenue',
    organizationId: ORG_IDS.RETAILER_003,
    role: ROLES.RETAILER,
  },
  {
    id: 'wallet-retailer-004-revenue',
    organizationId: ORG_IDS.RETAILER_004,
    role: ROLES.RETAILER,
  },
  {
    id: 'wallet-retailer-005-revenue',
    organizationId: ORG_IDS.RETAILER_005,
    role: ROLES.RETAILER,
  },
  {
    id: 'wallet-retailer-006-revenue',
    organizationId: ORG_IDS.RETAILER_006,
    role: ROLES.RETAILER,
  },
  {
    id: 'wallet-retailer-007-revenue',
    organizationId: ORG_IDS.RETAILER_007,
    role: ROLES.RETAILER,
  },
]

/**
 * Keep persisted revenue wallets aligned with completed-transaction share totals.
 * Must run after transactions are seeded/migrated.
 */
function reconcileRevenueWallets() {
  const transactions = getTransactions()
  const revenueSharing = getRevenueSharing()
  const existing = getWallets()
  const byId = new Map(existing.map((wallet) => [wallet.id, wallet]))
  let changed = false

  REVENUE_WALLET_SPECS.forEach((spec) => {
    const balance = sumCreditedShareForOrg(transactions, {
      role: spec.role,
      organizationId: spec.organizationId,
      revenueSharing,
    })
    const current = byId.get(spec.id)
    if (!current) {
      byId.set(
        spec.id,
        buildRevenueWallet(
          spec.id,
          spec.organizationId,
          spec.role,
          transactions,
          revenueSharing,
        ),
      )
      changed = true
      return
    }
    if (Number(current.availableBalance) !== balance) {
      byId.set(spec.id, {
        ...current,
        availableBalance: balance,
        updatedAt: new Date().toISOString(),
      })
      changed = true
    }
  })

  if (changed) {
    saveWallets(Array.from(byId.values()))
  }
}

export function getSeedWallets() {
  const transactions = getSeedTransactions()
  const revenueSharing = getSeedRevenueSharing()

  // Operating balances follow seeded funding transfers + opening float so
  // Available Balance matches Funding / Transfer history.
  //
  // Platform:       opening 675,000 - TRF-5002 175,000 = 500,000
  // Sub-Franchisee: opening 50,000 + TRF-5002 175,000 - TRF-5001 90,000 = 135,000
  // Franchisee-001: opening 40,000 - TRF-5003 10,000 = 30,000
  // Franchisee-002: opening 15,000 + TRF-5001 90,000 = 105,000
  // Franchisee-003/004: opening float only (no completed transfers yet)
  // Retailer-001:   opening 5,000 + TRF-5003 10,000 = 15,000
  const operating = [
    {
      id: 'wallet-platform',
      organizationId: ORG_IDS.PLATFORM,
      walletType: 'master',
      availableBalance: 500000,
      openingBalance: 675000,
      minimumBalance: 100000,
      status: 'active',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'wallet-sub-001',
      organizationId: ORG_IDS.SUB_001,
      walletType: 'operating',
      availableBalance: 135000,
      openingBalance: 50000,
      minimumBalance: 50000,
      status: 'active',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'wallet-franchise-001',
      organizationId: ORG_IDS.FRANCHISE_001,
      walletType: 'operating',
      availableBalance: 30000,
      openingBalance: 40000,
      minimumBalance: 25000,
      status: 'active',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'wallet-franchise-002',
      organizationId: ORG_IDS.FRANCHISE_002,
      walletType: 'operating',
      availableBalance: 105000,
      openingBalance: 15000,
      minimumBalance: 25000,
      status: 'active',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'wallet-franchise-003',
      organizationId: ORG_IDS.FRANCHISE_003,
      walletType: 'operating',
      availableBalance: 18000,
      openingBalance: 18000,
      minimumBalance: 25000,
      status: 'active',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'wallet-franchise-004',
      organizationId: ORG_IDS.FRANCHISE_004,
      walletType: 'operating',
      availableBalance: 32000,
      openingBalance: 32000,
      minimumBalance: 25000,
      status: 'active',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'wallet-franchise-005',
      organizationId: ORG_IDS.FRANCHISE_005,
      walletType: 'operating',
      availableBalance: 28000,
      openingBalance: 28000,
      minimumBalance: 25000,
      status: 'active',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'wallet-retailer-001',
      organizationId: ORG_IDS.RETAILER_001,
      walletType: 'operating',
      availableBalance: 15000,
      openingBalance: 5000,
      minimumBalance: 8000,
      status: 'active',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'wallet-retailer-002',
      organizationId: ORG_IDS.RETAILER_002,
      walletType: 'operating',
      availableBalance: 5000,
      openingBalance: 5000,
      minimumBalance: 8000,
      status: 'active',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'wallet-retailer-003',
      organizationId: ORG_IDS.RETAILER_003,
      walletType: 'operating',
      availableBalance: 7500,
      openingBalance: 7500,
      minimumBalance: 8000,
      status: 'active',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'wallet-retailer-004',
      organizationId: ORG_IDS.RETAILER_004,
      walletType: 'operating',
      availableBalance: 6200,
      openingBalance: 6200,
      minimumBalance: 8000,
      status: 'active',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'wallet-retailer-005',
      organizationId: ORG_IDS.RETAILER_005,
      walletType: 'operating',
      availableBalance: 9100,
      openingBalance: 9100,
      minimumBalance: 8000,
      status: 'active',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'wallet-retailer-006',
      organizationId: ORG_IDS.RETAILER_006,
      walletType: 'operating',
      availableBalance: 8400,
      openingBalance: 8400,
      minimumBalance: 8000,
      status: 'active',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'wallet-retailer-007',
      organizationId: ORG_IDS.RETAILER_007,
      walletType: 'operating',
      availableBalance: 11200,
      openingBalance: 11200,
      minimumBalance: 8000,
      status: 'active',
      createdAt: now,
      updatedAt: now,
    },
  ]

  const revenue = REVENUE_WALLET_SPECS.map((spec) =>
    buildRevenueWallet(
      spec.id,
      spec.organizationId,
      spec.role,
      transactions,
      revenueSharing,
    ),
  )

  return [...operating, ...revenue]
}

export function getSeedRevenueSharing() {
  // Global fallback only — per-retailer splits live in commission settings.
  const defaults = normalizeCommissionShares({
    retailerPercentage: 25,
    franchiseePercentage: 20,
    companyPercentage: DEFAULT_PLATFORM_FEE_PERCENTAGE,
  })
  return [
    {
      id: 'revshare-default',
      retailerPercentage: defaults.retailerPercentage,
      franchiseePercentage: defaults.franchiseePercentage,
      subfranchiseePercentage: defaults.subfranchiseePercentage,
      companyPercentage: defaults.companyPercentage,
      status: 'active',
      createdAt: now,
      updatedAt: now,
    },
  ]
}

export function getSeedCommissionSettings() {
  const orgs = getSeedOrganizations()
  const orgById = Object.fromEntries(orgs.map((org) => [org.id, org]))
  const retailers = orgs.filter((org) => org.type === 'retailer')

  // Different downline splits per retailer — only platform fee stays 40% when SF exists.
  // Direct-to-admin paths set SF=0 and absorb remainder into platform share.
  const sharePlans = [
    { retailerPercentage: 25, franchiseePercentage: 20, status: 'active' }, // SF 15
    { retailerPercentage: 30, franchiseePercentage: 15, status: 'active' }, // SF 15
    { retailerPercentage: 18, franchiseePercentage: 22, status: 'active' }, // SF 20
    { retailerPercentage: 28, franchiseePercentage: 12, status: 'active' }, // SF 20
    { retailerPercentage: 22, franchiseePercentage: 18, status: 'active' }, // SF 20
    { retailerPercentage: 27, franchiseePercentage: 18, status: 'active' }, // direct franchisee → platform 55
    { retailerPercentage: 35, franchiseePercentage: 0, status: 'active' }, // direct retailer → platform 65
  ]

  return retailers.map((retailer, index) => {
    const plan = sharePlans[index % sharePlans.length]
    const hierarchy = resolveCommissionHierarchy(retailer, orgById)
    const shares = normalizeCommissionShares({
      retailerPercentage: plan.retailerPercentage,
      franchiseePercentage: hierarchy.hasFranchisee
        ? plan.franchiseePercentage
        : 0,
      companyPercentage: DEFAULT_PLATFORM_FEE_PERCENTAGE,
      remainderTarget: hierarchy.remainderTarget,
    })
    const daysAgo = 5 + index * 8
    const effective = daysAgoAt(daysAgo, 10, 0)
    return {
      id: `comm-${retailer.id}`,
      retailerOrganizationId: retailer.id,
      franchiseeOrganizationId: hierarchy.franchisee?.id || '',
      subfranchiseeOrganizationId: hierarchy.subfranchisee?.id || '',
      ...shares,
      effectiveDate: effective.slice(0, 10),
      status: plan.status,
      createdAt: effective,
      updatedAt: effective,
    }
  })
}

const DEFAULT_PROOF = {
  fileName: 'deposit_slip_oct24.jpg',
  fileSize: '1.2 MB',
  url: '/proofs/deposit_slip_oct24.svg',
}

function withFundingDetails(request, notes) {
  return {
    ...request,
    notes,
    proofOfPayment: { ...DEFAULT_PROOF },
  }
}

export function getSeedFundingRequests() {
  const incoming = [
    withFundingDetails(
      {
        id: 'REQ-1234',
        organizationId: ORG_IDS.FRANCHISE_002,
        requesterRole: ROLES.FRANCHISEE,
        parentOrganizationId: ORG_IDS.SUB_001,
        amount: 150000,
        status: FUNDING_STATUS.PENDING,
        createdAt: daysAgoAt(0, 10, 45),
        updatedAt: daysAgoAt(0, 10, 45),
      },
      'Additional funds requested for the upcoming holiday season inventory restock. Transfer receipt attached.',
    ),
    withFundingDetails(
      {
        id: 'REQ-1235',
        organizationId: ORG_IDS.FRANCHISE_003,
        requesterRole: ROLES.FRANCHISEE,
        parentOrganizationId: ORG_IDS.SUB_001,
        amount: 85000,
        status: FUNDING_STATUS.PENDING,
        createdAt: daysAgoAt(1, 14, 12),
        updatedAt: daysAgoAt(1, 14, 12),
      },
      'Wallet top-up for weekend load and bills payment volume.',
    ),
    withFundingDetails(
      {
        id: 'REQ-1236',
        organizationId: ORG_IDS.FRANCHISE_004,
        requesterRole: ROLES.FRANCHISEE,
        parentOrganizationId: ORG_IDS.SUB_001,
        amount: 210500,
        status: FUNDING_STATUS.PENDING,
        createdAt: daysAgoAt(2, 9, 30),
        updatedAt: daysAgoAt(2, 9, 30),
      },
      'Urgent funding for distributor replenishment and float recovery.',
    ),
    withFundingDetails(
      {
        id: 'REQ-1237',
        organizationId: ORG_IDS.FRANCHISE_001,
        requesterRole: ROLES.FRANCHISEE,
        parentOrganizationId: ORG_IDS.SUB_001,
        amount: 45000,
        status: FUNDING_STATUS.PENDING,
        createdAt: daysAgoAt(2, 16, 5),
        updatedAt: daysAgoAt(2, 16, 5),
      },
      'Additional float needed for CDO retailer network coverage.',
    ),
    withFundingDetails(
      {
        id: 'REQ-1238',
        organizationId: ORG_IDS.FRANCHISE_002,
        requesterRole: ROLES.FRANCHISEE,
        parentOrganizationId: ORG_IDS.SUB_001,
        amount: 62000,
        status: FUNDING_STATUS.PENDING,
        createdAt: daysAgoAt(3, 11, 20),
        updatedAt: daysAgoAt(3, 11, 20),
      },
      'Deposit completed this morning. Please process once verified.',
    ),
    withFundingDetails(
      {
        id: 'REQ-1239',
        organizationId: ORG_IDS.FRANCHISE_003,
        requesterRole: ROLES.FRANCHISEE,
        parentOrganizationId: ORG_IDS.SUB_001,
        amount: 97500,
        status: FUNDING_STATUS.PENDING,
        createdAt: daysAgoAt(3, 15, 40),
        updatedAt: daysAgoAt(3, 15, 40),
      },
      'Funding request for mid-week transaction spike.',
    ),
    withFundingDetails(
      {
        id: 'REQ-1240',
        organizationId: ORG_IDS.FRANCHISE_004,
        requesterRole: ROLES.FRANCHISEE,
        parentOrganizationId: ORG_IDS.SUB_001,
        amount: 128000,
        status: FUNDING_STATUS.PENDING,
        createdAt: daysAgoAt(4, 9, 15),
        updatedAt: daysAgoAt(4, 9, 15),
      },
      'Proof attached for branch cash-in consolidation.',
    ),
    withFundingDetails(
      {
        id: 'REQ-1241',
        organizationId: ORG_IDS.FRANCHISE_001,
        requesterRole: ROLES.FRANCHISEE,
        parentOrganizationId: ORG_IDS.SUB_001,
        amount: 33000,
        status: FUNDING_STATUS.PENDING,
        createdAt: daysAgoAt(5, 14, 50),
        updatedAt: daysAgoAt(5, 14, 50),
      },
      'Small top-up to maintain minimum operating balance.',
    ),
    withFundingDetails(
      {
        id: 'REQ-1242',
        organizationId: ORG_IDS.FRANCHISE_002,
        requesterRole: ROLES.FRANCHISEE,
        parentOrganizationId: ORG_IDS.SUB_001,
        amount: 76000,
        status: FUNDING_STATUS.PENDING,
        createdAt: daysAgoAt(6, 13, 5),
        updatedAt: daysAgoAt(6, 13, 5),
      },
      'Inventory restock funding with bank transfer receipt.',
    ),
    withFundingDetails(
      {
        id: 'REQ-1243',
        organizationId: ORG_IDS.FRANCHISE_003,
        requesterRole: ROLES.FRANCHISEE,
        parentOrganizationId: ORG_IDS.SUB_001,
        amount: 54000,
        status: FUNDING_STATUS.PENDING,
        createdAt: daysAgoAt(7, 7, 25),
        updatedAt: daysAgoAt(7, 7, 25),
      },
      'Please approve after validating attached deposit slip.',
    ),
    withFundingDetails(
      {
        id: 'REQ-1244',
        organizationId: ORG_IDS.FRANCHISE_004,
        requesterRole: ROLES.FRANCHISEE,
        parentOrganizationId: ORG_IDS.SUB_001,
        amount: 189000,
        status: FUNDING_STATUS.PENDING,
        createdAt: daysAgoAt(8, 12, 10),
        updatedAt: daysAgoAt(8, 12, 10),
      },
      'Large float request for regional expansion weekend.',
    ),
    withFundingDetails(
      {
        id: 'REQ-1245',
        organizationId: ORG_IDS.FRANCHISE_001,
        requesterRole: ROLES.FRANCHISEE,
        parentOrganizationId: ORG_IDS.SUB_001,
        amount: 41000,
        status: FUNDING_STATUS.PENDING,
        createdAt: daysAgoAt(9, 4, 55),
        updatedAt: daysAgoAt(9, 4, 55),
      },
      'Standard weekly funding request with proof attached.',
    ),
  ]

  const myRequests = [
    withFundingDetails(
      {
        id: 'REQ-1101',
        organizationId: ORG_IDS.SUB_001,
        requesterRole: ROLES.SUBFRANCHISEE,
        parentOrganizationId: ORG_IDS.PLATFORM,
        amount: 250000,
        status: FUNDING_STATUS.PENDING,
        createdAt: daysAgoAt(1, 11, 0),
        updatedAt: daysAgoAt(1, 11, 0),
      },
      'Requesting platform funding to cover pending franchisee replenishment.',
    ),
    withFundingDetails(
      {
        id: 'REQ-1090',
        organizationId: ORG_IDS.SUB_001,
        requesterRole: ROLES.SUBFRANCHISEE,
        parentOrganizationId: ORG_IDS.PLATFORM,
        amount: 175000,
        status: FUNDING_STATUS.COMPLETED,
        createdAt: daysAgoAt(12, 10, 0),
        updatedAt: daysAgoAt(11, 16, 0),
      },
      'Approved platform top-up for Northern Mindanao operations.',
    ),
  ]

  const completed = [
    withFundingDetails(
      {
        id: 'REQ-1001',
        organizationId: ORG_IDS.FRANCHISE_002,
        requesterRole: ROLES.FRANCHISEE,
        parentOrganizationId: ORG_IDS.SUB_001,
        amount: 90000,
        status: FUNDING_STATUS.COMPLETED,
        createdAt: daysAgoAt(14, 10, 0),
        updatedAt: daysAgoAt(13, 15, 0),
      },
      'Completed transfer for prior inventory cycle.',
    ),
    withFundingDetails(
      {
        id: 'REQ-1002',
        organizationId: ORG_IDS.FRANCHISE_003,
        requesterRole: ROLES.FRANCHISEE,
        parentOrganizationId: ORG_IDS.SUB_001,
        amount: 120000,
        status: FUNDING_STATUS.APPROVED,
        createdAt: daysAgoAt(10, 12, 30),
        updatedAt: daysAgoAt(9, 13, 15),
      },
      'Approved and queued for settlement confirmation.',
    ),
  ]

  const retailerIncoming = [
    withFundingDetails(
      {
        id: 'REQ-1301',
        organizationId: ORG_IDS.RETAILER_001,
        requesterRole: ROLES.RETAILER,
        parentOrganizationId: ORG_IDS.FRANCHISE_001,
        amount: 15000,
        status: FUNDING_STATUS.PENDING,
        createdAt: daysAgoAt(0, 9, 15),
        updatedAt: daysAgoAt(0, 9, 15),
      },
      'Retailer float top-up for weekend peak transactions.',
    ),
    withFundingDetails(
      {
        id: 'REQ-1302',
        organizationId: ORG_IDS.RETAILER_002,
        requesterRole: ROLES.RETAILER,
        parentOrganizationId: ORG_IDS.FRANCHISE_001,
        amount: 8500,
        status: FUNDING_STATUS.PENDING,
        createdAt: daysAgoAt(1, 16, 40),
        updatedAt: daysAgoAt(1, 16, 40),
      },
      'Urgent wallet replenishment after high load sales.',
    ),
    withFundingDetails(
      {
        id: 'REQ-1303',
        organizationId: ORG_IDS.RETAILER_001,
        requesterRole: ROLES.RETAILER,
        parentOrganizationId: ORG_IDS.FRANCHISE_001,
        amount: 12000,
        status: FUNDING_STATUS.PENDING,
        createdAt: daysAgoAt(2, 13, 20),
        updatedAt: daysAgoAt(2, 13, 20),
      },
      'Additional funds for bills payment service coverage.',
    ),
  ]

  const franchiseeOwn = [
    withFundingDetails(
      {
        id: 'REQ-1201',
        organizationId: ORG_IDS.FRANCHISE_001,
        requesterRole: ROLES.FRANCHISEE,
        parentOrganizationId: ORG_IDS.SUB_001,
        amount: 75000,
        status: FUNDING_STATUS.PENDING,
        createdAt: daysAgoAt(4, 11, 0),
        updatedAt: daysAgoAt(4, 11, 0),
      },
      'CDO Franchisee requesting float to support retailer network.',
    ),
  ]

  const retailerCompleted = [
    withFundingDetails(
      {
        id: 'REQ-1050',
        organizationId: ORG_IDS.RETAILER_001,
        requesterRole: ROLES.RETAILER,
        parentOrganizationId: ORG_IDS.FRANCHISE_001,
        amount: 10000,
        status: FUNDING_STATUS.COMPLETED,
        createdAt: daysAgoAt(15, 10, 0),
        updatedAt: daysAgoAt(14, 14, 0),
      },
      'Completed retailer funding for prior week operations.',
    ),
  ]

  return [
    ...incoming,
    ...myRequests,
    ...completed,
    ...retailerIncoming,
    ...franchiseeOwn,
    ...retailerCompleted,
  ]
}

export function getSeedFundingTransfers() {
  return [
    {
      id: 'TRF-5001',
      fromOrganizationId: ORG_IDS.SUB_001,
      toOrganizationId: ORG_IDS.FRANCHISE_002,
      amount: 90000,
      status: FUNDING_STATUS.COMPLETED,
      fundingRequestId: 'REQ-1001',
      createdAt: daysAgoAt(13, 15, 0),
      updatedAt: daysAgoAt(13, 15, 0),
    },
    {
      id: 'TRF-5002',
      fromOrganizationId: ORG_IDS.PLATFORM,
      toOrganizationId: ORG_IDS.SUB_001,
      amount: 175000,
      status: FUNDING_STATUS.COMPLETED,
      fundingRequestId: 'REQ-1090',
      createdAt: daysAgoAt(11, 16, 0),
      updatedAt: daysAgoAt(11, 16, 0),
    },
    {
      id: 'TRF-5003',
      fromOrganizationId: ORG_IDS.FRANCHISE_001,
      toOrganizationId: ORG_IDS.RETAILER_001,
      amount: 10000,
      status: FUNDING_STATUS.COMPLETED,
      fundingRequestId: 'REQ-1050',
      createdAt: daysAgoAt(14, 14, 0),
      updatedAt: daysAgoAt(14, 14, 0),
    },
  ]
}

function buildTransaction({
  id,
  createdAt,
  retailerOrganizationId,
  franchiseeOrganizationId,
  subfranchiseeOrganizationId = '',
  retailerName,
  retailerCode,
  customerPayment,
  baseCost,
  platformProcessingFee,
  walletDeduction,
  retailerShare,
  retailerPercentage,
  franchiseePercentage,
  subfranchiseePercentage,
  companyPercentage = DEFAULT_PLATFORM_FEE_PERCENTAGE,
  remainderTarget,
  status,
  productService,
  customerReference,
}) {
  const resolvedBaseCost =
    baseCost != null
      ? Math.round(Number(baseCost) * 100) / 100
      : Math.round(Number(walletDeduction) * 100) / 100
  const resolvedProcessingFee =
    platformProcessingFee != null
      ? Math.round(Number(platformProcessingFee) * 100) / 100
      : 0
  const netWalletDeduction =
    walletDeduction != null
      ? Math.round(Number(walletDeduction) * 100) / 100
      : Math.round((resolvedBaseCost + resolvedProcessingFee) * 100) / 100
  const distributableRevenue =
    Math.round((customerPayment - netWalletDeduction) * 100) / 100
  const totalDistributed = distributableRevenue

  const shares = normalizeCommissionShares({
    retailerPercentage: retailerPercentage ?? 0,
    franchiseePercentage: franchiseePercentage ?? 0,
    companyPercentage: companyPercentage ?? DEFAULT_PLATFORM_FEE_PERCENTAGE,
    remainderTarget:
      remainderTarget ||
      (subfranchiseeOrganizationId ? 'subfranchisee' : 'company'),
  })
  const resolvedRetailerShare =
    retailerShare != null
      ? Math.round(Number(retailerShare) * 100) / 100
      : roundMoney((distributableRevenue * shares.retailerPercentage) / 100)

  return {
    id,
    reference: id,
    createdAt,
    updatedAt: createdAt,
    retailerOrganizationId,
    franchiseeOrganizationId: franchiseeOrganizationId || '',
    subfranchiseeOrganizationId: subfranchiseeOrganizationId || '',
    retailerName,
    retailerCode,
    customerPayment,
    baseCost: resolvedBaseCost,
    platformProcessingFee: resolvedProcessingFee,
    walletDeduction: netWalletDeduction,
    distributableRevenue,
    retailerShare: resolvedRetailerShare,
    retailerPercentage: shares.retailerPercentage,
    franchiseePercentage: shares.franchiseePercentage,
    subfranchiseePercentage: shares.subfranchiseePercentage,
    companyPercentage: shares.companyPercentage,
    totalDistributed,
    productService: matchProductServiceToPayment(
      productService || 'Mobile Load - Globe',
      customerPayment,
    ),
    customerReference: customerReference || '0917-000-0000',
    status,
  }
}

export function getSeedTransactions() {
  const allCommission = getSeedCommissionSettings()
  const commissionByRetailer = Object.fromEntries(
    allCommission.map((entry) => [entry.retailerOrganizationId, entry]),
  )
  // Prefer active config when a retailer has both.
  allCommission
    .filter((entry) => entry.status === 'active')
    .forEach((entry) => {
      commissionByRetailer[entry.retailerOrganizationId] = entry
    })

  const sharesForRetailer = (retailerOrganizationId) => {
    const configured = commissionByRetailer[retailerOrganizationId]
    if (configured) {
      return normalizeCommissionShares({
        retailerPercentage: configured.retailerPercentage,
        franchiseePercentage: configured.franchiseePercentage,
        companyPercentage: configured.companyPercentage,
        remainderTarget: configured.subfranchiseeOrganizationId
          ? 'subfranchisee'
          : 'company',
      })
    }
    return normalizeCommissionShares({
      retailerPercentage: 0,
      franchiseePercentage: 0,
      companyPercentage: DEFAULT_PLATFORM_FEE_PERCENTAGE,
      remainderTarget: 'company',
    })
  }

  const hierarchyIdsForRetailer = (retailerOrganizationId) => {
    const configured = commissionByRetailer[retailerOrganizationId]
    return {
      franchiseeOrganizationId: configured?.franchiseeOrganizationId || '',
      subfranchiseeOrganizationId: configured?.subfranchiseeOrganizationId || '',
    }
  }

  const productCatalog = [
    'Mobile Load - Globe',
    'Mobile Load - Smart',
    'Mobile Load - TNT',
    'Bills Payment - Meralco',
    'Bills Payment - Maynilad',
    'E-Wallet Cash-in - GCash',
    'E-Wallet Cash-in - Maya',
    'Gaming Credits - Steam',
  ]

  const featured = [
    buildTransaction({
      id: 'TX-8921-A',
      createdAt: daysAgoAt(0, 10, 42),
      retailerOrganizationId: ORG_IDS.RETAILER_003,
      ...hierarchyIdsForRetailer(ORG_IDS.RETAILER_003),
      retailerName: 'SariSari Central',
      retailerCode: 'RT-00291',
      customerPayment: 1500,
      baseCost: 1425,
      platformProcessingFee: 30,
      walletDeduction: 1455,
      ...sharesForRetailer(ORG_IDS.RETAILER_003),
      productService: 'Mobile Load - Globe',
      customerReference: '0917-123-4567',
      status: TRANSACTION_STATUS.COMPLETED,
    }),
    buildTransaction({
      id: 'TX-8920-B',
      createdAt: daysAgoAt(0, 9, 15),
      retailerOrganizationId: ORG_IDS.RETAILER_004,
      ...hierarchyIdsForRetailer(ORG_IDS.RETAILER_004),
      retailerName: 'QuickStop Mart',
      retailerCode: 'RT-00882',
      customerPayment: 850,
      baseCost: 807.5,
      platformProcessingFee: 17,
      walletDeduction: 824.5,
      ...sharesForRetailer(ORG_IDS.RETAILER_004),
      productService: 'Bills Payment - Meralco',
      customerReference: '0918-555-0192',
      status: TRANSACTION_STATUS.COMPLETED,
    }),
    buildTransaction({
      id: 'TX-8919-C',
      createdAt: daysAgoAt(1, 16, 30),
      retailerOrganizationId: ORG_IDS.RETAILER_005,
      ...hierarchyIdsForRetailer(ORG_IDS.RETAILER_005),
      retailerName: 'Neighborhood Hub',
      retailerCode: 'RT-00104',
      customerPayment: 2200,
      baseCost: 2090,
      platformProcessingFee: 44,
      walletDeduction: 2134,
      ...sharesForRetailer(ORG_IDS.RETAILER_005),
      productService: 'E-Wallet Cash-in - GCash',
      customerReference: '0920-771-3344',
      status: TRANSACTION_STATUS.COMPLETED,
    }),
    buildTransaction({
      id: 'TX-8918-D',
      createdAt: daysAgoAt(0, 11, 5),
      retailerOrganizationId: ORG_IDS.RETAILER_001,
      ...hierarchyIdsForRetailer(ORG_IDS.RETAILER_001),
      retailerName: 'Retailer A',
      retailerCode: 'RT-00001',
      customerPayment: 1000,
      baseCost: 950,
      platformProcessingFee: 20,
      walletDeduction: 970,
      ...sharesForRetailer(ORG_IDS.RETAILER_001),
      productService: 'Mobile Load - Smart',
      customerReference: '0917-882-1001',
      status: TRANSACTION_STATUS.COMPLETED,
    }),
  ]

  const retailers = [
    {
      id: ORG_IDS.RETAILER_001,
      name: 'Retailer A',
      code: 'RT-00001',
    },
    {
      id: ORG_IDS.RETAILER_002,
      name: 'Retailer B',
      code: 'RT-00002',
    },
    {
      id: ORG_IDS.RETAILER_003,
      name: 'SariSari Central',
      code: 'RT-00291',
    },
    {
      id: ORG_IDS.RETAILER_004,
      name: 'QuickStop Mart',
      code: 'RT-00882',
    },
    {
      id: ORG_IDS.RETAILER_005,
      name: 'Neighborhood Hub',
      code: 'RT-00104',
    },
    {
      id: ORG_IDS.RETAILER_006,
      name: 'Pasig Direct Store',
      code: 'RT-03001',
    },
    {
      id: ORG_IDS.RETAILER_007,
      name: 'CWPC Direct Retailer',
      code: 'RT-04001',
    },
  ]

  const generated = []
  for (let index = 0; index < 45; index += 1) {
    const retailer = retailers[index % retailers.length]
    const dayOffset = 2 + Math.floor(index / 3)
    const hour = 8 + (index % 10)
    const minute = (index * 7) % 60
    const payment = 500 + (index % 12) * 125
    const baseCost = roundMoney(payment * 0.95)
    const platformProcessingFee = roundMoney(payment * 0.02)
    const walletDeduction = roundMoney(baseCost + platformProcessingFee)
    const productService = productCatalog[index % productCatalog.length]
    const customerReference = `09${17 + (index % 10)}-${String(100 + (index % 90)).padStart(3, '0')}-${String(1000 + index).slice(-4)}`
    const shares = sharesForRetailer(retailer.id)
    const hierarchyIds = hierarchyIdsForRetailer(retailer.id)

    generated.push(
      buildTransaction({
        id: `TX-${8800 + index}-${String.fromCharCode(65 + (index % 26))}`,
        createdAt: daysAgoAt(dayOffset % 40, hour, minute),
        retailerOrganizationId: retailer.id,
        ...hierarchyIds,
        retailerName: retailer.name,
        retailerCode: retailer.code,
        customerPayment: payment,
        baseCost,
        platformProcessingFee,
        walletDeduction,
        ...shares,
        productService,
        customerReference,
        status: TRANSACTION_STATUS.COMPLETED,
      }),
    )
  }

  return [...featured, ...generated]
}

/**
 * Seeds missing localStorage collections only.
 * Does not overwrite existing valid data.
 *
 * Exception: empty funding collections are treated as unseeded so the
 * funding module demo data appears after this feature was added.
 */
export function initializeMockData() {
  if (collectionNeedsSeed('users')) {
    saveUsers(getSeedUsers())
  } else {
    // Keep demo admin credentials aligned without wiping other user accounts.
    const existing = getUsers()
    const admin = existing.find((user) => user.email === 'admin@esarisari.local')
    if (admin && admin.password !== ADMIN_DEMO_PASSWORD) {
      saveUsers(
        existing.map((user) =>
          user.email === 'admin@esarisari.local'
            ? { ...user, password: ADMIN_DEMO_PASSWORD }
            : user,
        ),
      )
    }
  }
  if (collectionNeedsSeed('organizations')) {
    saveOrganizations(getSeedOrganizations())
  } else {
    // Ensure newly added demo franchisees exist without wiping other org data.
    const existing = getOrganizations()
    const seedOrgs = getSeedOrganizations()
    const byId = new Map(existing.map((org) => [org.id, org]))

    seedOrgs.forEach((seedOrg) => {
      const current = byId.get(seedOrg.id)
      if (!current) {
        byId.set(seedOrg.id, seedOrg)
        return
      }
      byId.set(seedOrg.id, {
        ...current,
        name: seedOrg.name,
        code: seedOrg.code,
        type: seedOrg.type || current.type,
        parentId: seedOrg.parentId ?? current.parentId,
      })
    })

    saveOrganizations(Array.from(byId.values()))
  }
  if (collectionNeedsSeed('wallets')) {
    saveWallets(getSeedWallets())
    localStorage.setItem(STORAGE_KEYS.WALLET_LEDGER_VERSION, WALLET_LEDGER_VERSION)
  } else {
    const existing = getWallets()
    const seedWallets = getSeedWallets()
    const byId = new Map(existing.map((wallet) => [wallet.id, wallet]))
    const appliedLedgerVersion = localStorage.getItem(STORAGE_KEYS.WALLET_LEDGER_VERSION)
    const shouldRealignOperating =
      appliedLedgerVersion !== WALLET_LEDGER_VERSION

    seedWallets.forEach((seedWallet) => {
      const current = byId.get(seedWallet.id)
      if (!current) {
        byId.set(seedWallet.id, seedWallet)
        return
      }
      if (
        seedWallet.walletType === 'revenue' ||
        shouldRealignOperating
      ) {
        byId.set(seedWallet.id, {
          ...current,
          ...seedWallet,
          availableBalance: seedWallet.availableBalance,
        })
        return
      }
      // Keep live balances, but adopt seeded opening float + minimums when missing.
      const next = { ...current }
      let patched = false
      if (
        seedWallet.walletType !== 'revenue' &&
        !(Number(current.openingBalance) > 0) &&
        Number(seedWallet.openingBalance) > 0
      ) {
        next.openingBalance = seedWallet.openingBalance
        patched = true
      }
      if (
        seedWallet.walletType !== 'revenue' &&
        !(Number(current.minimumBalance) > 0) &&
        Number(seedWallet.minimumBalance) > 0
      ) {
        next.minimumBalance = seedWallet.minimumBalance
        patched = true
      }
      if (patched) {
        byId.set(seedWallet.id, next)
      }
    })

    saveWallets(Array.from(byId.values()))
    if (shouldRealignOperating) {
      // Keep transfer history aligned with reset balances (drop orphan demo transfers).
      saveFundingTransfers(getSeedFundingTransfers())
      localStorage.setItem(STORAGE_KEYS.WALLET_LEDGER_VERSION, WALLET_LEDGER_VERSION)
    }
  }
  if (collectionNeedsSeed('fundingRequests') || isEmptyCollection('fundingRequests')) {
    saveFundingRequests(getSeedFundingRequests())
  } else {
    const existing = getFundingRequests()
    const seedRequests = getSeedFundingRequests()
    const byId = new Map(existing.map((request) => [request.id, request]))
    let changed = false

    seedRequests.forEach((seed) => {
      const current = byId.get(seed.id)
      if (!current) {
        byId.set(seed.id, seed)
        changed = true
        return
      }
      if (!current.notes || !current.proofOfPayment) {
        byId.set(seed.id, {
          ...current,
          notes: current.notes || seed.notes,
          proofOfPayment: current.proofOfPayment || seed.proofOfPayment,
        })
        changed = true
      }
    })

    if (changed) {
      saveFundingRequests(Array.from(byId.values()))
    }
  }
  if (collectionNeedsSeed('fundingTransfers') || isEmptyCollection('fundingTransfers')) {
    saveFundingTransfers(getSeedFundingTransfers())
  } else {
    const existing = getFundingTransfers()
    const seedTransfers = getSeedFundingTransfers()
    const missing = seedTransfers.filter(
      (transfer) => !existing.some((item) => item.id === transfer.id),
    )
    if (missing.length > 0) {
      saveFundingTransfers([...existing, ...missing])
    }
  }
  if (collectionNeedsSeed('revenueSharing')) {
    saveRevenueSharing(getSeedRevenueSharing())
  } else {
    const existing = getRevenueSharing()
    const seed = getSeedRevenueSharing()[0]
    const list = Array.isArray(existing) ? existing : []
    if (list.length === 0) {
      saveRevenueSharing(getSeedRevenueSharing())
    } else {
      const next = list.map((entry, index) => {
        if (index !== 0 && entry.id !== 'revshare-default') return entry
        return {
          ...entry,
          retailerPercentage: seed.retailerPercentage,
          franchiseePercentage: seed.franchiseePercentage,
          subfranchiseePercentage: seed.subfranchiseePercentage,
          companyPercentage: seed.companyPercentage,
          updatedAt: new Date().toISOString(),
        }
      })
      const hasDefault = next.some((entry) => entry.id === 'revshare-default')
      saveRevenueSharing(hasDefault ? next : [seed, ...next])
    }
  }
  if (
    collectionNeedsSeed('commissionSettings') ||
    localStorage.getItem(STORAGE_KEYS.COMMISSION_SETTINGS_SEED_VERSION) !==
      COMMISSION_SETTINGS_SEED_VERSION
  ) {
    saveCommissionSettings(getSeedCommissionSettings())
    localStorage.setItem(
      STORAGE_KEYS.COMMISSION_SETTINGS_SEED_VERSION,
      COMMISSION_SETTINGS_SEED_VERSION,
    )
  } else {
    const existing = getCommissionSettings()
    const seed = getSeedCommissionSettings()
    const organizations = getOrganizations()
    const orgById = Object.fromEntries(organizations.map((org) => [org.id, org]))
    const byId = new Map(existing.map((entry) => [entry.id, entry]))
    let changed = false

    seed.forEach((seedEntry) => {
      if (!byId.has(seedEntry.id)) {
        byId.set(seedEntry.id, seedEntry)
        changed = true
        return
      }
      const current = byId.get(seedEntry.id)
      const retailer = orgById[current.retailerOrganizationId]
      const hierarchy = resolveCommissionHierarchy(retailer, orgById)
      const aligned = normalizeCommissionShares({
        retailerPercentage: current.retailerPercentage,
        franchiseePercentage: hierarchy.hasFranchisee
          ? current.franchiseePercentage
          : 0,
        companyPercentage: DEFAULT_PLATFORM_FEE_PERCENTAGE,
        remainderTarget: hierarchy.remainderTarget,
      })
      const nextEntry = {
        ...current,
        ...aligned,
        franchiseeOrganizationId: hierarchy.franchisee?.id || '',
        subfranchiseeOrganizationId: hierarchy.subfranchisee?.id || '',
      }
      if (
        Number(current.companyPercentage) !== aligned.companyPercentage ||
        Number(current.subfranchiseePercentage) !==
          aligned.subfranchiseePercentage ||
        Number(current.franchiseePercentage) !== aligned.franchiseePercentage ||
        current.franchiseeOrganizationId !== nextEntry.franchiseeOrganizationId ||
        current.subfranchiseeOrganizationId !== nextEntry.subfranchiseeOrganizationId
      ) {
        byId.set(seedEntry.id, nextEntry)
        changed = true
      }
    })

    if (changed) {
      saveCommissionSettings(Array.from(byId.values()))
    }
  }
  if (
    collectionNeedsSeed('transactions') ||
    isEmptyCollection('transactions') ||
    localStorage.getItem(STORAGE_KEYS.TRANSACTIONS_SEED_VERSION) !==
      TRANSACTIONS_SEED_VERSION
  ) {
    saveTransactions(getSeedTransactions())
    localStorage.setItem(
      STORAGE_KEYS.TRANSACTIONS_SEED_VERSION,
      TRANSACTIONS_SEED_VERSION,
    )
  } else {
    const existing = getTransactions()
    const seedTransactions = getSeedTransactions()
    const byId = new Map(existing.map((tx) => [tx.id, tx]))
    let changed = false

    // Demo surfaces completed transactions only — normalize legacy pending rows.
    byId.forEach((tx, id) => {
      let next = tx
      if (tx.status === TRANSACTION_STATUS.PENDING) {
        next = { ...next, status: TRANSACTION_STATUS.COMPLETED }
        changed = true
      }
      const distributable = Number(next.distributableRevenue)
      if (
        Number.isFinite(distributable) &&
        Number(next.totalDistributed) !== distributable
      ) {
        next = { ...next, totalDistributed: distributable }
        changed = true
      }
      if (
        next.retailerPercentage == null ||
        next.franchiseePercentage == null ||
        next.companyPercentage == null
      ) {
        const seedTx = seedTransactions.find((entry) => entry.id === id)
        if (seedTx) {
          next = {
            ...next,
            retailerPercentage: seedTx.retailerPercentage,
            franchiseePercentage: seedTx.franchiseePercentage,
            subfranchiseePercentage: seedTx.subfranchiseePercentage,
            companyPercentage: seedTx.companyPercentage,
            retailerShare: seedTx.retailerShare,
          }
          changed = true
        }
      } else if (Number.isFinite(distributable)) {
        const alignedRetailerShare = roundMoney(
          (distributable * Number(next.retailerPercentage || 0)) / 100,
        )
        if (Number(next.retailerShare) !== alignedRetailerShare) {
          next = { ...next, retailerShare: alignedRetailerShare }
          changed = true
        }
      }
      if (next !== tx) byId.set(id, next)
    })

    seedTransactions.forEach((seedTx) => {
      if (!byId.has(seedTx.id)) {
        byId.set(seedTx.id, seedTx)
        changed = true
        return
      }
      const current = byId.get(seedTx.id)
      const matchedProduct = matchProductServiceToPayment(
        current.productService || seedTx.productService,
        current.customerPayment ?? seedTx.customerPayment,
      )
      const nextProduct = matchedProduct
      const nextCustomerRef =
        current.customerReference || seedTx.customerReference
      if (
        current.productService !== nextProduct ||
        current.customerReference !== nextCustomerRef
      ) {
        byId.set(seedTx.id, {
          ...current,
          productService: nextProduct,
          customerReference: nextCustomerRef,
        })
        changed = true
      }
    })

    if (changed) {
      saveTransactions(Array.from(byId.values()))
    }
  }
  // Always recompute revenue wallets from the finalized transaction ledger.
  reconcileRevenueWallets()
  if (collectionNeedsSeed('settlements')) {
    saveSettlements([])
  }
}

/**
 * Clears all business data and reseeds original demo values.
 * Session is preserved by the caller if needed.
 */
export function resetDemoData() {
  clearAllBusinessData()
  saveUsers(getSeedUsers())
  saveOrganizations(getSeedOrganizations())
  saveWallets(getSeedWallets())
  saveFundingRequests(getSeedFundingRequests())
  saveFundingTransfers(getSeedFundingTransfers())
  saveRevenueSharing(getSeedRevenueSharing())
  saveCommissionSettings(getSeedCommissionSettings())
  saveTransactions(getSeedTransactions())
  saveSettlements([])
  localStorage.setItem(STORAGE_KEYS.WALLET_LEDGER_VERSION, WALLET_LEDGER_VERSION)
  localStorage.setItem(
    STORAGE_KEYS.TRANSACTIONS_SEED_VERSION,
    TRANSACTIONS_SEED_VERSION,
  )
  localStorage.setItem(
    STORAGE_KEYS.COMMISSION_SETTINGS_SEED_VERSION,
    COMMISSION_SETTINGS_SEED_VERSION,
  )
}
