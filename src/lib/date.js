/**
 * Formats an ISO date for funding tables.
 * Returns { date: 'Oct 24, 2023', time: '10:45 AM' } in local time.
 */
export function formatDateParts(isoDate) {
  const date = new Date(isoDate)

  if (Number.isNaN(date.getTime())) {
    return { date: '—', time: '' }
  }

  return {
    date: new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }).format(date),
    time: new Intl.DateTimeFormat('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    }).format(date),
  }
}

/**
 * Formats like:
 * Aug 12, 2026
 * 11:00 AM
 * Useful for plain-text receipts.
 */
export function formatDateTimeStacked(isoDate) {
  const parts = formatDateParts(isoDate)
  if (!parts.time) return parts.date
  return `${parts.date}\n${parts.time}`
}

/**
 * Formats like: Oct 24, 10:42 AM
 */
export function formatDateTimeShort(isoDate) {
  const parts = formatDateParts(isoDate)
  if (!parts.time) return parts.date
  return `${parts.date}, ${parts.time}`
}

/**
 * Formats like: Oct 25, 2024
 */
export function formatDateLong(isoDate) {
  const date = new Date(isoDate)
  if (Number.isNaN(date.getTime())) return '—'

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date)
}

/**
 * Human-readable label for report/revenue date-range filters.
 * e.g. "Last 7 days", "Jan 1 – Mar 12, 2026", "All time"
 */
export function formatReportPeriodLabel(dateRange, customRange = null) {
  switch (dateRange) {
    case 'all':
      return 'All time'
    case 'this_month':
      return 'This month'
    case '7d':
      return 'Last 7 days'
    case '30d':
      return 'Last 30 days'
    case '90d':
      return 'Last 90 days'
    case '3m':
      return 'Last 3 months'
    case '6m':
      return 'Last 6 months'
    case 'this_year':
      return 'This year'
    case 'last_year':
      return 'Last year'
    case 'custom': {
      const from = customRange?.from
      const to = customRange?.to
      if (from && to) {
        return `${formatDateLong(from)} – ${formatDateLong(to)}`
      }
      if (from) return `From ${formatDateLong(from)}`
      if (to) return `Through ${formatDateLong(to)}`
      return 'Custom range'
    }
    default:
      return 'Selected period'
  }
}

/**
 * Returns ISO date N days after the given date (local calendar day).
 */
export function addDaysIso(isoDate, days) {
  const date = new Date(isoDate)
  if (Number.isNaN(date.getTime())) return isoDate
  date.setDate(date.getDate() + days)
  return date.toISOString()
}

function startOfDay(dateInput) {
  const date = new Date(dateInput)
  if (Number.isNaN(date.getTime())) return null
  date.setHours(0, 0, 0, 0)
  return date
}

function endOfDay(dateInput) {
  const date = new Date(dateInput)
  if (Number.isNaN(date.getTime())) return null
  date.setHours(23, 59, 59, 999)
  return date
}

/**
 * Filters items by createdAt-style date field using Reports date-range options.
 * Supports: all | this_month | 7d | 30d | 90d | 3m | 6m | this_year | last_year | custom
 */
export function filterItemsByDateRange(
  items,
  dateRange,
  dateField = 'createdAt',
  customRange = null,
) {
  if (!dateRange || dateRange === 'all') return items

  if (dateRange === 'custom') {
    const from = customRange?.from ? startOfDay(customRange.from) : null
    const to = customRange?.to ? endOfDay(customRange.to) : null
    if (!from && !to) return items

    return items.filter((item) => {
      const created = new Date(item[dateField])
      if (Number.isNaN(created.getTime())) return false
      if (from && created < from) return false
      if (to && created > to) return false
      return true
    })
  }

  const now = new Date()
  let from = null
  let to = null

  if (dateRange === 'this_month') {
    from = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0)
    to = endOfDay(now)
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
    from = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0)
    to = endOfDay(now)
  } else if (dateRange === 'last_year') {
    from = new Date(now.getFullYear() - 1, 0, 1, 0, 0, 0, 0)
    to = new Date(now.getFullYear() - 1, 11, 31, 23, 59, 59, 999)
  } else {
    return items
  }

  return items.filter((item) => {
    const created = new Date(item[dateField])
    if (Number.isNaN(created.getTime())) return false
    if (from && created < from) return false
    if (to && created > to) return false
    return true
  })
}
