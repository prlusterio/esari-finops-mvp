import { PlaceholderPage } from '@/components/shared/PlaceholderPage'

export default function FranchiseesPage() {
  return (
    <PlaceholderPage
      title="Franchisees"
      description="View franchisees under your sub-franchisee organization and their Available Credits."
      breadcrumbs={[
        { label: 'Home', href: '/dashboard' },
        { label: 'Franchisees' },
      ]}
      details="Franchisee management will come later. For now, use Wallets for Available Credits and Internet Credits to release loads (cash + proof)."
    />
  )
}
