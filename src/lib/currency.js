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
