import { ChevronLeft, ChevronRight } from 'lucide-react'
import {
  DEFAULT_PAGE_SIZE,
  getTotalPages,
  getVisiblePageNumbers,
} from '@/lib/pagination'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

/**
 * Standard table footer pagination: range label + numbered pages.
 *
 * @param {{
 *   page: number,
 *   pageSize?: number,
 *   total: number,
 *   onPageChange: (page: number) => void,
 *   itemLabel?: string,
 *   maxPageButtons?: number,
 *   className?: string,
 * }} props
 */
export function TablePagination({
  page,
  pageSize = DEFAULT_PAGE_SIZE,
  total,
  onPageChange,
  itemLabel = 'entries',
  maxPageButtons = 5,
  className,
}) {
  const totalPages = getTotalPages(total, pageSize)
  const currentPage = Math.min(Math.max(0, page), totalPages - 1)
  const start = total === 0 ? 0 : currentPage * pageSize + 1
  const end = Math.min(total, (currentPage + 1) * pageSize)
  const pageNumbers = getVisiblePageNumbers(
    currentPage,
    totalPages,
    maxPageButtons,
  )

  return (
    <div
      className={cn(
        'flex flex-col gap-3 border-t border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between',
        className,
      )}
    >
      <p className="text-sm text-muted-foreground">
        Showing {start} to {end} of {total} {itemLabel}
      </p>
      <div className="flex items-center gap-1">
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-8 w-8"
          disabled={currentPage <= 0}
          onClick={() => onPageChange(currentPage - 1)}
          aria-label="Previous page"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        {pageNumbers.map((pageNumber) => (
          <Button
            key={pageNumber}
            type="button"
            variant={pageNumber === currentPage ? 'default' : 'outline'}
            size="icon"
            className={cn(
              'h-8 w-8',
              pageNumber === currentPage &&
                'bg-blue-600 text-white hover:bg-blue-700',
            )}
            onClick={() => onPageChange(pageNumber)}
            aria-label={`Page ${pageNumber + 1}`}
            aria-current={pageNumber === currentPage ? 'page' : undefined}
          >
            {pageNumber + 1}
          </Button>
        ))}
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-8 w-8"
          disabled={currentPage >= totalPages - 1}
          onClick={() => onPageChange(currentPage + 1)}
          aria-label="Next page"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
