import { PlaceholderPage } from '@/components/shared/PlaceholderPage'

export default function WalletPage() {
  return (
    <PlaceholderPage
      title="Wallet"
      description="Review your organization wallet balance and funding activity."
      breadcrumbs={[
        { label: 'Home', href: '/dashboard' },
        { label: 'Wallet' },
      ]}
      details="Detailed wallet history and transfer actions will be implemented in a later phase."
    />
  )
}
