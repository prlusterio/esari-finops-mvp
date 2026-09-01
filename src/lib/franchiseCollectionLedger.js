import {
  adminRevenueSplit,
  DEFAULT_HISTORY_START_DATE,
  defaultHistoryEndDate,
  fixedMonthlyTotal,
  periodKeysInRange,
  upfrontSetupTotal,
} from '@/lib/clientFinancials'
import {
  emptyCollectionState,
  getFranchisePortfolio,
  loadSharedCollections,
  monthLabel,
} from '@/lib/financialsDashboard'
import { getFranchiseCollections } from '@/services/storage'

function roundMoney(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100
}

function toIsoDate(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function historyPayment(collectionState, key) {
  return collectionState?.historyPayments?.[key] ?? null
}

function collectionStatus(due, paid) {
  const remaining = Math.max(0, roundMoney(due - paid))
  if (due > 0 && remaining <= 0.001) return 'Collected'
  if (paid > 0.001 && remaining > 0.001) return 'Partial'
  return 'Unpaid'
}

export function resolveCollectionRange(
  dateRange = 'all',
  customRange = null,
  now = new Date(),
) {
  const fallbackStart = DEFAULT_HISTORY_START_DATE
  const fallbackEnd = defaultHistoryEndDate(now)

  if (!dateRange || dateRange === 'all') {
    return { startDate: fallbackStart, endDate: fallbackEnd }
  }

  if (dateRange === 'custom') {
    const startDate = customRange?.from || fallbackStart
    const endDate = customRange?.to || fallbackEnd
    return startDate <= endDate
      ? { startDate, endDate }
      : { startDate: endDate, endDate: startDate }
  }

  let from = null
  let to = now

  if (dateRange === 'this_month') {
    from = new Date(now.getFullYear(), now.getMonth(), 1)
  } else if (dateRange === '7d' || dateRange === '30d' || dateRange === '90d') {
    const days = dateRange === '7d' ? 7 : dateRange === '30d' ? 30 : 90
    from = new Date(now)
    from.setDate(from.getDate() - days)
  } else if (dateRange === '3m') {
    from = new Date(now)
    from.setMonth(from.getMonth() - 3)
  } else if (dateRange === '6m') {
    from = new Date(now)
    from.setMonth(from.getMonth() - 6)
  } else if (dateRange === 'this_year') {
    from = new Date(now.getFullYear(), 0, 1)
  } else if (dateRange === 'last_year') {
    from = new Date(now.getFullYear() - 1, 0, 1)
    to = new Date(now.getFullYear() - 1, 11, 31)
  } else {
    return { startDate: fallbackStart, endDate: fallbackEnd }
  }

  return {
    startDate: toIsoDate(from),
    endDate: toIsoDate(to),
  }
}

function dateInRange(date, range) {
  if (!date) return false
  return date >= range.startDate && date <= range.endDate
}

function matchesSearch(entry, search) {
  const query = String(search || '').trim().toLowerCase()
  if (!query) return true
  return [
    entry.clientName,
    entry.clientType,
    entry.type,
    entry.period,
    entry.periodLabel,
    entry.reference,
    entry.status,
  ]
    .filter(Boolean)
    .some((value) => String(value).toLowerCase().includes(query))
}

export function buildFranchiseCollectionEntries({
  franchises = [],
  collections = {},
  range,
  search = '',
} = {}) {
  const bounds = range || resolveCollectionRange('all')
  const periods = periodKeysInRange(bounds.startDate, bounds.endDate)
  const rows = []

  franchises
    .filter((franchise) => franchise.status === 'Activated')
    .forEach((franchise) => {
      const state = collections[franchise.id] || emptyCollectionState()
      const split = adminRevenueSplit(franchise)
      const upfrontDue = roundMoney(upfrontSetupTotal(franchise))
      const monthlyDue = roundMoney(fixedMonthlyTotal(franchise))
      const activationMonth = franchise.activatedAt?.slice(0, 7) || ''

      if (upfrontDue > 0) {
        const paymentKey = 'upfront'
        const meta = historyPayment(state, paymentKey)
        const date =
          meta?.date ||
          franchise.activatedAt?.slice(0, 10) ||
          `${periods[0] || bounds.startDate.slice(0, 7)}-03`
        if (dateInRange(date, bounds)) {
          const paid = roundMoney(Math.max(0, Number(state.upfrontPaid ?? 0)))
          const remaining = Math.max(0, roundMoney(upfrontDue - paid))
          rows.push({
            id: `${franchise.id}-upfront`,
            clientId: franchise.id,
            clientName: franchise.name,
            clientType: franchise.clientType,
            type: 'Upfront',
            period: 'Setup',
            periodKey: null,
            periodLabel: 'Setup',
            date,
            due: upfrontDue,
            paid,
            remaining,
            status: collectionStatus(upfrontDue, paid),
            companyPct: split.company,
            clientPct: split.client,
            reference: meta?.reference || '',
            paymentKey,
            collectionKind: 'upfront',
          })
        }
      }

      if (monthlyDue > 0) {
        const startPeriod = bounds.startDate.slice(0, 7)
        const endPeriod = bounds.endDate.slice(0, 7)
        periods.forEach((period) => {
          if (activationMonth && period < activationMonth) return
          if (period < startPeriod || period > endPeriod) return
          const paymentKey = `monthly:${period}`
          const meta = historyPayment(state, paymentKey)
          const date = meta?.date || `${period}-01`
          const paid = roundMoney(
            Math.max(0, Number(state.monthlyPaidByPeriod?.[period] ?? 0)),
          )
          const remaining = Math.max(0, roundMoney(monthlyDue - paid))
          rows.push({
            id: `${franchise.id}-${period}`,
            clientId: franchise.id,
            clientName: franchise.name,
            clientType: franchise.clientType,
            type: 'Billable monthly',
            period,
            periodKey: period,
            periodLabel: monthLabel(period),
            date,
            due: monthlyDue,
            paid,
            remaining,
            status: collectionStatus(monthlyDue, paid),
            companyPct: split.company,
            clientPct: split.client,
            reference: meta?.reference || '',
            paymentKey,
            collectionKind: 'monthly',
          })
        })
      }
    })

  return rows
    .filter((entry) => matchesSearch(entry, search))
    .sort((a, b) => {
      if (a.date !== b.date) return b.date.localeCompare(a.date)
      return a.clientName.localeCompare(b.clientName)
    })
}

export function summarizeFranchiseCollectionEntries(entries = []) {
  return entries.reduce(
    (summary, entry) => {
      summary.due += entry.due
      summary.collected += entry.paid
      summary.remaining += entry.remaining
      summary.rowCount += 1
      if (entry.status === 'Collected') summary.collectedCount += 1
      summary.clientIds.add(entry.clientId)
      return summary
    },
    {
      due: 0,
      collected: 0,
      remaining: 0,
      rowCount: 0,
      collectedCount: 0,
      clientIds: new Set(),
    },
  )
}

export function franchiseCollectionKpis(entries = []) {
  const summary = summarizeFranchiseCollectionEntries(entries)
  return {
    due: roundMoney(summary.due),
    collected: roundMoney(summary.collected),
    remaining: roundMoney(summary.remaining),
    rowCount: summary.rowCount,
    collectedCount: summary.collectedCount,
    activatedCount: summary.clientIds.size,
  }
}

export function rollupFranchiseCollectionsByClient(entries = []) {
  const byId = new Map()
  entries.forEach((entry) => {
    const current = byId.get(entry.clientId) || {
      clientId: entry.clientId,
      name: entry.clientName,
      clientType: entry.clientType,
      companyPct: entry.companyPct,
      clientPct: entry.clientPct,
      upfrontDue: 0,
      upfrontPaid: 0,
      monthlyDue: 0,
      monthlyPaid: 0,
    }
    if (entry.collectionKind === 'upfront') {
      current.upfrontDue += entry.due
      current.upfrontPaid += entry.paid
    } else {
      current.monthlyDue += entry.due
      current.monthlyPaid += entry.paid
    }
    byId.set(entry.clientId, current)
  })

  return [...byId.values()]
    .map((row) => {
      const upfrontRemaining = Math.max(0, roundMoney(row.upfrontDue - row.upfrontPaid))
      const monthlyRemaining = Math.max(0, roundMoney(row.monthlyDue - row.monthlyPaid))
      return {
        ...row,
        upfrontDue: roundMoney(row.upfrontDue),
        upfrontPaid: roundMoney(row.upfrontPaid),
        monthlyDue: roundMoney(row.monthlyDue),
        monthlyPaid: roundMoney(row.monthlyPaid),
        collected: roundMoney(row.upfrontPaid + row.monthlyPaid),
        remaining: roundMoney(upfrontRemaining + monthlyRemaining),
      }
    })
    .sort((a, b) => a.name.localeCompare(b.name))
}

export function franchiseCollectionEntriesToCsv(entries = []) {
  const header = [
    'Client',
    'Type',
    'Period',
    'Date',
    'Due',
    'Paid',
    'Remaining',
    'Status',
    'Company %',
    'Client %',
    'Reference',
  ]
  const lines = entries.map((entry) =>
    [
      entry.clientName,
      entry.type,
      entry.periodLabel,
      entry.date,
      entry.due.toFixed(2),
      entry.paid.toFixed(2),
      entry.remaining.toFixed(2),
      entry.status,
      entry.companyPct,
      entry.clientPct,
      entry.reference,
    ]
      .map((value) => `"${String(value ?? '').replace(/"/g, '""')}"`)
      .join(','),
  )
  return [header.join(','), ...lines].join('\n')
}

export function loadFranchiseCollectionView({
  dateRange = 'all',
  customDateRange = null,
  search = '',
} = {}) {
  const franchises = getFranchisePortfolio()
  const collections = loadSharedCollections(
    franchises,
    getFranchiseCollections(),
  )
  const range = resolveCollectionRange(dateRange, customDateRange)
  const entries = buildFranchiseCollectionEntries({
    franchises,
    collections,
    range,
    search,
  })
  return {
    franchises,
    collections,
    range,
    entries,
    kpis: franchiseCollectionKpis(entries),
    rollup: rollupFranchiseCollectionsByClient(entries),
  }
}
