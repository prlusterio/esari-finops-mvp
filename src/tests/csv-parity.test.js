import { describe, expect, it } from 'vitest'
import { franchiseCollectionEntriesToCsv } from '@/lib/franchiseCollectionLedger'
import {
  internetRetailerBalanceReportToCsv,
  revenueEntriesToCsv,
} from '@/lib/reports'
import { creditLedgerToCsv } from '@/lib/wallets'

describe('spec 02 §17 CSV parity: local oracle builders stay well-formed', () => {
  it('transactions oracle emits a header + quoted rows', async () => {
    const { exportTransactionsCsv } = await import('@/lib/reports')
    const csv = exportTransactionsCsv(
      [
        {
          id: 7,
          reference: 'TX-7',
          createdAt: '2026-01-02T00:00:00Z',
          retailerOrganizationId: 'org-r-1',
          retailerName: 'Retailer, "One"',
          franchiseeOrganizationId: 'org-f-1',
          customerPayment: 1000,
          walletDeduction: 1000,
          status: 'completed',
        },
      ],
      { 'org-r-1': { name: 'Retailer One' }, 'org-f-1': { name: 'Franchisee One' } },
      { revenueSharing: [], role: 'retailer' },
    )
    const [header, ...rows] = csv.split('\n')
    expect(header.split(',').length).toBeGreaterThan(3)
    expect(rows.length).toBe(1)
    expect(rows[0]).toMatch('"Retailer, ""One"""')
  })

  it('revenue oracle emits header + rows for credited entries', () => {
    const csv = revenueEntriesToCsv([
      {
        id: 'r1',
        reference: 'REF-1',
        createdAt: '2026-01-03T00:00:00Z',
        retailerName: 'Shop',
        distributableRevenue: 500,
        sharePercentage: 10,
        yourRevenue: 50,
        status: 'credited',
      },
    ])
    expect(csv.split('\n')[0].split(',').length).toBeGreaterThan(3)
    expect(csv).toMatch('REF-1')
  })

  it('franchise collections oracle keeps 11 columns', () => {
    const csv = franchiseCollectionEntriesToCsv([
      {
        clientName: 'Client',
        type: 'Upfront',
        periodLabel: 'Setup',
        date: '2026-01-01',
        due: 100,
        paid: 40,
        remaining: 60,
        status: 'Partial',
        companyPct: 20,
        clientPct: 80,
        reference: 'OR-1',
      },
    ])
    const [header, ...rows] = csv.split('\n')
    expect(header.split(',')).toHaveLength(11)
    expect(rows).toHaveLength(1)
  })

  it('credit ledger + retailer balance oracles stay non-empty', () => {
    const ledger = creditLedgerToCsv({
      openingBalance: 100,
      closingBalance: 150,
      movements: [
        {
          id: 'm1',
          createdAt: '2026-01-04T00:00:00Z',
          typeLabel: 'Release',
          details: 'Downline load',
          counterpartyName: 'Shop',
          amount: 50,
          direction: 'credit',
        },
      ],
    })
    expect(ledger.split('\n').length).toBeGreaterThan(1)
    const balance = internetRetailerBalanceReportToCsv({
      rows: [
        {
          dateLabel: 'Jan 4',
          franchiseeName: 'Fran',
          credited: 'Yes',
          debit: '',
          depositAmount: 100,
          debitSales: 20,
          walletBalance: 80,
        },
      ],
    })
    expect(balance.split('\n').length).toBeGreaterThan(1)
  })
})
