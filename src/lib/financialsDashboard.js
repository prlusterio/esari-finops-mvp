import { mockFranchises } from '@/data/franchiseFinancials'
import { formatCurrency } from '@/lib/currency'
import { getClientStatusOverrides, getRegisteredClients } from '@/services/storage'

export const FRANCHISE_STATUS_ORDER = [
  'Activated',
  'Pending Activation',
  'Pending Review',
  'In Progress',
]

const COLLECTION_STAGES = ['Confirmed', 'Collected']

const MOCK_UPFRONT_COLLECTED_IDS = new Set([
  'fr_sc_sdn_001',
  'fr_sg_dapa_003',
  'fr_sdn_sis_007',
  'fr_sdn_sm_008',
])

const MOCK_MONTHLY_COLLECTED_IDS = new Set([
  'fr_sg_dapa_003',
  'fr_sdn_sis_007',
  'fr_sdn_sm_008',
])

export function applyClientStatusOverride(franchise, overrides = getClientStatusOverrides()) {
  const patch = overrides[franchise?.id]
  if (!patch) return franchise
  return {
    ...franchise,
    status: patch.status || franchise.status,
    activatedAt: patch.activatedAt || franchise.activatedAt,
    updatedAt: patch.updatedAt || franchise.updatedAt,
  }
}

export function getFranchisePortfolio() {
  const overrides = getClientStatusOverrides()
  return [...getRegisteredClients(), ...mockFranchises].map((franchise) =>
    applyClientStatusOverride(franchise, overrides),
  )
}

export function isBillableFee(fee) {
  return fee?.treatment !== 'CostDeduction'
}

export function monthKey(date = new Date()) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  return `${y}-${m}`
}

export function monthLabel(key) {
  const [yRaw, mRaw] = String(key).split('-')
  const y = Number(yRaw)
  const m = Number(mRaw)
  if (!Number.isFinite(y) || !Number.isFinite(m) || m < 1 || m > 12) {
    return key
  }
  return new Intl.DateTimeFormat('en-PH', {
    month: 'short',
    year: 'numeric',
  }).format(new Date(y, m - 1, 1))
}

export function addMonthsToPeriodKey(key, delta) {
  const [yRaw, mRaw] = String(key).split('-')
  const y = Number(yRaw)
  const m = Number(mRaw)
  if (!Number.isFinite(y) || !Number.isFinite(m) || m < 1 || m > 12) {
    return key
  }
  return monthKey(new Date(y, m - 1 + delta, 1))
}

export function collectionPeriodOptions(
  base = new Date(),
  { pastCount = 6, futureCount = 12 } = {},
) {
  const months = [monthKey(base)]
  for (let i = 1; i <= futureCount; i += 1) {
    months.push(monthKey(new Date(base.getFullYear(), base.getMonth() + i, 1)))
  }
  for (let i = 1; i <= pastCount; i += 1) {
    months.push(monthKey(new Date(base.getFullYear(), base.getMonth() - i, 1)))
  }
  return months
}

export function computeFranchiseMoney(franchise) {
  const packageFees = (franchise.packageSelections || []).reduce(
    (sum, item) => sum + item.unitFee * item.quantity,
    0,
  )
  const oneTimeEnabled = (franchise.oneTimeFees || [])
    .filter((fee) => fee.enabled)
    .reduce((sum, fee) => sum + fee.amount, 0)
  const fixedMonthly = (franchise.monthlyFees || [])
    .filter((fee) => fee.billingType === 'FixedMonthly' && isBillableFee(fee))
    .reduce((sum, fee) => sum + fee.amount, 0)
  const percentGrossCount = (franchise.monthlyFees || []).filter(
    (fee) => fee.billingType === 'PercentGrossSales',
  ).length

  return {
    id: franchise.id,
    name: franchise.name,
    status: franchise.status,
    packageFees,
    oneTimeEnabled,
    upfrontTotal: packageFees + oneTimeEnabled,
    fixedMonthly,
    percentGrossCount,
    territories: (franchise.territories || []).length,
  }
}

export function computeMoney(franchises = mockFranchises) {
  return franchises.map(computeFranchiseMoney)
}

function isCollectionStage(value) {
  return COLLECTION_STAGES.includes(String(value))
}

export function defaultCollectionState(franchise, period) {
  const isActivated = franchise.status === 'Activated'
  const isUpfrontCollected =
    isActivated && MOCK_UPFRONT_COLLECTED_IDS.has(franchise.id)
  const isMonthlyCollected =
    isActivated && MOCK_MONTHLY_COLLECTED_IDS.has(franchise.id)
  const money = computeFranchiseMoney(franchise)

  return {
    upfront: isUpfrontCollected ? 'Collected' : 'Confirmed',
    upfrontPaid: isUpfrontCollected ? money.upfrontTotal : 0,
    monthlyPaidByPeriod:
      isMonthlyCollected && money.fixedMonthly > 0
        ? { [period]: money.fixedMonthly }
        : {},
    historyPayments: {},
  }
}

export function emptyCollectionState() {
  return {
    upfront: 'Confirmed',
    upfrontPaid: 0,
    monthlyPaidByPeriod: {},
    historyPayments: {},
  }
}

export function buildDefaultCollections(franchises, period) {
  const next = {}
  franchises.forEach((franchise) => {
    next[franchise.id] = defaultCollectionState(franchise, period)
  })
  return next
}

export function normalizeStoredCollections(
  parsed,
  money,
  defaults,
  fallbackPeriod,
) {
  const next = { ...defaults }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return next
  }

  Object.keys(defaults).forEach((id) => {
    const entry = parsed[id]
    if (!entry || typeof entry !== 'object') return

    const moneyRow = money.find((item) => item.id === id)
    const upfrontDue = Math.max(0, moneyRow?.upfrontTotal ?? 0)
    const due = Math.max(0, moneyRow?.fixedMonthly ?? 0)
    const upfrontRaw = entry.upfront
    const upfrontPaidRaw = Number(entry.upfrontPaid)
    const monthlyRaw = entry.monthly
    const monthlyByPeriodRaw = entry.monthlyByPeriod
    const monthlyPaidByPeriodRaw = entry.monthlyPaidByPeriod

    const upfrontStage =
      upfrontRaw === 'Expected'
        ? 'Confirmed'
        : isCollectionStage(upfrontRaw)
          ? upfrontRaw
          : next[id]?.upfront ?? 'Confirmed'
    const upfrontPaid = Number.isFinite(upfrontPaidRaw)
      ? Math.max(0, Math.min(upfrontPaidRaw, upfrontDue))
      : upfrontStage === 'Collected'
        ? upfrontDue
        : 0

    const monthlyPaidByPeriod = {}
    if (monthlyPaidByPeriodRaw && typeof monthlyPaidByPeriodRaw === 'object') {
      Object.keys(monthlyPaidByPeriodRaw).forEach((period) => {
        const amountRaw = Number(monthlyPaidByPeriodRaw[period])
        if (!Number.isFinite(amountRaw)) return
        const amount = Math.max(0, amountRaw)
        if (amount <= 0) return
        monthlyPaidByPeriod[period] = due > 0 ? Math.min(amount, due) : amount
      })
    } else if (monthlyByPeriodRaw && typeof monthlyByPeriodRaw === 'object') {
      Object.keys(monthlyByPeriodRaw).forEach((period) => {
        const stageRaw = monthlyByPeriodRaw[period]
        const stage =
          stageRaw === 'Expected'
            ? 'Confirmed'
            : isCollectionStage(stageRaw)
              ? stageRaw
              : null
        if (stage === 'Collected' && due > 0) {
          monthlyPaidByPeriod[period] = due
        }
      })
    } else {
      const legacyMonthly =
        monthlyRaw === 'Expected'
          ? 'Confirmed'
          : isCollectionStage(monthlyRaw)
            ? monthlyRaw
            : null
      if (legacyMonthly === 'Collected' && due > 0) {
        monthlyPaidByPeriod[fallbackPeriod] = due
      }
    }

    const historyPaymentsRaw = entry.historyPayments
    const historyPayments =
      historyPaymentsRaw &&
      typeof historyPaymentsRaw === 'object' &&
      !Array.isArray(historyPaymentsRaw)
        ? historyPaymentsRaw
        : next[id]?.historyPayments ?? {}

    next[id] = {
      upfront: upfrontDue > 0 && upfrontPaid >= upfrontDue ? 'Collected' : 'Confirmed',
      upfrontPaid,
      monthlyPaidByPeriod,
      historyPayments,
    }
  })

  return next
}

export function loadSharedCollections(franchises = mockFranchises, stored = {}) {
  const fallbackPeriod = monthKey(new Date())
  return normalizeStoredCollections(
    stored,
    computeMoney(franchises),
    buildDefaultCollections(franchises, fallbackPeriod),
    fallbackPeriod,
  )
}

export function applyUpfrontCollection(current, upfrontAmount, amountCollected) {
  const existing = current ?? emptyCollectionState()
  const nextPaid = Math.min(
    upfrontAmount,
    Math.max(0, existing.upfrontPaid ?? 0) + amountCollected,
  )
  return {
    ...existing,
    upfront: nextPaid >= upfrontAmount ? 'Collected' : 'Confirmed',
    upfrontPaid: nextPaid,
  }
}

export function allocateMonthlyPayment({
  existingPaidByPeriod = {},
  startPeriod,
  perMonthAmount,
  amountCollected,
  maxPeriods = 24,
}) {
  const nextMonthlyPaidByPeriod = { ...existingPaidByPeriod }
  let remaining = amountCollected
  let appliedAmount = 0
  let fullyCoveredCount = 0
  let firstTouchedPeriod = null
  let lastFullyCoveredPeriod = null
  let partialPeriod = null
  let partialRemaining = null

  for (let i = 0; i < maxPeriods && remaining > 0; i += 1) {
    const period = addMonthsToPeriodKey(startPeriod, i)
    const existingPaid = Math.max(0, nextMonthlyPaidByPeriod[period] ?? 0)
    const remainingDue = Math.max(0, perMonthAmount - existingPaid)
    if (remainingDue <= 0) continue

    if (!firstTouchedPeriod) firstTouchedPeriod = period

    const applied = Math.min(remainingDue, remaining)
    if (applied <= 0) break

    const nextPaid = Math.min(perMonthAmount, existingPaid + applied)
    nextMonthlyPaidByPeriod[period] = nextPaid
    appliedAmount += applied
    remaining -= applied

    if (nextPaid >= perMonthAmount - 0.001) {
      fullyCoveredCount += 1
      lastFullyCoveredPeriod = period
      continue
    }

    partialPeriod = period
    partialRemaining = Math.max(0, perMonthAmount - nextPaid)
    break
  }

  return {
    nextMonthlyPaidByPeriod,
    appliedAmount,
    unallocatedAmount: Math.max(0, amountCollected - appliedAmount),
    fullyCoveredCount,
    firstTouchedPeriod,
    lastFullyCoveredPeriod,
    partialPeriod,
    partialRemaining,
  }
}

export function monthlyCoverageLabel(allocation, startPeriod) {
  const {
    appliedAmount,
    fullyCoveredCount,
    firstTouchedPeriod,
    lastFullyCoveredPeriod,
    partialPeriod,
    partialRemaining,
  } = allocation

  if (appliedAmount <= 0) return '—'

  if (fullyCoveredCount <= 0 && partialPeriod) {
    return `Partial ${monthLabel(partialPeriod)} • remaining ${formatCurrency(
      partialRemaining ?? 0,
    )}`
  }

  const from = monthLabel(firstTouchedPeriod ?? startPeriod)
  const to = monthLabel(
    lastFullyCoveredPeriod ?? firstTouchedPeriod ?? startPeriod,
  )
  const base = `${from} → ${to} (${fullyCoveredCount} mo)`
  if (partialPeriod) {
    return `${base} + partial ${monthLabel(partialPeriod)} (remaining ${formatCurrency(
      partialRemaining ?? 0,
    )})`
  }
  return base
}

export function buildDashboardMetrics({
  franchises,
  money,
  collections,
  monthlyPeriod,
}) {
  const activeMoney = money.filter((item) => item.status === 'Activated')
  const activeFranchises = activeMoney.length
  const activatedUpfront = activeMoney.reduce(
    (sum, item) => sum + item.upfrontTotal,
    0,
  )
  const activatedFixedMonthly = activeMoney.reduce(
    (sum, item) => sum + item.fixedMonthly,
    0,
  )

  const allTerritories = franchises.flatMap((franchise) =>
    (franchise.territories || []).map((territory) => ({
      franchiseId: franchise.id,
      franchiseName: franchise.name,
      ...territory,
    })),
  )
  const missingBoundaries = allTerritories.filter(
    (territory) => !territory.boundaryDefined,
  )

  const oneTimeEnabledTotal = activeMoney.reduce(
    (sum, item) => sum + item.oneTimeEnabled,
    0,
  )
  const packageFeesTotal = activeMoney.reduce(
    (sum, item) => sum + item.packageFees,
    0,
  )
  const upfrontTotal = activeMoney.reduce(
    (sum, item) => sum + item.upfrontTotal,
    0,
  )
  const fixedMonthlyTotal = activeMoney.reduce(
    (sum, item) => sum + item.fixedMonthly,
    0,
  )
  const percentGrossConfigured = activeMoney.filter(
    (item) => item.percentGrossCount > 0,
  ).length
  const percentGrossItemsTotal = activeMoney.reduce(
    (sum, item) => sum + item.percentGrossCount,
    0,
  )

  const upfrontCollectedTotal = activeMoney.reduce((sum, item) => {
    const due = Math.max(0, item.upfrontTotal)
    const paid = Math.max(0, collections[item.id]?.upfrontPaid ?? 0)
    return sum + (due > 0 ? Math.min(paid, due) : 0)
  }, 0)
  const upfrontCollectedCount = activeMoney.reduce((count, item) => {
    const due = Math.max(0, item.upfrontTotal)
    const paid = Math.max(0, collections[item.id]?.upfrontPaid ?? 0)
    return due > 0 && paid >= due ? count + 1 : count
  }, 0)
  const monthlyCollectedTotal = activeMoney.reduce((sum, item) => {
    const due = Math.max(0, item.fixedMonthly)
    const paid = Math.max(
      0,
      collections[item.id]?.monthlyPaidByPeriod?.[monthlyPeriod] ?? 0,
    )
    return sum + (due > 0 ? Math.min(paid, due) : 0)
  }, 0)
  const monthlyCollectedCount = activeMoney.reduce((count, item) => {
    const due = Math.max(0, item.fixedMonthly)
    const paid = Math.max(
      0,
      collections[item.id]?.monthlyPaidByPeriod?.[monthlyPeriod] ?? 0,
    )
    return due > 0 && paid >= due ? count + 1 : count
  }, 0)

  const packageAdoption = {
    eNeighborhood: 0,
    eBarangay: 0,
    eLGU: 0,
  }
  franchises
    .filter((franchise) => franchise.status === 'Activated')
    .forEach((franchise) => {
      ;(franchise.packageSelections || []).forEach((selection) => {
        if (selection.quantity > 0 && packageAdoption[selection.code] != null) {
          packageAdoption[selection.code] += 1
        }
      })
    })

  const byStatusMap = new Map()
  money.forEach((item) => {
    const row = byStatusMap.get(item.status) ?? {
      count: 0,
      upfront: 0,
      fixedMonthly: 0,
    }
    row.count += 1
    row.upfront += item.upfrontTotal
    row.fixedMonthly += item.fixedMonthly
    byStatusMap.set(item.status, row)
  })
  const byStatus = Array.from(byStatusMap.entries())
    .map(([status, value]) => ({ status, ...value }))
    .sort(
      (a, b) =>
        FRANCHISE_STATUS_ORDER.indexOf(a.status) -
        FRANCHISE_STATUS_ORDER.indexOf(b.status),
    )

  const oneTimeByNameMap = new Map()
  franchises
    .filter((franchise) => franchise.status === 'Activated')
    .forEach((franchise) => {
      ;(franchise.oneTimeFees || []).forEach((fee) => {
        const row = oneTimeByNameMap.get(fee.name) ?? {
          enabledCount: 0,
          total: 0,
        }
        if (fee.enabled) {
          row.enabledCount += 1
          row.total += fee.amount
        }
        oneTimeByNameMap.set(fee.name, row)
      })
    })

  const monthlyByNameMap = new Map()
  franchises
    .filter((franchise) => franchise.status === 'Activated')
    .forEach((franchise) => {
      ;(franchise.monthlyFees || []).forEach((fee) => {
        if (!isBillableFee(fee)) return
        const key = `${fee.billingType}:${fee.name}`
        const row = monthlyByNameMap.get(key) ?? {
          count: 0,
          total: 0,
          billingType: fee.billingType,
          name: fee.name,
        }
        row.count += 1
        row.total += fee.amount
        monthlyByNameMap.set(key, row)
      })
    })

  return {
    activeFranchises,
    activatedUpfront,
    activatedFixedMonthly,
    allTerritories,
    missingBoundaries,
    oneTimeEnabledTotal,
    packageFeesTotal,
    upfrontTotal,
    fixedMonthlyTotal,
    percentGrossConfigured,
    percentGrossItemsTotal,
    upfrontCollectedTotal,
    upfrontCollectedCount,
    upfrontRemainingTotal: upfrontTotal - upfrontCollectedTotal,
    monthlyCollectedTotal,
    monthlyCollectedCount,
    monthlyRemainingTotal: fixedMonthlyTotal - monthlyCollectedTotal,
    packageAdoption,
    byStatus,
    topUpfront: [...money]
      .sort((a, b) => b.upfrontTotal - a.upfrontTotal)
      .slice(0, 8),
    topMonthly: [...money]
      .sort((a, b) => b.fixedMonthly - a.fixedMonthly)
      .slice(0, 8),
    oneTimeByName: Array.from(oneTimeByNameMap.entries())
      .map(([name, value]) => ({ name, ...value }))
      .sort((a, b) => b.total - a.total),
    monthlyByName: Array.from(monthlyByNameMap.values()).sort(
      (a, b) => b.total - a.total,
    ),
  }
}
