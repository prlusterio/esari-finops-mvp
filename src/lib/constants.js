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
  COMMISSION_SETTINGS: 'esarisari_commission_settings',
  TRANSACTIONS: 'esarisari_transactions',
  SETTLEMENTS: 'esarisari_settlements',
  SESSION: 'esarisari_session',
  /** One-time migrations for seeded operating wallet balances */
  WALLET_LEDGER_VERSION: 'esarisari_wallet_ledger_version',
}

/** Bump when operating wallet seed balances change and existing demos should realign once. */
export const WALLET_LEDGER_VERSION = 'funding-ledger-v1'

export const ORG_IDS = {
  PLATFORM: 'org-platform',
  SUB_001: 'org-sub-001',
  FRANCHISE_001: 'org-franchise-001',
  FRANCHISE_002: 'org-franchise-002',
  FRANCHISE_003: 'org-franchise-003',
  FRANCHISE_004: 'org-franchise-004',
  RETAILER_001: 'org-retailer-001',
  RETAILER_002: 'org-retailer-002',
  RETAILER_003: 'org-retailer-003',
  RETAILER_004: 'org-retailer-004',
  RETAILER_005: 'org-retailer-005',
}

export const FUNDING_STATUS = {
  PENDING: 'pending',
  APPROVED: 'approved',
  COMPLETED: 'completed',
  REJECTED: 'rejected',
}

export const FUNDING_STATUS_LABELS = {
  [FUNDING_STATUS.PENDING]: 'Pending Review',
  [FUNDING_STATUS.APPROVED]: 'Approved',
  [FUNDING_STATUS.COMPLETED]: 'Completed',
  [FUNDING_STATUS.REJECTED]: 'Rejected',
}

export const TRANSACTION_STATUS = {
  PENDING: 'pending',
  COMPLETED: 'completed',
}

export const TRANSACTION_STATUS_LABELS = {
  [TRANSACTION_STATUS.PENDING]: 'Pending',
  [TRANSACTION_STATUS.COMPLETED]: 'Completed',
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
