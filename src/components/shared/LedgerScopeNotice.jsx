import { Info } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { ROLES } from '@/lib/constants'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

/**
 * Scope note for Transactions, Revenue, and Reports.
 * Admin also sees franchise collections as a separate section on these pages.
 */
export function LedgerScopeNotice({ className }) {
  const { user } = useAuth()
  const isAdmin = user?.role === ROLES.ADMIN

  return (
    <div
      role="note"
      className={cn(
        'mb-4 flex flex-col gap-3 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 sm:flex-row sm:items-start sm:justify-between',
        className,
      )}
    >
      <div className="flex min-w-0 items-start gap-3">
        <Info className="mt-0.5 h-5 w-5 shrink-0 text-sky-700" />
        <div className="min-w-0">
          <p className="text-sm font-semibold text-sky-950">
            {isAdmin
              ? 'Internet Credits, sales, and franchise collections'
              : 'Internet Credits and sales only'}
          </p>
          <p className="mt-0.5 text-sm text-sky-900">
            {isAdmin
              ? 'Internet Credits and sales cards stay the same. Franchise setup collections are a separate Admin section on this page and write the same ledger as Financials Dashboard and Client Details. They are not added into Total earnings.'
              : 'This page covers Internet Credits loads and retailer sales commissions.'}
          </p>
        </div>
      </div>
      {isAdmin ? (
        <div className="flex shrink-0 flex-wrap gap-2">
          <Button asChild size="sm" variant="outline">
            <Link to="/dashboard">Dashboard</Link>
          </Button>
          <Button asChild size="sm">
            <Link to="/franchise-setup/clients">Clients</Link>
          </Button>
        </div>
      ) : null}
    </div>
  )
}
