import { PlaceholderPage } from '@/components/shared/PlaceholderPage'

export default function TransactionsPage() {
  return (
    <PlaceholderPage
      title="Transactions"
      description="Track customer and wallet-related transactions for your organization."
      breadcrumbs={[
        { label: 'Home', href: '/dashboard' },
        { label: 'Transactions' },
      ]}
      details="Customer transaction processing and filtering will be implemented in a later phase."
    />
  )
}
