/**
 * Phase-3 server → franchise-portfolio normalizer.
 *
 * Backend contract (ClientResource + GET /api/v1/fee-type):
 * - oneTimeFees[]: { name, amount, enabled }
 * - monthlyFees[]: { name, billingType, amount, treatment: 'BillingOnly' }
 *   (FixedMonthly rows carry fee_amount, PercentGrossSales rows carry
 *   fee_percentage; both are accepted as `amount` fallbacks)
 * - initialFee: { target, recovered }
 * - revenueSplit: { companyPct, clientPct } (or { company, client })
 *
 * Phase-1 frontend shapes (unchanged consumers):
 * - one-time rows: { name, amount, enabled } — computeFranchiseMoney sums
 *   only `enabled` rows.
 * - monthly rows: { name, billingType, amount, treatment } — billable fixed
 *   monthly = billingType === 'FixedMonthly' && treatment !== 'CostDeduction'
 *   (so 'Both' stays billable AND a standard cost); standardCosts picks up
 *   CostDeduction/Both. Missing treatment defaults to 'BillingOnly'.
 * - packageSelections: [{ code, unitFee, quantity }] — backend does not send
 *   packages, so wired rows degrade to [].
 * - revenueSplit passes through; { company, client } is also projected onto
 *   companyPct/clientPct for adminRevenueSplit.
 *
 * Unwired fallback (mockFranchises / DEFAULT_ONBOARDING_*) is never mixed
 * in here: unknown/missing fields degrade to []/null/{} and empty payloads
 * return [] (never crash, never null).
 */

function asFiniteAmount(value, fallback = 0) {
  const n = Number(value)
  return Number.isFinite(n) ? Math.max(0, n) : fallback
}

function asTrimmedName(value) {
  return String(value ?? '').trim()
}

function normalizeBillingType(value) {
  return value === 'PercentGrossSales' ? 'PercentGrossSales' : 'FixedMonthly'
}

function normalizeTreatment(value) {
  return value === 'CostDeduction' || value === 'Both' ? value : 'BillingOnly'
}

export function normalizeServerOneTimeFees(raw) {
  if (!Array.isArray(raw)) return []
  return raw
    .filter((row) => row && typeof row === 'object')
    .map((row) => ({
      name: asTrimmedName(row.name),
      amount: asFiniteAmount(row.amount ?? row.fee_amount ?? row.feeAmount ?? 0),
      enabled: row.enabled !== false,
    }))
    .filter((row) => row.name)
}

export function normalizeServerMonthlyFees(raw) {
  if (!Array.isArray(raw)) return []
  return raw
    .filter((row) => row && typeof row === 'object')
    .map((row) => ({
      name: asTrimmedName(row.name),
      billingType: normalizeBillingType(row.billingType),
      amount: asFiniteAmount(
        row.amount ??
          row.fee_amount ??
          row.feeAmount ??
          row.fee_percentage ??
          row.feePercentage ??
          0,
      ),
      treatment: normalizeTreatment(row.treatment),
    }))
    .filter((row) => row.name)
}

export function normalizeServerPackageSelections(raw) {
  if (!Array.isArray(raw)) return []
  return raw
    .filter((row) => row && typeof row === 'object')
    .map((row) => ({
      code: asTrimmedName(row.code),
      unitFee: asFiniteAmount(row.unitFee ?? row.fee_amount ?? 0),
      quantity: Math.max(0, Math.floor(asFiniteAmount(row.quantity ?? 0))),
    }))
    .filter((row) => row.code)
}

export function normalizeServerInitialFee(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  return {
    target: asFiniteAmount(raw.target ?? 0),
    recovered: asFiniteAmount(raw.recovered ?? 0),
  }
}

export function normalizeServerRevenueSplit(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
  if (
    typeof raw.companyPct !== 'undefined' ||
    typeof raw.clientPct !== 'undefined'
  ) {
    return { ...raw }
  }
  const company = Number(raw.company ?? raw.company_pct)
  const client = Number(raw.client ?? raw.client_pct)
  if (Number.isFinite(company) || Number.isFinite(client)) {
    const companyPct = Number.isFinite(company) ? company : 0
    return {
      ...raw,
      companyPct,
      clientPct: Number.isFinite(client)
        ? client
        : Math.max(0, 100 - companyPct),
    }
  }
  return { ...raw }
}

export function normalizeServerCompany(company, index = 0) {
  const source =
    company && typeof company === 'object' && !Array.isArray(company)
      ? company
      : {}
  return {
    id: source.id ?? source.companyId ?? `server-company-${index}`,
    name: source.name ?? '',
    clientType: source.clientType ?? source.type ?? '',
    status: source.status ?? 'Pending Review',
    territories: Array.isArray(source.territories) ? source.territories : [],
    packageSelections: normalizeServerPackageSelections(source.packageSelections),
    oneTimeFees: normalizeServerOneTimeFees(source.oneTimeFees),
    monthlyFees: normalizeServerMonthlyFees(source.monthlyFees),
    initialFee: normalizeServerInitialFee(source.initialFee),
    revenueSplit: normalizeServerRevenueSplit(source.revenueSplit),
    clientInfo: source.clientInfo ?? null,
    activatedAt: source.activatedAt ?? null,
    updatedAt: source.updatedAt ?? null,
  }
}

/**
 * []-safe mapping for GET /admin/companies payloads (or a bare array of
 * companies) onto the franchise-portfolio shape. Unknown/missing fields
 * degrade to empty arrays/strings, never null crashes.
 */
export function normalizeServerPortfolio(payload) {
  const source =
    payload && typeof payload === 'object' && !Array.isArray(payload)
      ? (payload.companies ?? payload.items ?? payload.data ?? [])
      : payload
  return (Array.isArray(source) ? source : []).map((company, index) =>
    normalizeServerCompany(company, index),
  )
}
