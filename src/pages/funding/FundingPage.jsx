import { PlaceholderPage } from '@/components/shared/PlaceholderPage'

export default function FundingPage() {
  return (
    <PlaceholderPage
      title="Funding Requests & Transfers"
      description="Review funding requests and wallet transfers within your network."
      breadcrumbs={[
        { label: 'Home', href: '/dashboard' },
        { label: 'Funding Requests & Transfers' },
      ]}
      details="Funding request approval, proof of payment, and direct transfers will be implemented in a later phase."
    />
  )
}
