export const ROLES = {
  ADMIN: 'admin',
  SUBFRANCHISEE: 'subfranchisee',
  FRANCHISEE: 'franchisee',
  RETAILER: 'retailer',
}

export const ROLE_LABELS = {
  [ROLES.ADMIN]: 'Admin',
  [ROLES.SUBFRANCHISEE]: 'Sub-Franchisee',
  [ROLES.FRANCHISEE]: 'Franchisee',
  [ROLES.RETAILER]: 'Retailer',
}

export const STORAGE_KEYS = {
  USERS: 'esarisari_users',
  ORGANIZATIONS: 'esarisari_organizations',
  WALLETS: 'esarisari_wallets',
  FUNDING_REQUESTS: 'esarisari_funding_requests',
  FUNDING_TRANSFERS: 'esarisari_funding_transfers',
  REVENUE_SHARING: 'esarisari_revenue_sharing',
  TRANSACTIONS: 'esarisari_transactions',
  SETTLEMENTS: 'esarisari_settlements',
  SESSION: 'esarisari_session',
}

export const ORG_IDS = {
  PLATFORM: 'org-platform',
  SUB_001: 'org-sub-001',
  FRANCHISE_001: 'org-franchise-001',
  RETAILER_001: 'org-retailer-001',
  RETAILER_002: 'org-retailer-002',
}

export const DEMO_ACCOUNTS = [
  {
    label: 'Admin',
    email: 'admin@esarisari.local',
  },
  {
    label: 'Sub-Franchisee',
    email: 'subfranchisee@esarisari.local',
  },
  {
    label: 'Franchisee',
    email: 'franchisee@esarisari.local',
  },
  {
    label: 'Retailer',
    email: 'retailer@esarisari.local',
  },
]

export const DEMO_PASSWORD = 'password123'
