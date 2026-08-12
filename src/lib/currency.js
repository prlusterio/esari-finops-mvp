/**
 * Formats a numeric amount as Philippine Peso.
 * @param {number} amount
 * @returns {string} e.g. ₱10,000.00
 */
export function formatCurrency(amount) {
  const value = Number(amount)

  if (Number.isNaN(value)) {
    return '₱0.00'
  }

  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

/**
 * Formats an absolute amount with an explicit + / - prefix.
 * @param {number} amount
 * @param {'credit' | 'debit'} direction
 * @returns {string} e.g. +₱10,000.00 or -₱10,000.00
 */
export function formatSignedCurrency(amount, direction = 'credit') {
  const absolute = Math.abs(Number(amount) || 0)
  const prefix = direction === 'debit' ? '-' : '+'
  return `${prefix}${formatCurrency(absolute)}`
}

/**
 * Tailwind text color for credit (green) vs debit (red).
 * @param {'credit' | 'debit'} direction
 * @returns {string}
 */
export function signedAmountClassName(direction = 'credit') {
  return direction === 'debit' ? 'text-red-600' : 'text-emerald-600'
}
