import { PlaceholderPage } from '@/components/shared/PlaceholderPage'

export default function RetailersPage() {
  return (
    <PlaceholderPage
      title="Retailers"
      description="View retailers under your franchisee organization and their Available Credits."
      breadcrumbs={[
        { label: 'Home', href: '/dashboard' },
        { label: 'Retailers' },
      ]}
      details="Retailer management will come later. For now, use Wallets for Available Credits and Internet Credits to release loads (cash + proof)."
    />
  )
}
