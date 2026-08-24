export const PACKAGE_OPTIONS = [
  {
    code: 'eNeighborhood',
    label: 'eNeighborhood',
    description: 'Base level unit coverage',
    unitFee: 20_000,
  },
  {
    code: 'eBarangay',
    label: 'eBarangay',
    description: 'Medium level cluster coverage',
    unitFee: 200_000,
  },
  {
    code: 'eLGU',
    label: 'eLGU',
    description: 'Macro level regional coverage',
    unitFee: 2_000_000,
  },
]

/** Admin onboarding split: company vs this client only. Downlines are not set here. */
export const DEFAULT_ADMIN_REVENUE_SPLIT = {
  company: 40,
  client: 60,
}

export const DEFAULT_REVENUE_SPLIT_SUB_FRANCHISOR = {
  ...DEFAULT_ADMIN_REVENUE_SPLIT,
}

export const DEFAULT_REVENUE_SPLIT_FRANCHISEE = {
  ...DEFAULT_ADMIN_REVENUE_SPLIT,
}

export const DEFAULT_REVENUE_SPLIT_DEFAULTS = {
  subFranchisor: DEFAULT_REVENUE_SPLIT_SUB_FRANCHISOR,
  franchisee: DEFAULT_REVENUE_SPLIT_FRANCHISEE,
}

export const ONBOARDING_STEP_PATHS = {
  1: '/franchise-setup/onboarding/step-1',
  2: '/franchise-setup/onboarding/step-2',
  3: '/franchise-setup/onboarding/step-3',
  4: '/franchise-setup/onboarding/step-4',
}

export const ONBOARDING_STEPS = [
  { n: 1, label: 'Client Info', path: ONBOARDING_STEP_PATHS[1] },
  { n: 2, label: 'Franchise Setup', path: ONBOARDING_STEP_PATHS[2] },
  { n: 3, label: 'Revenue Split', path: ONBOARDING_STEP_PATHS[3] },
  { n: 4, label: 'Review', path: ONBOARDING_STEP_PATHS[4] },
]

export const ONBOARDING_CLIENT_TYPES = ['Sub-Franchisor', 'Franchisee']
export const DEFAULT_ONBOARDING_CLIENT_TYPE = 'Sub-Franchisor'

export const ONBOARDING_CLIENT_TYPE_META = {
  'Sub-Franchisor': {
    label: 'Sub-franchisor',
    description:
      'Oversees a regional network of franchisees, providing guidance, support, and operational oversight within their assigned territory.',
  },
  Franchisee: {
    label: 'Franchisee',
    description:
      'Operates one or multiple franchise units, providing services directly to customers while adhering to the franchisor’s established systems and guidelines.',
  },
}

export const DEFAULT_ONBOARDING_PACKAGE_STATE = {
  quantities: {
    eNeighborhood: 1,
    eBarangay: 1,
    eLGU: 0,
  },
  primary: 'eBarangay',
}

export const DEFAULT_ONBOARDING_ONE_TIME_FEES = [
  { id: 'franchise-fee', name: 'Franchise Fee', amount: 200_000, enabled: true },
  { id: 'setup-training', name: 'Setup & Training', amount: 25_000, enabled: true },
  { id: 'legal-docs', name: 'Legal & Documentation', amount: 5_000, enabled: true },
]

export const DEFAULT_ONBOARDING_MONTHLY_FEES = [
  {
    id: 'software-license',
    name: 'Software License Fee',
    billingType: 'FixedMonthly',
    amount: 500,
    treatment: 'Both',
  },
  {
    id: 'marketing-csr',
    name: 'Marketing & CSR Fund',
    billingType: 'PercentGrossSales',
    amount: 2.0,
    treatment: 'BillingOnly',
  },
  {
    id: 'tech-support',
    name: 'Tech Support SLA',
    billingType: 'FixedMonthly',
    amount: 1_200,
    treatment: 'BillingOnly',
  },
  {
    id: 'internet-bandwidth',
    name: 'Internet Bandwidth',
    billingType: 'FixedMonthly',
    amount: 9_600,
    treatment: 'CostDeduction',
  },
]

export const DEFAULT_ONBOARDING_FRANCHISE_SETUP = {
  packageState: DEFAULT_ONBOARDING_PACKAGE_STATE,
  oneTimeFees: DEFAULT_ONBOARDING_ONE_TIME_FEES,
  monthlyFees: DEFAULT_ONBOARDING_MONTHLY_FEES,
  territory: {
    id: 'territory_surigaocity_01',
    coverageName: 'Surigao City Hub 01',
    region: 'Region XIII (Caraga)',
    province: 'Surigao del Norte',
    city: 'Surigao City',
  },
  areas: [
    { id: 'area_surigaocity_1', name: 'Barangay Taft, Surigao City' },
    { id: 'area_surigaocity_2', name: 'Barangay Washington, Surigao City' },
  ],
}

export function parseOnboardingClientType(raw) {
  return ONBOARDING_CLIENT_TYPES.includes(raw)
    ? raw
    : DEFAULT_ONBOARDING_CLIENT_TYPE
}

export function onboardingClientShareLabel(clientType) {
  return parseOnboardingClientType(clientType) === 'Sub-Franchisor'
    ? 'Sub-franchisor'
    : 'Franchisee'
}

export function onboardingDownlineHint(clientType) {
  return parseOnboardingClientType(clientType) === 'Sub-Franchisor'
    ? 'Franchisee and retailer shares inside this client’s network (sub-franchisor → franchisee → retailers) are set by the sub-franchisor, not by platform admin.'
    : 'Retailer shares inside this client’s network (franchisee → retailers) are set by the franchisee, not by platform admin.'
}

export function summarizeOnboardingRevenueSplit(defaults, clientType) {
  const type = parseOnboardingClientType(clientType)
  const split =
    type === 'Sub-Franchisor' ? defaults.subFranchisor : defaults.franchisee
  const total = split.company + split.client
  const ok = Math.abs(total - 100) < 0.001
  const delta = Math.round((total - 100) * 10) / 10
  return {
    type,
    split,
    clientLabel: onboardingClientShareLabel(type),
    total,
    ok,
    delta,
    needs: Math.round(Math.abs(delta) * 10) / 10,
  }
}

export const EMPTY_ONBOARDING_CLIENT_INFO = {
  admin_first_name: '',
  admin_last_name: '',
  admin_email: '',
  admin_password: '',
  admin_password_confirmation: '',
  company_name: '',
  company_email: '',
  company_phone: '',
  registration_number: '',
  tax_id: '',
  address_line_1: '',
  address_line_2: '',
  city_municipality: '',
  state_province_region: '',
  country: '',
  postal: '',
  contact_person: '',
  contact_email: '',
  contact_phone: '',
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function asTrimmedString(value) {
  return value == null ? '' : String(value)
}

export function parseOnboardingClientInfo(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const next = { ...EMPTY_ONBOARDING_CLIENT_INFO }
  Object.keys(next).forEach((key) => {
    next[key] = asTrimmedString(raw[key])
  })
  return next
}

export function validateOnboardingClientInfo(form) {
  const values = parseOnboardingClientInfo(form) ?? EMPTY_ONBOARDING_CLIENT_INFO
  const errors = {}

  const required = [
    ['admin_first_name', 'First name is required.'],
    ['admin_last_name', 'Last name is required.'],
    ['admin_email', 'Admin email is required.'],
    ['admin_password', 'Password is required.'],
    ['admin_password_confirmation', 'Confirm password is required.'],
    ['company_name', 'Company name is required.'],
    ['registration_number', 'Registration number is required.'],
    ['company_email', 'Corporate email is required.'],
    ['address_line_1', 'Address 1 is required.'],
    ['address_line_2', 'Address 2 is required.'],
    ['city_municipality', 'City/Municipality is required.'],
    ['state_province_region', 'State/Province/Region is required.'],
    ['country', 'Country is required.'],
    ['postal', 'Postal/ZIP is required.'],
  ]

  required.forEach(([key, message]) => {
    if (!values[key].trim()) errors[key] = message
  })

  if (values.admin_email.trim() && !EMAIL_PATTERN.test(values.admin_email.trim())) {
    errors.admin_email = 'Enter a valid admin email.'
  }
  if (values.company_email.trim() && !EMAIL_PATTERN.test(values.company_email.trim())) {
    errors.company_email = 'Enter a valid corporate email.'
  }
  if (values.contact_email.trim() && !EMAIL_PATTERN.test(values.contact_email.trim())) {
    errors.contact_email = 'Enter a valid contact email.'
  }
  if (values.admin_password && values.admin_password.length < 8) {
    errors.admin_password = 'Password must be at least 8 characters.'
  }
  if (
    values.admin_password &&
    values.admin_password_confirmation &&
    values.admin_password !== values.admin_password_confirmation
  ) {
    errors.admin_password_confirmation = 'Passwords do not match.'
  }
  if (values.postal.trim() && !/^\d{1,5}$/.test(values.postal.trim())) {
    errors.postal = 'Postal/ZIP must be 1 to 5 digits.'
  }

  return errors
}

export function isOnboardingClientInfoComplete(form) {
  return Object.keys(validateOnboardingClientInfo(form)).length === 0
}

function asFiniteNumber(value, fallback = 0) {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

function parsePackageState(raw) {
  const quantities = { ...DEFAULT_ONBOARDING_PACKAGE_STATE.quantities }
  const source = raw?.quantities && typeof raw.quantities === 'object' ? raw.quantities : {}
  PACKAGE_OPTIONS.forEach((item) => {
    quantities[item.code] = Math.max(0, Math.floor(asFiniteNumber(source[item.code], 0)))
  })
  const primaryCandidate = raw?.primary
  const primary =
    PACKAGE_OPTIONS.some((item) => item.code === primaryCandidate) &&
    quantities[primaryCandidate] > 0
      ? primaryCandidate
      : PACKAGE_OPTIONS.find((item) => quantities[item.code] > 0)?.code ??
        DEFAULT_ONBOARDING_PACKAGE_STATE.primary
  return { quantities, primary }
}

function parseNamedFees(raw, fallback) {
  if (!Array.isArray(raw) || raw.length === 0) return fallback.map((item) => ({ ...item }))
  return raw
    .filter((item) => item && typeof item === 'object')
    .map((item, index) => ({
      id: asTrimmedString(item.id) || `fee_${index}`,
      name: asTrimmedString(item.name),
      amount: Math.max(0, asFiniteNumber(item.amount)),
      enabled: item.enabled !== false,
    }))
    .filter((item) => item.name)
}

function parseMonthlyFees(raw) {
  if (!Array.isArray(raw) || raw.length === 0) {
    return DEFAULT_ONBOARDING_MONTHLY_FEES.map((item) => ({ ...item }))
  }
  return raw
    .filter((item) => item && typeof item === 'object')
    .map((item, index) => ({
      id: asTrimmedString(item.id) || `monthly_${index}`,
      name: asTrimmedString(item.name),
      billingType:
        item.billingType === 'PercentGrossSales' ? 'PercentGrossSales' : 'FixedMonthly',
      amount: Math.max(0, asFiniteNumber(item.amount)),
      treatment:
        item.treatment === 'CostDeduction' || item.treatment === 'Both'
          ? item.treatment
          : 'BillingOnly',
    }))
    .filter((item) => item.name)
}

function parseTerritory(raw) {
  if (!raw || typeof raw !== 'object') return DEFAULT_ONBOARDING_FRANCHISE_SETUP.territory
  return {
    id: asTrimmedString(raw.id) || DEFAULT_ONBOARDING_FRANCHISE_SETUP.territory.id,
    coverageName: asTrimmedString(raw.coverageName),
    region: asTrimmedString(raw.region),
    province: asTrimmedString(raw.province),
    city: asTrimmedString(raw.city),
  }
}

function parseAreas(raw) {
  if (!Array.isArray(raw) || raw.length === 0) {
    return DEFAULT_ONBOARDING_FRANCHISE_SETUP.areas.map((item) => ({ ...item }))
  }
  return raw
    .filter((item) => item && typeof item === 'object')
    .map((item, index) => ({
      id: asTrimmedString(item.id) || `area_${index}`,
      name: asTrimmedString(item.name),
    }))
    .filter((item) => item.name)
}

export function parseOnboardingFranchiseSetup(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ...DEFAULT_ONBOARDING_FRANCHISE_SETUP }
  }
  return {
    packageState: parsePackageState(raw.packageState),
    oneTimeFees: parseNamedFees(raw.oneTimeFees, DEFAULT_ONBOARDING_ONE_TIME_FEES),
    monthlyFees: parseMonthlyFees(raw.monthlyFees),
    territory: parseTerritory(raw.territory),
    areas: parseAreas(raw.areas),
  }
}

export function formatPlainPhp(amount) {
  const value = Number(amount)
  return new Intl.NumberFormat('en-PH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(value) ? value : 0)
}

export function formatOnboardingMonthlyFeeAmount(fee) {
  if (fee.billingType === 'PercentGrossSales') {
    return `${new Intl.NumberFormat('en-PH', {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    }).format(fee.amount)}%`
  }
  return `₱${formatPlainPhp(fee.amount)}`
}

export function monthlyFeeTreatmentLabel(treatment) {
  if (treatment === 'CostDeduction') return 'Cost deduction'
  if (treatment === 'Both') return 'Billing + cost'
  return 'Billing only'
}

export function generateId(prefix = 'id') {
  try {
    return `${prefix}_${crypto.randomUUID()}`
  } catch {
    return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`
  }
}

export function clampPercent(value) {
  if (!Number.isFinite(value)) return 0
  return Math.max(0, Math.min(100, value))
}

function coerceAdminRevenueSplit(value) {
  if (!value || typeof value !== 'object') return null
  const company = Number(value.company)
  const client = Number(value.client)
  if (Number.isFinite(company) && Number.isFinite(client)) {
    return {
      company: clampPercent(company),
      client: clampPercent(client),
    }
  }
  if (Number.isFinite(company)) {
    return {
      company: clampPercent(company),
      client: clampPercent(100 - company),
    }
  }
  return null
}

export function parseOnboardingRevenueSplit(raw) {
  if (!raw || typeof raw !== 'object') return null
  const subFranchisor =
    coerceAdminRevenueSplit(raw.subFranchisor) ?? coerceAdminRevenueSplit(raw)
  const franchisee =
    coerceAdminRevenueSplit(raw.franchisee) ??
    coerceAdminRevenueSplit(raw) ??
    subFranchisor
  if (!subFranchisor || !franchisee) return null
  return { subFranchisor, franchisee }
}

export function parseAmount(input) {
  const n = Number(input)
  if (!Number.isFinite(n)) return 0
  return Math.max(0, n)
}

export function publicOnboardingClientInfo(form) {
  const parsed = parseOnboardingClientInfo(form) ?? EMPTY_ONBOARDING_CLIENT_INFO
  return {
    admin_first_name: parsed.admin_first_name,
    admin_last_name: parsed.admin_last_name,
    admin_email: parsed.admin_email,
    company_name: parsed.company_name,
    company_email: parsed.company_email,
    company_phone: parsed.company_phone,
    registration_number: parsed.registration_number,
    tax_id: parsed.tax_id,
    address_line_1: parsed.address_line_1,
    address_line_2: parsed.address_line_2,
    city_municipality: parsed.city_municipality,
    state_province_region: parsed.state_province_region,
    country: parsed.country,
    postal: parsed.postal,
    contact_person: parsed.contact_person,
    contact_email: parsed.contact_email,
    contact_phone: parsed.contact_phone,
  }
}

const REGISTERED_CLIENT_STATUSES = [
  'Activated',
  'Pending Activation',
  'Pending Review',
  'In Progress',
]

function parsePackageSelections(raw) {
  const byCode = new Map(
    Array.isArray(raw)
      ? raw
          .filter((item) => item && typeof item === 'object')
          .map((item) => [asTrimmedString(item.code), item])
      : [],
  )
  return PACKAGE_OPTIONS.map((option) => {
    const found = byCode.get(option.code)
    return {
      code: option.code,
      unitFee: Math.max(0, asFiniteNumber(found?.unitFee, option.unitFee)),
      quantity: Math.max(0, Math.floor(asFiniteNumber(found?.quantity, 0))),
    }
  })
}

function parseClientTerritories(raw) {
  if (!Array.isArray(raw) || raw.length === 0) return []
  return raw
    .filter((item) => item && typeof item === 'object')
    .map((item, index) => {
      const territory = parseTerritory(item)
      return {
        ...territory,
        id: territory.id || `territory_${index}`,
        boundaryDefined: item.boundaryDefined === true,
        areas: parseAreas(item.areas),
      }
    })
    .filter((item) => item.coverageName)
}

export function parseRegisteredClient(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const id = asTrimmedString(raw.id)
  const name = asTrimmedString(raw.name)
  if (!id || !name) return null
  const clientType = parseOnboardingClientType(raw.clientType)
  const status = REGISTERED_CLIENT_STATUSES.includes(raw.status)
    ? raw.status
    : 'Pending Review'
  const createdAt = asTrimmedString(raw.createdAt) || new Date().toISOString()
  const updatedAt = asTrimmedString(raw.updatedAt) || createdAt
  const splitSource =
    raw.revenueSplit && typeof raw.revenueSplit === 'object'
      ? {
          company: raw.revenueSplit.companyPct ?? raw.revenueSplit.company,
          client: raw.revenueSplit.clientPct ?? raw.revenueSplit.client,
        }
      : null
  const split = coerceAdminRevenueSplit(splitSource) ?? {
    ...DEFAULT_ADMIN_REVENUE_SPLIT,
  }
  const clientInfo = publicOnboardingClientInfo(raw.clientInfo)
  const activatedAt = asTrimmedString(raw.activatedAt)
  return {
    id,
    name,
    clientType,
    status,
    currentStep: 4,
    createdAt,
    updatedAt,
    ...(activatedAt ? { activatedAt } : {}),
    packageSelections: parsePackageSelections(raw.packageSelections),
    territories: parseClientTerritories(raw.territories),
    oneTimeFees: parseNamedFees(raw.oneTimeFees, DEFAULT_ONBOARDING_ONE_TIME_FEES).map(
      ({ name: feeName, amount, enabled }) => ({
        name: feeName,
        amount,
        enabled,
      }),
    ),
    monthlyFees: parseMonthlyFees(raw.monthlyFees).map(
      ({ name: feeName, billingType, amount, treatment }) => ({
        name: feeName,
        billingType,
        amount,
        treatment,
      }),
    ),
    revenueSplit: {
      companyPct: split.company,
      clientPct: split.client,
    },
    clientInfo,
    source: 'registered',
  }
}

export function buildRegisteredClientFromOnboarding({
  clientInfo,
  clientType,
  setup,
  revenueDefaults,
}) {
  const parsedInfo = publicOnboardingClientInfo(clientInfo)
  const type = parseOnboardingClientType(clientType)
  const franchiseSetup = parseOnboardingFranchiseSetup(setup)
  const summary = summarizeOnboardingRevenueSplit(revenueDefaults, type)
  const now = new Date().toISOString()
  return parseRegisteredClient({
    id: generateId('fr'),
    name: parsedInfo.company_name,
    clientType: type,
    status: 'Pending Review',
    createdAt: now,
    updatedAt: now,
    packageSelections: PACKAGE_OPTIONS.map((option) => ({
      code: option.code,
      unitFee: option.unitFee,
      quantity: franchiseSetup.packageState.quantities[option.code] ?? 0,
    })),
    territories: franchiseSetup.territory
      ? [
          {
            ...franchiseSetup.territory,
            boundaryDefined: false,
            areas: franchiseSetup.areas,
          },
        ]
      : [],
    oneTimeFees: franchiseSetup.oneTimeFees,
    monthlyFees: franchiseSetup.monthlyFees,
    revenueSplit: {
      companyPct: summary.split.company,
      clientPct: summary.split.client,
    },
    clientInfo: parsedInfo,
  })
}
