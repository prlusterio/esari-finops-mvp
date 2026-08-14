import { STORAGE_KEYS } from '@/lib/constants'

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
}

export function collectionNeedsSeed(name) {
  return BUSINESS_COLLECTIONS[name]?.needsSeed() ?? true
}
