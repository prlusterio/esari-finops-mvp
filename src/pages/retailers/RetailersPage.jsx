import { PlaceholderPage } from '@/components/shared/PlaceholderPage'

export default function RetailersPage() {
  return (
    <PlaceholderPage
      title="Retailers"
      description="View retailers under your franchisee organization."
      breadcrumbs={[
        { label: 'Home', href: '/dashboard' },
        { label: 'Retailers' },
      ]}
      details="Retailer management and funding oversight will be implemented in a later phase."
    />
  )
}
