import { STORAGE_KEYS } from '@/lib/constants'
import {
  DEFAULT_ONBOARDING_CLIENT_TYPE,
  DEFAULT_ONBOARDING_FRANCHISE_SETUP,
  DEFAULT_REVENUE_SPLIT_DEFAULTS,
  EMPTY_ONBOARDING_CLIENT_INFO,
  parseOnboardingClientInfo,
  parseOnboardingClientType,
  parseOnboardingFranchiseSetup,
  parseOnboardingRevenueSplit,
} from '@/lib/onboardingSetup'

function safeParse(raw, fallback) {
  if (raw === null || raw === undefined) {
    return { missing: true, data: fallback }
  }

  try {
    const parsed = JSON.parse(raw)
    if (parsed === null || parsed === undefined) {
      return { missing: true, data: fallback }
    }
    return { missing: false, data: parsed }
  } catch {
    return { malformed: true, data: fallback }
  }
}

function readArray(key) {
  const result = safeParse(localStorage.getItem(key), [])
  if (result.malformed || !Array.isArray(result.data)) {
    return { needsSeed: true, data: [] }
  }
  if (result.missing) {
    return { needsSeed: true, data: [] }
  }
  return { needsSeed: false, data: result.data }
}

function readObjectOrArray(key, fallback) {
  const result = safeParse(localStorage.getItem(key), fallback)
  if (result.malformed) {
    return { needsSeed: true, data: fallback }
  }
  if (result.missing) {
    return { needsSeed: true, data: fallback }
  }
  return { needsSeed: false, data: result.data }
}

function write(key, value) {
  localStorage.setItem(key, JSON.stringify(value))
}

function createCollectionHelpers(key) {
  return {
    get() {
      return readArray(key).data
    },
    save(data) {
      write(key, Array.isArray(data) ? data : [])
    },
    needsSeed() {
      return readArray(key).needsSeed
    },
    clear() {
      localStorage.removeItem(key)
    },
  }
}

const users = createCollectionHelpers(STORAGE_KEYS.USERS)
const organizations = createCollectionHelpers(STORAGE_KEYS.ORGANIZATIONS)
const wallets = createCollectionHelpers(STORAGE_KEYS.WALLETS)
const fundingRequests = createCollectionHelpers(STORAGE_KEYS.FUNDING_REQUESTS)
const fundingTransfers = createCollectionHelpers(STORAGE_KEYS.FUNDING_TRANSFERS)
const transactions = createCollectionHelpers(STORAGE_KEYS.TRANSACTIONS)
const settlements = createCollectionHelpers(STORAGE_KEYS.SETTLEMENTS)

const revenueSharing = {
  get() {
    return readObjectOrArray(STORAGE_KEYS.REVENUE_SHARING, []).data
  },
  save(data) {
    write(STORAGE_KEYS.REVENUE_SHARING, data)
  },
  needsSeed() {
    return readObjectOrArray(STORAGE_KEYS.REVENUE_SHARING, []).needsSeed
  },
  clear() {
    localStorage.removeItem(STORAGE_KEYS.REVENUE_SHARING)
  },
}

const commissionSettings = createCollectionHelpers(STORAGE_KEYS.COMMISSION_SETTINGS)
const depositRates = createCollectionHelpers(STORAGE_KEYS.DEPOSIT_RATES)

const onboardingClientInfo = {
  get() {
    const result = readObjectOrArray(STORAGE_KEYS.ONBOARDING_CLIENT_INFO, null)
    return parseOnboardingClientInfo(result.data) ?? EMPTY_ONBOARDING_CLIENT_INFO
  },
  save(data) {
    const parsed = parseOnboardingClientInfo(data)
    write(
      STORAGE_KEYS.ONBOARDING_CLIENT_INFO,
      parsed ?? EMPTY_ONBOARDING_CLIENT_INFO,
    )
  },
  clear() {
    localStorage.removeItem(STORAGE_KEYS.ONBOARDING_CLIENT_INFO)
  },
}

const onboardingRevenueSplit = {
  get() {
    const result = readObjectOrArray(STORAGE_KEYS.ONBOARDING_REVENUE_SPLIT, null)
    return parseOnboardingRevenueSplit(result.data) ?? DEFAULT_REVENUE_SPLIT_DEFAULTS
  },
  save(data) {
    const parsed = parseOnboardingRevenueSplit(data)
    write(
      STORAGE_KEYS.ONBOARDING_REVENUE_SPLIT,
      parsed ?? DEFAULT_REVENUE_SPLIT_DEFAULTS,
    )
  },
  clear() {
    localStorage.removeItem(STORAGE_KEYS.ONBOARDING_REVENUE_SPLIT)
  },
}

const onboardingClientType = {
  get() {
    const result = safeParse(
      localStorage.getItem(STORAGE_KEYS.ONBOARDING_CLIENT_TYPE),
      DEFAULT_ONBOARDING_CLIENT_TYPE,
    )
    return parseOnboardingClientType(result.data)
  },
  save(data) {
    write(STORAGE_KEYS.ONBOARDING_CLIENT_TYPE, parseOnboardingClientType(data))
  },
  clear() {
    localStorage.removeItem(STORAGE_KEYS.ONBOARDING_CLIENT_TYPE)
  },
}

const onboardingFranchiseSetup = {
  get() {
    const result = readObjectOrArray(STORAGE_KEYS.ONBOARDING_FRANCHISE_SETUP, null)
    return parseOnboardingFranchiseSetup(result.data)
  },
  save(data) {
    write(
      STORAGE_KEYS.ONBOARDING_FRANCHISE_SETUP,
      parseOnboardingFranchiseSetup({
        ...DEFAULT_ONBOARDING_FRANCHISE_SETUP,
        ...(data && typeof data === 'object' ? data : {}),
      }),
    )
  },
  clear() {
    localStorage.removeItem(STORAGE_KEYS.ONBOARDING_FRANCHISE_SETUP)
  },
}

const franchiseCollections = {
  get() {
    const result = readObjectOrArray(STORAGE_KEYS.FRANCHISE_COLLECTIONS, {})
    if (!result.data || Array.isArray(result.data) || typeof result.data !== 'object') {
      return {}
    }
    return result.data
  },
  save(data) {
    write(
      STORAGE_KEYS.FRANCHISE_COLLECTIONS,
      data && typeof data === 'object' && !Array.isArray(data) ? data : {},
    )
  },
  clear() {
    localStorage.removeItem(STORAGE_KEYS.FRANCHISE_COLLECTIONS)
  },
}

export function getUsers() {
  return users.get()
}

export function saveUsers(data) {
  users.save(data)
}

export function getOrganizations() {
  return organizations.get()
}

export function saveOrganizations(data) {
  organizations.save(data)
}

export function getWallets() {
  return wallets.get()
}

export function saveWallets(data) {
  wallets.save(data)
}

export function getFundingRequests() {
  return fundingRequests.get()
}

export function saveFundingRequests(data) {
  fundingRequests.save(data)
}

export function getFundingTransfers() {
  return fundingTransfers.get()
}

export function saveFundingTransfers(data) {
  fundingTransfers.save(data)
}

export function getRevenueSharing() {
  return revenueSharing.get()
}

export function saveRevenueSharing(data) {
  revenueSharing.save(data)
}

export function getCommissionSettings() {
  return commissionSettings.get()
}

export function saveCommissionSettings(data) {
  commissionSettings.save(data)
}

export function getDepositRates() {
  return depositRates.get()
}

export function saveDepositRates(data) {
  depositRates.save(data)
}

export function getFranchiseCollections() {
  return franchiseCollections.get()
}

export function saveFranchiseCollections(data) {
  franchiseCollections.save(data)
}

export function getOnboardingClientInfo() {
  return onboardingClientInfo.get()
}

export function saveOnboardingClientInfo(data) {
  onboardingClientInfo.save(data)
}

export function getOnboardingRevenueSplit() {
  return onboardingRevenueSplit.get()
}

export function saveOnboardingRevenueSplit(data) {
  onboardingRevenueSplit.save(data)
}

export function getOnboardingClientType() {
  return onboardingClientType.get()
}

export function saveOnboardingClientType(data) {
  onboardingClientType.save(data)
}

export function getOnboardingFranchiseSetup() {
  return onboardingFranchiseSetup.get()
}

export function saveOnboardingFranchiseSetup(data) {
  onboardingFranchiseSetup.save(data)
}

export function getTransactions() {
  return transactions.get()
}

export function saveTransactions(data) {
  transactions.save(data)
}

export function getSettlements() {
  return settlements.get()
}

export function saveSettlements(data) {
  settlements.save(data)
}

export function getSession() {
  const result = safeParse(localStorage.getItem(STORAGE_KEYS.SESSION), null)
  if (result.malformed || result.missing) {
    return null
  }
  return result.data
}

export function saveSession(session) {
  write(STORAGE_KEYS.SESSION, session)
}

export function clearSession() {
  localStorage.removeItem(STORAGE_KEYS.SESSION)
}

function readNotificationReads() {
  const result = readObjectOrArray(STORAGE_KEYS.NOTIFICATION_READS, {})
  if (!result.data || Array.isArray(result.data) || typeof result.data !== 'object') {
    return {}
  }
  return result.data
}

export function getNotificationReads() {
  return readNotificationReads()
}

export function saveNotificationReads(data) {
  write(
    STORAGE_KEYS.NOTIFICATION_READS,
    data && typeof data === 'object' && !Array.isArray(data) ? data : {},
  )
}

export function markNotificationsRead(organizationId, notificationIds) {
  if (!organizationId) return getNotificationReads()
  const ids = (notificationIds || []).filter(Boolean)
  if (ids.length === 0) return getNotificationReads()

  const all = { ...readNotificationReads() }
  const current = { ...(all[organizationId] || {}) }
  const readAt = new Date().toISOString()
  ids.forEach((id) => {
    current[id] = { readAt }
  })
  all[organizationId] = current
  saveNotificationReads(all)
  return all
}

/** Business data keys only — excludes session */
export const BUSINESS_COLLECTIONS = {
  users,
  organizations,
  wallets,
  fundingRequests,
  fundingTransfers,
  revenueSharing,
  commissionSettings,
  depositRates,
  transactions,
  settlements,
}

/**
 * Clears all business mock data (keeps session unless callers clear it).
 */
export function clearAllBusinessData() {
  Object.values(BUSINESS_COLLECTIONS).forEach((collection) => {
    collection.clear()
  })
  localStorage.removeItem(STORAGE_KEYS.WALLET_LEDGER_VERSION)
  localStorage.removeItem(STORAGE_KEYS.TRANSACTIONS_SEED_VERSION)
  localStorage.removeItem(STORAGE_KEYS.COMMISSION_SETTINGS_SEED_VERSION)
  localStorage.removeItem(STORAGE_KEYS.INTERNET_CREDITS_SEED_VERSION)
  localStorage.removeItem(STORAGE_KEYS.NETWORK_SEED_VERSION)
  localStorage.removeItem(STORAGE_KEYS.NOTIFICATION_READS)
  localStorage.removeItem(STORAGE_KEYS.FRANCHISE_COLLECTIONS)
  localStorage.removeItem(STORAGE_KEYS.ONBOARDING_REVENUE_SPLIT)
  localStorage.removeItem(STORAGE_KEYS.ONBOARDING_CLIENT_TYPE)
  localStorage.removeItem(STORAGE_KEYS.ONBOARDING_CLIENT_INFO)
  localStorage.removeItem(STORAGE_KEYS.ONBOARDING_FRANCHISE_SETUP)
}

export function collectionNeedsSeed(name) {
  return BUSINESS_COLLECTIONS[name]?.needsSeed() ?? true
}
