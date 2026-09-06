import { describe, expect, it } from 'vitest'
import {
  normalizeServerCompany,
  normalizeServerInitialFee,
  normalizeServerMonthlyFees,
  normalizeServerOneTimeFees,
  normalizeServerPackageSelections,
  normalizeServerPortfolio,
  normalizeServerRevenueSplit,
} from '@/lib/serverPortfolio'
import { computeFranchiseMoney } from '@/lib/financialsDashboard'
import { fixedMonthlyTotal, standardCosts, upfrontSetupTotal } from '@/lib/clientFinancials'

const BACKEND_COMPANY = {
  id: 'company-1',
  name: 'Surigao City Service Hub',
  clientType: 'Sub-Franchisor',
  status: 'Activated',
  territories: [],
  packageSelections: [],
  oneTimeFees: [
    { name: 'franchise_fee', amount: 200_000, enabled: true },
    { name: 'setup', amount: 25_000, enabled: true },
    { name: 'legal', amount: 5_000, enabled: false },
  ],
  monthlyFees: [
    { name: 'Software License Fee', billingType: 'FixedMonthly', amount: 500, treatment: 'BillingOnly' },
    { name: 'Tech Support SLA', billingType: 'FixedMonthly', amount: 1200, treatment: 'BillingOnly' },
    { name: 'Internet Bandwidth', billingType: 'FixedMonthly', amount: 9600, treatment: 'CostDeduction' },
    { name: 'Marketing & CSR Fund', billingType: 'PercentGrossSales', amount: 2.0, treatment: 'BillingOnly' },
  ],
  initialFee: { target: 230_000, recovered: 100_000 },
  revenueSplit: { companyPct: 40, clientPct: 60 },
}

describe('Phase 3 server portfolio normalization', () => {
  it('maps a backend company payload onto Phase-1 franchise shapes', () => {
    const [row] = normalizeServerPortfolio({ data: [BACKEND_COMPANY] })
    expect(row.id).toBe('company-1')
    expect(row.oneTimeFees).toEqual([
      { name: 'franchise_fee', amount: 200_000, enabled: true },
      { name: 'setup', amount: 25_000, enabled: true },
      { name: 'legal', amount: 5_000, enabled: false },
    ])
    expect(row.monthlyFees).toEqual([
      { name: 'Software License Fee', billingType: 'FixedMonthly', amount: 500, treatment: 'BillingOnly' },
      { name: 'Tech Support SLA', billingType: 'FixedMonthly', amount: 1200, treatment: 'BillingOnly' },
      { name: 'Internet Bandwidth', billingType: 'FixedMonthly', amount: 9600, treatment: 'CostDeduction' },
      { name: 'Marketing & CSR Fund', billingType: 'PercentGrossSales', amount: 2.0, treatment: 'BillingOnly' },
    ])
    expect(row.packageSelections).toEqual([])
    expect(row.initialFee).toEqual({ target: 230_000, recovered: 100_000 })
    expect(row.revenueSplit).toEqual({ companyPct: 40, clientPct: 60 })
  })

  it('accepts bare arrays and companies/items envelopes', () => {
    expect(normalizeServerPortfolio([BACKEND_COMPANY])).toHaveLength(1)
    expect(normalizeServerPortfolio({ companies: [BACKEND_COMPANY] })).toHaveLength(1)
    expect(normalizeServerPortfolio({ items: [BACKEND_COMPANY] })).toHaveLength(1)
  })

  it('degrades empty/unknown payloads to [] without crashing', () => {
    expect(normalizeServerPortfolio(null)).toEqual([])
    expect(normalizeServerPortfolio(undefined)).toEqual([])
    expect(normalizeServerPortfolio({})).toEqual([])
    expect(normalizeServerPortfolio({ data: null })).toEqual([])
    expect(normalizeServerPortfolio('nope')).toEqual([])
    expect(normalizeServerPortfolio([])).toEqual([])
  })

  it('defaults missing fee arrays to [] and drops unnamed rows', () => {
    const row = normalizeServerCompany({ id: 'c-empty', name: 'Empty Co' })
    expect(row.oneTimeFees).toEqual([])
    expect(row.monthlyFees).toEqual([])
    expect(row.packageSelections).toEqual([])
    expect(row.initialFee).toBeNull()
    expect(row.revenueSplit).toEqual({})
    expect(normalizeServerOneTimeFees(null)).toEqual([])
    expect(normalizeServerOneTimeFees([{ amount: 10 }])).toEqual([])
    expect(normalizeServerMonthlyFees(undefined)).toEqual([])
    expect(normalizeServerMonthlyFees([{ amount: 10 }])).toEqual([])
    expect(normalizeServerPackageSelections(null)).toEqual([])
    expect(normalizeServerInitialFee(null)).toBeNull()
  })

  it('keeps enabled semantics: disabled one-time rows excluded from totals', () => {
    const [row] = normalizeServerPortfolio([BACKEND_COMPANY])
    const money = computeFranchiseMoney(row)
    expect(money.oneTimeEnabled).toBe(225_000)
    expect(upfrontSetupTotal(row)).toBe(225_000)
  })

  it('keeps billable filter semantics: CostDeduction and % sales excluded from fixed monthly', () => {
    const [row] = normalizeServerPortfolio([BACKEND_COMPANY])
    const money = computeFranchiseMoney(row)
    expect(money.fixedMonthly).toBe(1_700)
    expect(fixedMonthlyTotal(row)).toBe(1_700)
    expect(money.percentGrossCount).toBe(1)
    // Cost-deduction rows stay visible as standard costs.
    expect(standardCosts(row)).toEqual([
      { label: 'Internet Bandwidth', amount: 9_600, treatment: 'CostDeduction' },
    ])
  })

  it('treats Both as billable AND a standard cost (Phase-1 semantics)', () => {
    const [row] = normalizeServerPortfolio([
      {
        ...BACKEND_COMPANY,
        monthlyFees: [
          { name: 'Software License Fee', billingType: 'FixedMonthly', amount: 500, treatment: 'Both' },
        ],
      },
    ])
    expect(computeFranchiseMoney(row).fixedMonthly).toBe(500)
    expect(standardCosts(row)).toHaveLength(1)
  })

  it('defaults missing treatment to BillingOnly and maps fee_amount/fee_percentage fallbacks', () => {
    const rows = normalizeServerMonthlyFees([
      { name: 'Flat', billingType: 'FixedMonthly', fee_amount: 750 },
      { name: 'Share', billingType: 'PercentGrossSales', fee_percentage: 1.5 },
      { name: 'Odd type', billingType: 'Whatever', amount: 100, treatment: 'Whatever' },
    ])
    expect(rows).toEqual([
      { name: 'Flat', billingType: 'FixedMonthly', amount: 750, treatment: 'BillingOnly' },
      { name: 'Share', billingType: 'PercentGrossSales', amount: 1.5, treatment: 'BillingOnly' },
      { name: 'Odd type', billingType: 'FixedMonthly', amount: 100, treatment: 'BillingOnly' },
    ])
  })

  it('projects { company, client } revenue splits onto companyPct/clientPct', () => {
    expect(normalizeServerRevenueSplit({ company: 40, client: 60 })).toMatchObject({
      companyPct: 40,
      clientPct: 60,
    })
    expect(normalizeServerRevenueSplit(null)).toEqual({})
  })

  it('never blends mock fallback data into the wired path', () => {
    const rows = normalizeServerPortfolio({ data: [BACKEND_COMPANY] })
    expect(rows).toHaveLength(1)
    expect(rows[0].name).toBe('Surigao City Service Hub')
  })
})
