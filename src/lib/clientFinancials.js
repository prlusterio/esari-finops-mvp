import { mockFranchises } from '@/data/franchiseFinancials'
import {
  addMonthsToPeriodKey,
  allocateMonthlyPayment,
  applyUpfrontCollection,
  computeFranchiseMoney,
  emptyCollectionState,
  monthKey,
  monthLabel,
} from '@/lib/financialsDashboard'

export const GROSS_SALES_BY_CLIENT_ID = {
  fr_sc_sdn_001: 18_500,
  fr_sg_dapa_003: 14_800,
  fr_sdn_sis_007: 15_000,
  fr_sdn_sm_008: 12_750,
}

export const DEFAULT_HISTORY_START_DATE = '2026-05-01'

export function defaultHistoryEndDate(date = new Date()) {
  const last = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(last).padStart(2, '0')}`
}

export const DEFAULT_HISTORY_END_DATE = defaultHistoryEndDate()

export function getClientPortfolio() {
  return mockFranchises
}

export function getClientById(clientId) {
  return mockFranchises.find((franchise) => franchise.id === clientId) ?? null
}

export function formatClientDate(date) {
  return new Date(`${date}T12:00:00`).toLocaleDateString('en-PH', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export function formatUpdatedAt(iso) {
  return new Date(iso).toLocaleDateString('en-PH')
}

export function packageTotal(franchise) {
  return computeFranchiseMoney(franchise).packageFees
}

export function oneTimeTotal(franchise) {
  return computeFranchiseMoney(franchise).oneTimeEnabled
}

export function fixedMonthlyTotal(franchise) {
  return computeFranchiseMoney(franchise).fixedMonthly
}

export function upfrontSetupTotal(franchise) {
  return computeFranchiseMoney(franchise).upfrontTotal
}

export function adminRevenueSplit(franchise) {
  const split = franchise.revenueSplit || {}
  const company = Number(split.companyPct || 0)
  const storedClient = Number(split.clientPct)
  const legacyNetwork =
    Number(split.retailerPct || 0) +
    Number(split.franchiseePct || 0) +
    Number(split.subFranchiseePct || 0)
  const client = Number.isFinite(storedClient)
    ? storedClient
    : legacyNetwork > 0
      ? legacyNetwork
      : Math.max(0, 100 - company)
  const clientLabel =
    franchise.clientType === 'Franchisee' ? 'Franchisee' : 'Sub-franchisor'
  return { company, client, clientLabel }
}

export function splitTotal(franchise) {
  const split = adminRevenueSplit(franchise)
  return split.company + split.client
}

export function splitIsValid(franchise) {
  return Math.abs(splitTotal(franchise) - 100) < 0.001
}

export function standardCosts(franchise) {
  return (franchise.monthlyFees || [])
    .filter((fee) => fee.treatment === 'CostDeduction' || fee.treatment === 'Both')
    .map((fee) => ({
      label: fee.name,
      amount: fee.amount,
      treatment: fee.treatment,
    }))
}

export function treatmentLabel(treatment) {
  if (treatment === 'CostDeduction') return 'Cost deduction'
  if (treatment === 'Both') return 'Billing + cost'
  return 'Billing only'
}

export function treatmentVariant(treatment) {
  if (treatment === 'CostDeduction') return 'warning'
  if (treatment === 'Both') return 'wallet'
  return 'secondary'
}

export function stakeholders(franchise) {
  const split = adminRevenueSplit(franchise)
  return [
    { label: 'Company', share: split.company },
    { label: split.clientLabel, share: split.client },
  ]
}

export function transactionStatusClass(status) {
  if (status === 'Unpaid') return 'bg-amber-50 text-amber-700'
  if (status === 'Collected') return 'bg-emerald-50 text-emerald-700'
  if (status === 'Paid') return 'bg-sky-50 text-sky-700'
  return 'bg-slate-100 text-slate-700'
}

export function transactionBasis(transaction, formatCurrency) {
  switch (transaction.type) {
    case 'Gross Sale':
      return `Gross sales reported for this period: ${formatCurrency(transaction.grossAmount)}.`
    case 'Standard Cost Deduction':
      return `${formatCurrency(transaction.grossAmount)} gross - ${formatCurrency(transaction.deductionAmount)} standard costs = ${formatCurrency(transaction.netShareableAmount)} net shareable.`
    case 'Revenue Share Payout':
      return `${formatCurrency(transaction.grossAmount)} gross - ${formatCurrency(transaction.deductionAmount)} deductions = ${formatCurrency(transaction.netShareableAmount)} payout basis.`
    case 'Billable Monthly Collection':
      return `Billable fixed monthly due for ${transaction.period}: ${formatCurrency(transaction.amount)}.`
    case 'Upfront Collection':
      return `Package and included one-time setup fees total: ${formatCurrency(transaction.amount)}.`
    default:
      return transaction.remarks
  }
}

export function periodKeysInRange(startDate, endDate) {
  const start = monthKey(new Date(`${startDate}T00:00:00`))
  const end = monthKey(new Date(`${endDate}T00:00:00`))
  const keys = []
  let cursor = start
  for (let i = 0; i < 36; i += 1) {
    keys.push(cursor)
    if (cursor === end) break
    cursor = addMonthsToPeriodKey(cursor, 1)
    if (cursor > end) break
  }
  return keys
}

function historyPayment(collectionState, key) {
  return collectionState?.historyPayments?.[key] ?? null
}

function monthlyPaid(collectionState, period) {
  return Math.max(0, Number(collectionState?.monthlyPaidByPeriod?.[period] ?? 0))
}

export function buildClientTransactions(
  franchise,
  grossSale,
  costs,
  collectionState = emptyCollectionState(),
  startDate = DEFAULT_HISTORY_START_DATE,
  endDate = DEFAULT_HISTORY_END_DATE,
) {
  const totalCosts = costs.reduce((sum, cost) => sum + cost.amount, 0)
  const monthlyBillable = fixedMonthlyTotal(franchise)
  const upfrontSetup = upfrontSetupTotal(franchise)
  const salesPeriod = { key: '2026-07', label: monthLabel('2026-07') }
  const deductions = Math.min(grossSale, totalCosts)
  const netShareable = Math.max(0, grossSale - deductions)
  const periods = periodKeysInRange(startDate, endDate)
  const upfrontPaid = Math.max(0, Number(collectionState?.upfrontPaid ?? 0))
  const upfrontRemaining = Math.max(0, upfrontSetup - upfrontPaid)
  const isUpfrontCollected = upfrontSetup > 0 && upfrontRemaining <= 0.001
  const upfrontPaymentKey = 'upfront'
  const upfrontMeta = historyPayment(collectionState, upfrontPaymentKey)
  const defaultUpfrontReference = `UFC-${franchise.id.slice(-3).toUpperCase()}`

  const rows = [
    {
      id: `${franchise.id}-upfront`,
      date: upfrontMeta?.date ?? franchise.activatedAt?.slice(0, 10) ?? `${salesPeriod.key}-03`,
      period: 'Setup',
      type: 'Upfront Collection',
      reference:
        upfrontMeta?.reference ?? (isUpfrontCollected ? defaultUpfrontReference : '-'),
      grossAmount: 0,
      deductionAmount: 0,
      netShareableAmount: 0,
      amount: isUpfrontCollected ? upfrontPaid || upfrontSetup : upfrontSetup,
      paidAmount: upfrontPaid,
      remainingDue: upfrontRemaining,
      status: isUpfrontCollected ? 'Collected' : 'Unpaid',
      remarks: isUpfrontCollected
        ? 'Collected against the shared Financials Dashboard ledger.'
        : upfrontPaid > 0
          ? 'Partial collection recorded. Remaining balance is still due.'
          : 'Awaiting upfront collection confirmation.',
      paymentKey: upfrontRemaining > 0.001 ? upfrontPaymentKey : undefined,
      collectionKind: 'upfront',
    },
  ]

  periods.forEach((period) => {
    const paid = monthlyPaid(collectionState, period)
    const remaining = Math.max(0, monthlyBillable - paid)
    const isCollected = monthlyBillable > 0 && remaining <= 0.001
    const paymentKey = `monthly:${period}`
    const meta = historyPayment(collectionState, paymentKey)
    rows.push({
      id: `${franchise.id}-${period}-monthly`,
      date: meta?.date ?? `${period}-05`,
      period: monthLabel(period),
      type: 'Billable Monthly Collection',
      reference:
        meta?.reference ??
        (isCollected ? `BMC-${franchise.id.slice(-3).toUpperCase()}-${period}` : '-'),
      grossAmount: 0,
      deductionAmount: 0,
      netShareableAmount: 0,
      amount: monthlyBillable,
      paidAmount: paid,
      remainingDue: remaining,
      status: isCollected ? 'Collected' : 'Unpaid',
      remarks: isCollected
        ? 'Billable fixed monthly fee already collected.'
        : paid > 0
          ? `Partial collection recorded. Remaining due for ${monthLabel(period)}.`
          : 'Awaiting billable monthly collection confirmation.',
      paymentKey: remaining > 0.001 && monthlyBillable > 0 ? paymentKey : undefined,
      collectionKind: 'monthly',
      periodKey: period,
    })
  })

  if (periods.includes(salesPeriod.key)) {
    const grossPaymentKey = `gross:${salesPeriod.key}`
    const costPaymentKey = `cost:${salesPeriod.key}`
    const payoutPaymentKey = `payout:${salesPeriod.key}`
    const grossPayment = historyPayment(collectionState, grossPaymentKey)
    const costPayment = historyPayment(collectionState, costPaymentKey)
    const payoutPayment = historyPayment(collectionState, payoutPaymentKey)

    rows.push(
      {
        id: `${franchise.id}-${salesPeriod.key}-gross`,
        date: grossPayment?.date ?? `${salesPeriod.key}-25`,
        period: salesPeriod.label,
        type: 'Gross Sale',
        reference: grossPayment?.reference ?? '-',
        grossAmount: grossSale,
        deductionAmount: 0,
        netShareableAmount: grossSale,
        amount: grossPayment?.amount ?? grossSale,
        paidAmount: grossPayment?.amount ?? 0,
        remainingDue: grossPayment ? 0 : grossSale,
        status: grossPayment ? 'Paid' : 'Unpaid',
        remarks: grossPayment
          ? 'Gross sale collection confirmed.'
          : 'Awaiting gross sale collection confirmation.',
        paymentKey: grossPaymentKey,
        collectionKind: 'history',
      },
      {
        id: `${franchise.id}-${salesPeriod.key}-costs`,
        date: costPayment?.date ?? `${salesPeriod.key}-26`,
        period: salesPeriod.label,
        type: 'Standard Cost Deduction',
        reference: costPayment?.reference ?? '-',
        grossAmount: grossSale,
        deductionAmount: deductions,
        netShareableAmount: netShareable,
        amount: costPayment?.amount ?? deductions,
        paidAmount: costPayment?.amount ?? 0,
        remainingDue: costPayment ? 0 : deductions,
        status: costPayment ? 'Paid' : 'Unpaid',
        remarks: costPayment
          ? 'Standard cost deduction collection confirmed.'
          : 'Awaiting standard cost deduction collection confirmation.',
        paymentKey: costPaymentKey,
        collectionKind: 'history',
      },
      {
        id: `${franchise.id}-${salesPeriod.key}-payout`,
        date: payoutPayment?.date ?? `${salesPeriod.key}-28`,
        period: salesPeriod.label,
        type: 'Revenue Share Payout',
        reference: payoutPayment?.reference ?? '-',
        grossAmount: grossSale,
        deductionAmount: deductions,
        netShareableAmount: netShareable,
        amount: payoutPayment?.amount ?? netShareable,
        paidAmount: payoutPayment?.amount ?? 0,
        remainingDue: payoutPayment ? 0 : netShareable,
        status: payoutPayment ? 'Paid' : 'Unpaid',
        remarks: payoutPayment
          ? 'Combined stakeholder payout collection confirmed.'
          : 'Awaiting revenue share payout confirmation.',
        paymentKey: payoutPaymentKey,
        collectionKind: 'history',
      },
    )
  }

  return rows
}

export function applyClientCollection({
  current = emptyCollectionState(),
  kind,
  periodKey,
  amountCollected,
  reference,
  date,
  upfrontDue,
  monthlyDue,
  paymentKey,
}) {
  const historyPayments = {
    ...(current.historyPayments || {}),
    [paymentKey]: { amount: amountCollected, reference, date },
  }

  if (kind === 'upfront') {
    return {
      ...applyUpfrontCollection(current, upfrontDue, amountCollected),
      historyPayments,
    }
  }

  if (kind === 'monthly') {
    const allocation = allocateMonthlyPayment({
      existingPaidByPeriod: current.monthlyPaidByPeriod,
      startPeriod: periodKey,
      perMonthAmount: monthlyDue,
      amountCollected,
    })
    return {
      ...current,
      monthlyPaidByPeriod: allocation.nextMonthlyPaidByPeriod,
      historyPayments,
    }
  }

  return {
    ...current,
    historyPayments,
  }
}

export function filterTransactionsByDate(transactions, startDate, endDate) {
  const start = new Date(`${startDate}T00:00:00`)
  const end = new Date(`${endDate}T23:59:59`)
  return transactions
    .filter((transaction) => {
      const date = new Date(`${transaction.date}T12:00:00`)
      return date >= start && date <= end
    })
    .sort((a, b) => b.date.localeCompare(a.date))
}

export function summarizeHistory(filteredTransactions) {
  return filteredTransactions.reduce(
    (summary, transaction) => {
      if (transaction.type === 'Gross Sale') {
        summary.grossSales += transaction.grossAmount
      }
      if (transaction.type === 'Standard Cost Deduction') {
        summary.standardCostDeductions += transaction.deductionAmount
      }
      if (transaction.type === 'Revenue Share Payout' && transaction.status === 'Paid') {
        summary.stakeholderPayouts += transaction.amount
      }
      if (transaction.type === 'Billable Monthly Collection') {
        summary.billableMonthlyCollected += Number(transaction.paidAmount ?? 0)
      }
      if (transaction.type === 'Upfront Collection') {
        summary.upfrontCollected += Number(transaction.paidAmount ?? 0)
      }
      return summary
    },
    {
      grossSales: 0,
      standardCostDeductions: 0,
      stakeholderPayouts: 0,
      billableMonthlyCollected: 0,
      upfrontCollected: 0,
    },
  )
}
