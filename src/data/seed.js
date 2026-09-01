import {
  FUNDING_STATUS,
  INTERNET_CREDITS_SEED_VERSION,
  NETWORK_SEED_VERSION,
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
  DEFAULT_COMMISSION_SHARES,
  normalizeCommissionShares,
  resolveCommissionHierarchy,
} from '@/lib/commission'
import { matchProductServiceToPayment } from '@/lib/transactions'
import {
  collectionNeedsSeed,
  getCommissionSettings,
  getDepositRates,
  getFundingRequests,
  getFundingTransfers,
  getOrganizations,
  getRevenueSharing,
  getTransactions,
  getUsers,
  getWallets,
  saveCommissionSettings,
  saveDepositRates,
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
      name: 'Franchisee A',
      email: 'franchisee-a@esarisari.local',
      password: DEMO_PASSWORD,
      role: ROLES.FRANCHISEE,
      organizationId: ORG_IDS.FRANCHISE_001,
      status: 'active',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'user-franchisee-b',
      name: 'Franchisee B',
      email: 'franchisee-b@esarisari.local',
      password: DEMO_PASSWORD,
      role: ROLES.FRANCHISEE,
      organizationId: ORG_IDS.FRANCHISE_002,
      status: 'active',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'user-retailer',
      name: 'Retailer A',
      email: 'retailer-a@esarisari.local',
      password: DEMO_PASSWORD,
      role: ROLES.RETAILER,
      organizationId: ORG_IDS.RETAILER_001,
      status: 'active',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'user-retailer-b',
      name: 'Retailer B',
      email: 'retailer-b@esarisari.local',
      password: DEMO_PASSWORD,
      role: ROLES.RETAILER,
      organizationId: ORG_IDS.RETAILER_002,
      status: 'active',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'user-retailer-c',
      name: 'Retailer C',
      email: 'retailer-c@esarisari.local',
      password: DEMO_PASSWORD,
      role: ROLES.RETAILER,
      organizationId: ORG_IDS.RETAILER_003,
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
      name: 'Franchisee A',
      code: 'FR-01010',
      type: 'franchisee',
      parentId: ORG_IDS.SUB_001,
      status: 'active',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: ORG_IDS.FRANCHISE_002,
      name: 'Franchisee B',
      code: 'FR-00892',
      type: 'franchisee',
      parentId: ORG_IDS.SUB_001,
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
      name: 'Retailer C',
      code: 'RT-00003',
      type: 'retailer',
      parentId: ORG_IDS.FRANCHISE_002,
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
]

/**
 * Keep persisted revenue wallets aligned with completed-transaction share totals.
 * Must run after transactions are seeded/migrated or a demo sale is recorded.
 */
export function reconcileRevenueWallets() {
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

  const orgIds = new Set(getOrganizations().map((org) => org.id))
  const pruned = Array.from(byId.values()).filter((wallet) =>
    orgIds.has(wallet.organizationId),
  )
  if (pruned.length !== byId.size) {
    saveWallets(pruned)
  }
}

function netSeedTransferAmount(organizationId, transfers) {
  return roundMoney(
    (transfers || []).reduce((sum, transfer) => {
      if (
        transfer.status !== FUNDING_STATUS.COMPLETED &&
        transfer.status !== FUNDING_STATUS.RELEASED &&
        transfer.status !== FUNDING_STATUS.APPROVED
      ) {
        return sum
      }
      const amount = Number(transfer.amount) || 0
      if (transfer.toOrganizationId === organizationId) return sum + amount
      if (transfer.fromOrganizationId === organizationId) return sum - amount
      return sum
    }, 0),
  )
}

/**
 * Keep seed Available Credits reconcilable with the credit statement:
 * opening + posted transfers = available. If that would go negative,
 * keep the listed available float and raise opening instead.
 */
function applySeedTransferLedger(wallet, transfers) {
  const opening = roundMoney(Number(wallet.openingBalance) || 0)
  const net = netSeedTransferAmount(wallet.organizationId, transfers)
  const derivedAvailable = roundMoney(opening + net)
  if (derivedAvailable >= 0) {
    return { ...wallet, availableBalance: derivedAvailable }
  }
  const floor = roundMoney(Math.max(Number(wallet.availableBalance) || 0, 0))
  return {
    ...wallet,
    availableBalance: floor,
    openingBalance: roundMoney(floor - net),
  }
}

export function getSeedWallets() {
  const transactions = getSeedTransactions()
  const revenueSharing = getSeedRevenueSharing()
  const transfers = getSeedFundingTransfers()

  // Opening float is the intended starting inventory. Available Credits are
  // derived from opening + posted seed transfers so Reports statements
  // (opening + in − out) match the live wallet.
  const rawOperating = [
    {
      id: 'wallet-platform',
      organizationId: ORG_IDS.PLATFORM,
      walletType: 'master',
      availableBalance: 500000,
      openingBalance: 500000,
      minimumBalance: 5000,
      status: 'active',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'wallet-sub-001',
      organizationId: ORG_IDS.SUB_001,
      walletType: 'operating',
      availableBalance: 135000,
      openingBalance: 135000,
      minimumBalance: 5000,
      status: 'active',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'wallet-franchise-001',
      organizationId: ORG_IDS.FRANCHISE_001,
      walletType: 'operating',
      availableBalance: 0,
      openingBalance: 0,
      minimumBalance: 5000,
      status: 'active',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'wallet-franchise-002',
      organizationId: ORG_IDS.FRANCHISE_002,
      walletType: 'operating',
      availableBalance: 0,
      openingBalance: 0,
      minimumBalance: 5000,
      status: 'active',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'wallet-retailer-001',
      organizationId: ORG_IDS.RETAILER_001,
      walletType: 'operating',
      availableBalance: 0,
      openingBalance: 0,
      minimumBalance: 5000,
      status: 'active',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'wallet-retailer-002',
      organizationId: ORG_IDS.RETAILER_002,
      walletType: 'operating',
      availableBalance: 0,
      openingBalance: 0,
      minimumBalance: 5000,
      status: 'active',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'wallet-retailer-003',
      organizationId: ORG_IDS.RETAILER_003,
      walletType: 'operating',
      availableBalance: 0,
      openingBalance: 0,
      minimumBalance: 5000,
      status: 'active',
      createdAt: now,
      updatedAt: now,
    },
  ]

  const operating = rawOperating.map((wallet) =>
    applySeedTransferLedger(wallet, transfers),
  )

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
    retailerPercentage: DEFAULT_COMMISSION_SHARES.retailerPercentage,
    franchiseePercentage: DEFAULT_COMMISSION_SHARES.franchiseePercentage,
    companyPercentage: DEFAULT_COMMISSION_SHARES.companyPercentage,
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

  // Default sheet split: retailer 10 / franchisee 20 / sub 30 / platform 40 of sales.
  const sharePlans = [
    {
      retailerPercentage: DEFAULT_COMMISSION_SHARES.retailerPercentage,
      franchiseePercentage: DEFAULT_COMMISSION_SHARES.franchiseePercentage,
      status: 'active',
    },
  ]

  return retailers.map((retailer, index) => {
    const plan = sharePlans[index % sharePlans.length]
    const hierarchy = resolveCommissionHierarchy(retailer, orgById)
    const shares = normalizeCommissionShares({
      retailerPercentage: plan.retailerPercentage,
      franchiseePercentage: hierarchy.hasFranchisee
        ? plan.franchiseePercentage
        : 0,
      companyPercentage: DEFAULT_COMMISSION_SHARES.companyPercentage,
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

function migrateCommissionSettingsPreservingPlatform(
  existing = [],
  seed = [],
  orgById = {},
) {
  const usedIds = new Set()
  const next = seed.map((seedEntry) => {
    const current =
      existing.find((entry) => entry.id === seedEntry.id) ||
      existing.find(
        (entry) =>
          entry.retailerOrganizationId === seedEntry.retailerOrganizationId,
      )
    if (!current) return seedEntry
    usedIds.add(current.id)
    const retailer = orgById[current.retailerOrganizationId]
    const hierarchy = resolveCommissionHierarchy(retailer, orgById)
    const aligned = normalizeCommissionShares({
      retailerPercentage: DEFAULT_COMMISSION_SHARES.retailerPercentage,
      franchiseePercentage: hierarchy.hasFranchisee
        ? DEFAULT_COMMISSION_SHARES.franchiseePercentage
        : 0,
      companyPercentage: current.companyPercentage,
      remainderTarget: hierarchy.remainderTarget,
    })
    return {
      ...current,
      ...aligned,
      franchiseeOrganizationId: hierarchy.franchisee?.id || '',
      subfranchiseeOrganizationId: hierarchy.subfranchisee?.id || '',
    }
  })

  existing.forEach((entry) => {
    if (usedIds.has(entry.id)) return
    if (orgById[entry.retailerOrganizationId]?.type !== 'retailer') return
    const retailer = orgById[entry.retailerOrganizationId]
    const hierarchy = resolveCommissionHierarchy(retailer, orgById)
    const aligned = normalizeCommissionShares({
      retailerPercentage: DEFAULT_COMMISSION_SHARES.retailerPercentage,
      franchiseePercentage: hierarchy.hasFranchisee
        ? DEFAULT_COMMISSION_SHARES.franchiseePercentage
        : 0,
      companyPercentage: entry.companyPercentage,
      remainderTarget: hierarchy.remainderTarget,
    })
    next.push({
      ...entry,
      ...aligned,
      franchiseeOrganizationId: hierarchy.franchisee?.id || '',
      subfranchiseeOrganizationId: hierarchy.subfranchisee?.id || '',
    })
  })

  return next
}

export function getSeedDepositRates() {
  return []
}

/**
 * Demo starts with an empty Internet Credits request/release ledger
 * so roles can walk cash-in and credit loads themselves.
 */
export function getSeedFundingRequests() {
  return []
}

export function getSeedFundingTransfers() {
  return []
}

/**
 * Demo starts with an empty sales ledger so retailers can record dummy sales
 * and walk the result through Revenue and Reports for themselves and uplines.
 */
export function getSeedTransactions() {
  return []
}

/**
 * Seeds missing localStorage collections only.
 * Does not overwrite existing valid data.
 */
export function initializeMockData() {
  if (collectionNeedsSeed('users')) {
    saveUsers(getSeedUsers())
  } else {
    const existing = getUsers()
    const seedUsers = getSeedUsers()
    const byId = new Map(existing.map((user) => [user.id, user]))
    let changed = false

    seedUsers.forEach((seedUser) => {
      const current = byId.get(seedUser.id)
      if (!current) {
        byId.set(seedUser.id, seedUser)
        changed = true
        return
      }
      const next = {
        ...current,
        name: seedUser.name,
        email: seedUser.email,
        role: seedUser.role,
        organizationId: seedUser.organizationId,
        password: seedUser.password,
        status: seedUser.status || current.status,
      }
      if (
        current.name !== next.name ||
        current.email !== next.email ||
        current.role !== next.role ||
        current.organizationId !== next.organizationId ||
        current.password !== next.password
      ) {
        byId.set(seedUser.id, next)
        changed = true
      }
    })

    if (changed) {
      saveUsers(Array.from(byId.values()))
    }
  }
  if (
    collectionNeedsSeed('organizations') ||
    localStorage.getItem(STORAGE_KEYS.NETWORK_SEED_VERSION) !==
      NETWORK_SEED_VERSION
  ) {
    saveOrganizations(getSeedOrganizations())
    saveWallets(getSeedWallets())
    saveCommissionSettings(getSeedCommissionSettings())
    saveDepositRates(getSeedDepositRates())
    localStorage.setItem(STORAGE_KEYS.NETWORK_SEED_VERSION, NETWORK_SEED_VERSION)
    localStorage.setItem(STORAGE_KEYS.WALLET_LEDGER_VERSION, WALLET_LEDGER_VERSION)
    localStorage.setItem(
      STORAGE_KEYS.COMMISSION_SETTINGS_SEED_VERSION,
      COMMISSION_SETTINGS_SEED_VERSION,
    )
  } else {
    const existing = getOrganizations()
    const seedOrgs = getSeedOrganizations()
    const seedIds = new Set(seedOrgs.map((org) => org.id))
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

    saveOrganizations(
      Array.from(byId.values()).filter((org) => seedIds.has(org.id)),
    )
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

    const allowedWalletIds = new Set(seedWallets.map((wallet) => wallet.id))
    saveWallets(
      Array.from(byId.values()).filter((wallet) =>
        allowedWalletIds.has(wallet.id),
      ),
    )
    if (shouldRealignOperating) {
      // Keep transfer history aligned with reset balances (drop orphan demo transfers).
      saveFundingTransfers(getSeedFundingTransfers())
      localStorage.setItem(STORAGE_KEYS.WALLET_LEDGER_VERSION, WALLET_LEDGER_VERSION)
    }
  }
  if (
    collectionNeedsSeed('fundingRequests') ||
    localStorage.getItem(STORAGE_KEYS.INTERNET_CREDITS_SEED_VERSION) !==
      INTERNET_CREDITS_SEED_VERSION
  ) {
    saveFundingRequests(getSeedFundingRequests())
    saveFundingTransfers(getSeedFundingTransfers())
    localStorage.setItem(
      STORAGE_KEYS.INTERNET_CREDITS_SEED_VERSION,
      INTERNET_CREDITS_SEED_VERSION,
    )
  }
  if (collectionNeedsSeed('fundingTransfers')) {
    saveFundingTransfers(getSeedFundingTransfers())
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
    const existing = collectionNeedsSeed('commissionSettings')
      ? []
      : getCommissionSettings()
    const seed = getSeedCommissionSettings()
    if (!existing.length) {
      saveCommissionSettings(seed)
    } else {
      const organizations = getOrganizations()
      const orgById = Object.fromEntries(
        organizations.map((org) => [org.id, org]),
      )
      saveCommissionSettings(
        migrateCommissionSettingsPreservingPlatform(existing, seed, orgById),
      )
    }
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
        companyPercentage: current.companyPercentage,
        subfranchiseePercentage: current.subfranchiseePercentage,
        remainderTarget: hierarchy.remainderTarget,
        lockSubShare: hierarchy.hasSubfranchisee,
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

    const kept = Array.from(byId.values()).filter(
      (entry) => orgById[entry.retailerOrganizationId]?.type === 'retailer',
    )
    if (kept.length !== byId.size) {
      saveCommissionSettings(kept)
    }
  }

  if (
    collectionNeedsSeed('depositRates') ||
    localStorage.getItem(STORAGE_KEYS.NETWORK_SEED_VERSION) !==
      NETWORK_SEED_VERSION
  ) {
    saveDepositRates(getSeedDepositRates())
  } else {
    const seedOrgIds = new Set(getSeedOrganizations().map((org) => org.id))
    const existing = getDepositRates()
    const next = existing.filter(
      (row) =>
        seedOrgIds.has(row.organizationId) ||
        seedOrgIds.has(row.parentOrganizationId),
    )
    if (next.length !== existing.length) {
      saveDepositRates(next)
    }
  }

  if (
    collectionNeedsSeed('transactions') ||
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

    const seedOrgIds = new Set(getSeedOrganizations().map((org) => org.id))
    const keptTx = Array.from(byId.values()).filter((tx) =>
      seedOrgIds.has(tx.retailerOrganizationId),
    )
    if (keptTx.length !== byId.size) {
      saveTransactions(keptTx)
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
  saveDepositRates(getSeedDepositRates())
  saveTransactions(getSeedTransactions())
  saveSettlements([])
  localStorage.setItem(STORAGE_KEYS.NETWORK_SEED_VERSION, NETWORK_SEED_VERSION)
  localStorage.setItem(STORAGE_KEYS.WALLET_LEDGER_VERSION, WALLET_LEDGER_VERSION)
  localStorage.setItem(
    STORAGE_KEYS.TRANSACTIONS_SEED_VERSION,
    TRANSACTIONS_SEED_VERSION,
  )
  localStorage.setItem(
    STORAGE_KEYS.COMMISSION_SETTINGS_SEED_VERSION,
    COMMISSION_SETTINGS_SEED_VERSION,
  )
  localStorage.setItem(
    STORAGE_KEYS.INTERNET_CREDITS_SEED_VERSION,
    INTERNET_CREDITS_SEED_VERSION,
  )
}
