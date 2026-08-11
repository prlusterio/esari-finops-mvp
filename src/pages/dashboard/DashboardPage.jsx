import { useMemo } from 'react'
import {
  ArrowLeftRight,
  Receipt,
  Scale,
  Wallet,
} from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { ROLES } from '@/lib/constants'
import { formatCurrency } from '@/lib/currency'
import {
  getFundingRequests,
  getSettlements,
  getTransactions,
  getWallets,
} from '@/services/storage'
import { PageHeader } from '@/components/shared/PageHeader'
import { StatCard } from '@/components/shared/StatCard'
import { ORG_IDS } from '@/lib/constants'

function isToday(isoDate) {
  if (!isoDate) return false
  const date = new Date(isoDate)
  if (Number.isNaN(date.getTime())) return false
  const today = new Date()
  return (
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate()
  )
}

export default function DashboardPage() {
  const { user, organization, dataVersion } = useAuth()

  const stats = useMemo(() => {
    const wallets = getWallets()
    const fundingRequests = getFundingRequests()
    const transactions = getTransactions()
    const settlements = getSettlements()

    const orgWallet = wallets.find(
      (wallet) => wallet.organizationId === user?.organizationId,
    )
    const masterWallet = wallets.find(
      (wallet) => wallet.organizationId === ORG_IDS.PLATFORM,
    )

    const pendingRequests = fundingRequests.filter(
      (request) => request.status === 'pending',
    )
    const myPendingRequests = pendingRequests.filter(
      (request) => request.organizationId === user?.organizationId,
    )
    const pendingFranchiseeRequests = pendingRequests.filter(
      (request) => request.requesterRole === ROLES.FRANCHISEE,
    )
    const pendingRetailerRequests = pendingRequests.filter(
      (request) => request.requesterRole === ROLES.RETAILER,
    )
    const transactionsToday = transactions.filter((tx) => isToday(tx.createdAt))
    const pendingSettlements = settlements.filter(
      (settlement) => settlement.status === 'pending',
    )

    return {
      walletBalance: orgWallet?.availableBalance ?? 0,
      masterBalance: masterWallet?.availableBalance ?? 0,
      pendingFundingCount: pendingRequests.length,
      myPendingCount: myPendingRequests.length,
      pendingFranchiseeCount: pendingFranchiseeRequests.length,
      pendingRetailerCount: pendingRetailerRequests.length,
      transactionsTodayCount: transactionsToday.length,
      pendingSettlementsCount: pendingSettlements.length,
    }
  }, [user?.organizationId, dataVersion])

  const breadcrumbs = [
    { label: 'Home', href: '/dashboard' },
    { label: 'Dashboard' },
  ]

  return (
    <div>
      <PageHeader
        title="Dashboard"
        description={`Welcome back, ${user?.name}. Viewing ${organization?.name || 'your organization'}.`}
        breadcrumbs={breadcrumbs}
      />

      {user?.role === ROLES.ADMIN && (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            title="Master Wallet Balance"
            value={formatCurrency(stats.masterBalance)}
            icon={Wallet}
            accent="wallet"
          />
          <StatCard
            title="Pending Funding Requests"
            value={stats.pendingFundingCount}
            icon={ArrowLeftRight}
            accent="warning"
          />
          <StatCard
            title="Transactions Today"
            value={stats.transactionsTodayCount}
            icon={Receipt}
          />
          <StatCard
            title="Pending Settlements"
            value={stats.pendingSettlementsCount}
            icon={Scale}
            accent="warning"
          />
        </div>
      )}

      {user?.role === ROLES.SUBFRANCHISEE && (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <StatCard
            title="Current Wallet Balance"
            value={formatCurrency(stats.walletBalance)}
            icon={Wallet}
            accent="wallet"
          />
          <StatCard
            title="My Pending Funding Request"
            value={stats.myPendingCount}
            icon={ArrowLeftRight}
            accent="warning"
          />
          <StatCard
            title="Pending Franchisee Requests"
            value={stats.pendingFranchiseeCount}
            icon={ArrowLeftRight}
            accent="warning"
          />
        </div>
      )}

      {user?.role === ROLES.FRANCHISEE && (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <StatCard
            title="Current Wallet Balance"
            value={formatCurrency(stats.walletBalance)}
            icon={Wallet}
            accent="wallet"
          />
          <StatCard
            title="My Pending Funding Request"
            value={stats.myPendingCount}
            icon={ArrowLeftRight}
            accent="warning"
          />
          <StatCard
            title="Pending Retailer Requests"
            value={stats.pendingRetailerCount}
            icon={ArrowLeftRight}
            accent="warning"
          />
        </div>
      )}

      {user?.role === ROLES.RETAILER && (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <StatCard
            title="Current Wallet Balance"
            value={formatCurrency(stats.walletBalance)}
            icon={Wallet}
            accent="wallet"
          />
          <StatCard
            title="Pending Funding Request"
            value={stats.myPendingCount}
            icon={ArrowLeftRight}
            accent="warning"
          />
          <StatCard
            title="Transactions Today"
            value={stats.transactionsTodayCount}
            icon={Receipt}
          />
        </div>
      )}
    </div>
  )
}
