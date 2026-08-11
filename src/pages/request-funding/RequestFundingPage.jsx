import { PlaceholderPage } from '@/components/shared/PlaceholderPage'

export default function RequestFundingPage() {
  return (
    <PlaceholderPage
      title="Request Funding"
      description="Submit a funding request to your franchisee when wallet balance needs replenishment."
      breadcrumbs={[
        { label: 'Home', href: '/dashboard' },
        { label: 'Request Funding' },
      ]}
      details="Funding request submission and proof of payment upload will be implemented in a later phase."
    />
  )
}
