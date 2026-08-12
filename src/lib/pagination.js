/** Default rows per page for list tables across the app. */
export const DEFAULT_PAGE_SIZE = 10

/**
 * @param {number} total
 * @param {number} pageSize
 * @returns {number}
 */
export function getTotalPages(total, pageSize = DEFAULT_PAGE_SIZE) {
  return Math.max(1, Math.ceil((Number(total) || 0) / pageSize))
}

/**
 * Clamps a 0-based page index into a valid range.
 * @param {number} page
 * @param {number} total
 * @param {number} pageSize
 * @returns {number}
 */
export function clampPage(page, total, pageSize = DEFAULT_PAGE_SIZE) {
  const totalPages = getTotalPages(total, pageSize)
  return Math.min(Math.max(0, Number(page) || 0), totalPages - 1)
}

/**
 * @template T
 * @param {T[]} items
 * @param {number} page
 * @param {number} pageSize
 * @returns {{ page: number, totalPages: number, start: number, end: number, items: T[] }}
 */
export function paginateItems(items, page, pageSize = DEFAULT_PAGE_SIZE) {
  const list = Array.isArray(items) ? items : []
  const total = list.length
  const currentPage = clampPage(page, total, pageSize)
  const startIndex = currentPage * pageSize
  const paged = list.slice(startIndex, startIndex + pageSize)
  const start = total === 0 ? 0 : startIndex + 1
  const end = Math.min(total, startIndex + pageSize)

  return {
    page: currentPage,
    totalPages: getTotalPages(total, pageSize),
    start,
    end,
    items: paged,
  }
}

/**
 * Window of page indexes to show around the current page.
 * @param {number} currentPage 0-based
 * @param {number} totalPages
 * @param {number} maxButtons
 * @returns {number[]}
 */
export function getVisiblePageNumbers(currentPage, totalPages, maxButtons = 5) {
  const pages = Math.max(1, totalPages)
  const buttons = Math.max(1, maxButtons)

  if (pages <= buttons) {
    return Array.from({ length: pages }, (_, index) => index)
  }

  const startPage = Math.min(
    Math.max(0, currentPage - Math.floor(buttons / 2)),
    pages - buttons,
  )

  return Array.from({ length: buttons }, (_, index) => startPage + index)
}
