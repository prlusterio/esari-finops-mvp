import { ORG_IDS, ROLES } from '@/lib/constants'
import {
  collectionNeedsSeed,
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

export function getSeedUsers() {
  return [
    {
      id: 'user-admin',
      name: 'eSariSari Admin',
      email: 'admin@esarisari.local',
      password: 'password123',
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
      password: 'password123',
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
      password: 'password123',
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
      password: 'password123',
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
      type: 'platform',
      parentId: null,
      status: 'active',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: ORG_IDS.SUB_001,
      name: 'Northern Mindanao Sub-Franchisee',
      type: 'subfranchisee',
      parentId: ORG_IDS.PLATFORM,
      status: 'active',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: ORG_IDS.FRANCHISE_001,
      name: 'CDO Franchisee',
      type: 'franchisee',
      parentId: ORG_IDS.SUB_001,
      status: 'active',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: ORG_IDS.RETAILER_001,
      name: 'Retailer A',
      type: 'retailer',
      parentId: ORG_IDS.FRANCHISE_001,
      status: 'active',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: ORG_IDS.RETAILER_002,
      name: 'Retailer B',
      type: 'retailer',
      parentId: ORG_IDS.FRANCHISE_001,
      status: 'active',
      createdAt: now,
      updatedAt: now,
    },
  ]
}

export function getSeedWallets() {
  return [
    {
      id: 'wallet-platform',
      organizationId: ORG_IDS.PLATFORM,
      walletType: 'master',
      availableBalance: 500000,
      minimumBalance: 0,
      status: 'active',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'wallet-sub-001',
      organizationId: ORG_IDS.SUB_001,
      walletType: 'operating',
      availableBalance: 100000,
      minimumBalance: 0,
      status: 'active',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'wallet-franchise-001',
      organizationId: ORG_IDS.FRANCHISE_001,
      walletType: 'operating',
      availableBalance: 50000,
      minimumBalance: 0,
      status: 'active',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'wallet-retailer-001',
      organizationId: ORG_IDS.RETAILER_001,
      walletType: 'operating',
      availableBalance: 10000,
      minimumBalance: 0,
      status: 'active',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'wallet-retailer-002',
      organizationId: ORG_IDS.RETAILER_002,
      walletType: 'operating',
      availableBalance: 5000,
      minimumBalance: 0,
      status: 'active',
      createdAt: now,
      updatedAt: now,
    },
  ]
}

export function getSeedRevenueSharing() {
  return [
    {
      id: 'revshare-default',
      retailerPercentage: 10,
      franchiseePercentage: 30,
      subfranchiseePercentage: 20,
      companyPercentage: 40,
      status: 'active',
      createdAt: now,
      updatedAt: now,
    },
  ]
}

/**
 * Seeds missing localStorage collections only.
 * Does not overwrite existing valid data.
 */
export function initializeMockData() {
  if (collectionNeedsSeed('users')) {
    saveUsers(getSeedUsers())
  }
  if (collectionNeedsSeed('organizations')) {
    saveOrganizations(getSeedOrganizations())
  }
  if (collectionNeedsSeed('wallets')) {
    saveWallets(getSeedWallets())
  }
  if (collectionNeedsSeed('fundingRequests')) {
    saveFundingRequests([])
  }
  if (collectionNeedsSeed('fundingTransfers')) {
    saveFundingTransfers([])
  }
  if (collectionNeedsSeed('revenueSharing')) {
    saveRevenueSharing(getSeedRevenueSharing())
  }
  if (collectionNeedsSeed('transactions')) {
    saveTransactions([])
  }
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
  saveFundingRequests([])
  saveFundingTransfers([])
  saveRevenueSharing(getSeedRevenueSharing())
  saveTransactions([])
  saveSettlements([])
}
