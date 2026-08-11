import { PlaceholderPage } from '@/components/shared/PlaceholderPage'

export default function FranchiseesPage() {
  return (
    <PlaceholderPage
      title="Franchisees"
      description="View franchisees under your sub-franchisee organization."
      breadcrumbs={[
        { label: 'Home', href: '/dashboard' },
        { label: 'Franchisees' },
      ]}
      details="Franchisee management and wallet oversight will be implemented in a later phase."
    />
  )
}
