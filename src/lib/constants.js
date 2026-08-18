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
  /** One-time migrations for seeded transaction economics / revenue scale */
  TRANSACTIONS_SEED_VERSION: 'esarisari_transactions_seed_version',
  /** One-time migrations for seeded commission settings */
  COMMISSION_SETTINGS_SEED_VERSION: 'esarisari_commission_settings_seed_version',
  /** One-time migrations for internet credits funding request shape */
  INTERNET_CREDITS_SEED_VERSION: 'esarisari_internet_credits_seed_version',
  /** One-time trim of demo orgs to accounts that have logins */
  NETWORK_SEED_VERSION: 'esarisari_network_seed_version',
  /** Deposit rate overrides per downline */
  DEPOSIT_RATES: 'esarisari_deposit_rates',
  /** Per-organization read state for in-app notifications */
  NOTIFICATION_READS: 'esarisari_notification_reads',
}

/** Bump when operating wallet seed balances change and existing demos should realign once. */
export const WALLET_LEDGER_VERSION = 'funding-ledger-v7'

/** Bump when seeded transactions change and existing demos should refresh once. */
export const TRANSACTIONS_SEED_VERSION = 'empty-demo-v1'

/** Bump when seeded commission settings change and existing demos should refresh once. */
export const COMMISSION_SETTINGS_SEED_VERSION = 'login-accounts-v1'

/** Bump when internet-credits funding seeds change and existing demos should refresh once. */
export const INTERNET_CREDITS_SEED_VERSION = 'empty-demo-v3'

/** Bump when the demo org tree is trimmed to login-backed accounts. */
export const NETWORK_SEED_VERSION = 'login-accounts-v1'

/** Default deposit rate (cash ÷ credit face) by hop. */
export const CREDIT_DEPOSIT_RATES = {
  ADMIN_TO_SUB: 0.6,
  SUB_TO_FRANCHISEE: 0.7,
  FRANCHISEE_TO_RETAILER: 0.8,
}

export const ORG_IDS = {
  PLATFORM: 'org-platform',
  SUB_001: 'org-sub-001',
  FRANCHISE_001: 'org-franchise-001',
  FRANCHISE_002: 'org-franchise-002',
  RETAILER_001: 'org-retailer-001',
  RETAILER_002: 'org-retailer-002',
  RETAILER_003: 'org-retailer-003',
}

export const FUNDING_STATUS = {
  PENDING: 'pending',
  APPROVED: 'approved',
  COMPLETED: 'completed',
  RELEASED: 'released',
  REJECTED: 'rejected',
  REVERSED: 'reversed',
}

export const FUNDING_STATUS_LABELS = {
  [FUNDING_STATUS.PENDING]: 'Pending',
  [FUNDING_STATUS.APPROVED]: 'Approved',
  [FUNDING_STATUS.COMPLETED]: 'Completed',
  [FUNDING_STATUS.RELEASED]: 'Released',
  [FUNDING_STATUS.REJECTED]: 'Rejected',
  [FUNDING_STATUS.REVERSED]: 'Reversed',
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
    restricted: true,
  },
  {
    label: 'Sub-Franchisee',
    email: 'subfranchisee@esarisari.local',
  },
  {
    label: 'Franchisee A',
    email: 'franchisee-a@esarisari.local',
  },
  {
    label: 'Franchisee B',
    email: 'franchisee-b@esarisari.local',
  },
  {
    label: 'Retailer A',
    email: 'retailer-a@esarisari.local',
  },
  {
    label: 'Retailer B',
    email: 'retailer-b@esarisari.local',
  },
  {
    label: 'Retailer C',
    email: 'retailer-c@esarisari.local',
  },
]

/** Shared password for non-admin demo accounts. */
export const DEMO_PASSWORD = 'password123'

/** Restricted password for the platform admin demo account. */
export const ADMIN_DEMO_PASSWORD = 'abc12345678'

/** HTML user guide on GitHub Pages / local preview. */
export const USER_GUIDE_HREF = `${import.meta.env.BASE_URL}user-guide.html`

/** Word copy of the same guide. */
export const USER_GUIDE_DOCX_HREF = `${import.meta.env.BASE_URL}user-guide.docx`

/** Workbook of app formulas (loads, spreads, demo sale, commissions). */
export const COMPUTATIONS_XLSX_HREF = `${import.meta.env.BASE_URL}esari-computations.xlsx`
