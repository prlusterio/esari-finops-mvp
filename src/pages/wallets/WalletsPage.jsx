import { PlaceholderPage } from '@/components/shared/PlaceholderPage'

export default function WalletsPage() {
  return (
    <PlaceholderPage
      title="Wallets"
      description="View and monitor wallets across the eSariSari organization hierarchy."
      breadcrumbs={[
        { label: 'Home', href: '/dashboard' },
        { label: 'Wallets' },
      ]}
      details="Wallet listings, balances, and transfer actions will be implemented in a later phase."
    />
  )
}
